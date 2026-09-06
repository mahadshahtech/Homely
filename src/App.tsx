import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { TopBar } from './components/Navigation/TopBar';
import { BottomNav } from './components/Navigation/BottomNav';
import { ConnectionStatusBanner } from './components/Navigation/ConnectionStatusBanner';
import { AuthView } from './components/Auth/AuthView';
import { CreateOrJoinHomeModal } from './components/HomeManagement/CreateOrJoinHomeModal';
import { HomeSettingsModal } from './components/HomeManagement/HomeSettingsModal';
import { HomeFeedView } from './components/Feed/HomeFeedView';
import { ChatView } from './components/Chat/ChatView';
import { AskHomelyView } from './components/AskHomely/AskHomelyView';
import { FamilyView } from './components/Family/FamilyView';
import { ProfileView } from './components/Profile/ProfileView';
import { NotificationsDrawer } from './components/Notifications/NotificationsDrawer';
import type { ActiveTab } from './types';
import { Heart, Sparkles } from 'lucide-react';

interface ParsedDeepLink {
  hasDeepLink: boolean;
  tab?: ActiveTab;
  familySubTab?: 'members' | 'events' | 'memories' | 'vault';
  conversationId?: string | null;
  homeId?: string | null;
}

function parseDeepLink(searchStr: string): ParsedDeepLink {
  if (!searchStr || searchStr.length <= 1) {
    return { hasDeepLink: false };
  }

  try {
    const params = new URLSearchParams(searchStr);
    const rawTab = params.get('tab')?.toLowerCase()?.trim() || null;
    const conv = params.get('conv') || params.get('conversation') || params.get('conversationId') || null;
    const post = params.get('post') || params.get('postId') || null;
    const event = params.get('event') || params.get('eventId') || null;
    const memory = params.get('memory') || params.get('memoryId') || null;
    const homeId = params.get('home') || params.get('homeId') || null;
    const subTab = params.get('subtab') || params.get('subTab')?.toLowerCase()?.trim() || null;

    // Chat destination: ?tab=chat&conv=... or ?tab=messages or ?conv=...
    if (rawTab === 'chat' || rawTab === 'messages' || rawTab === 'message' || (!rawTab && conv)) {
      return {
        hasDeepLink: true,
        tab: 'chat',
        conversationId: conv,
        homeId
      };
    }

    // Feed / Home destination: ?tab=feed or ?tab=home or ?post=...
    if (rawTab === 'feed' || rawTab === 'home' || rawTab === 'posts' || (!rawTab && post)) {
      return {
        hasDeepLink: true,
        tab: 'home',
        homeId
      };
    }

    // Calendar / Events destination: ?tab=calendar or ?tab=events or ?event=...
    if (rawTab === 'calendar' || rawTab === 'events' || rawTab === 'event' || (!rawTab && event)) {
      return {
        hasDeepLink: true,
        tab: 'family',
        familySubTab: 'events',
        homeId
      };
    }

    // Memories destination: ?tab=memories or ?tab=memory or ?memory=...
    if (rawTab === 'memories' || rawTab === 'memory' || rawTab === 'photos' || (!rawTab && memory)) {
      return {
        hasDeepLink: true,
        tab: 'family',
        familySubTab: 'memories',
        homeId
      };
    }

    // Vault destination
    if (rawTab === 'vault') {
      return {
        hasDeepLink: true,
        tab: 'family',
        familySubTab: 'vault',
        homeId
      };
    }

    // Members / Family destination
    if (rawTab === 'members') {
      return {
        hasDeepLink: true,
        tab: 'family',
        familySubTab: 'members',
        homeId
      };
    }

    if (rawTab === 'family') {
      let resolvedSubTab: 'members' | 'events' | 'memories' | 'vault' = 'members';
      if (subTab === 'events' || subTab === 'calendar') resolvedSubTab = 'events';
      else if (subTab === 'memories' || subTab === 'memory') resolvedSubTab = 'memories';
      else if (subTab === 'vault') resolvedSubTab = 'vault';

      return {
        hasDeepLink: true,
        tab: 'family',
        familySubTab: resolvedSubTab,
        homeId
      };
    }

    // Ask Homely destination
    if (rawTab === 'ask' || rawTab === 'ask_homely' || rawTab === 'assistant') {
      return {
        hasDeepLink: true,
        tab: 'ask',
        homeId
      };
    }

    // Profile destination
    if (rawTab === 'profile') {
      return {
        hasDeepLink: true,
        tab: 'profile',
        homeId
      };
    }

    // If only homeId is passed without recognized tab
    if (homeId) {
      return {
        hasDeepLink: true,
        homeId
      };
    }

    return { hasDeepLink: false };
  } catch (err) {
    console.warn('Failed to parse deep link query params:', err);
    return { hasDeepLink: false };
  }
}

