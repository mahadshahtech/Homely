import type { User, Home, HomeMember, UserRole, Post, Conversation, Message, FamilyEvent, FamilyMemory } from '../types';

export type SyncActionType =
  | 'send_message'
  | 'create_post'
  | 'add_comment'
  | 'toggle_reaction'
  | 'create_event'
  | 'update_event';

export type SyncActionStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export interface SyncAction {
  id: string; // client idempotency key, e.g. op_send_message_1710000000000_abc123
  userId: string;
  homeId: string;
  actionType: SyncActionType;
  payload: any;
  createdAt: string;
  status: SyncActionStatus;
  retryCount: number;
  errorMessage?: string;
  isPermanentFailure?: boolean;
}

const DB_NAME = 'homely_offline_db';
const DB_VERSION = 1;

// Object store names
const STORES = {
  USER_PROFILES: 'user_profiles',
  USER_HOMES: 'user_homes',
  HOME_DETAILS: 'home_details',
  HOME_FEED: 'home_feed',
  CONVERSATIONS: 'home_conversations',
  MESSAGES: 'conversation_messages',
  EVENTS: 'home_events',
  MEMORIES: 'home_memories',
  SYNC_QUEUE: 'sync_queue'
} as const;

// In-memory fallback if IndexedDB is unavailable in a sandboxed iframe
const memoryFallback = new Map<string, any>();

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

export function openOfflineDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. User profiles (Key: userId)
        if (!db.objectStoreNames.contains(STORES.USER_PROFILES)) {
          db.createObjectStore(STORES.USER_PROFILES, { keyPath: 'userId' });
        }

        // 2. User homes list (Key: userId)
        if (!db.objectStoreNames.contains(STORES.USER_HOMES)) {
          db.createObjectStore(STORES.USER_HOMES, { keyPath: 'userId' });
        }

        // 3. Home details & members (Key: `${userId}:${homeId}`)
        if (!db.objectStoreNames.contains(STORES.HOME_DETAILS)) {
          db.createObjectStore(STORES.HOME_DETAILS, { keyPath: 'key' });
        }

        // 4. Home feed & dashboard (Key: `${userId}:${homeId}`)
        if (!db.objectStoreNames.contains(STORES.HOME_FEED)) {
          db.createObjectStore(STORES.HOME_FEED, { keyPath: 'key' });
        }

        // 5. Conversations list (Key: `${userId}:${homeId}`)
        if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
          db.createObjectStore(STORES.CONVERSATIONS, { keyPath: 'key' });
        }

        // 6. Messages per conversation (Key: `${userId}:${homeId}:${conversationId}`)
        if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
          db.createObjectStore(STORES.MESSAGES, { keyPath: 'key' });
        }

        // 7. Events (Key: `${userId}:${homeId}`)
        if (!db.objectStoreNames.contains(STORES.EVENTS)) {
          db.createObjectStore(STORES.EVENTS, { keyPath: 'key' });
        }

        // 8. Memories (Key: `${userId}:${homeId}`)
        if (!db.objectStoreNames.contains(STORES.MEMORIES)) {
          db.createObjectStore(STORES.MEMORIES, { keyPath: 'key' });
        }

        // 9. Sync queue (Key: id)
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
          queueStore.createIndex('by_user_home', ['userId', 'homeId'], { unique: false });
          queueStore.createIndex('by_status', 'status', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('[OfflineStorage] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn('[OfflineStorage] IndexedDB upgrade blocked by another tab');
      };
    } catch (err) {
      console.warn('[OfflineStorage] Error initializing IndexedDB:', err);
      reject(err);
    }
  });

  return dbPromise;
}

// Generic transaction helper
async function performTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest | Promise<T>
): Promise<T> {
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      let req: any;
      try {
        req = callback(store);
      } catch (err) {
        reject(err);
        return;
      }

      if (req && 'onsuccess' in req) {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }

      tx.oncomplete = () => {
        if (!req || !('onsuccess' in req)) {
          resolve(undefined as unknown as T);
        }
      };

      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // Fallback in memory
    const fallbackKey = `${storeName}:memory`;
    return memoryFallback.get(fallbackKey) as T;
  }
}

// -------------------------------------------------------------
// USER & HOMES CACHE
// -------------------------------------------------------------

