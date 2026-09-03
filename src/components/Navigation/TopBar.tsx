import React, { useState } from 'react';
import { ChevronDown, Plus, Copy, Check, Bell, Moon, Sun, Shield, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TopBarProps {
  onOpenNotifications: () => void;
  onOpenCreateJoinModal: () => void;
  onOpenHomeSettings?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenNotifications,
  onOpenCreateJoinModal,
  onOpenHomeSettings
}) => {
  const { activeHome, userRole, homes, setActiveHomeId, darkMode, toggleDarkMode, unreadCount } = useAuth();
  const [showHomeDropdown, setShowHomeDropdown] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const handleCopyInvite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeHome?.inviteCode) return;
    navigator.clipboard.writeText(activeHome.inviteCode);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  return (
    <header
      id="homely-top-bar"
      className="sticky top-0 z-30 bg-stone-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-stone-200/80 dark:border-zinc-800/80 transition-colors"
    >
      <div className="max-w-md md:max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Home Selector / Brand */}
        <div className="relative flex items-center space-x-2">
          {activeHome ? (
            <div className="relative">
              <button
                id="btn-switch-home"
                onClick={() => setShowHomeDropdown(!showHomeDropdown)}
                className="flex items-center space-x-2 text-left p-1 -ml-1 rounded-xl hover:bg-stone-200/60 dark:hover:bg-zinc-800/60 transition-colors"
                aria-expanded={showHomeDropdown}
              >
                <img
                  src={activeHome.avatar}
                  alt={activeHome.name}
                  className="w-8 h-8 rounded-full border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-zinc-900 object-cover"
                />
                <div className="flex flex-col">
                  <div className="flex items-center space-x-1">
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100 line-clamp-1 max-w-[130px] sm:max-w-[200px]">
                      {activeHome.name}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                  </div>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 capitalize -mt-0.5">
                    {userRole || 'Member'}
                  </span>
                </div>
              </button>

              {/* Home Dropdown */}
              {showHomeDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowHomeDropdown(false)}
                  />
                  <div className="absolute top-full left-0 mt-1.5 w-64 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-stone-200 dark:border-zinc-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                      Your Family Homes
                    </div>
                    {homes.map(h => (
                      <button
                        key={h.id}
                        onClick={() => {
                          setActiveHomeId(h.id);
                          setShowHomeDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left flex items-center space-x-2.5 transition-colors ${
                          h.id === activeHome.id
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                            : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        <img src={h.avatar} alt="" className="w-7 h-7 rounded-full bg-stone-100" />
                        <div className="flex-1 truncate">
                          <p className="text-xs font-semibold truncate">{h.name}</p>
                          <p className="text-[10px] text-stone-400 truncate">{h.description}</p>
                        </div>
                      </button>
                    ))}
                    <div className="border-t border-stone-100 dark:border-zinc-800 my-1.5" />
                    {onOpenHomeSettings && (
                      <button
                        onClick={() => {
                          setShowHomeDropdown(false);
                          onOpenHomeSettings();
                        }}
                        className="w-full px-3 py-2 text-left flex items-center space-x-2 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-stone-500" />
                        <span>Home Settings & Customization</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowHomeDropdown(false);
                        onOpenCreateJoinModal();
                      }}
                      className="w-full px-3 py-2 text-left flex items-center space-x-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create or Join a Home</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                H
              </div>
              <span className="font-bold text-lg text-stone-900 dark:text-stone-100 tracking-tight">
                HOMELY
              </span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {activeHome && (
            <button
              id="btn-copy-invite-code"
              onClick={handleCopyInvite}
              title={`Family Invite Code: ${activeHome.inviteCode}`}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-200/70 dark:bg-zinc-800/80 hover:bg-stone-300/70 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-200 transition-colors"
            >
              {copiedInvite ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                  <span className="text-[11px] font-mono tracking-wide">{activeHome.inviteCode}</span>
                </>
              )}
            </button>
          )}

          {/* Theme Toggle */}
          <button
            id="btn-toggle-theme"
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-zinc-800/60 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Button */}
          {activeHome && (
            <button
              id="btn-notifications"
              onClick={onOpenNotifications}
              aria-label="Notifications"
              className="relative p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute 1.5 top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
