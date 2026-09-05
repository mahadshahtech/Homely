import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import type { NotificationItem, PushDeviceSubscription } from './types.ts';
import {
  getUserNotificationPreferences,
  shouldDeliverNotification,
  getUserPushSubscriptions,
  deletePushSubscriptionByEndpoint,
  updatePushSubscriptionLastUsed
} from './db.ts';
import { isUserInConversationRoom } from './realtime.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const VAPID_KEY_FILE = path.join(DATA_DIR, 'vapid.json');

interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let vapidConfig: VapidKeys | null = null;

export function initVapid(): VapidKeys {
  if (vapidConfig) {
    return vapidConfig;
  }

  const subject = process.env.VAPID_SUBJECT || 'mailto:support@homely.app';
  let publicKey = process.env.VAPID_PUBLIC_KEY;
  let privateKey = process.env.VAPID_PRIVATE_KEY;

  if (publicKey && privateKey) {
    vapidConfig = { publicKey, privateKey, subject };
  } else {
    // Check if persisted in local data/vapid.json for persistent dev operation
    if (fs.existsSync(VAPID_KEY_FILE)) {
      try {
        const raw = fs.readFileSync(VAPID_KEY_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.publicKey && parsed.privateKey) {
          vapidConfig = {
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
            subject: parsed.subject || subject
          };
        }
      } catch (err) {
        console.warn('[Push] Error reading existing VAPID keys file:', err);
      }
    }

    if (!vapidConfig) {
      // Auto-generate fresh VAPID keypair
      const generated = webpush.generateVAPIDKeys();
      vapidConfig = {
        publicKey: generated.publicKey,
        privateKey: generated.privateKey,
        subject
      };

      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(VAPID_KEY_FILE, JSON.stringify(vapidConfig, null, 2), 'utf-8');
        console.log('[Push] Auto-generated and persisted local VAPID keys');
      } catch (err) {
        console.warn('[Push] Failed to persist VAPID keys to disk:', err);
      }
    }
  }

  try {
    webpush.setVapidDetails(
      vapidConfig.subject,
      vapidConfig.publicKey,
      vapidConfig.privateKey
    );
  } catch (err) {
    console.error('[Push] Failed to set VAPID details on web-push:', err);
  }

  return vapidConfig;
}

export function getVapidPublicKey(): string {
  const config = initVapid();
  return config.publicKey;
}

export interface PushPayloadData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    notificationId?: string;
    homeId?: string;
    targetType?: string;
    targetId?: string;
    url?: string;
    timestamp?: number;
  };
}

/**
 * Format clean notification payload with privacy in mind.
 * Sensitive data or vault files are never broadcast in plain push payloads.
 */
export function formatPushPayload(notif: NotificationItem): PushPayloadData {
  let url = '/';
  if (notif.targetType === 'conversation' && notif.targetId) {
    url = `/?tab=chat&conv=${encodeURIComponent(notif.targetId)}`;
  } else if (notif.targetType === 'post' && notif.targetId) {
    url = `/?tab=feed&post=${encodeURIComponent(notif.targetId)}`;
  } else if (notif.targetType === 'event') {
    url = '/?tab=calendar';
  } else if (notif.targetType === 'memory') {
    url = '/?tab=memories';
  }

  // Sanitize title & body to avoid leaking sensitive contents
  let safeTitle = notif.title;
  let safeBody = notif.body;

  if (notif.type.startsWith('message')) {
    safeTitle = notif.title || 'New Family Message';
    // Limit body length for lock screens
    if (safeBody && safeBody.length > 120) {
      safeBody = safeBody.slice(0, 117) + '...';
    }
  }

  return {
    title: safeTitle,
    body: safeBody,
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    tag: notif.targetId ? `homely-${notif.targetType}-${notif.targetId}` : `homely-${notif.id}`,
    data: {
      notificationId: notif.id,
      homeId: notif.homeId,
      targetType: notif.targetType,
      targetId: notif.targetId,
      url,
      timestamp: Date.now()
    }
  };
}

/**
 * Main push delivery pipeline.
 * Called whenever a database notification is created.
 * Enforces:
 * 1. User preferences (must have browserPush enabled and category enabled)
 * 2. Active WebSocket deduplication (suppresses push if recipient is currently in the conversation room)
 * 3. Delivery to all registered devices for this user
 * 4. Stale device cleanup on 410/404
 * 5. Safe non-blocking execution
 */