export async function cacheUserProfile(user: User): Promise<void> {
  if (!user || !user.id) return;
  try {
    await performTx(STORES.USER_PROFILES, 'readwrite', (store) => {
      return store.put({
        userId: user.id,
        user,
        cachedAt: new Date().toISOString()
      });
    });
  } catch (err) {
    memoryFallback.set(`user:${user.id}`, user);
  }
}

export async function getCachedUserProfile(userId?: string): Promise<User | null> {
  try {
    if (userId) {
      const res = await performTx<{ userId: string; user: User } | undefined>(
        STORES.USER_PROFILES,
        'readonly',
        (store) => store.get(userId)
      );
      if (res?.user) return res.user;
    } else {
      // Get the most recently cached user
      const db = await openOfflineDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction(STORES.USER_PROFILES, 'readonly');
        const store = tx.objectStore(STORES.USER_PROFILES);
        const req = store.openCursor(null, 'prev');
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor && cursor.value && cursor.value.user) {
            resolve(cursor.value.user);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    }
  } catch {
    if (userId) return memoryFallback.get(`user:${userId}`) || null;
  }
  return null;
}

export async function cacheUserHomes(userId: string, homes: Home[]): Promise<void> {
  if (!userId) return;
  try {
    await performTx(STORES.USER_HOMES, 'readwrite', (store) => {
      return store.put({
        userId,
        homes,
        cachedAt: new Date().toISOString()
      });
    });
  } catch {
    memoryFallback.set(`homes:${userId}`, homes);
  }
}

export async function getCachedUserHomes(userId: string): Promise<Home[] | null> {
  if (!userId) return null;
  try {
    const res = await performTx<{ userId: string; homes: Home[] } | undefined>(
      STORES.USER_HOMES,
      'readonly',
      (store) => store.get(userId)
    );
    return res?.homes || null;
  } catch {
    return memoryFallback.get(`homes:${userId}`) || null;
  }
}

export async function cacheHomeDetails(
  userId: string,
  homeId: string,
  data: { home: Home; role: UserRole; members?: HomeMember[] }
): Promise<void> {
  if (!userId || !homeId) return;
  const key = `${userId}:${homeId}`;
  try {
    await performTx(STORES.HOME_DETAILS, 'readwrite', (store) => {
      return store.put({
        key,
        userId,
        homeId,
        ...data,
        cachedAt: new Date().toISOString()
      });
    });
  } catch {
    memoryFallback.set(`home_details:${key}`, data);
  }
}

export async function getCachedHomeDetails(
  userId: string,
  homeId: string
): Promise<{ home: Home; role: UserRole; members?: HomeMember[] } | null> {
  if (!userId || !homeId) return null;
  const key = `${userId}:${homeId}`;
  try {
    const res = await performTx<any>(STORES.HOME_DETAILS, 'readonly', (store) => store.get(key));
    if (res?.home) {
      return {
        home: res.home,
        role: res.role,
        members: res.members
      };
    }
    return null;
  } catch {
    return memoryFallback.get(`home_details:${key}`) || null;
  }
}

// -------------------------------------------------------------
// HOME FEED & DASHBOARD CACHE (Partitioned by userId + homeId)
// -------------------------------------------------------------

export interface CachedDashboardData {
  posts: Post[];
  notices: Post[];
  upcomingEvents: FamilyEvent[];
  memories: FamilyMemory[];
  members: HomeMember[];
  recentActivity: any[];
  cachedAt: string;
}

export async function cacheHomeFeed(
  userId: string,
  homeId: string,
  dashboard: {
    posts?: Post[];
    notices?: Post[];
    upcomingEvents?: FamilyEvent[];
    memories?: FamilyMemory[];
    members?: HomeMember[];
    recentActivity?: any[];
  }
): Promise<void> {
  if (!userId || !homeId) return;
  const key = `${userId}:${homeId}`;
  try {
    // Limit cache size: keep up to 40 posts and 20 recent activities to save storage
    const prunedPosts = (dashboard.posts || []).slice(0, 40);
    const prunedNotices = (dashboard.notices || []).slice(0, 10);
    const prunedEvents = (dashboard.upcomingEvents || []).slice(0, 30);
    const prunedMemories = (dashboard.memories || []).slice(0, 30);
    const prunedActivity = (dashboard.recentActivity || []).slice(0, 20);

    await performTx(STORES.HOME_FEED, 'readwrite', (store) => {
      return store.put({
        key,
        userId,
        homeId,
        posts: prunedPosts,
        notices: prunedNotices,
        upcomingEvents: prunedEvents,
        memories: prunedMemories,
        members: dashboard.members || [],
        recentActivity: prunedActivity,
        cachedAt: new Date().toISOString()
      });
    });
  } catch {
    memoryFallback.set(`feed:${key}`, dashboard);
  }
}

