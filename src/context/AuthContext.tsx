import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User, Home, UserRole } from '../types';
import { api, getStoredToken } from '../services/api';
import { syncPendingSubscriptionRenewal } from '../services/pushNotifications';
import { realtimeChat, type RealtimeStatus } from '../services/realtimeChat';
import {
  cacheUserProfile,
  getCachedUserProfile,
  cacheHomeDetails,
  getCachedHomeDetails
} from '../services/offlineStorage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  activeHome: Home | null;
  userRole: UserRole | null;
  homes: Home[];
  darkMode: boolean;
  unreadCount: number;
  chatUnreadCount: number;
  currentViewingConvId: string | null;
  setCurrentViewingConvId: (convId: string | null) => void;
  toggleDarkMode: () => void;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string, avatar?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshHomes: () => Promise<void>;
  refreshActiveHome: () => Promise<void>;
  updateActiveHomeData: (updatedHome: Home) => void;
  setActiveHomeId: (homeId: string) => void;
  refreshUserData: () => Promise<void>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  setChatUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  refreshUnreadCount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_HOME_KEY = 'homely_active_home_id';
const THEME_KEY = 'homely_dark_mode';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [homes, setHomes] = useState<Home[]>([]);
  const [activeHome, setActiveHome] = useState<Home | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [chatUnreadCount, setChatUnreadCount] = useState<number>(0);
  const [currentViewingConvId, setCurrentViewingConvIdState] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('disconnected');
  const currentViewingConvIdRef = useRef<string | null>(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // Apply dark mode class to document
  useEffect(() => {
    try {
      if (darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem(THEME_KEY, 'true');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(THEME_KEY, 'false');
      }
    } catch {
      // ignore
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // Load active home details & user role
  const loadHomeDetails = useCallback(async (homeId: string) => {
    try {
      const res = await api.getHomeDetails(homeId);
      setActiveHome(res.home);
      const role = (res.role as UserRole) || 'member';
      setUserRole(role);
      try {
        localStorage.setItem(ACTIVE_HOME_KEY, homeId);
      } catch {
        // ignore
      }
      if (user?.id) {
        await cacheHomeDetails(user.id, homeId, {
          home: res.home,
          role,
          members: (res as any).members
        });
      }
    } catch (err) {
      console.warn('Failed to load active home details from network, checking cache:', err);
      if (user?.id) {
        const cached = await getCachedHomeDetails(user.id, homeId);
        if (cached) {
          setActiveHome(cached.home);
          setUserRole(cached.role);
        }
      }
    }
  }, [user?.id]);

  // Fetch homes for current user
  const refreshHomes = useCallback(async () => {
    try {
      const res = await api.getHomes();
      setHomes(res.homes);

      if (res.homes.length > 0) {
        let savedHomeId = null;
        try {
          savedHomeId = localStorage.getItem(ACTIVE_HOME_KEY);
        } catch {
          // ignore
        }

        const match = res.homes.find(h => h.id === savedHomeId);
        const target = match || res.homes[0];
        await loadHomeDetails(target.id);
      } else {
        setActiveHome(null);
        setUserRole(null);
      }
    } catch (err) {
      console.warn('Failed to load homes:', err);
    }
  }, [loadHomeDetails]);

  // Initial user fetch
  const refreshUserData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setHomes([]);
      setActiveHome(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      setUser(res.user);
      await cacheUserProfile(res.user);
      await refreshHomes();
      syncPendingSubscriptionRenewal().catch(() => {});
    } catch (err) {
      console.warn('Auth check network failed, trying offline cache:', err);
      try {
        const cached = await getCachedUserProfile();
        if (cached) {
          setUser(cached);
          let savedHomeId: string | null = null;
          try {
            savedHomeId = localStorage.getItem(ACTIVE_HOME_KEY);
          } catch {
            // ignore
          }
          if (savedHomeId) {
            const cachedDetails = await getCachedHomeDetails(cached.id, savedHomeId);
            if (cachedDetails) {
              setActiveHome(cachedDetails.home);
              setUserRole(cachedDetails.role);
              setHomes([cachedDetails.home]);
            }
          }
        } else {
          setUser(null);
          setHomes([]);
          setActiveHome(null);
        }
      } catch {
        setUser(null);
        setHomes([]);
        setActiveHome(null);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshHomes]);

  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

  // Keep currentViewingConvIdRef in sync with currentViewingConvId
  useEffect(() => {
    currentViewingConvIdRef.current = currentViewingConvId;
  }, [currentViewingConvId]);

  const setCurrentViewingConvId = useCallback((convId: string | null) => {
    currentViewingConvIdRef.current = convId;
    setCurrentViewingConvIdState(convId);
    if (convId) {
      // Small timeout allows the backend to finish updating conversation_reads and notifications
      setTimeout(() => {
        refreshUnreadCount();
      }, 350);
    }
  }, []);

  // Monitor realtime WebSocket status
  useEffect(() => {
    const unsub = realtimeChat.onStatusChange(status => {
      setRealtimeStatus(status);
    });
    return unsub;
  }, []);

  // Ensure WebSocket is connected and joined to the active home
  useEffect(() => {
    if (user && activeHome?.id) {
      realtimeChat.connect();
      realtimeChat.joinHome(activeHome.id);
    }
  }, [user?.id, activeHome?.id]);

  // Server-authoritative unread count refresh
  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getUnreadNotificationCount(activeHome?.id);
      setUnreadCount(res.total);
      if (typeof res.chatUnread === 'number') {
        setChatUnreadCount(res.chatUnread);
      } else if (activeHome?.id) {
        const convRes = await api.getConversations(activeHome.id);
        const total = (convRes.conversations || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        setChatUnreadCount(total);
      }
    } catch {
      // silent fallback
    }
  }, [user, activeHome?.id]);

  // Realtime event listeners for immediate unread count updates
  useEffect(() => {
    if (!user) return;

    const handleNewMessage = (msgId?: string, senderId?: string, convId?: string) => {
      if (!msgId || !convId) return;

      // Duplicate prevention across multiple broadcasts/events
      if (processedMessageIdsRef.current.has(msgId)) return;
      processedMessageIdsRef.current.add(msgId);

      // Keep cache bounded
      if (processedMessageIdsRef.current.size > 200) {
        const arr = Array.from(processedMessageIdsRef.current);
        processedMessageIdsRef.current = new Set(arr.slice(-100));
      }

      // Do not count messages sent by the current user
      if (senderId && senderId === user.id) return;

      // Do not count messages for the conversation currently being viewed
      if (currentViewingConvIdRef.current === convId) return;

      // Immediately increment unread counts
      setChatUnreadCount(prev => prev + 1);
      setUnreadCount(prev => prev + 1);
    };

    // 1. Conversation updated (broadcast to home room when any new message arrives)
    const unsubConvUpdate = realtimeChat.on('conversation:updated', (data: { conversationId: string; lastMessage?: any }) => {
      handleNewMessage(data?.lastMessage?.id, data?.lastMessage?.senderId, data?.conversationId);
    });

    // 2. Direct message:new (broadcast to conversation room)
    const unsubNewMsg = realtimeChat.on('message:new', (data: { conversationId: string; message?: any }) => {
      const msg = data?.message;
      handleNewMessage(msg?.id, msg?.sender?.id || msg?.senderId, data?.conversationId);
    });

    // 3. Message deleted: reconcile with server source of truth
    const unsubDelete = realtimeChat.on('message:deleted', () => {
      refreshUnreadCount();
    });

    // 4. Conversation read receipt
    const unsubRead = realtimeChat.on('conversation:read', (data: { conversationId: string; userId: string }) => {
      if (data?.userId === user.id) {
        refreshUnreadCount();
      }
    });

    // 5. Reconnection handler: reconcile unread count with backend after reconnect
    const unsubReconnect = realtimeChat.on('reconnected', () => {
      refreshUnreadCount();
    });

    return () => {
      unsubConvUpdate();
      unsubNewMsg();
      unsubDelete();
      unsubRead();
      unsubReconnect();
    };
  }, [user?.id, refreshUnreadCount]);

  // Lightweight fallback polling:
  // If realtime WebSocket is connected and healthy, we do NOT poll every 20s;
  // instead we use a gentle 120s fallback interval.
  // If disconnected or reconnecting, we check every 25s.
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setChatUnreadCount(0);
      return;
    }

    refreshUnreadCount();

    const pollInterval = realtimeStatus === 'connected' ? 120000 : 25000;
    const timer = setInterval(() => {
      refreshUnreadCount();
    }, pollInterval);

    return () => clearInterval(timer);
  }, [user, activeHome?.id, realtimeStatus, refreshUnreadCount]);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setUser(res.user);
    await refreshHomes();
    syncPendingSubscriptionRenewal().catch(() => {});
  };

  const register = async (name: string, email: string, pass: string, avatar?: string) => {
    const res = await api.register(name, email, pass, avatar);
    setUser(res.user);
    await refreshHomes();
    syncPendingSubscriptionRenewal().catch(() => {});
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setHomes([]);
    setActiveHome(null);
    setUserRole(null);
    try {
      localStorage.removeItem(ACTIVE_HOME_KEY);
    } catch {
      // ignore
    }
  };

  const setActiveHomeId = (homeId: string) => {
    const found = homes.find(h => h.id === homeId);
    if (found) {
      loadHomeDetails(homeId);
    }
  };

  const updateActiveHomeData = (updatedHome: Home) => {
    setActiveHome(updatedHome);
    setHomes(prev => prev.map(h => h.id === updatedHome.id ? updatedHome : h));
  };

  const refreshActiveHome = async () => {
    if (activeHome) {
      await loadHomeDetails(activeHome.id);
      try {
        const res = await api.getHomes();
        setHomes(res.homes);
      } catch (e) {
        console.warn('Failed to refresh homes:', e);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeHome,
        userRole,
        homes,
        darkMode,
        unreadCount,
        chatUnreadCount,
        currentViewingConvId,
        setCurrentViewingConvId,
        toggleDarkMode,
        login,
        register,
        logout,
        refreshHomes,
        refreshActiveHome,
        updateActiveHomeData,
        setActiveHomeId,
        refreshUserData,
        setUnreadCount,
        setChatUnreadCount,
        refreshUnreadCount
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