const MainLayout: React.FC = () => {
  const { user, loading, homes, activeHome, setActiveHomeId, chatUnreadCount } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [familySubTab, setFamilySubTab] = useState<'members' | 'events' | 'memories' | 'vault'>('members');
  const [targetConversationId, setTargetConversationId] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCreateJoinModalOpen, setIsCreateJoinModalOpen] = useState(false);
  const [isHomeSettingsOpen, setIsHomeSettingsOpen] = useState(false);
  const deepLinkHandledRef = useRef(false);

  const handleNavigate = (tab: ActiveTab, subTab?: string, targetId?: string) => {
    setActiveTab(tab);
    if (tab === 'family' && subTab) {
      setFamilySubTab(subTab as 'members' | 'events' | 'memories' | 'vault');
    }
    if (tab === 'chat') {
      setTargetConversationId(targetId || null);
    } else {
      setTargetConversationId(null);
    }
  };

  const applyDeepLink = useCallback(
    (searchStr: string) => {
      const parsed = parseDeepLink(searchStr);
      if (!parsed.hasDeepLink) return false;

      // 1. Home isolation: only switch if user belongs to that home
      if (parsed.homeId && homes.length > 0) {
        const authorizedHome = homes.find(h => h.id === parsed.homeId);
        if (authorizedHome && activeHome?.id !== authorizedHome.id) {
          setActiveHomeId(authorizedHome.id);
        }
      }

      // 2. Tab navigation
      if (parsed.tab) {
        setActiveTab(parsed.tab);
      }

      // 3. Subtab navigation
      if (parsed.familySubTab) {
        setFamilySubTab(parsed.familySubTab);
      }

      // 4. Chat conversation targeting
      if (parsed.tab === 'chat') {
        setTargetConversationId(parsed.conversationId || null);
      }

      return true;
    },
    [homes, activeHome?.id, setActiveHomeId]
  );

  // Consume deep link once user is authenticated
  useEffect(() => {
    if (loading || !user) return;

    if (!deepLinkHandledRef.current && window.location.search) {
      const consumed = applyDeepLink(window.location.search);
      if (consumed) {
        deepLinkHandledRef.current = true;
        // Clean query parameters so normal renders/reloads do not re-trigger it
        try {
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch {
          // ignore
        }
      }
    }
  }, [loading, user, applyDeepLink]);

  // Listen for browser popstate or location changes (e.g. from service worker navigate)
  useEffect(() => {
    const handlePopState = () => {
      if (loading || !user) return;
      if (window.location.search) {
        const consumed = applyDeepLink(window.location.search);
        if (consumed) {
          try {
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
          } catch {
            // ignore
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loading, user, applyDeepLink]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100/60 dark:bg-zinc-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/20 animate-pulse">
          <Heart className="w-7 h-7 fill-white/20" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 font-sans">
            HOMELY
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
            Your family. Your space.
          </p>
        </div>
      </div>
    );
  }

  // If not logged in, show Auth View
  if (!user) {
    return <AuthView />;
  }

  // If logged in but has no home yet, require creating or joining one
  const hasNoHome = homes.length === 0 || !activeHome;

  return (
    <div className="min-h-screen bg-stone-100/60 dark:bg-zinc-950 text-stone-900 dark:text-stone-100 transition-colors flex flex-col selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-900/50 dark:selection:text-indigo-200">
      {/* Top Bar Navigation */}
      <TopBar
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenCreateJoinModal={() => setIsCreateJoinModalOpen(true)}
        onOpenHomeSettings={() => setIsHomeSettingsOpen(true)}
      />

      {/* Unobtrusive Connection & Sync Banner */}
      <ConnectionStatusBanner />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md md:max-w-3xl mx-auto">
        {hasNoHome ? (
          <div className="py-12 px-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
              <Heart className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
              Welcome, {user.name}!
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mx-auto leading-relaxed">
              Every person in HOMELY belongs to one or more private family spaces. Create your family's Home or join an existing one using an invite code.
            </p>
            <button
              id="btn-welcome-create-home"
              onClick={() => setIsCreateJoinModalOpen(true)}
              className="mt-4 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
            >
              Get Started with Your Family
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'home' && <HomeFeedView onNavigate={handleNavigate} />}
            {activeTab === 'chat' && <ChatView initialConversationId={targetConversationId} />}
            {activeTab === 'ask' && <AskHomelyView />}
            {activeTab === 'family' && <FamilyView initialSubTab={familySubTab} />}
            {activeTab === 'profile' && (
              <ProfileView onOpenCreateJoinModal={() => setIsCreateJoinModalOpen(true)} />
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      {!hasNoHome && (
        <BottomNav
          activeTab={activeTab}
          onChangeTab={tab => {
            setActiveTab(tab);
            if (tab !== 'chat') {
              setTargetConversationId(null);
            }
          }}
          chatUnreadCount={chatUnreadCount}
        />
      )}

      {/* Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* Create or Join Home Modal */}
      <CreateOrJoinHomeModal
        isOpen={isCreateJoinModalOpen || hasNoHome}
        onClose={() => setIsCreateJoinModalOpen(false)}
        required={hasNoHome}
      />

      {/* Home Settings & Customization Modal */}
      <HomeSettingsModal
        isOpen={isHomeSettingsOpen}
        onClose={() => setIsHomeSettingsOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <MainLayout />
      </SyncProvider>
    </AuthProvider>
  );
}