export async function getCachedHomeFeed(
  userId: string,
  homeId: string
): Promise<CachedDashboardData | null> {
  if (!userId || !homeId) return null;
  const key = `${userId}:${homeId}`;
  try {
    const res = await performTx<CachedDashboardData | undefined>(
      STORES.HOME_FEED,
      'readonly',
      (store) => store.get(key)
    );
    return res || null;
  } catch {
    return memoryFallback.get(`feed:${key}`) || null;
  }
}

// -------------------------------------------------------------
// CHAT CONVERSATIONS & MESSAGES CACHE (Partitioned by userId + homeId)
// -------------------------------------------------------------

export async function cacheConversations(
  userId: string,
  homeId: string,
  conversations: Conversation[]
): Promise<void> {
  if (!userId || !homeId) return;
  const key = `${userId}:${homeId}`;
  try {
    await performTx(STORES.CONVERSATIONS, 'readwrite', (store) => {
      return store.put({
        key,
        userId,
        homeId,
        conversations: (conversations || []).slice(0, 50),
        cachedAt: new Date().toISOString()
      });
    });
  } catch {
    memoryFallback.set(`conversations:${key}`, conversations);
  }
}

export async function getCachedConversations(
  userId: string,
  homeId: string
): Promise<Conversation[] | null> {
  if (!userId || !homeId) return null;
  const key = `${userId}:${homeId}`;
  try {
    const res = await performTx<{ conversations: Conversation[] } | undefined>(
      STORES.CONVERSATIONS,
      'readonly',
      (store) => store.get(key)
    );
    return res?.conversations || null;
  } catch {
    return memoryFallback.get(`conversations:${key}`) || null;
  }
}

export async function cacheMessages(
  userId: string,
  homeId: string,
  conversationId: string,
  messages: Message[]
): Promise<void> {
  if (!userId || !homeId || !conversationId) return;
  const key = `${userId}:${homeId}:${conversationId}`;
  try {
    // Keep up to 100 recent messages
    const trimmed = (messages || []).slice(-100);
    await performTx(STORES.MESSAGES, 'readwrite', (store) => {
      return store.put({
        key,
        userId,
        homeId,
        conversationId,
        messages: trimmed,
        cachedAt: new Date().toISOString()
      });
    });
  } catch {
    memoryFallback.set(`messages:${key}`, messages);
  }
}

export async function getCachedMessages(
  userId: string,
  homeId: string,
  conversationId: string
): Promise<Message[] | null> {
  if (!userId || !homeId || !conversationId) return null;
  const key = `${userId}:${homeId}:${conversationId}`;
  try {
    const res = await performTx<{ messages: Message[] } | undefined>(
      STORES.MESSAGES,
      'readonly',
      (store) => store.get(key)
    );
    return res?.messages || null;
  } catch {
    return memoryFallback.get(`messages:${key}`) || null;
  }
}

// -------------------------------------------------------------
// EVENTS & MEMORIES CACHE
// -------------------------------------------------------------

export async function cacheEvents(
  userId: string,
  homeId: string,
  events: FamilyEvent[]
): Promise<void> {
  if (!userId || !homeId) return;
  const key = `${userId}:${homeId}`;
  try {
    await performTx(STORES.EVENTS, 'readwrite', (store) => {
      return store.put({
        key,
        userId,
        homeId,
        events: (events || []).slice(0, 60),
        cachedAt: new Date().toISOString()
      });
    });
  } catch {
    memoryFallback.set(`events:${key}`, events);
  }
}

