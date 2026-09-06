import React, { useState } from 'react';
import { 
  User, 
  Home as HomeIcon, 
  LogOut, 
  ShieldCheck, 
  Moon, 
  Sun, 
  Copy, 
  Check, 
  Plus, 
  Edit3, 
  CheckCircle2, 
  Heart 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

interface ProfileViewProps {
  onOpenCreateJoinModal: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onOpenCreateJoinModal }) => {
  const { user, activeHome, userRole, homes, setActiveHomeId, logout, darkMode, toggleDarkMode, refreshUserData } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setSaving(true);
    try {
      await api.updateProfile(nameInput.trim());
      await refreshUserData();
      setEditing(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCode = () => {
    if (!activeHome?.inviteCode) return;
    navigator.clipboard.writeText(activeHome.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div id="homely-profile-view" className="max-w-md md:max-w-2xl mx-auto px-4 py-4 space-y-4 pb-24">
      {/* User Card */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-sm transition-colors space-y-4">
        <div className="flex items-center space-x-4">
          <img
            src={user?.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${user?.name}`}
            alt={user?.name}
            className="w-16 h-16 rounded-2xl bg-stone-100 dark:bg-zinc-800 border-2 border-indigo-200 dark:border-indigo-800/80 object-cover"
          />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                {user?.name}
              </h2>
              <button
                onClick={() => {
                  setNameInput(user?.name || '');
                  setEditing(!editing);
                }}
                className="p-1 text-stone-400 hover:text-indigo-600 rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">{user?.email}</p>
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                Active Member
              </span>
            </div>
          </div>
        </div>

        {editing && (
          <form onSubmit={handleSaveProfile} className="pt-3 border-t border-stone-100 dark:border-zinc-800 space-y-2">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
              Update Your Name
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Active Family Space Card */}
      {activeHome && (
        <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Current Family Space
            </h3>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 capitalize">
              {userRole}
            </span>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/50 border border-stone-200/50 dark:border-zinc-700/50">
            <img
              src={activeHome.avatar}
              alt=""
              className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-zinc-800 object-cover"
            />
            <div className="flex-1 truncate">
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">{activeHome.name}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{activeHome.description}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-stone-500 dark:text-stone-400">Invitation Code:</span>
            <button
              onClick={handleCopyCode}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-stone-100 dark:bg-zinc-800 font-mono text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <span>{activeHome.inviteCode}</span>
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
            </button>
          </div>
        </div>
      )}

      {/* Switch / Add Home */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
            All Your Family Homes ({homes.length})
          </h3>
          <button
            onClick={onOpenCreateJoinModal}
            className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create / Join</span>
          </button>
        </div>

        <div className="space-y-2">
          {homes.map(h => (
            <button
              key={h.id}
              onClick={() => setActiveHomeId(h.id)}
              className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${
                h.id === activeHome?.id
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200'
                  : 'border-stone-200/60 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-800/60 text-stone-700 dark:text-stone-300'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <img src={h.avatar} alt="" className="w-7 h-7 rounded-lg bg-stone-100" />
                <span className="text-xs font-semibold">{h.name}</span>
              </div>
              {h.id === activeHome?.id && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                  Active
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Settings & Preferences */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-3 transition-colors">
        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
          Preferences & Security
        </h3>

        <div className="divide-y divide-stone-100 dark:divide-zinc-800 text-xs">
          {/* Theme */}
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-stone-700 dark:text-stone-300">
              {darkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              <span className="font-medium">Theme Mode</span>
            </div>
            <button
              onClick={toggleDarkMode}
              className="px-3 py-1 rounded-xl bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 font-semibold hover:bg-stone-200 dark:hover:bg-zinc-700"
            >
              {darkMode ? 'Dark Mode' : 'Light Warm'}
            </button>
          </div>

          {/* Privacy info */}
          <div className="py-3 flex items-center space-x-2 text-stone-500 dark:text-stone-400">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="text-[11px] leading-relaxed">
              Family data is strictly isolated. Non-family members cannot view posts, chats, or vault notes.
            </span>
          </div>
        </div>
      </div>

      {/* Sign Out Button */}
      <button
        id="btn-logout"
        onClick={logout}
        className="w-full py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors flex items-center justify-center space-x-2"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out of HOMELY</span>
      </button>
    </div>
  );
};
