import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Sparkles, 
  Image as ImageIcon, 
  Megaphone, 
  BookOpen, 
  Trash2, 
  Plus, 
  Smile, 
  Clock, 
  Check,
  Copy,
  Calendar,
  MapPin,
  Users,
  Settings,
  Pin,
  ChevronRight,
  Bot,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { Post, FamilyEvent, FamilyMemory, HomeMember, ActiveTab } from '../../types';
import { HomeSettingsModal } from '../HomeManagement/HomeSettingsModal';

const SAMPLE_PHOTO_PRESETS = [
  'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80'
];

interface HomeFeedViewProps {
  onNavigate?: (tab: ActiveTab, subTab?: string) => void;
}

export const HomeFeedView: React.FC<HomeFeedViewProps> = ({ onNavigate }) => {
  const { activeHome, user, userRole } = useAuth();
  
  // Dashboard state
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [notices, setNotices] = useState<Post[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<FamilyEvent[]>([]);
  const [memories, setMemories] = useState<FamilyMemory[]>([]);
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // Post composer state
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'update' | 'photo' | 'announcement' | 'memory'>('update');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [postMessage, setPostMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Comments state
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});

  // Quick modals & actions
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'appearance' | 'members' | 'invite'>('general');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Quick Create Event modal
  const [showQuickEventModal, setShowQuickEventModal] = useState(false);
  const [quickEventTitle, setQuickEventTitle] = useState('');
  const [quickEventDate, setQuickEventDate] = useState('');
  const [quickEventTime, setQuickEventTime] = useState('18:00');
  const [quickEventLocation, setQuickEventLocation] = useState('');
  const [quickEventSubmitting, setQuickEventSubmitting] = useState(false);

  // Quick Add Memory modal
  const [showQuickMemoryModal, setShowQuickMemoryModal] = useState(false);
  const [quickMemoryTitle, setQuickMemoryTitle] = useState('');
  const [quickMemoryStory, setQuickMemoryStory] = useState('');
  const [quickMemoryImage, setQuickMemoryImage] = useState('');
  const [quickMemorySubmitting, setQuickMemorySubmitting] = useState(false);

  const postInputRef = useRef<HTMLTextAreaElement>(null);

  const canManageHome = userRole === 'owner' || userRole === 'admin';

  // Load Dashboard Data
  const loadDashboard = async () => {
    if (!activeHome) return;
    try {
      setDashboardError(null);
      const data = await api.getHomeDashboard(activeHome.id);
      setPosts(data.posts || []);
      setNotices(data.notices || []);
      setUpcomingEvents(data.upcomingEvents || []);
      setMemories(data.memories || []);
      setMembers(data.members || []);
      setRecentActivity(data.recentActivity || []);
    } catch (err: any) {
      setDashboardError(err.message || 'Failed to load family dashboard');
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    setDashboardLoading(true);
    loadDashboard();
  }, [activeHome?.id]);

  // Handle Post Creation
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHome || !content.trim()) return;

    setSubmittingPost(true);
    setPostMessage(null);
    try {
      const res = await api.createPost(
        activeHome.id, 
        content.trim(), 
        postType, 
        imageUrl ? imageUrl.trim() : undefined
      );

      setPosts(prev => [res.post, ...prev]);
      if (postType === 'announcement') {
        setNotices(prev => [res.post, ...prev]);
      }

      setContent('');
      setImageUrl('');
      setShowImageInput(false);
      setPostType('update');
      setPostMessage({ type: 'success', text: 'Moment shared with family!' });
      setTimeout(() => setPostMessage(null), 3000);
      loadDashboard();
    } catch (err: any) {
      setPostMessage({ type: 'error', text: err.message || 'Could not create post' });
    } finally {
      setSubmittingPost(false);
    }
  };

  // Helper to safely extract reaction stats whether reactions is a Record or Array
  const getReactionDetail = (reactions: any, emoji: string): { count: number; hasReacted: boolean } => {
    if (!reactions) return { count: 0, hasReacted: false };
    if (Array.isArray(reactions)) {
      const found = reactions.find(r => r && (r.emoji === emoji || r.type === emoji));
      if (!found) return { count: 0, hasReacted: false };
      const hasReacted = Boolean(
        found.hasReacted ||
        (user && (found.users?.includes(user.id) || found.userIds?.includes(user.id)))
      );
      return { count: found.count || (found.users?.length ?? 0), hasReacted };
    }
    if (typeof reactions === 'object' && reactions[emoji]) {
      const r = reactions[emoji];
      const hasReacted = Boolean(
        r.hasReacted ||
        (user && r.userIds?.includes(user.id))
      );
      return { count: r.count || 0, hasReacted };
    }
    return { count: 0, hasReacted: false };
  };

  // Toggle Reactions
  const handleReaction = async (postId: string, emoji: string) => {
    if (!activeHome) return;
    try {
      await api.toggleReaction(activeHome.id, postId, emoji);
      const res = await api.getPosts(activeHome.id);
      setPosts(res.posts);
      setNotices(res.posts.filter(p => p.type === 'announcement'));
    } catch (err) {
      console.warn('Reaction error:', err);
    }
  };

  // Add Comment
  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!activeHome || !text) return;

    setCommentSubmitting(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await api.addComment(activeHome.id, postId, text);
      const updateList = (prevList: Post[]) =>
        prevList.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: [...(p.comments || []), res.comment]
            };
          }
          return p;
        });

      setPosts(updateList);
      setNotices(updateList);
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err: any) {
      console.error('Comment error:', err);
    } finally {
      setCommentSubmitting(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Delete Post
  const handleDeletePost = async (postId: string) => {
    if (!activeHome) return;
    if (!window.confirm('Delete this moment from the family feed?')) return;

    try {
      await api.deletePost(activeHome.id, postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      setNotices(prev => prev.filter(p => p.id !== postId));
    } catch (err: any) {
      console.error('Delete post error:', err);
    }
  };

  // RSVP for Upcoming Event directly from Dashboard
  const handleRsvpToggle = async (eventId: string) => {
    if (!activeHome) return;
    try {
      const res = await api.toggleRsvp(activeHome.id, eventId);
      if (res) {
        setUpcomingEvents(prev =>
          prev.map(evt => {
            if (evt.id === eventId) {
              const newAttendees = res.isAttending
                ? [...(evt.attendeeIds || []), user!.id]
                : (evt.attendeeIds || []).filter(id => id !== user!.id);
              return {
                ...evt,
                isAttending: res.isAttending,
                attendeeIds: newAttendees
              };
            }
            return evt;
          })
        );
      }
    } catch (err) {
      console.warn('RSVP error:', err);
    }
  };

  // Quick Event Creation
  const handleQuickCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHome || !quickEventTitle.trim() || !quickEventDate) return;

    setQuickEventSubmitting(true);
    try {
      const newEvt = await api.createEvent(activeHome.id, {
        title: quickEventTitle.trim(),
        date: quickEventDate,
        time: quickEventTime || '18:00',
        description: '',
        location: quickEventLocation.trim() || undefined
      });
      setUpcomingEvents(prev => [newEvt.event, ...prev].slice(0, 4));
      setShowQuickEventModal(false);
      setQuickEventTitle('');
      setQuickEventDate('');
      setQuickEventLocation('');
      loadDashboard();
    } catch (err: any) {
      console.error('Create event error:', err);
    } finally {
      setQuickEventSubmitting(false);
    }
  };

  // Quick Memory Creation
  const handleQuickAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHome || !quickMemoryTitle.trim() || !quickMemoryStory.trim()) return;

    setQuickMemorySubmitting(true);
    try {
      const newMem = await api.createMemory(activeHome.id, {
        title: quickMemoryTitle.trim(),
        story: quickMemoryStory.trim(),
        date: new Date().toISOString().split('T')[0],
        imageUrl: quickMemoryImage.trim() || undefined
      });
      setMemories(prev => [newMem.memory, ...prev].slice(0, 6));
      setShowQuickMemoryModal(false);
      setQuickMemoryTitle('');
      setQuickMemoryStory('');
      setQuickMemoryImage('');
      loadDashboard();
    } catch (err: any) {
      console.error('Add memory error:', err);
    } finally {
      setQuickMemorySubmitting(false);
    }
  };

  // Copy invite code helper
  const handleCopyInvite = () => {
    if (!activeHome?.inviteCode) return;
    navigator.clipboard.writeText(activeHome.inviteCode);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const focusPostComposer = (type: 'update' | 'photo' | 'announcement' | 'memory' = 'update') => {
    setPostType(type);
    if (type === 'photo') setShowImageInput(true);
    postInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    postInputRef.current?.focus();
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days === 1) return 'Yesterday';
      return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatCalendarBadge = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const month = d.toLocaleDateString(undefined, { month: 'short' });
      const day = d.getDate();
      return { month, day };
    } catch {
      return { month: 'DATE', day: '•' };
    }
  };

  if (!activeHome) return null;

  return (
    <div className="pb-24 pt-3 px-3 sm:px-4 space-y-6 max-w-3xl mx-auto">
      {/* 1. FAMILY DASHBOARD HEADER */}
      <section 
        id="family-home-header" 
        className="relative rounded-3xl overflow-hidden border border-stone-200/80 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-900 transition-all"
      >
        {/* Cover Banner with atmospheric gradient overlay */}
        <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-stone-100 dark:bg-zinc-800">
          <img
            src={activeHome.coverImage || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80'}
            alt={`${activeHome.name} Cover`}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Top Quick Badges */}
          <div className="absolute top-3 right-3 flex items-center space-x-2">
            <button
              id="btn-copy-code-header"
              type="button"
              onClick={handleCopyInvite}
              className="px-2.5 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white text-[11px] font-medium flex items-center space-x-1.5 transition-all shadow-sm"
              title="Copy family invite code"
            >
              {copiedInvite ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white/80" />
                  <span className="font-mono tracking-wider">{activeHome.inviteCode}</span>
                </>
              )}
            </button>

            <button
              id="btn-header-customize-home"
              type="button"
              onClick={() => {
                setSettingsTab('general');
                setIsSettingsModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-stone-900 text-xs font-semibold backdrop-blur-md shadow-md transition-all flex items-center space-x-1.5 hover:scale-105"
            >
              <Settings className="w-3.5 h-3.5 text-stone-700" />
              <span>{canManageHome ? 'Customize Home' : 'Home Info'}</span>
            </button>
          </div>
        </div>

        {/* Profile Info Row Overlapping Cover */}
        <div className="px-5 pb-5 pt-0 -mt-10 sm:-mt-12 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-end space-x-3.5">
            {/* Avatar & Icon Badge */}
            <div className="relative flex-shrink-0">
              <img
                src={activeHome.avatar}
                alt={activeHome.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl border-4 border-white dark:border-zinc-900 object-cover shadow-md bg-white dark:bg-zinc-800"
              />
              <div 
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-white dark:bg-zinc-900 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-sm shadow-sm"
                style={{ color: activeHome.themeColor || '#4f46e5' }}
              >
                {activeHome.icon || '🏡'}
              </div>
            </div>

            {/* Home Title & Description */}
            <div className="pb-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-bold font-serif text-stone-900 dark:text-stone-100 tracking-tight line-clamp-1">
                  {activeHome.name}
                </h1>
                <span 
                  className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase"
                  style={{ 
                    backgroundColor: `${activeHome.themeColor || '#4f46e5'}15`, 
                    color: activeHome.themeColor || '#4f46e5' 
                  }}
                >
                  Family Sanctuary
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 line-clamp-2 max-w-md mt-0.5">
                {activeHome.description || 'Our private family space for memories, updates, and daily moments.'}
              </p>
            </div>
          </div>

          {/* Members Avatar Preview Stack */}
          <div className="flex items-center justify-between sm:justify-end space-x-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-zinc-800">
            <button
              onClick={() => onNavigate?.('family', 'members')}
              className="flex items-center space-x-2 group text-left"
              title="View all family members"
            >
              <div className="flex -space-x-2 overflow-hidden">
                {members.slice(0, 4).map((member, i) => (
                  <img
                    key={member.id || i}
                    src={member.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(member.name)}`}
                    alt={member.name}
                    className="inline-block w-7 h-7 rounded-full ring-2 ring-white dark:ring-zinc-900 object-cover"
                  />
                ))}
                {members.length > 4 && (
                  <div className="w-7 h-7 rounded-full bg-stone-200 dark:bg-zinc-800 ring-2 ring-white dark:ring-zinc-900 flex items-center justify-center text-[10px] font-bold text-stone-600 dark:text-stone-300">
                    +{members.length - 4}
                  </div>
                )}
              </div>
              <span className="text-xs font-medium text-stone-600 dark:text-stone-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. QUICK ACTIONS ROW */}
      <section id="family-quick-actions" className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <button
          id="btn-action-post"
          onClick={() => focusPostComposer('update')}
          className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800/80 hover:border-indigo-300 dark:hover:border-indigo-700/60 shadow-xs hover:shadow-sm transition-all flex items-center space-x-2.5 group text-left"
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <Plus className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block truncate">Share Update</span>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">Post moment</span>
          </div>
        </button>

        <button
          id="btn-action-memory"
          onClick={() => setShowQuickMemoryModal(true)}
          className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800/80 hover:border-amber-300 dark:hover:border-amber-700/60 shadow-xs hover:shadow-sm transition-all flex items-center space-x-2.5 group text-left"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block truncate">Add Memory</span>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">Family album</span>
          </div>
        </button>

        <button
          id="btn-action-event"
          onClick={() => setShowQuickEventModal(true)}
          className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800/80 hover:border-emerald-300 dark:hover:border-emerald-700/60 shadow-xs hover:shadow-sm transition-all flex items-center space-x-2.5 group text-left"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block truncate">Plan Event</span>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">Family calendar</span>
          </div>
        </button>

        <button
          id="btn-action-chat"
          onClick={() => onNavigate?.('chat')}
          className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800/80 hover:border-violet-300 dark:hover:border-violet-700/60 shadow-xs hover:shadow-sm transition-all flex items-center space-x-2.5 group text-left"
        >
          <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block truncate">Family Chat</span>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">Living room</span>
          </div>
        </button>

        <button
          id="btn-action-ask"
          onClick={() => onNavigate?.('ask')}
          className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800/80 hover:border-purple-300 dark:hover:border-purple-700/60 shadow-xs hover:shadow-sm transition-all flex items-center space-x-2.5 group text-left"
        >
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block truncate">Ask Homely</span>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">Family assistant</span>
          </div>
        </button>
      </section>

      {/* 3. PROMINENT NOTICES / ANNOUNCEMENTS */}
      {notices.length > 0 && (
        <section id="family-notices-section" className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 font-sans">
              Important Family Notices
            </h2>
          </div>

          <div className="space-y-3">
            {notices.slice(0, 2).map(notice => (
              <div
                key={notice.id}
                className="relative p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/15 dark:via-zinc-900 dark:to-zinc-900 border-2 border-amber-300/80 dark:border-amber-800/60 shadow-sm space-y-3"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={notice.author.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(notice.author.name)}`}
                      alt={notice.author.name}
                      className="w-8 h-8 rounded-full border border-amber-300/60 object-cover"
                    />
                    <div>
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
                        {notice.author.name}
                      </span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400">
                        {formatRelativeTime(notice.createdAt)}
                      </span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center space-x-1">
                    <Megaphone className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Announcement</span>
                  </span>
                </div>

                {/* Content */}
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200 leading-relaxed">
                  {notice.content}
                </p>

                {notice.imageUrl && (
                  <div className="rounded-2xl overflow-hidden max-h-60 border border-amber-200/60 dark:border-amber-900/40">
                    <img src={notice.imageUrl} alt="Announcement visual" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Interaction Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-amber-200/50 dark:border-amber-900/40 text-xs">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleReaction(notice.id, '❤️')}
                      className={`px-2.5 py-1 rounded-xl text-xs flex items-center space-x-1 transition-colors border ${
                        getReactionDetail(notice.reactions, '❤️').hasReacted
                          ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 font-semibold'
                          : 'bg-white/80 dark:bg-zinc-800/80 hover:bg-white text-stone-700 dark:text-stone-300 border-amber-200/60 dark:border-zinc-700'
                      }`}
                    >
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      <span>{getReactionDetail(notice.reactions, '❤️').count}</span>
                    </button>
                    <button
                      onClick={() => handleReaction(notice.id, '👍')}
                      className={`px-2.5 py-1 rounded-xl text-xs flex items-center space-x-1 transition-colors border ${
                        getReactionDetail(notice.reactions, '👍').hasReacted
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'bg-white/80 dark:bg-zinc-800/80 hover:bg-white text-stone-700 dark:text-stone-300 border-amber-200/60 dark:border-zinc-700'
                      }`}
                    >
                      <span>👍</span>
                      <span>{getReactionDetail(notice.reactions, '👍').count}</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-stone-500 dark:text-stone-400">
                    {notice.comments?.length || 0} comments
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. UPCOMING EVENTS & MEMORIES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* UPCOMING EVENTS CARD */}
        <section id="dashboard-events-card" className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Upcoming Events
              </h2>
            </div>

            <button
              onClick={() => onNavigate?.('family', 'events')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center space-x-0.5 group"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="py-6 text-center space-y-2 border border-dashed border-stone-200 dark:border-zinc-800 rounded-2xl">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                No upcoming events planned
              </p>
              <button
                onClick={() => setShowQuickEventModal(true)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Plan family dinner or gathering</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.slice(0, 3).map(event => {
                const { month, day } = formatCalendarBadge(event.date);
                const isAttending = event.isAttending;

                return (
                  <div
                    key={event.id}
                    className="p-3 rounded-2xl border border-stone-100 dark:border-zinc-800 bg-stone-50/40 dark:bg-zinc-800/30 flex items-center justify-between gap-3 hover:border-emerald-200 dark:hover:border-emerald-900/60 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Calendar Badge */}
                      <div className="w-11 h-11 rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 flex flex-col items-center justify-center flex-shrink-0 shadow-xs">
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase leading-none">
                          {month}
                        </span>
                        <span className="text-sm font-extrabold text-stone-900 dark:text-stone-100 leading-tight">
                          {day}
                        </span>
                      </div>

                      {/* Event Details */}
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                          {event.title}
                        </h4>
                        <div className="flex items-center space-x-2 text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                          <span className="flex items-center space-x-0.5">
                            <Clock className="w-3 h-3 text-stone-400" />
                            <span>{event.time}</span>
                          </span>
                          {event.location && (
                            <span className="flex items-center space-x-0.5 truncate">
                              <MapPin className="w-3 h-3 text-stone-400 flex-shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick RSVP Button */}
                    <button
                      type="button"
                      onClick={() => handleRsvpToggle(event.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0 transition-all flex items-center space-x-1 ${
                        isAttending
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                          : 'bg-stone-100 dark:bg-zinc-800 hover:bg-emerald-50 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {isAttending && <Check className="w-3 h-3 text-emerald-600" />}
                      <span>{isAttending ? 'Going' : 'RSVP'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* RECENT MEMORIES CARD */}
        <section id="dashboard-memories-card" className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Family Memories
              </h2>
            </div>

            <button
              onClick={() => onNavigate?.('family', 'memories')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center space-x-0.5 group"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {memories.length === 0 ? (
            <div className="py-6 text-center space-y-2 border border-dashed border-stone-200 dark:border-zinc-800 rounded-2xl">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                No memories recorded yet
              </p>
              <button
                onClick={() => setShowQuickMemoryModal(true)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Preserve your first family story</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {memories.slice(0, 2).map(memory => {
                const coverPhoto = (memory.images && memory.images.length > 0) ? memory.images[0] : memory.imageUrl;
                return (
                  <div
                    key={memory.id}
                    onClick={() => onNavigate?.('family', 'memories')}
                    className="cursor-pointer group relative rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/50 hover:border-amber-400 transition-all flex flex-col justify-between p-3 h-36"
                  >
                    {coverPhoto ? (
                      <>
                        <img
                          src={coverPhoto}
                          alt={memory.title}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/30 to-transparent" />
                        <div className="relative z-10 flex justify-end">
                          <span className="text-[10px] text-white/80 font-medium">
                            {memory.date}
                          </span>
                        </div>
                        <div className="relative z-10 text-white">
                          <h4 className="text-xs font-bold font-serif line-clamp-1">
                            {memory.title}
                          </h4>
                          <p className="text-[10px] text-white/80 line-clamp-1 mt-0.5">
                            {memory.story}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col justify-between h-full">
                        <div className="flex items-center justify-between text-stone-400">
                          <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[10px] text-stone-400">{memory.date}</span>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 font-serif line-clamp-1">
                            {memory.title}
                          </h4>
                          <p className="text-[10px] text-stone-500 dark:text-stone-400 line-clamp-2 mt-1">
                            {memory.story}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* 5. RECENT FAMILY ACTIVITY & MEMBERS SUMMARY */}
      <section id="family-activity-section" className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Recent Family Activity
            </h2>
          </div>
          <span className="text-[11px] text-stone-400">Real-time sync</span>
        </div>

        {recentActivity.length === 0 ? (
          <p className="text-xs text-stone-400 py-3 text-center">
            No recent activity recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-zinc-800">
            {recentActivity.slice(0, 4).map(act => (
              <div key={act.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <img
                    src={act.actor?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(act.actor?.name || 'User')}`}
                    alt={act.actor?.name || 'User'}
                    className="w-7 h-7 rounded-full border border-stone-200 dark:border-zinc-700 object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-stone-800 dark:text-stone-200 truncate">
                      <strong className="font-semibold text-stone-900 dark:text-stone-100">{act.actor?.name}</strong> • {act.title}
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                      {act.description}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] text-stone-400 flex-shrink-0">
                  {formatRelativeTime(act.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 6. POST COMPOSER */}
      <section 
        id="family-post-composer"
        className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800/80 shadow-sm space-y-3"
      >
        <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2">
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user?.name || 'You')}`}
              alt="You"
              className="w-8 h-8 rounded-full border border-stone-200 dark:border-zinc-700 object-cover"
            />
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Share with the Family
            </span>
          </div>

          {/* Post Type Selector */}
          <div className="flex items-center space-x-1 bg-stone-100 dark:bg-zinc-800 p-0.5 rounded-xl text-[11px]">
            <button
              type="button"
              onClick={() => setPostType('update')}
              className={`px-2 py-1 rounded-lg font-medium transition-all ${
                postType === 'update' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-stone-500'
              }`}
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => {
                setPostType('photo');
                setShowImageInput(true);
              }}
              className={`px-2 py-1 rounded-lg font-medium transition-all ${
                postType === 'photo' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-stone-500'
              }`}
            >
              Photo
            </button>
            <button
              type="button"
              onClick={() => setPostType('announcement')}
              className={`px-2 py-1 rounded-lg font-medium transition-all ${
                postType === 'announcement' ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-300 shadow-xs' : 'text-stone-500'
              }`}
            >
              Notice
            </button>
          </div>
        </div>

        <form onSubmit={handleCreatePost} className="space-y-3">
          <textarea
            ref={postInputRef}
            rows={2}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={
              postType === 'announcement' 
                ? 'Make an important family announcement (pinned to top)...' 
                : postType === 'photo'
                ? 'Add a caption for this family photo...'
                : "What's happening in our home today?"
            }
            className="w-full text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 px-3.5 py-2.5 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
          />

          {showImageInput && (
            <div className="space-y-2 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/80 dark:border-zinc-700">
              <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
                <span>Select preset photo or paste image URL:</span>
                <button
                  type="button"
                  onClick={() => setShowImageInput(false)}
                  className="text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                type="url"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full text-xs rounded-lg border border-stone-200 dark:border-zinc-700 px-3 py-1.5 bg-white dark:bg-zinc-800"
              />

              <div className="flex items-center space-x-2 overflow-x-auto pt-1">
                {SAMPLE_PHOTO_PRESETS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImageUrl(url)}
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                      imageUrl === url ? 'border-indigo-600 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="Preset" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {postMessage && (
            <div className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 ${
              postMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' 
                : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'
            }`}>
              {postMessage.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{postMessage.text}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowImageInput(!showImageInput)}
              className="text-stone-500 hover:text-indigo-600 dark:text-stone-400 text-xs flex items-center space-x-1.5 px-2 py-1 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ImageIcon className="w-4 h-4" />
              <span>{imageUrl ? 'Change Photo' : 'Add Photo'}</span>
            </button>

            <button
              id="btn-submit-post"
              type="submit"
              disabled={submittingPost || !content.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center space-x-1.5"
            >
              {submittingPost ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sharing...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* 7. FAMILY FEED / MOMENTS STREAM */}
      <section id="family-feed-stream" className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 font-sans">
            Family Moments & Updates
          </h2>
          <button
            onClick={loadDashboard}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1"
            title="Refresh Feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dashboardLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl space-y-2">
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
              No family posts yet
            </p>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              Be the first to share a warm family update, photo, or announcement.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => {
              const isAuthor = post.authorId === user?.id;
              const isAnnouncement = post.type === 'announcement';
              const isCommentsOpen = !!expandedComments[post.id];

              return (
                <article
                  key={post.id}
                  className={`p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border shadow-xs space-y-3 transition-all ${
                    isAnnouncement
                      ? 'border-amber-300/70 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/20 to-white dark:from-amber-950/10 dark:to-zinc-900'
                      : 'border-stone-200/80 dark:border-zinc-800/80'
                  }`}
                >
                  {/* Post Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={post.author.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(post.author.name)}`}
                        alt={post.author.name}
                        className="w-9 h-9 rounded-full border border-stone-200 dark:border-zinc-700 object-cover"
                      />
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                            {post.author.name}
                          </span>
                          {isAnnouncement && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                              Notice
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-stone-400">
                          {formatRelativeTime(post.createdAt)}
                        </span>
                      </div>
                    </div>

                    {isAuthor && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg transition-colors"
                        title="Delete post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Post Text */}
                  <p className="text-xs sm:text-sm text-stone-800 dark:text-stone-200 leading-relaxed">
                    {post.content}
                  </p>

                  {/* Post Image */}
                  {post.imageUrl && (
                    <div className="rounded-2xl overflow-hidden border border-stone-200/80 dark:border-zinc-800 max-h-96">
                      <img
                        src={post.imageUrl}
                        alt="Moment Visual"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Reactions & Comments Bar */}
                  <div className="pt-2 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between">
                    {/* Emoji Reactions */}
                    <div className="flex items-center space-x-1.5">
                      {['❤️', '👏', '😂', '👍'].map(emoji => {
                        const { count, hasReacted } = getReactionDetail(post.reactions, emoji);

                        return (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(post.id, emoji)}
                            className={`px-2 py-1 rounded-xl text-xs flex items-center space-x-1 border transition-all ${
                              hasReacted
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-semibold'
                                : 'bg-stone-50 dark:bg-zinc-800/60 border-stone-200/80 dark:border-zinc-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100'
                            }`}
                          >
                            <span>{emoji}</span>
                            {count > 0 && (
                              <span className="text-[10px]">{count}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Expand Comments */}
                    <button
                      onClick={() =>
                        setExpandedComments(prev => ({
                          ...prev,
                          [post.id]: !prev[post.id]
                        }))
                      }
                      className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-xs flex items-center space-x-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{post.comments?.length || 0}</span>
                    </button>
                  </div>

                  {/* Comments Thread */}
                  {isCommentsOpen && (
                    <div className="pt-3 border-t border-stone-100 dark:border-zinc-800 space-y-3 animate-in fade-in">
                      {post.comments && post.comments.length > 0 && (
                        <div className="space-y-2">
                          {post.comments.map(comment => (
                            <div
                              key={comment.id}
                              className="p-2.5 rounded-2xl bg-stone-50 dark:bg-zinc-800/50 flex items-start space-x-2.5 text-xs"
                            >
                              <img
                                src={comment.author.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(comment.author.name)}`}
                                alt={comment.author.name}
                                className="w-6 h-6 rounded-full border border-stone-200 dark:border-zinc-700 object-cover mt-0.5"
                              />
                              <div className="flex-1">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-bold text-stone-900 dark:text-stone-100">
                                    {comment.author.name}
                                  </span>
                                  <span className="text-[10px] text-stone-400">
                                    {formatRelativeTime(comment.createdAt)}
                                  </span>
                                </div>
                                <p className="text-stone-700 dark:text-stone-300 mt-0.5">
                                  {comment.content}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comment Input */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={commentInputs[post.id] || ''}
                          onChange={e =>
                            setCommentInputs(prev => ({
                              ...prev,
                              [post.id]: e.target.value
                            }))
                          }
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddComment(post.id);
                          }}
                          placeholder="Write a family comment..."
                          className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddComment(post.id)}
                          disabled={commentSubmitting[post.id] || !commentInputs[post.id]?.trim()}
                          className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs disabled:opacity-40"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* QUICK CREATE EVENT MODAL */}
      {showQuickEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl p-5 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-serif">
                  Plan Family Event
                </h3>
              </div>
              <button onClick={() => setShowQuickEventModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateEvent} className="space-y-3">
              <input
                type="text"
                required
                value={quickEventTitle}
                onChange={e => setQuickEventTitle(e.target.value)}
                placeholder="Event name (e.g. Sunday Family Brunch)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  required
                  value={quickEventDate}
                  onChange={e => setQuickEventDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800"
                />
                <input
                  type="time"
                  required
                  value={quickEventTime}
                  onChange={e => setQuickEventTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800"
                />
              </div>

              <input
                type="text"
                value={quickEventLocation}
                onChange={e => setQuickEventLocation(e.target.value)}
                placeholder="Location (e.g. Living Room / Grandpa's house)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800"
              />

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickEventModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickEventSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                >
                  {quickEventSubmitting ? 'Saving...' : 'Plan Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD MEMORY MODAL */}
      {showQuickMemoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl p-5 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-serif">
                  Add Family Memory
                </h3>
              </div>
              <button onClick={() => setShowQuickMemoryModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddMemory} className="space-y-3">
              <input
                type="text"
                required
                value={quickMemoryTitle}
                onChange={e => setQuickMemoryTitle(e.target.value)}
                placeholder="Memory title (e.g. Summer trip to the lake)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800"
              />

              <textarea
                required
                rows={3}
                value={quickMemoryStory}
                onChange={e => setQuickMemoryStory(e.target.value)}
                placeholder="Tell the story of what happened..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 resize-none"
              />

              <input
                type="url"
                value={quickMemoryImage}
                onChange={e => setQuickMemoryImage(e.target.value)}
                placeholder="Photo URL (optional)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800"
              />

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickMemoryModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickMemorySubmitting}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm"
                >
                  {quickMemorySubmitting ? 'Saving...' : 'Save Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HOME SETTINGS MODAL */}
      <HomeSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => {
          setIsSettingsModalOpen(false);
          loadDashboard();
        }}
        defaultTab={settingsTab}
      />
    </div>
  );
};
