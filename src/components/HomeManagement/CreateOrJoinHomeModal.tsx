import React, { useState } from 'react';
import { Home as HomeIcon, KeyRound, Plus, Users, X, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface CreateOrJoinHomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  required?: boolean;
}

export const CreateOrJoinHomeModal: React.FC<CreateOrJoinHomeModalProps> = ({
  isOpen,
  onClose,
  required = false
}) => {
  const { refreshHomes, user } = useAuth();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create fields
  const [homeName, setHomeName] = useState(user?.name ? `${user.name.split(' ')[1] || user.name} Family` : 'Our Family');
  const [description, setDescription] = useState('Our private family space');

  // Join fields
  const [inviteCode, setInviteCode] = useState('');

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeName.trim()) {
      setError('Please provide a name for your family Home');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.createHome(homeName.trim(), description.trim());
      await refreshHomes();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create Home');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setError('Please enter a family invitation code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.joinHome(inviteCode.trim());
      await refreshHomes();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to join Home');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-stone-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <HomeIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                {required ? 'Welcome to HOMELY' : 'Family Space'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {required ? 'Start by creating or joining your family Home' : 'Manage your family spaces'}
              </p>
            </div>
          </div>
          {!required && (
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4">
          <div className="flex bg-stone-100 dark:bg-zinc-800/80 p-1 rounded-xl">
            <button
              id="btn-tab-create-home"
              type="button"
              onClick={() => { setMode('create'); setError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'create'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-900 dark:text-indigo-300 shadow-sm'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create a Home</span>
            </button>
            <button
              id="btn-tab-join-home"
              type="button"
              onClick={() => { setMode('join'); setError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'join'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-900 dark:text-indigo-300 shadow-sm'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Join with Code</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-2.5 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Family Home Name
                </label>
                <input
                  id="input-create-home-name"
                  type="text"
                  required
                  placeholder="e.g. Shah Family"
                  value={homeName}
                  onChange={e => setHomeName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  You will become the <strong>Owner</strong> of this Home.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Description / Motto (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Our private circle of love and laughter"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>

              <div className="pt-2">
                <button
                  id="btn-confirm-create-home"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Create Family Space</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Invitation Code
                </label>
                <input
                  id="input-join-home-code"
                  type="text"
                  required
                  placeholder="e.g. SHAH-4921"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-900 dark:text-stone-100 font-mono tracking-wider text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Ask a family member for their 8-character invitation code.
                </p>
              </div>

              <div className="pt-2">
                <button
                  id="btn-confirm-join-home"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Join Family Space</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
