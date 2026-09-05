import { api } from './api';
import {
  enqueueSyncAction,
  getQueuedActions,
  updateSyncAction,
  removeSyncAction,
  getCachedMessages,
  cacheMessages,
  getCachedHomeFeed,
  cacheHomeFeed,
  getCachedEvents,
  cacheEvents,
  SyncAction
} from './offlineStorage';
import type { Message, Post, FamilyEvent, User } from '../types';

type SyncListener = () => void;

class SyncManager {
  private isProcessing = false;
  private listeners = new Set<SyncListener>();
  private lastSyncedAt: Date | null = null;

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.warn('[SyncManager] Listener error:', err);
      }
    });
  }

  public getLastSyncedAt(): Date | null {
    return this.lastSyncedAt;
  }

  // -----------------------------------------------------------
  // OPTIMISTIC ENQUEUE ACTIONS
  // -----------------------------------------------------------

  /**
   * Optimistically add a chat message and queue it for sync
   */
  public async queueSendMessage(
    userId: string,
    homeId: string,
    conversationId: string,
    payload: {
      content: string;
      replyToId?: string;
      mediaUrl?: string;
      mediaType?: 'image' | 'video' | 'file' | 'voice' | 'location' | 'poll' | 'announcement';
      mediaName?: string;
      mediaSize?: number;
      mediaDuration?: number;
      extraData?: string | object;
      isPinned?: boolean;
    },
    senderUser: User
  ): Promise<Message> {
    const clientMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    const optimisticMessage: Message = {
      id: clientMessageId,
      conversationId,
      senderId: userId,
      content: payload.content,
      replyToId: payload.replyToId,
      mediaUrl: payload.mediaUrl,
      mediaType: payload.mediaType,
      mediaName: payload.mediaName,
      mediaSize: payload.mediaSize,
      mediaDuration: payload.mediaDuration,
      extraData: typeof payload.extraData === 'object' ? JSON.stringify(payload.extraData) : payload.extraData,
      isPinned: payload.isPinned,
      createdAt: nowIso,
      status: 'pending',
      isOwn: true,
      sender: {
        id: senderUser.id,
        name: senderUser.name,
        email: senderUser.email,
        avatar: senderUser.avatar
      }
    };

    // Optimistically update cached messages
    const cached = (await getCachedMessages(userId, homeId, conversationId)) || [];
    await cacheMessages(userId, homeId, conversationId, [...cached, optimisticMessage]);

    // Enqueue
    const action: SyncAction = {
      id: clientMessageId,
      userId,
      homeId,
      actionType: 'send_message',
      payload: {
        conversationId,
        ...payload
      },
      createdAt: nowIso,
      status: 'pending',
      retryCount: 0
    };

    await enqueueSyncAction(action);
    this.notify();

    // If online, immediately try to sync
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.triggerSync(userId, homeId);
    }

    return optimisticMessage;
  }

  /**
   * Optimistically create a feed post and queue it for sync
   */
  public async queueCreatePost(
    userId: string,
    homeId: string,
    content: string,
    type: 'update' | 'photo' | 'announcement' | 'memory',
    imageUrl: string | undefined,
    authorUser: User
  ): Promise<Post> {
    const clientPostId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    const optimisticPost: Post = {
      id: clientPostId,
      homeId,
      authorId: userId,
      content,
      type,
      imageUrl,
      createdAt: nowIso,
      author: {
        id: authorUser.id,
        name: authorUser.name,
        email: authorUser.email,
        avatar: authorUser.avatar
      },
      comments: [],
      reactions: {}
    };

    // Optimistically update cached feed
    const cachedFeed = await getCachedHomeFeed(userId, homeId);
    if (cachedFeed) {
      const updatedPosts = [optimisticPost, ...(cachedFeed.posts || [])];
      const updatedNotices = type === 'announcement' ? [optimisticPost, ...(cachedFeed.notices || [])] : cachedFeed.notices;
      await cacheHomeFeed(userId, homeId, {
        ...cachedFeed,
        posts: updatedPosts,
        notices: updatedNotices
      });
    }

    // Enqueue
    const action: SyncAction = {
      id: clientPostId,
      userId,
      homeId,
      actionType: 'create_post',
      payload: {
        content,
        type,
        imageUrl
      },
      createdAt: nowIso,
      status: 'pending',
      retryCount: 0
    };

    await enqueueSyncAction(action);
    this.notify();

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.triggerSync(userId, homeId);
    }

    return optimisticPost;
  }

  /**
   * Optimistically add a comment and queue it for sync
   */
  public async queueAddComment(
    userId: string,
    homeId: string,
    postId: string,
    content: string,
    authorUser: User
  ): Promise<any> {
    const clientCommentId = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    const optimisticComment = {
      id: clientCommentId,
      postId,
      authorId: userId,
      content,
      createdAt: nowIso,
      author: {
        id: authorUser.id,
        name: authorUser.name,
        email: authorUser.email,
        avatar: authorUser.avatar
      }
    };

    // Optimistically update cached feed
    const cachedFeed = await getCachedHomeFeed(userId, homeId);
    if (cachedFeed && cachedFeed.posts) {
      const updatedPosts = cachedFeed.posts.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            comments: [...(p.comments || []), optimisticComment]
          };
        }
        return p;
      });
      await cacheHomeFeed(userId, homeId, {
        ...cachedFeed,
        posts: updatedPosts
      });
    }

    // Enqueue
    const action: SyncAction = {
      id: clientCommentId,
      userId,
      homeId,
      actionType: 'add_comment',
      payload: {
        postId,
        content
      },
      createdAt: nowIso,
      status: 'pending',
      retryCount: 0
    };

    await enqueueSyncAction(action);
    this.notify();

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.triggerSync(userId, homeId);
    }

    return optimisticComment;
  }

  /**
   * Optimistically toggle a reaction and queue it for sync
   */
  public async queueToggleReaction(
    userId: string,
    homeId: string,
    postId: string,
    emoji: string
  ): Promise<void> {
    const clientReactionId = `rx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    // Optimistically update cached feed reactions
    const cachedFeed = await getCachedHomeFeed(userId, homeId);
    if (cachedFeed && cachedFeed.posts) {
      const updatedPosts = cachedFeed.posts.map((p) => {
        if (p.id === postId) {
          const reactions = { ...(p.reactions || {}) };
          const cur = reactions[emoji] || { count: 0, userIds: [], hasReacted: false };
          if (cur.hasReacted) {
            reactions[emoji] = {
              count: Math.max(0, cur.count - 1),
              userIds: cur.userIds.filter((id) => id !== userId),
              hasReacted: false
            };
          } else {
            reactions[emoji] = {
              count: cur.count + 1,
              userIds: [...cur.userIds, userId],
              hasReacted: true
            };
          }
          return { ...p, reactions };
        }
        return p;
      });
      await cacheHomeFeed(userId, homeId, {
        ...cachedFeed,
        posts: updatedPosts
      });
    }

    // Enqueue
    const action: SyncAction = {
      id: clientReactionId,
      userId,
      homeId,
      actionType: 'toggle_reaction',
      payload: {
        postId,
        emoji
      },
      createdAt: nowIso,
      status: 'pending',
      retryCount: 0
    };

    await enqueueSyncAction(action);
    this.notify();

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.triggerSync(userId, homeId);
    }
  }

  /**
   * Optimistically create an event and queue it for sync
   */
  public async queueCreateEvent(
    userId: string,
    homeId: string,
    eventData: {
      title: string;
      description?: string;
      date: string;
      time?: string;
      endTime?: string;
      location?: string;
      reminder?: string;
      attendeeIds?: string[];
    },
    creatorUser: User
  ): Promise<FamilyEvent> {
    const clientEventId = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    const optimisticEvent: FamilyEvent = {
      id: clientEventId,
      homeId,
      creatorId: userId,
      title: eventData.title,
      description: eventData.description || '',
      date: eventData.date,
      time: eventData.time || '18:00',
      endTime: eventData.endTime,
      location: eventData.location,
      attendeeIds: [userId, ...(eventData.attendeeIds || [])],
      reminder: eventData.reminder || '24h',
      createdAt: nowIso,
      isAttending: true,
      userRsvp: 'going',
      creator: {
        id: creatorUser.id,
        name: creatorUser.name,
        email: creatorUser.email,
        avatar: creatorUser.avatar
      },
      rsvps: {
        going: [{ userId, name: creatorUser.name, avatar: creatorUser.avatar, status: 'going', updatedAt: nowIso }],
        maybe: [],
        declined: []
      }
    };

    // Optimistically update cached events
    const cachedEvents = (await getCachedEvents(userId, homeId)) || [];
    await cacheEvents(userId, homeId, [optimisticEvent, ...cachedEvents]);

    // Enqueue
    const action: SyncAction = {
      id: clientEventId,
      userId,
      homeId,
      actionType: 'create_event',
      payload: eventData,
      createdAt: nowIso,
      status: 'pending',
      retryCount: 0
    };

    await enqueueSyncAction(action);
    this.notify();

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.triggerSync(userId, homeId);
    }

    return optimisticEvent;
  }

  // -----------------------------------------------------------
  // PROCESS QUEUE & SYNCHRONIZE
  // -----------------------------------------------------------

  public async triggerSync(userId: string, homeId?: string): Promise<void> {
    if (this.isProcessing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isProcessing = true;
    this.notify();

    try {
      const actions = await getQueuedActions(userId, homeId);

      for (const action of actions) {
        // Skip permanently failed or currently syncing items
        if (action.isPermanentFailure) continue;

        await updateSyncAction(action.id, { status: 'syncing' });
        this.notify();

        try {
          await this.executeAction(action);
          // Synced successfully: delete from queue
          await removeSyncAction(action.id);
          this.notify();
        } catch (err: any) {
          const status = err?.status || err?.response?.status;
          const msg = err?.message || 'Synchronization failed';

          if (status === 401) {
            // Session expired
            await updateSyncAction(action.id, {
              status: 'failed',
              errorMessage: 'Session expired. Please log in again.',
              isPermanentFailure: true
            });
            this.notify();
            // Halt processing rest of queue to avoid repeated 401s
            break;
          } else if (status === 400 || status === 403 || status === 404) {
            // Permanent validation or permission error
            await updateSyncAction(action.id, {
              status: 'failed',
              errorMessage: msg,
              isPermanentFailure: true
            });
            this.notify();
          } else {
            // Network or transient server error
            const newRetryCount = (action.retryCount || 0) + 1;
            await updateSyncAction(action.id, {
              status: newRetryCount >= 5 ? 'failed' : 'pending',
              retryCount: newRetryCount,
              errorMessage: msg
            });
            this.notify();
          }
        }
      }

      // After synchronizing queued actions, reconcile latest server state
      if (homeId) {
        await this.reconcileHome(userId, homeId);
      }

      this.lastSyncedAt = new Date();
    } catch (err) {
      console.warn('[SyncManager] Sync loop error:', err);
    } finally {
      this.isProcessing = false;
      this.notify();
    }
  }

  private async executeAction(action: SyncAction): Promise<void> {
    switch (action.actionType) {
      case 'send_message': {
        const { conversationId, ...payload } = action.payload;
        await api.sendMessage(action.homeId, conversationId, {
          ...payload,
          clientMessageId: action.id
        });
        break;
      }
      case 'create_post': {
        const { content, type, imageUrl } = action.payload;
        await api.createPost(action.homeId, content, type, imageUrl, action.id);
        break;
      }
      case 'add_comment': {
        const { postId, content } = action.payload;
        await api.addComment(action.homeId, postId, content, action.id);
        break;
      }
      case 'toggle_reaction': {
        const { postId, emoji } = action.payload;
        await api.toggleReaction(action.homeId, postId, emoji);
        break;
      }
      case 'create_event': {
        await api.createEvent(action.homeId, {
          ...action.payload,
          clientEventId: action.id
        });
        break;
      }
      case 'update_event': {
        const { eventId, updates } = action.payload;
        await api.updateEvent(action.homeId, eventId, updates);
        break;
      }
      default:
        console.warn('[SyncManager] Unknown action type:', (action as any).actionType);
    }
  }

  /**
   * Lightweight server reconciliation: refresh dashboard and conversations
   */
  public async reconcileHome(userId: string, homeId: string): Promise<void> {
    try {
      const syncRes = await api.getHomeSync(homeId);
      if (syncRes && syncRes.dashboard) {
        await cacheHomeFeed(userId, homeId, syncRes.dashboard);
      }
      if (syncRes && syncRes.conversations) {
        const { cacheConversations } = await import('./offlineStorage');
        await cacheConversations(userId, homeId, syncRes.conversations);
      }
    } catch (err) {
      // Fallback to standard dashboard if sync endpoint fails
      try {
        const dash = await api.getHomeDashboard(homeId);
        if (dash) {
          await cacheHomeFeed(userId, homeId, dash);
        }
      } catch {
        // Non-blocking
      }
    }
  }

  /**
   * Retry failed actions for a user
   */
  public async retryFailedActions(userId: string, homeId?: string): Promise<void> {
    const actions = await getQueuedActions(userId, homeId);
    for (const a of actions) {
      if (a.status === 'failed') {
        await updateSyncAction(a.id, {
          status: 'pending',
          retryCount: 0,
          isPermanentFailure: false,
          errorMessage: undefined
        });
      }
    }
    this.notify();
    await this.triggerSync(userId, homeId);
  }

  public isSyncProcessing(): boolean {
    return this.isProcessing;
  }
}

export const syncManager = new SyncManager();
