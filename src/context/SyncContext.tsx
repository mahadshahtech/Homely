import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { syncManager } from '../services/syncManager';
import { getQueuedActions, SyncAction } from '../services/offlineStorage';
import { realtimeChat } from '../services/realtimeChat';
import { useAuth } from './AuthContext';

export type ConnectionState = 'online' | 'offline' | 'reconnecting';
export type SyncStatus = 'synced' | 'offline' | 'syncing' | 'pending' | 'failed';

interface SyncContextType {
  connectionState: ConnectionState;
  syncStatus: SyncStatus;
  isOffline: boolean;
  pendingCount: number;
  failedCount: number;
  pendingActions: SyncAction[];
  lastSyncedAt: Date | null;
  syncNow: () => Promise<void>;
  retryFailed: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, activeHome } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine ? 'online' : 'offline';
    }
    return 'online';
  });

  const [actions, setActions] = useState<SyncAction[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => syncManager.getLastSyncedAt());

  const refreshActions = useCallback(async () => {
    if (!user) {
      setActions([]);
      return;
    }
    try {
      const list = await getQueuedActions(user.id, activeHome?.id);
      setActions(list);
      setLastSyncedAt(syncManager.getLastSyncedAt());
    } catch {
      setActions([]);
    }
  }, [user?.id, activeHome?.id]);

  // Subscribe to SyncManager changes
  useEffect(() => {
    refreshActions();
    const unsubscribe = syncManager.subscribe(() => {
      refreshActions();
    });
    return unsubscribe;
  }, [refreshActions]);

  // Online / offline event listeners
  useEffect(() => {
    const handleOnline = async () => {
      setConnectionState('reconnecting');
      // Reconnect websocket
      realtimeChat.connect();

      if (user) {
        await syncManager.triggerSync(user.id, activeHome?.id);
      }
      setConnectionState('online');
    };

    const handleOffline = () => {
      setConnectionState('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user?.id, activeHome?.id]);

  // Monitor realtimeChat status
  useEffect(() => {
    const unsub = realtimeChat.onStatusChange((status) => {
      if (status === 'connected' && navigator.onLine) {
        setConnectionState('online');
      } else if (status === 'connecting' && navigator.onLine) {
        setConnectionState('reconnecting');
      } else if (!navigator.onLine) {
        setConnectionState('offline');
      }
    });
    return unsub;
  }, []);

  const pendingCount = useMemo(() => {
    return actions.filter((a) => a.status === 'pending' || a.status === 'syncing').length;
  }, [actions]);

  const failedCount = useMemo(() => {
    return actions.filter((a) => a.status === 'failed').length;
  }, [actions]);

  const syncStatus: SyncStatus = useMemo(() => {
    if (connectionState === 'offline') return 'offline';
    if (syncManager.isSyncProcessing()) return 'syncing';
    if (failedCount > 0) return 'failed';
    if (pendingCount > 0) return 'pending';
    return 'synced';
  }, [connectionState, failedCount, pendingCount]);

  const syncNow = useCallback(async () => {
    if (!user) return;
    await syncManager.triggerSync(user.id, activeHome?.id);
    await refreshActions();
  }, [user?.id, activeHome?.id, refreshActions]);

  const retryFailed = useCallback(async () => {
    if (!user) return;
    await syncManager.retryFailedActions(user.id, activeHome?.id);
    await refreshActions();
  }, [user?.id, activeHome?.id, refreshActions]);

  return (
    <SyncContext.Provider
      value={{
        connectionState,
        syncStatus,
        isOffline: connectionState === 'offline',
        pendingCount,
        failedCount,
        pendingActions: actions,
        lastSyncedAt,
        syncNow,
        retryFailed
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = (): SyncContextType => {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return ctx;
};
