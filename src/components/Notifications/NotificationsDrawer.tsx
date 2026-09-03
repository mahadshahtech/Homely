import React, { useEffect, useState, useMemo } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  MessageSquare,
  Heart,
  Calendar,
  Megaphone,
  Sparkles,
  Camera,
  Users,
  Clock,
  Settings,
  Trash2,
  Check,
  ExternalLink,
  Filter,
  Home as HomeIcon,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { NotificationItem, ActiveTab } from '../../types';
import { NotificationPreferencesModal } from './NotificationPreferencesModal';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: ActiveTab, subTab?: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const { activeHome, homes, setActiveHomeId, unreadCount, setUnreadCount, refreshUnreadCount } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedHomeId, setSelectedHomeId] = useState<string>('all');
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      // Fetch global notifications for user across homes
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      const unread = (res.notifications || []).filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifs();
    }
  }, [isOpen, activeHome?.id]);

  const handleMarkAllRead = async () => {
    try {
      await api.markNotificationsRead(selectedHomeId !== 'all' ? selectedHomeId : undefined);
      setNotifications(prev =>
        prev.map(n => {
          if (selectedHomeId === 'all' || n.homeId === selectedHomeId) {
            return { ...n, read: true };
          }
          return n;
        })
      );
      if (selectedHomeId === 'all') {
        setUnreadCount(0);
      } else {
        refreshUnreadCount();
      }
      setActionNotice('All marked as read');
      setTimeout(() => setActionNotice(null), 2000);
    } catch (err) {
      console.warn('Error marking all read:', err);
    }
  };

  const handleMarkSingleRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      refreshUnreadCount();
    } catch (err) {
      console.warn('Error marking notification read:', err);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.deleteNotification(id);
      const target = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (target && !target.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        refreshUnreadCount();
      }
    } catch (err) {
      console.warn('Error deleting notification:', err);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    // 1. Mark read if unread
    if (!notif.read) {
      try {
        await api.markNotificationRead(notif.id);
        setNotifications(prev =>
          prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        refreshUnreadCount();
      } catch (err) {
        console.warn('Error marking notification read on click:', err);
      }
    }

    // 2. Switch home if needed
    if (notif.homeId && activeHome?.id !== notif.homeId) {
      setActiveHomeId(notif.homeId);
    }

    // 3. Deep-link navigation
    if (onNavigate) {
      const type = notif.type;
      const targetType = notif.targetType;

      if (targetType === 'conversation' || type.startsWith('message')) {
        onNavigate('chat');
      } else if (targetType === 'event' || type.startsWith('event')) {
        onNavigate('family', 'events');
      } else if (targetType === 'memory' || type.startsWith('memory')) {
        onNavigate('family', 'memories');
      } else if (targetType === 'member' || type.startsWith('member') || type.startsWith('home')) {
        onNavigate('family', 'members');
      } else if (targetType === 'ask' || type.startsWith('ask_homely')) {
        onNavigate('ask');
      } else if (targetType === 'post' || type.startsWith('post') || type.startsWith('comment')) {
        onNavigate('home');
      } else {
        onNavigate('home');
      }
    }

    onClose();
  };

  // Group notifications into Today, Yesterday, Earlier
  const groupedNotifications = useMemo(() => {
    let list = [...notifications];

    // Filter by home if selected
    if (selectedHomeId !== 'all') {
      list = list.filter(n => n.homeId === selectedHomeId);
    }

    // Filter by read status if selected
    if (filter === 'unread') {
      list = list.filter(n => !n.read);
    }

    const today: NotificationItem[] = [];
    const yesterday: NotificationItem[] = [];
    const earlier: NotificationItem[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    list.forEach(item => {
      const itemTime = new Date(item.createdAt).getTime();
      if (itemTime >= startOfToday) {
        today.push(item);
      } else if (itemTime >= startOfYesterday) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    });

    return { today, yesterday, earlier, totalCount: list.length };
  }, [notifications, selectedHomeId, filter]);

  if (!isOpen) return null;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'post_announcement':
        return {
          icon: <Megaphone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
          bg: 'bg-amber-100 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800/60'
        };
      case 'post':
        return {
          icon: <Heart className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
          bg: 'bg-rose-100 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800/60'
        };
      case 'comment':
      case 'comment_reply':
        return {
          icon: <MessageSquare className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />,
          bg: 'bg-teal-100 dark:bg-teal-950/80 border-teal-200 dark:border-teal-800/60'
        };
      case 'post_reaction':
      case 'reaction':
        return {
          icon: <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />,
          bg: 'bg-pink-100 dark:bg-pink-950/80 border-pink-200 dark:border-pink-800/60'
        };
      case 'message_dm':
        return {
          icon: <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />,
          bg: 'bg-indigo-100 dark:bg-indigo-950/80 border-indigo-200 dark:border-indigo-800/60'
        };
      case 'message_mention':
      case 'message_reply':
        return {
          icon: <MessageSquare className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />,
          bg: 'bg-violet-100 dark:bg-violet-950/80 border-violet-200 dark:border-violet-800/60'
        };
      case 'message_family':
      case 'message':
        return {
          icon: <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
          bg: 'bg-blue-100 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800/60'
        };
      case 'event_reminder':
      case 'event_starting_soon':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />,
          bg: 'bg-orange-100 dark:bg-orange-950/80 border-orange-200 dark:border-orange-800/60'
        };
      case 'event_created':
      case 'event_rsvp':
      case 'event':
        return {
          icon: <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
          bg: 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800/60'
        };
      case 'memory_created':
      case 'memory_reaction':
        return {
          icon: <Camera className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />,
          bg: 'bg-purple-100 dark:bg-purple-950/80 border-purple-200 dark:border-purple-800/60'
        };
      case 'ask_homely_action':
      case 'ask_homely_reminder':
      case 'ask_homely_result':
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />,
          bg: 'bg-cyan-100 dark:bg-cyan-950/80 border-cyan-200 dark:border-cyan-800/60'
        };
      case 'member_joined':
      case 'member_role_changed':
      case 'home_invite_regenerated':
        return {
          icon: <Users className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />,
          bg: 'bg-stone-100 dark:bg-zinc-800 border-stone-200 dark:border-zinc-700'
        };
      default:
        return {
          icon: <Bell className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />,
          bg: 'bg-indigo-100 dark:bg-indigo-950/80 border-indigo-200 dark:border-indigo-800/60'
        };
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const currentHomeName = (homeId: string) => {
    const found = homes.find(h => h.id === homeId);
    return found?.name || 'Family';
  };

  const renderNotificationCard = (n: NotificationItem) => {
    const iconData = getNotificationIcon(n.type);
    const isUnread = !n.read;

    return (
      <div
        key={n.id}
        onClick={() => handleNotificationClick(n)}
        className={`group relative p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer flex items-start space-x-3.5 ${
          isUnread
            ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/35 hover:border-indigo-200 dark:hover:border-indigo-800'
            : 'bg-white dark:bg-zinc-900/60 border-stone-100 dark:border-zinc-800/70 hover:bg-stone-50 dark:hover:bg-zinc-800/40 hover:border-stone-200 dark:hover:border-zinc-700'
        }`}
      >
        {/* Unread Accent Indicator */}
        {isUnread && (
          <span className="absolute top-4 right-3.5 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-950" />
        )}

        {/* Sender Avatar & Type Icon Badge */}
        <div className="relative shrink-0 mt-0.5">
          {n.sender?.avatar ? (
            <img
              src={n.sender.avatar}
              alt={n.sender.name || 'Member'}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-2xl object-cover border border-stone-200/80 dark:border-zinc-700"
            />
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-stone-100 dark:bg-zinc-800 border border-stone-200/60 dark:border-zinc-700 flex items-center justify-center text-xs font-bold text-stone-700 dark:text-stone-300">
              {n.sender?.name ? n.sender.name.slice(0, 2).toUpperCase() : <Bell className="w-4 h-4 text-stone-400" />}
            </div>
          )}

          {/* Type Icon Overlay Badge */}
          <div
            className={`absolute -bottom-1 -right-1 p-1 rounded-lg shadow-xs border ${iconData.bg}`}
          >
            {iconData.icon}
          </div>
        </div>

        {/* Details & Preview */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center space-x-1.5 mb-0.5">
            <p className={`text-xs font-semibold leading-tight truncate ${isUnread ? 'text-stone-900 dark:text-stone-100 font-bold' : 'text-stone-800 dark:text-stone-200'}`}>
              {n.title}
            </p>
          </div>

          {n.body && (
            <p className="text-[12px] text-stone-600 dark:text-stone-400 leading-snug line-clamp-2 mt-0.5">
              {n.body}
            </p>
          )}

          {/* Footer Metadata */}
          <div className="flex items-center space-x-2 mt-1.5 text-[10px] text-stone-400 dark:text-stone-500">
            <span>{formatTimestamp(n.createdAt)}</span>
            {homes.length > 1 && (
              <>
                <span>•</span>
                <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-400 font-medium">
                  <HomeIcon className="w-2.5 h-2.5 mr-0.5" />
                  {n.homeName || currentHomeName(n.homeId)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Hover Quick Actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-2.5 right-2.5 flex items-center space-x-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xs p-1 rounded-xl shadow-xs border border-stone-200 dark:border-zinc-700">
          {isUnread && (
            <button
              onClick={e => handleMarkSingleRead(e, n.id)}
              title="Mark as read"
              className="p-1 text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={e => handleDeleteNotification(e, n.id)}
            title="Delete notification"
            className="p-1 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const totalUnread = notifications.filter(n => !n.read).length;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in">
        <div
          id="drawer-notifications"
          className="w-full max-w-md h-full bg-white dark:bg-zinc-900 border-l border-stone-200 dark:border-zinc-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        >
          {/* Top Header */}
          <div className="p-4 sm:p-5 pb-3 border-b border-stone-100 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-2">
                    <span>Notifications</span>
                    {totalUnread > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-xs">
                        {totalUnread} new
                      </span>
                    )}
                  </h3>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center space-x-1">
                {totalUnread > 0 && (
                  <button
                    id="btn-mark-all-read"
                    onClick={handleMarkAllRead}
                    title="Mark all as read"
                    className="p-2 rounded-xl text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}

                <button
                  id="btn-notification-preferences"
                  onClick={() => setIsPreferencesOpen(true)}
                  title="Notification settings"
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>

                <button
                  id="btn-close-notifications"
                  onClick={onClose}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification Notice Banner */}
            {actionNotice && (
              <div className="p-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs flex items-center space-x-1.5 animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>{actionNotice}</span>
              </div>
            )}

            {/* Filter Tabs & Home Scoping */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center p-0.5 rounded-xl bg-stone-100 dark:bg-zinc-800/80 text-xs">
                <button
                  id="filter-notifications-all"
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    filter === 'all'
                      ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  id="filter-notifications-unread"
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
                    filter === 'unread'
                      ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                  }`}
                >
                  <span>Unread</span>
                  {totalUnread > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  )}
                </button>
              </div>

              {/* Multi-home filter selector */}
              {homes.length > 1 && (
                <select
                  value={selectedHomeId}
                  onChange={e => setSelectedHomeId(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-stone-700 dark:text-stone-300 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Homes</option>
                  {homes.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {loading && notifications.length === 0 ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="p-3.5 rounded-2xl border border-stone-100 dark:border-zinc-800 flex items-start space-x-3.5 animate-pulse"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-stone-200 dark:bg-zinc-800" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 w-1/3 bg-stone-200 dark:bg-zinc-800 rounded-md" />
                      <div className="h-2.5 w-3/4 bg-stone-100 dark:bg-zinc-800/60 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : groupedNotifications.totalCount === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-stone-400 p-6">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-zinc-800 flex items-center justify-center text-stone-400 dark:text-stone-500 mb-3">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-stone-700 dark:text-stone-300">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 max-w-xs">
                  {filter === 'unread'
                    ? 'You have caught up with all family alerts and messages.'
                    : 'Activity from chats, posts, events, memories, and family members will appear here.'}
                </p>
              </div>
            ) : (
              <>
                {/* Today Section */}
                {groupedNotifications.today.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                        Today
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {groupedNotifications.today.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {groupedNotifications.today.map(renderNotificationCard)}
                    </div>
                  </div>
                )}

                {/* Yesterday Section */}
                {groupedNotifications.yesterday.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                        Yesterday
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {groupedNotifications.yesterday.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {groupedNotifications.yesterday.map(renderNotificationCard)}
                    </div>
                  </div>
                )}

                {/* Earlier Section */}
                {groupedNotifications.earlier.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                        Earlier
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {groupedNotifications.earlier.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {groupedNotifications.earlier.map(renderNotificationCard)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
      />
    </>
  );
};
