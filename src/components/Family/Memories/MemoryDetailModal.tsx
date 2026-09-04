import React, { useState } from 'react';
import {
  X,
  MapPin,
  Calendar,
  Users,
  Heart,
  MessageCircle,
  Share2,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Send,
  Check,
  AlertCircle
} from 'lucide-react';
import type { FamilyMemory, User } from '../../../types';
import { api } from '../../../services/api';

interface MemoryDetailModalProps {
  memory: FamilyMemory;
  currentUser: User | null;
  userRole?: string;
  allMemories: FamilyMemory[];
  onClose: () => void;
  onMemoryUpdated: (updated: FamilyMemory) => void;
  onMemoryDeleted: (memoryId: string) => void;
  onOpenEdit: (memory: FamilyMemory) => void;
  onNavigateToMemory: (memory: FamilyMemory) => void;
}

const EMOJI_OPTIONS = [
  { emoji: '❤️', label: 'Love' },
  { emoji: '😊', label: 'Smile' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🥺', label: 'Touched' },
  { emoji: '✨', label: 'Magic' }
];

export const MemoryDetailModal: React.FC<MemoryDetailModalProps> = ({
  memory,
  currentUser,
  userRole,
  allMemories,
  onClose,
  onMemoryUpdated,
  onMemoryDeleted,
  onOpenEdit,
  onNavigateToMemory
}) => {
  const images = memory.images && memory.images.length > 0
    ? memory.images
    : memory.imageUrl
    ? [memory.imageUrl]
    : [];

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check authorization
  const isCreator = currentUser?.id === memory.creatorId;
  const isAdmin = userRole === 'owner' || userRole === 'admin';
  const canEditOrDelete = isCreator || isAdmin;

  // Previous and next memories in list
  const currentIndex = allMemories.findIndex(m => m.id === memory.id);
  const prevMemory = currentIndex > 0 ? allMemories[currentIndex - 1] : null;
  const nextMemory = currentIndex >= 0 && currentIndex < allMemories.length - 1 ? allMemories[currentIndex + 1] : null;

  // Format date nicely
  const formatDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const handleToggleReaction = async (emoji: string) => {
    try {
      const res = await api.toggleMemoryReaction(memory.homeId, memory.id, emoji);
      if (res.reactions) {
        onMemoryUpdated({
          ...memory,
          reactions: res.reactions
        });
      }
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed || isSubmittingComment) return;

    setIsSubmittingComment(true);
    setCommentError(null);
    try {
      const res = await api.addMemoryComment(memory.homeId, memory.id, trimmed);
      const updatedComments = [...(memory.comments || []), res.comment];
      onMemoryUpdated({
        ...memory,
        comments: updatedComments
      });
      setCommentText('');
    } catch (err: any) {
      setCommentError(err.message || 'Could not post comment. Please try again.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.deleteMemoryComment(memory.homeId, memory.id, commentId);
      const updatedComments = (memory.comments || []).filter(c => c.id !== commentId);
      onMemoryUpdated({
        ...memory,
        comments: updatedComments
      });
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const handleDeleteMemory = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await api.deleteMemory(memory.homeId, memory.id);
      onMemoryDeleted(memory.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete memory:', err);
      setIsDeleting(false);
    }
  };

  const handleCopyShare = async () => {
    try {
      const shareText = `Family Memory: "${memory.title}" (${memory.date})\n${memory.story}`;
      await navigator.clipboard.writeText(shareText);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  return (
    <div
      id="memory-detail-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="memory-detail-modal"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-3xl border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        {/* Navigation arrows for desktop */}
        {prevMemory && (
          <button
            id="btn-prev-memory"
            type="button"
            onClick={() => onNavigateToMemory(prevMemory)}
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-800 text-stone-700 dark:text-stone-200 shadow-md backdrop-blur-sm transition-transform hover:scale-105"
            title={`Previous: ${prevMemory.title}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {nextMemory && (
          <button
            id="btn-next-memory"
            type="button"
            onClick={() => onNavigateToMemory(nextMemory)}
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-800 text-stone-700 dark:text-stone-200 shadow-md backdrop-blur-sm transition-transform hover:scale-105"
            title={`Next: ${nextMemory.title}`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/70 dark:bg-zinc-900/90 shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full">
              Family Memory
            </span>
            <span className="text-xs text-stone-400">•</span>
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400 truncate">
              {formatDate(memory.date)}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Share / Copy button */}
            <button
              id="btn-share-memory"
              type="button"
              onClick={handleCopyShare}
              className="p-2 rounded-xl text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-zinc-800 transition-colors"
              title="Copy memory details"
            >
              {copiedNotification ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            </button>

            {/* Edit button */}
            {canEditOrDelete && (
              <button
                id="btn-edit-memory"
                type="button"
                onClick={() => onOpenEdit(memory)}
                className="p-2 rounded-xl text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                title="Edit memory"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

            {/* Delete button */}
            {canEditOrDelete && (
              <button
                id="btn-delete-memory"
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-xl text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Delete memory"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Close modal */}
            <button
              id="btn-close-memory-modal"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-zinc-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Alert Bar */}
        {showDeleteConfirm && (
          <div className="px-6 py-3 bg-rose-50 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-900/50 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Are you sure you want to permanently delete this memory?</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-white dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-memory"
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteMemory}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-sm disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Memory'}
              </button>
            </div>
          </div>
        )}

        {/* Modal Body: Scrollable */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-8 space-y-6">
          {/* Main Media Carousel / Photo Display */}
          {images.length > 0 && (
            <div className="space-y-3">
              <div className="relative w-full max-h-[55vh] rounded-2xl overflow-hidden bg-black/90 flex items-center justify-center shadow-inner">
                <img
                  src={images[activeImageIndex]}
                  alt={`${memory.title} - ${activeImageIndex + 1}`}
                  className="max-h-[55vh] w-auto max-w-full object-contain mx-auto"
                />

                {/* Left/Right inside image if multiple */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white shadow backdrop-blur-sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white shadow backdrop-blur-sm"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[11px] text-white font-medium">
                      {activeImageIndex + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnails Row */}
              {images.length > 1 && (
                <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                        activeImageIndex === idx
                          ? 'border-amber-500 scale-95 shadow-sm'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="thumbnail" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Story & Info Section */}
          <div className="space-y-4">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 leading-tight">
              {memory.title}
            </h2>

            {/* Metadata Bar */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 dark:text-stone-400 py-2 border-y border-stone-100 dark:border-zinc-800">
              {/* Creator */}
              <div className="flex items-center space-x-2">
                <img
                  src={memory.creator?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${memory.creatorId}`}
                  alt={memory.creator?.name || 'Creator'}
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-stone-200 dark:ring-zinc-700"
                />
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  {memory.creator?.name || 'Family Member'}
                </span>
              </div>

              <span>•</span>

              {/* Date */}
              <div className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>{formatDate(memory.date)}</span>
              </div>

              {/* Location */}
              {memory.location && (
                <>
                  <span>•</span>
                  <div className="flex items-center space-x-1 text-stone-700 dark:text-stone-300">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span className="font-medium">{memory.location}</span>
                  </div>
                </>
              )}
            </div>

            {/* Tagged Family Members */}
            {memory.taggedMembers && memory.taggedMembers.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/70 dark:border-zinc-800 flex items-center flex-wrap gap-2">
                <div className="flex items-center space-x-1 text-xs font-semibold text-stone-600 dark:text-stone-400 mr-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>With:</span>
                </div>
                {memory.taggedMembers.map((tm) => (
                  <div
                    key={tm.id}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-xs text-stone-700 dark:text-stone-300 font-medium shadow-xs"
                  >
                    <img
                      src={tm.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tm.id}`}
                      alt={tm.name}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                    <span>{tm.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Full Story Paragraph */}
            <div className="text-sm sm:text-base text-stone-700 dark:text-stone-200 leading-relaxed font-normal whitespace-pre-line pt-2">
              {memory.story}
            </div>
          </div>

          {/* Reactions Bar */}
          <div className="pt-4 border-t border-stone-100 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Reactions
              </h4>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              {EMOJI_OPTIONS.map((opt) => {
                const reactionData = memory.reactions?.[opt.emoji];
                const count = reactionData?.count || 0;
                const hasReacted = reactionData?.hasReacted || false;

                return (
                  <button
                    key={opt.emoji}
                    type="button"
                    id={`btn-react-${opt.emoji}`}
                    onClick={() => handleToggleReaction(opt.emoji)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      hasReacted
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 shadow-xs'
                        : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-300 hover:border-amber-300 dark:hover:border-amber-600'
                    }`}
                  >
                    <span className="text-sm leading-none">{opt.emoji}</span>
                    <span className="font-semibold">{count > 0 ? count : opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comments Section */}
          <div className="pt-4 border-t border-stone-100 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center space-x-1.5">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Family Comments ({memory.comments?.length || 0})</span>
              </h4>
            </div>

            {/* Comment List */}
            <div className="space-y-3">
              {(!memory.comments || memory.comments.length === 0) ? (
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-zinc-800/40 text-center text-xs text-stone-400">
                  No comments yet. Leave a loving note for the family!
                </div>
              ) : (
                memory.comments.map((comment) => {
                  const canDeleteComment =
                    comment.authorId === currentUser?.id || isCreator || isAdmin;

                  return (
                    <div
                      key={comment.id}
                      className="group flex items-start space-x-3 p-3 rounded-2xl bg-stone-50/70 dark:bg-zinc-800/40 border border-stone-100 dark:border-zinc-800"
                    >
                      <img
                        src={
                          comment.author?.avatar ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.authorId}`
                        }
                        alt={comment.author?.name || 'Commenter'}
                        className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-stone-200 dark:ring-zinc-700 mt-0.5"
                      />
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-stone-800 dark:text-stone-200">
                            {comment.author?.name || 'Family Member'}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] text-stone-400">
                              {new Date(comment.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {canDeleteComment && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(comment.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-rose-500 rounded transition-opacity"
                                title="Delete comment"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} className="space-y-2 pt-2">
              {commentError && (
                <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl">
                  {commentError}
                </div>
              )}
              <div className="flex items-center space-x-2">
                <input
                  id="input-memory-comment"
                  type="text"
                  placeholder="Share a thought or memory..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  id="btn-submit-memory-comment"
                  type="submit"
                  disabled={!commentText.trim() || isSubmittingComment}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center space-x-1 shadow-sm transition-colors shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-between px-5 py-2.5 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900 text-xs text-stone-500">
          <button
            type="button"
            disabled={!prevMemory}
            onClick={() => prevMemory && onNavigateToMemory(prevMemory)}
            className="flex items-center space-x-1 disabled:opacity-30 p-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>
          <span className="text-[11px] text-stone-400">
            {currentIndex + 1} of {allMemories.length}
          </span>
          <button
            type="button"
            disabled={!nextMemory}
            onClick={() => nextMemory && onNavigateToMemory(nextMemory)}
            className="flex items-center space-x-1 disabled:opacity-30 p-1"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
