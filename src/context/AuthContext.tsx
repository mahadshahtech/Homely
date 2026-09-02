import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Home, UserRole } from '../types';
import { api, getStoredToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  activeHome: Home | null;
  userRole: UserRole | null;
  homes: Home[];
  darkMode: boolean;
  unreadCount: number;
  toggleDarkMode: () => void;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string, avatar?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshHomes: () => Promise<void>;
  setActiveHomeId: (homeId: string) => void;
  refreshUserData: () => Promise<void>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
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
      setUserRole((res.role as UserRole) || 'member');
      try {
        localStorage.setItem(ACTIVE_HOME_KEY, homeId);
      } catch {
        // ignore
      }
    } catch (err) {
      console.warn('Failed to load active home details:', err);
    }
  }, []);

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
      await refreshHomes();
    } catch (err) {
      console.warn('Auth check failed:', err);
      setUser(null);
      setHomes([]);
      setActiveHome(null);
    } finally {
      setLoading(false);
    }
  }, [refreshHomes]);

  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setUser(res.user);
    await refreshHomes();
  };

  const register = async (name: string, email: string, pass: string, avatar?: string) => {
    const res = await api.register(name, email, pass, avatar);
    setUser(res.user);
    await refreshHomes();
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
        toggleDarkMode,
        login,
        register,
        logout,
        refreshHomes,
        setActiveHomeId,
        refreshUserData,
        setUnreadCount
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
