import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Moon,
  Volume2,
  VolumeX,
  MessageSquare,
  Calendar,
  Heart,
  Camera,
  Users,
  Sparkles,
  Check,
  RotateCcw
} from 'lucide-react';
import { api } from '../../services/api';
import type { NotificationPreferences } from '../../types';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    userId: '',
    messages: true,
    feedActivity: true,
    events: true,
    memories: true,
    familyActivity: true,
    askHomely: true,
    browserPush: false
  });

  const [quietHours, setQuietHours] = useState(() => {
    try {
      const saved = localStorage.getItem('homely_quiet_hours');
      return saved ? JSON.parse(saved) : { enabled: false, start: '22:00', end: '08:00' };
    } catch {
      return { enabled: false, start: '22:00', end: '08:00' };
    }
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('homely_sound_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [loading, setLoading] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    api.getNotificationPreferences()
      .then(res => {
        if (isMounted && res.preferences) {
          setPreferences(res.preferences);
        }
      })
      .catch(err => {
        console.warn('Failed to load notification preferences:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = async (key: keyof NotificationPreferences, value?: boolean) => {
    const nextVal = value !== undefined ? value : !preferences[key];
    const updated = { ...preferences, [key]: nextVal };
    setPreferences(updated);
    try {
      await api.updateNotificationPreferences({ [key]: nextVal });
      setSaveMessage('Preference saved');
      setTimeout(() => setSaveMessage(null), 1800);
    } catch (err) {
      console.warn('Failed to save notification preference:', err);
      // rollback
      setPreferences(preferences);
    }
  };

  const handleQuietHoursChange = (partial: any) => {
    const updated = { ...quietHours, ...partial };
    setQuietHours(updated);
    try {
      localStorage.setItem('homely_quiet_hours', JSON.stringify(updated));
      setSaveMessage('Quiet hours updated');
      setTimeout(() => setSaveMessage(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleSoundToggle = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    try {
      localStorage.setItem('homely_sound_enabled', String(nextVal));
      setSaveMessage(nextVal ? 'Sound enabled' : 'Sound muted');
      setTimeout(() => setSaveMessage(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleRequestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission === 'granted') {
        await handleToggle('browserPush', true);
        new Notification('HOMELY Notifications Active', {
          body: 'You will receive notifications for your family spaces.',
          icon: '/favicon.ico'
        });
      }
    } catch (err) {
      console.warn('Error requesting browser notification permission:', err);
    }
  };

  const handleResetDefaults = async () => {
    const defaults = {
      messages: true,
      feedActivity: true,
      events: true,
      memories: true,
      familyActivity: true,
      askHomely: true,
      browserPush: false
    };
    setPreferences(prev => ({ ...prev, ...defaults }));
    setQuietHours({ enabled: false, start: '22:00', end: '08:00' });
    setSoundEnabled(true);
    try {
      localStorage.setItem('homely_quiet_hours', JSON.stringify({ enabled: false, start: '22:00', end: '08:00' }));
      localStorage.setItem('homely_sound_enabled', 'true');
      await api.updateNotificationPreferences(defaults);
      setSaveMessage('Reset to defaults');
      setTimeout(() => setSaveMessage(null), 1800);
    } catch (err) {
      console.warn('Failed to reset preferences:', err);
    }
  };

  const preferenceItems = [
    {
      key: 'messages' as const,
      label: 'Chat & Direct Messages',
      description: 'DMs, @mentions, message replies, and family group conversations',
      icon: <MessageSquare className="w-4 h-4 text-indigo-500" />
    },
    {
      key: 'feedActivity' as const,
      label: 'Feed Posts & Comments',
      description: 'New family stories, announcements, comments, and reactions',
      icon: <Heart className="w-4 h-4 text-rose-500" />
    },
    {
      key: 'events' as const,
      label: 'Events & 24h Reminders',
      description: 'New family calendar events, RSVP updates, and 24-hour reminders',
      icon: <Calendar className="w-4 h-4 text-amber-500" />
    },
    {
      key: 'memories' as const,
      label: 'Family Memories',
      description: 'Photos, stories, and milestones preserved in the family album',
      icon: <Camera className="w-4 h-4 text-purple-500" />
    },
    {
      key: 'askHomely' as const,
      label: 'Ask Homely AI Actions',
      description: 'Notifications when scheduled tasks or assistant actions complete',
      icon: <Sparkles className="w-4 h-4 text-cyan-500" />
    },
    {
      key: 'familyActivity' as const,
      label: 'Home Membership & Invites',
      description: 'New family members joining, role changes, and code updates',
      icon: <Users className="w-4 h-4 text-emerald-500" />
    }
  ];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div
        id="modal-notification-preferences"
        className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-zinc-900 rounded-3xl border border-stone-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Notification Preferences
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Customize alerts for your family activity
              </p>
            </div>
          </div>
          <button
            id="btn-close-notification-preferences"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {saveMessage && (
            <div className="p-2.5 px-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2 animate-in fade-in">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{saveMessage}</span>
            </div>
          )}

          {/* Browser Desktop Alerts */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-700/60 text-stone-700 dark:text-stone-300 shadow-xs mt-0.5">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Browser Desktop Notifications
                </p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  {browserPermission === 'granted'
                    ? 'Browser alerts are enabled'
                    : browserPermission === 'denied'
                    ? 'Blocked by browser permissions'
                    : 'Get notified even when HOMELY is in the background'}
                </p>
              </div>
            </div>
            {browserPermission !== 'granted' ? (
              <button
                onClick={handleRequestBrowserPermission}
                className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
              >
                Enable Alerts
              </button>
            ) : (
              <span className="self-start sm:self-center inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                <Check className="w-3 h-3 mr-1" /> Active
              </span>
            )}
          </div>

          {/* Quiet Hours / Do Not Disturb */}
          <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    Quiet Hours (Do Not Disturb)
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Pause push and audio alerts during focus or sleep hours
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!quietHours.enabled}
                  onChange={e => handleQuietHoursChange({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {quietHours.enabled && (
              <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-stone-500 dark:text-stone-400">From</span>
                  <input
                    type="time"
                    value={quietHours.start || '22:00'}
                    onChange={e => handleQuietHoursChange({ start: e.target.value })}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-stone-200 text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-stone-500 dark:text-stone-400">to</span>
                  <input
                    type="time"
                    value={quietHours.end || '08:00'}
                    onChange={e => handleQuietHoursChange({ end: e.target.value })}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-stone-200 text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  Active
                </span>
              </div>
            )}
          </div>

          {/* Sound toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-stone-400" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Notification Sounds
                </p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Play gentle chime for family activity
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={handleSoundToggle}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Category Preferences */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold tracking-wider uppercase text-stone-400 dark:text-stone-500 px-1">
              Category Alerts
            </h3>
            <div className="divide-y divide-stone-100 dark:divide-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/40">
              {preferenceItems.map(item => {
                const isEnabled = preferences[item.key] !== false;
                return (
                  <div
                    key={item.key}
                    className="p-3.5 flex items-center justify-between hover:bg-stone-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center space-x-3 pr-4">
                      <div className="p-2 rounded-xl bg-stone-100 dark:bg-zinc-800 shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                          {item.label}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-1">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={e => handleToggle(item.key, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-100 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900 flex items-center justify-between">
          <button
            onClick={handleResetDefaults}
            className="flex items-center space-x-1.5 text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to defaults</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
