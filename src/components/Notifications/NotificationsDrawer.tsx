import React, { useEffect, useState } from 'react';
import { Bell, X, CheckCheck, MessageSquare, Heart, Calendar, Megaphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { NotificationItem } from '../../types';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ isOpen, onClose }) => {
  const { activeHome, setUnreadCount } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifs = async () => {
    if (!activeHome) return;
    setLoading(true);
    try {
      const res = await api.getNotifications(activeHome.id);
      setNotifications(res.notifications);
      const unread = res.notifications.filter(n => !n.read).length;
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
    if (!activeHome) return;
    try {
      await api.markNotificationsRead(activeHome.id);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Error marking read:', err);
    }
  };

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'post':
        return <Megaphone className="w-3.5 h-3.5 text-indigo-600" />;
      case 'comment':
        return <MessageSquare className="w-3.5 h-3.5 text-blue-600" />;
      case 'event':
        return <Calendar className="w-3.5 h-3.5 text-amber-600" />;
      case 'reaction':
        return <Heart className="w-3.5 h-3.5 text-rose-600" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-indigo-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm h-full bg-white dark:bg-zinc-900 border-l border-stone-200 dark:border-zinc-800 p-5 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Family Activity
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            {notifications.some(n => !n.read) && (
              <button
                onClick={handleMarkAllRead}
                title="Mark all as read"
                className="p-1 text-stone-400 hover:text-indigo-600"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-center text-stone-400">
              <Bell className="w-8 h-8 text-stone-300 dark:text-zinc-700 mb-2" />
              <p className="text-xs font-semibold">No recent notifications</p>
              <p className="text-[10px] text-stone-400 mt-1">You're completely up to date!</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className={`p-3 rounded-2xl border transition-colors flex items-start space-x-3 ${
                  n.read
                    ? 'bg-transparent border-stone-100 dark:border-zinc-800/80 text-stone-600 dark:text-stone-400'
                    : 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/60 text-stone-900 dark:text-stone-100'
                }`}
              >
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 shadow-xs shrink-0 mt-0.5">
                  {getIcon(n.type)}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold">{n.title}</p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-2">
                    {n.body}
                  </p>
                  <span className="text-[9px] text-stone-400 mt-1 block">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
