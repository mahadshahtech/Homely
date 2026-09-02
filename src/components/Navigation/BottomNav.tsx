import React from 'react';
import { Home as HomeIcon, MessageCircle, Sparkles, Users, User as UserIcon } from 'lucide-react';
import type { ActiveTab } from '../../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  chatUnreadCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  chatUnreadCount = 0
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'ask', label: 'Ask', icon: Sparkles },
    { id: 'family', label: 'Family', icon: Users },
    { id: 'profile', label: 'Profile', icon: UserIcon }
  ];

  return (
    <nav
      id="homely-bottom-navigation"
      aria-label="Main Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-t border-stone-200/80 dark:border-zinc-800/80 transition-colors"
    >
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around">
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          const isAsk = item.id === 'ask';

          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => onChangeTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-200 min-w-[56px] min-h-[44px] ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                {isAsk ? (
                  <div
                    className={`p-1.5 rounded-full transition-transform ${
                      isActive
                        ? 'bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/25 scale-110'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                ) : (
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                )}

                {item.id === 'chat' && chatUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none shadow-sm">
                    {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                  </span>
                )}
              </div>

              <span className={`text-[11px] mt-0.5 tracking-tight whitespace-nowrap ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>

              {isActive && !isAsk && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
