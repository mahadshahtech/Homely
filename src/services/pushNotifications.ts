import { api } from './api';
import type { PushDeviceSubscription } from '../types';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getDeviceDetails(): { label: string; platform: 'web_push' | 'android' } {
  if (typeof window === 'undefined') {
    return { label: 'Unknown Device', platform: 'web_push' };
  }

  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;

  let os = 'Desktop';
  if (isAndroid) os = 'Android';
  else if (isIOS) os = 'iOS';
  else if (/Mac/i.test(ua)) os = 'macOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Chrome/i.test(ua) && !/Edge|Edg|OPR/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Edge|Edg/i.test(ua)) browser = 'Edge';

  const typeStr = isStandalone ? ' (PWA)' : '';
  const label = `${os} ${browser}${typeStr}`;

  return {
    label,
    platform: isAndroid ? 'android' : 'web_push'
  };
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    return registration;
  } catch (err) {
    console.warn('[Push] Service worker registration error:', err);
    return null;
  }
}

export async function getCurrentDeviceSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch (err) {
    console.warn('[Push] Error getting current device subscription:', err);
    return null;
  }
}

export async function subscribeCurrentDevice(): Promise<{
  success: boolean;
  device?: PushDeviceSubscription;
  error?: string;
}> {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      error: 'Push notifications are not supported in this browser or environment'
    };
  }

  try {
    // 1. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error: permission === 'denied'
          ? 'Notification permission was denied in your browser settings.'
          : 'Notification permission was dismissed.'
      };
    }

    // 2. Ensure Service Worker registration
    let reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) {
      reg = await registerServiceWorker();
    }
    if (!reg) {
      return {
        success: false,
        error: 'Failed to initialize service worker for push notifications.'
      };
    }

    // Wait until service worker is active
    await navigator.serviceWorker.ready;

    // 3. Fetch server VAPID public key
    const keyRes = await api.getPushVapidPublicKey();
    if (!keyRes.publicKey) {
      return {
        success: false,
        error: 'VAPID public key unavailable from server.'
      };
    }

    // 4. Check if subscription already exists or create a new one
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(keyRes.publicKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any
      });
    }

    // 5. Serialize subscription keys
    const subJson = subscription.toJSON();
    const p256dh = subJson.keys?.p256dh;
    const auth = subJson.keys?.auth;

    if (!p256dh || !auth) {
      return {
        success: false,
        error: 'Subscription generated without necessary cryptographic keys.'
      };
    }

    const { label, platform } = getDeviceDetails();

    // 6. Register with backend
    const regRes = await api.registerPushDevice({
      endpoint: subscription.endpoint,
      keys: { p256dh, auth },
      deviceLabel: label,
      platform
    });

    return {
      success: true,
      device: regRes.device
    };
  } catch (err: any) {
    console.error('[Push] subscribeCurrentDevice error:', err);
    return {
      success: false,
      error: err.message || 'Failed to subscribe device for push notifications.'
    };
  }
}

export async function unsubscribeCurrentDevice(): Promise<{ success: boolean; error?: string }> {
  if (!isPushNotificationSupported()) return { success: true };

  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return { success: true };

    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      // Unregister on backend
      try {
        await api.unsubscribePushDevice(subscription.endpoint);
      } catch (err) {
        console.warn('[Push] Error unregistering on server:', err);
      }
      // Unsubscribe locally
      await subscription.unsubscribe();
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Push] unsubscribeCurrentDevice error:', err);
    return { success: false, error: err.message };
  }
}
