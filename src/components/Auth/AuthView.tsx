import React, { useState } from 'react';
import { Sparkles, Shield, Heart, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Felix&backgroundColor=ede9fe,e0e7ff',
  'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Aria&backgroundColor=fce7f3,ede9fe',
  'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Jasper&backgroundColor=fef3c7,e0e7ff',
  'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Maya&backgroundColor=dcfce7,ede9fe',
  'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Noah&backgroundColor=fee2e2,fce7f3'
];

export const AuthView: React.FC = () => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Please enter your full name');
        if (!email.trim() || !email.includes('@')) throw new Error('Please enter a valid email address');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        await register(name, email, password, selectedAvatar);
      } else {
        if (!email.trim()) throw new Error('Please enter your email');
        if (!password) throw new Error('Please enter your password');
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (roleName: string, demoEmail: string) => {
    setIsRegister(true);
    setName(roleName);
    setEmail(demoEmail);
    setPassword('family123');
  };

  return (
    <div className="min-h-screen bg-stone-100/60 dark:bg-zinc-950 flex flex-col justify-center items-center px-4 py-8 sm:px-6 transition-colors">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 text-white shadow-lg shadow-indigo-500/20 mb-3">
            <Heart className="w-7 h-7 fill-white/20" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-sans">
            HOMELY
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 font-medium">
            Your family. Your space.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl shadow-xl shadow-stone-200/50 dark:shadow-none p-6 sm:p-8 transition-colors">
          {/* Tab Switcher */}
          <div className="flex bg-stone-100 dark:bg-zinc-800/80 p-1 rounded-xl mb-6">
            <button
              type="button"
              id="btn-tab-login"
              onClick={() => { setIsRegister(false); setError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                !isRegister
                  ? 'bg-white dark:bg-zinc-900 text-indigo-900 dark:text-indigo-300 shadow-sm'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              id="btn-tab-register"
              onClick={() => { setIsRegister(true); setError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                isRegister
                  ? 'bg-white dark:bg-zinc-900 text-indigo-900 dark:text-indigo-300 shadow-sm'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-2.5 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="input-register-name"
                    type="text"
                    required
                    placeholder="e.g. Maya Shah"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                    Choose Your Avatar
                  </label>
                  <div className="flex items-center space-x-2 overflow-x-auto py-1">
                    {AVATAR_OPTIONS.map((url, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setSelectedAvatar(url)}
                        className={`p-1 rounded-full border-2 transition-transform ${
                          selectedAvatar === url
                            ? 'border-indigo-600 scale-105 shadow-sm'
                            : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="Avatar option" className="w-9 h-9 rounded-full bg-stone-100" />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Email Address
              </label>
              <input
                id="input-auth-email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Password
              </label>
              <input
                id="input-auth-password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>

            <button
              id="btn-submit-auth"
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? 'Join Homely' : 'Sign In to Your Space'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick family member presets for convenient testing */}
          <div className="mt-6 pt-5 border-t border-stone-100 dark:border-zinc-800">
            <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2 text-center">
              Quick Setup Presets
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={() => handleQuickDemo('Mahad Shah', 'mahadshah.ai@gmail.com')}
                className="px-2.5 py-1 text-xs rounded-lg bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-300 font-medium transition-colors"
              >
                Mahad (Owner)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('Sara Shah', 'sara@example.com')}
                className="px-2.5 py-1 text-xs rounded-lg bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-300 font-medium transition-colors"
              >
                Sara (Family)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('Aryan Shah', 'aryan@example.com')}
                className="px-2.5 py-1 text-xs rounded-lg bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-300 font-medium transition-colors"
              >
                Aryan (Family)
              </button>
            </div>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-stone-500 dark:text-stone-400">
          <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Encrypted sessions & private family boundaries</span>
        </div>
      </div>
    </div>
  );
};