export async function getCachedEvents(
  userId: string,
  homeId: string
): Promise<FamilyEvent[] | null> {
  if (!userId || !homeId) return null;
  const key = `${userId}:${homeId}`;
  try {
    const res = await performTx<{ events: FamilyEvent[] } | undefined>(
      STORES.EVENTS,
      'readonly',
      (store) => store.get(key)
    );
    return res?.events || null;
  } catch {
    return memoryFallback.get(`events:${key}`) || null;
  }
}

export async function cacheMemories(
  userId: string,
  homeId: string,
  memories: FamilyMemory[]
): Promise<void> {
  if (!userId || !homeId) return;
  const key = `${userId}:${homeId}`;
  try {
    await performTx(STORES.MEMORIES, 'readwrite', (store) => {
      return store.put({
        key,
        userId,
        homeId,
        memories: (memories || []).slice(0, 50),
        cachedAt: new Date().toISOString()
      });
    });
  } catch {
    memoryFallback.set(`memories:${key}`, memories);
  }
}

export async function getCachedMemories(
  userId: string,
  homeId: string
): Promise<FamilyMemory[] | null> {
  if (!userId || !homeId) return null;
  const key = `${userId}:${homeId}`;
  try {
    const res = await performTx<{ memories: FamilyMemory[] } | undefined>(
      STORES.MEMORIES,
      'readonly',
      (store) => store.get(key)
    );
    return res?.memories || null;
  } catch {
    return memoryFallback.get(`memories:${key}`) || null;
  }
}

// -------------------------------------------------------------
// SYNC ACTION QUEUE (IndexedDB)
// -------------------------------------------------------------

export async function enqueueSyncAction(action: SyncAction): Promise<void> {
  try {
    await performTx(STORES.SYNC_QUEUE, 'readwrite', (store) => {
      return store.put(action);
    });
  } catch (err) {
    const inMemList: SyncAction[] = memoryFallback.get('sync_queue') || [];
    inMemList.push(action);
    memoryFallback.set('sync_queue', inMemList);
  }
}

export async function getQueuedActions(userId: string, homeId?: string): Promise<SyncAction[]> {
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.getAll();

      req.onsuccess = () => {
        const all: SyncAction[] = req.result || [];
        const filtered = all.filter(a => {
          if (a.userId !== userId) return false;
          if (homeId && a.homeId !== homeId) return false;
          return true;
        });
        // Sort by creation time
        filtered.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
        resolve(filtered);
      };

      req.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    const inMemList: SyncAction[] = memoryFallback.get('sync_queue') || [];
    return inMemList.filter(a => a.userId === userId && (!homeId || a.homeId === homeId));
  }
}

export async function updateSyncAction(
  id: string,
  updates: Partial<SyncAction>
): Promise<void> {
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const existing: SyncAction | undefined = getReq.result;
        if (!existing) {
          resolve();
          return;
        }

        const merged: SyncAction = { ...existing, ...updates };
        const putReq = store.put(merged);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    const inMemList: SyncAction[] = memoryFallback.get('sync_queue') || [];
    const idx = inMemList.findIndex(a => a.id === id);
    if (idx >= 0) {
      inMemList[idx] = { ...inMemList[idx], ...updates };
      memoryFallback.set('sync_queue', inMemList);
    }
  }
}

export async function removeSyncAction(id: string): Promise<void> {
  try {
    await performTx(STORES.SYNC_QUEUE, 'readwrite', (store) => {
      return store.delete(id);
    });
  } catch {
    const inMemList: SyncAction[] = memoryFallback.get('sync_queue') || [];
    memoryFallback.set('sync_queue', inMemList.filter(a => a.id !== id));
  }
}

export async function clearAllHomeCache(userId: string, homeId: string): Promise<void> {
  try {
    const key = `${userId}:${homeId}`;
    await Promise.allSettled([
      performTx(STORES.HOME_DETAILS, 'readwrite', (s) => s.delete(key)),
      performTx(STORES.HOME_FEED, 'readwrite', (s) => s.delete(key)),
      performTx(STORES.CONVERSATIONS, 'readwrite', (s) => s.delete(key)),
      performTx(STORES.EVENTS, 'readwrite', (s) => s.delete(key)),
      performTx(STORES.MEMORIES, 'readwrite', (s) => s.delete(key))
    ]);
  } catch {
    // ignore
  }
}
