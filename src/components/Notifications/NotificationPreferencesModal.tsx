import React, { useState, useEffect, useCallback } from 'react';
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
  RotateCcw,
  Smartphone,
  Laptop,
  Trash2,
  Send,
  AlertCircle,
  CheckCircle2,
  BellRing,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';
import type { NotificationPreferences, PushDeviceSubscription } from '../../types';
import {
  isPushNotificationSupported,
  subscribeCurrentDevice,
  unsubscribeCurrentDevice,
  getCurrentDeviceSubscription,
  getDeviceDetails
} from '../../services/pushNotifications';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Push device state
  const [pushSupported, setPushSupported] = useState(true);
  const [devices, setDevices] = useState<PushDeviceSubscription[]>([]);
  const [currentDeviceRegistered, setCurrentDeviceRegistered] = useState(false);
  const [registeringDevice, setRegisteringDevice] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({ label: '', platform: 'web_push' as 'web_push' | 'android' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = isPushNotificationSupported();
      setPushSupported(supported);
      if ('Notification' in window) {
        setBrowserPermission(Notification.permission);
      }
      setDeviceInfo(getDeviceDetails());
    }
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const res = await api.getPushDevices();
      if (res && res.devices) {
        setDevices(res.devices);
      }
      // Check if current device has subscription in push manager
      const currentSub = await getCurrentDeviceSubscription();
      if (currentSub && res.devices) {
        const found = res.devices.some(d => d.endpoint === currentSub.endpoint);
        setCurrentDeviceRegistered(found);
      } else {
        setCurrentDeviceRegistered(false);
      }
    } catch (err) {
      console.warn('Failed to load registered push devices:', err);
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

    loadDevices();

    return () => {
      isMounted = false;
    };
  }, [isOpen, loadDevices]);

  if (!isOpen) return null;

  const showFeedback = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 3500);
    } else {
      setSaveMessage(msg);
      setTimeout(() => setSaveMessage(null), 2500);
    }
  };

  const handleToggle = async (key: keyof NotificationPreferences, value?: boolean) => {
    const nextVal = value !== undefined ? value : !preferences[key];
    const updated = { ...preferences, [key]: nextVal };
    setPreferences(updated);
    try {
      await api.updateNotificationPreferences({ [key]: nextVal });
      showFeedback('Preference saved');
    } catch (err) {
      console.warn('Failed to save notification preference:', err);
      setPreferences(preferences);
      showFeedback('Failed to update preference', true);
    }
  };

  const handleRegisterCurrentDevice = async () => {
    setRegisteringDevice(true);
    try {
      const res = await subscribeCurrentDevice();
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setBrowserPermission(Notification.permission);
      }

      if (res.success) {
        setPreferences(prev => ({ ...prev, browserPush: true }));
        setCurrentDeviceRegistered(true);
        await loadDevices();
        showFeedback('Device successfully registered for push notifications!');
      } else {
        showFeedback(res.error || 'Failed to register this device', true);
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      showFeedback(err.message || 'Failed to register push device', true);
    } finally {
      setRegisteringDevice(false);
    }
  };

  const handleUnregisterDevice = async (id: string) => {
    try {
      const res = await api.deletePushDevice(id);
      if (res.success) {
        // If current device was unregistered, also unsubscribe push manager
        const currentSub = await getCurrentDeviceSubscription();
        const deletedDevice = devices.find(d => d.id === id);
        if (deletedDevice && currentSub && deletedDevice.endpoint === currentSub.endpoint) {
          await unsubscribeCurrentDevice();
          setCurrentDeviceRegistered(false);
        }
        await loadDevices();
        showFeedback('Device unregistered');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Failed to unregister device', true);
    }
  };

  const handleSendTestPush = async () => {
    setTestingPush(true);
    try {
      const res = await api.sendTestPush(deviceInfo.label);
      if (res.success) {
        showFeedback(`Delivered to ${res.sent} active device(s)!`);
      } else {
        showFeedback(res.message || 'Could not deliver test notification', true);
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error triggering test notification', true);
    } finally {
      setTestingPush(false);
    }
  };

  const handleQuietHoursChange = (partial: any) => {
    const updated = { ...quietHours, ...partial };
    setQuietHours(updated);
    try {
      localStorage.setItem('homely_quiet_hours', JSON.stringify(updated));
      showFeedback('Quiet hours updated');
    } catch {
      // ignore
    }
  };

  const handleSoundToggle = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    try {
      localStorage.setItem('homely_sound_enabled', String(nextVal));
      showFeedback(nextVal ? 'Sound enabled' : 'Sound muted');
    } catch {
      // ignore
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
      showFeedback('Reset to defaults');
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

  const formatLastActive = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div
        id="modal-notification-preferences"
        className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-zinc-900 rounded-3xl border border-stone-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between bg-stone-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Notification Preferences
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Push alerts, device sync, and category settings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback banners */}
        {saveMessage && (
          <div className="px-6 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
            <span className="flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              {saveMessage}
            </span>
          </div>
        )}
        {errorMessage && (
          <div className="px-6 py-2 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/40 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
            <span className="flex items-center">
              <AlertCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              {errorMessage}
            </span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-130px)]">
          {loading && (
            <div className="flex items-center justify-center py-4 text-xs text-stone-400">
              <RotateCcw className="w-4 h-4 animate-spin mr-2" />
              Loading preferences...
            </div>
          )}

          {/* REAL DEVICE PUSH NOTIFICATIONS SECTION */}
          <div className="p-4.5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-stone-50/60 to-purple-50/40 dark:from-indigo-950/30 dark:via-zinc-800/60 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start space-x-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs mt-0.5">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      Real Device Push Notifications
                    </p>
                    {preferences.browserPush && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 mt-1">
                    Receive instant lock-screen alerts on your Android device or browser when away from the app.
                  </p>
                </div>
              </div>

              {/* Master Push Toggle */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={!!preferences.browserPush}
                  onChange={e => handleToggle('browserPush', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Android / Device Context Banner */}
            <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/60 border border-stone-200/70 dark:border-zinc-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-stone-700 dark:text-stone-300">
                <span className="font-medium flex items-center">
                  {deviceInfo.platform === 'android' ? (
                    <Smartphone className="w-4 h-4 mr-1.5 text-indigo-500" />
                  ) : (
                    <Laptop className="w-4 h-4 mr-1.5 text-indigo-500" />
                  )}
                  Current Device: <strong className="ml-1 text-stone-900 dark:text-stone-100">{deviceInfo.label || 'Web Device'}</strong>
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  Permission: <strong className="capitalize">{browserPermission}</strong>
                </span>
              </div>

              {/* Device Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!pushSupported ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                    Web Push is not supported in this browser mode.
                  </p>
                ) : browserPermission === 'denied' ? (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                    Notifications are blocked in your browser settings. Please enable them to receive alerts.
                  </p>
                ) : !currentDeviceRegistered ? (
                  <button
                    onClick={handleRegisterCurrentDevice}
                    disabled={registeringDevice}
                    className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                  >
                    {registeringDevice ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <BellRing className="w-3.5 h-3.5 mr-1.5" />
                        Enable Push on this Device
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                      <Check className="w-3.5 h-3.5 mr-1" /> This device is registered
                    </span>
                    <button
                      onClick={handleSendTestPush}
                      disabled={testingPush}
                      className="inline-flex items-center px-3 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium transition-colors"
                    >
                      {testingPush ? (
                        <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3 mr-1.5" />
                      )}
                      Send Test Push
                    </button>
                  </div>
                )}
              </div>

              {deviceInfo.platform === 'android' && (
                <p className="text-[11px] text-stone-500 dark:text-stone-400 pt-1">
                  Tip: On Android, install HOMELY to your Home Screen from the Chrome menu for full standalone push alerts.
                </p>
              )}
            </div>

            {/* Registered Devices List */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-600 dark:text-stone-300 px-1">
                <span>Your Registered Devices ({devices.length})</span>
                <button
                  onClick={loadDevices}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                </button>
              </div>

              {devices.length === 0 ? (
                <div className="p-3 text-center rounded-xl border border-dashed border-stone-200 dark:border-zinc-800 text-xs text-stone-400">
                  No devices registered yet. Click &ldquo;Enable Push on this Device&rdquo; above to connect your phone or browser.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {devices.map(device => (
                    <div
                      key={device.id}
                      className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {device.platform === 'android' ? (
                          <Smartphone className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Laptop className="w-4 h-4 text-indigo-500 shrink-0" />
                        )}
                        <div className="truncate">
                          <p className="font-semibold text-stone-800 dark:text-stone-200 truncate">
                            {device.deviceLabel || 'Push Device'}
                          </p>
                          <p className="text-[10px] text-stone-400 dark:text-stone-500">
                            Active: {formatLastActive(device.lastUsedAt)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleUnregisterDevice(device.id)}
                        title="Remove device"
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                    <div className="flex items-start space-x-3 pr-4">
                      <div className="p-2 rounded-xl bg-stone-50 dark:bg-zinc-800 shadow-2xs mt-0.5">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                          {item.label}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
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
        <div className="px-6 py-4 border-t border-stone-200 dark:border-zinc-800 flex items-center justify-between bg-stone-50/50 dark:bg-zinc-900/50">
          <button
            onClick={handleResetDefaults}
            className="flex items-center text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-bold shadow-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
