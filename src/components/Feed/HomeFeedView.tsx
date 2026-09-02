import React, { useState, useEffect } from 'react';
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
  Share2, 
  Smile, 
  Clock,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { Post } from '../../types';

const SAMPLE_PHOTO_PRESETS = [
  'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80'
];

export const HomeFeedView: React.FC = () => {
  const { activeHome, user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New post state
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'update' | 'photo' | 'announcement' | 'memory'>('update');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active expanded comments
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});

  const fetchPosts = async () => {
    if (!activeHome) return;
    try {
      setError(null);
      const res = await api.getPosts(activeHome.id);
      setPosts(res.posts);
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [activeHome?.id]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHome || !content.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.createPost(activeHome.id, content.trim(), postType, imageUrl ? imageUrl.trim() : undefined);
      setPosts(prev => [res.post, ...prev]);
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
      setPostType('update');
    } catch (err: any) {
      alert(err.message || 'Could not create post');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReaction = async (postId: string, emoji: string) => {
    if (!activeHome) return;
    try {
      await api.toggleReaction(activeHome.id, postId, emoji);
      // Refresh posts to sync reactions smoothly
      await fetchPosts();
    } catch (err) {
      console.warn('Reaction error:', err);
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!activeHome || !text) return;

    setCommentSubmitting(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await api.addComment(activeHome.id, postId, text);
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            comments: [...p.comments, res.comment]
          };
        }
        return p;
      }));
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err: any) {
      alert(err.message || 'Could not add comment');
    } finally {
      setCommentSubmitting(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!activeHome) return;
    if (!confirm('Are you sure you want to delete this family post?')) return;

    try {
      await api.deletePost(activeHome.id, postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err: any) {
      alert(err.message || 'Could not delete post');
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div id="homely-feed-container" className="max-w-md md:max-w-2xl mx-auto px-4 py-4 space-y-4 pb-24">
      {/* Create Post Card */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl shadow-sm p-4 sm:p-5 transition-colors">
        <form onSubmit={handleCreatePost}>
          <div className="flex items-start space-x-3">
            <img
              src={user?.avatar}
              alt=""
              className="w-10 h-10 rounded-full bg-stone-100 dark:bg-zinc-800 border border-indigo-100 dark:border-indigo-900/60 object-cover shrink-0"
            />
            <div className="flex-1">
              <textarea
                id="input-feed-post-content"
                rows={2}
                placeholder={`Share a moment with the ${activeHome?.name || 'family'}...`}
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full bg-transparent border-0 resize-none text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-0 leading-relaxed"
              />

              {showImageInput && (
                <div className="mt-2 space-y-2 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/60 dark:border-zinc-700/60">
                  <input
                    type="url"
                    placeholder="Paste image URL..."
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-stone-400 font-medium">Quick presets:</span>
                    {SAMPLE_PHOTO_PRESETS.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setImageUrl(p)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-stone-200 dark:bg-zinc-700 hover:bg-stone-300 dark:hover:bg-zinc-600 text-stone-700 dark:text-stone-300"
                      >
                        Photo {i + 1}
                      </button>
                    ))}
                  </div>
                  {imageUrl && (
                    <div className="relative mt-2 rounded-xl overflow-hidden max-h-48 border border-stone-200 dark:border-zinc-700">
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Post Type Chips & Submit */}
          <div className="mt-3 pt-3 border-t border-stone-100 dark:border-zinc-800/80 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5">
              <button
                type="button"
                onClick={() => setPostType('update')}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                  postType === 'update'
                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800'
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
                className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                  postType === 'photo' || showImageInput
                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Photo</span>
              </button>
              <button
                type="button"
                onClick={() => setPostType('announcement')}
                className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                  postType === 'announcement'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                    : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>Notice</span>
              </button>
              <button
                type="button"
                onClick={() => setPostType('memory')}
                className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                  postType === 'memory'
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                    : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Memory</span>
              </button>
            </div>

            <button
              id="btn-submit-post"
              type="submit"
              disabled={!content.trim() || submitting}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
            >
              {submitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Post</span>
                  <Send className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-stone-200/80 dark:border-zinc-800 animate-pulse space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-zinc-800" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-28 h-3.5 bg-stone-200 dark:bg-zinc-800 rounded" />
                  <div className="w-16 h-2.5 bg-stone-200 dark:bg-zinc-800 rounded" />
                </div>
              </div>
              <div className="w-3/4 h-3 bg-stone-200 dark:bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex justify-between items-center">
          <span>{error}</span>
          <button onClick={fetchPosts} className="font-semibold underline">Retry</button>
        </div>
      )}

      {/* Empty State */}
      {!loading && posts.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-8 text-center space-y-3 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
            <Heart className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
            No family moments yet
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mx-auto leading-relaxed">
            Be the first to share an update, childhood memory, or photo with {activeHome?.name || 'the family'}.
          </p>
        </div>
      )}

      {/* Posts List */}
      {!loading && posts.map(post => {
        const isAuthor = post.author.id === user?.id;
        const commentsOpen = expandedComments[post.id];
        const emojis = ['❤️', '🤗', '🎉', '👏', '😍'];

        return (
          <article
            key={post.id}
            id={`post-${post.id}`}
            className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl shadow-sm p-4 sm:p-5 transition-colors space-y-3"
          >
            {/* Author Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={post.author.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${post.author.name}`}
                  alt=""
                  className="w-10 h-10 rounded-full bg-stone-100 dark:bg-zinc-800 border border-indigo-100 dark:border-indigo-900/60 object-cover"
                />
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                      {post.author.name}
                    </span>
                    {post.type === 'announcement' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                        Notice
                      </span>
                    )}
                    {post.type === 'memory' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300">
                        Memory
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 text-[11px] text-stone-400">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(post.createdAt)}</span>
                  </div>
                </div>
              </div>

              {isAuthor && (
                <button
                  onClick={() => handleDeletePost(post.id)}
                  title="Delete post"
                  className="p-1.5 text-stone-400 hover:text-rose-500 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Post Content */}
            <div className="text-sm text-stone-800 dark:text-stone-200 whitespace-pre-line leading-relaxed">
              {post.content}
            </div>

            {/* Post Image (if any) */}
            {post.imageUrl && (
              <div className="rounded-2xl overflow-hidden border border-stone-200/80 dark:border-zinc-800 max-h-80 bg-stone-100 dark:bg-zinc-800">
                <img
                  src={post.imageUrl}
                  alt="Post visual"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Reactions & Comments Count Bar */}
            <div className="pt-2 border-t border-stone-100 dark:border-zinc-800/80 flex items-center justify-between flex-wrap gap-2">
              {/* Emoji Reaction Buttons */}
              <div className="flex items-center space-x-1 sm:space-x-1.5 flex-wrap">
                {emojis.map(emoji => {
                  const detail = post.reactions[emoji];
                  const hasReacted = detail?.hasReacted;
                  const count = detail?.count || 0;

                  return (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(post.id, emoji)}
                      className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-transform active:scale-90 ${
                        hasReacted
                          ? 'bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-semibold'
                          : 'bg-stone-100 dark:bg-zinc-800/80 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      <span>{emoji}</span>
                      {count > 0 && <span className="text-[11px] font-bold">{count}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Comment Toggle */}
              <button
                onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                className="flex items-center space-x-1 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 font-medium py-1 px-2 rounded-lg"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>
                  {post.comments.length > 0 ? `${post.comments.length} Comments` : 'Comment'}
                </span>
              </button>
            </div>

            {/* Comment Section (Accordion) */}
            {commentsOpen && (
              <div className="pt-3 border-t border-stone-100 dark:border-zinc-800/80 space-y-3 animate-in fade-in duration-150">
                {post.comments.map(c => (
                  <div key={c.id} className="flex items-start space-x-2 text-xs">
                    <img
                      src={c.author.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${c.author.name}`}
                      alt=""
                      className="w-6 h-6 rounded-full bg-stone-100 dark:bg-zinc-800 mt-0.5 shrink-0"
                    />
                    <div className="flex-1 bg-stone-50 dark:bg-zinc-800/60 rounded-2xl p-2.5 border border-stone-200/50 dark:border-zinc-700/50">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900 dark:text-stone-100">
                          {c.author.name}
                        </span>
                        <span className="text-[10px] text-stone-400">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-stone-700 dark:text-stone-300 mt-0.5">{c.content}</p>
                    </div>
                  </div>
                ))}

                {/* Add comment input */}
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="text"
                    placeholder="Write a warm reply..."
                    value={commentInputs[post.id] || ''}
                    onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddComment(post.id);
                      }
                    }}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/50 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => handleAddComment(post.id)}
                    disabled={!commentInputs[post.id]?.trim() || commentSubmitting[post.id]}
                    className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors"
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
  );
};
