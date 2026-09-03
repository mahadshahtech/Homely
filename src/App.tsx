import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TopBar } from './components/Navigation/TopBar';
import { BottomNav } from './components/Navigation/BottomNav';
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

const MainLayout: React.FC = () => {
  const { user, loading, homes, activeHome } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [familySubTab, setFamilySubTab] = useState<'members' | 'events' | 'memories' | 'vault'>('members');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCreateJoinModalOpen, setIsCreateJoinModalOpen] = useState(false);
  const [isHomeSettingsOpen, setIsHomeSettingsOpen] = useState(false);

  const handleNavigate = (tab: ActiveTab, subTab?: string) => {
    setActiveTab(tab);
    if (tab === 'family' && subTab) {
      setFamilySubTab(subTab as 'members' | 'events' | 'memories' | 'vault');
    }
  };

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
            {activeTab === 'chat' && <ChatView />}
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
          onChangeTab={setActiveTab}
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
      <MainLayout />
    </AuthProvider>
  );
}