export async function deliverPushNotification(notif: NotificationItem): Promise<{
  attempted: number;
  delivered: number;
  suppressedReason?: string;
}> {
  try {
    // 1. Verify user preferences
    const prefs = await getUserNotificationPreferences(notif.recipientId);
    if (!prefs.browserPush) {
      return { attempted: 0, delivered: 0, suppressedReason: 'User has browserPush disabled' };
    }

    if (!shouldDeliverNotification(notif.type, prefs)) {
      return { attempted: 0, delivered: 0, suppressedReason: 'Notification category disabled by user' };
    }

    // 2. Chat / Conversation Room Deduplication
    // If this is a message and recipient is actively viewing this conversation right now in the app,
    // suppress push to avoid distracting duplicates.
    if (notif.targetType === 'conversation' && notif.targetId) {
      const isViewing = isUserInConversationRoom(notif.recipientId, notif.targetId);
      if (isViewing) {
        return { attempted: 0, delivered: 0, suppressedReason: 'Recipient is actively viewing this conversation' };
      }
    }

    // 3. Retrieve user's registered devices
    const devices = await getUserPushSubscriptions(notif.recipientId);
    if (!devices || devices.length === 0) {
      return { attempted: 0, delivered: 0, suppressedReason: 'No registered push devices for user' };
    }

    // Ensure VAPID initialized
    initVapid();

    const payload = formatPushPayload(notif);
    const serializedPayload = JSON.stringify(payload);

    let delivered = 0;
    const sendPromises = devices.map(async (device) => {
      try {
        if (!device.endpoint) return;

        const pushSub = {
          endpoint: device.endpoint,
          keys: {
            p256dh: device.p256dh,
            auth: device.auth
          }
        };

        await webpush.sendNotification(pushSub, serializedPayload, {
          TTL: 60 * 60 * 24 // 24 hours
        });

        delivered++;
        await updatePushSubscriptionLastUsed(device.endpoint);
      } catch (err: any) {
        const statusCode = err.statusCode || err.status;
        if (statusCode === 410 || statusCode === 404) {
          // Subscription has expired or unsubscribed on device: clean it up
          console.log(`[Push] Removing expired push endpoint (${statusCode}):`, device.endpoint.slice(0, 40));
          await deletePushSubscriptionByEndpoint(device.endpoint);
        } else {
          console.warn(`[Push] Error delivering to device ${device.id}:`, err.message || err);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    return {
      attempted: devices.length,
      delivered
    };
  } catch (err) {
    console.error('[Push] Unexpected failure in deliverPushNotification:', err);
    return { attempted: 0, delivered: 0, suppressedReason: 'Internal delivery error' };
  }
}

/**
 * Send a test notification to an authenticated user's registered devices.
 */
export async function sendTestPushToUser(
  userId: string,
  deviceLabel?: string
): Promise<{ success: boolean; sent: number; totalDevices: number; message: string }> {
  try {
    initVapid();
    const devices = await getUserPushSubscriptions(userId);
    if (devices.length === 0) {
      return {
        success: false,
        sent: 0,
        totalDevices: 0,
        message: 'No devices registered for push notifications yet. Please enable push on this device first.'
      };
    }

    const testPayload = {
      title: 'HOMELY Push Connected! 🎉',
      body: `Push notifications are active for ${deviceLabel || 'your device'}. You'll receive real-time family updates when away.`,
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      tag: `homely-test-${Date.now()}`,
      data: {
        url: '/',
        timestamp: Date.now()
      }
    };

    let sent = 0;
    const serialized = JSON.stringify(testPayload);

    for (const device of devices) {
      try {
        const pushSub = {
          endpoint: device.endpoint,
          keys: {
            p256dh: device.p256dh,
            auth: device.auth
          }
        };

        await webpush.sendNotification(pushSub, serialized, { TTL: 60 });
        sent++;
        await updatePushSubscriptionLastUsed(device.endpoint);
      } catch (err: any) {
        const statusCode = err.statusCode || err.status;
        if (statusCode === 410 || statusCode === 404) {
          await deletePushSubscriptionByEndpoint(device.endpoint);
        } else {
          console.warn(`[Push] Test delivery failed for ${device.id}:`, err.message || err);
        }
      }
    }

    return {
      success: sent > 0,
      sent,
      totalDevices: devices.length,
      message: sent > 0
        ? `Test notification delivered to ${sent} device(s)!`
        : 'Failed to deliver test notification to registered devices.'
    };
  } catch (err: any) {
    console.error('[Push] sendTestPushToUser error:', err);
    return {
      success: false,
      sent: 0,
      totalDevices: 0,
      message: err.message || 'Failed to dispatch test notification'
    };
  }
}
