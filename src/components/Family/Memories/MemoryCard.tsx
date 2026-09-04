import React from 'react';
import { MapPin, Users, Heart, MessageCircle, Image as ImageIcon } from 'lucide-react';
import type { FamilyMemory, User } from '../../../types';

interface MemoryCardProps {
  memory: FamilyMemory;
  currentUser: User | null;
  onSelect: (memory: FamilyMemory) => void;
  onQuickReact?: (memory: FamilyMemory, emoji: string) => void;
}

export const MemoryCard: React.FC<MemoryCardProps> = ({
  memory,
  currentUser,
  onSelect,
  onQuickReact
}) => {
  const images = memory.images && memory.images.length > 0
    ? memory.images
    : memory.imageUrl
    ? [memory.imageUrl]
    : [];

  const primaryImage = images[0];
  const photoCount = images.length;
  const commentCount = memory.comments?.length || 0;

  // Aggregate reactions
  const reactionEntries = (Object.entries(memory.reactions || {}) as [string, { count: number; userIds: string[]; hasReacted: boolean }][]).filter(
    ([_, data]) => data && data.count > 0
  );
  const totalReactions = reactionEntries.reduce((acc, [_, data]) => acc + data.count, 0);
  const hasUserReactedHeart = memory.reactions?.['❤️']?.hasReacted ?? false;

  // Format date nicely
  const formatDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <article
      id={`memory-card-${memory.id}`}
      onClick={() => onSelect(memory)}
      className="group relative bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800/90 rounded-3xl overflow-hidden shadow-sm hover:shadow-md hover:border-amber-300/60 dark:hover:border-amber-700/50 transition-all duration-200 flex flex-col cursor-pointer"
    >
      {/* Photo Area */}
      {primaryImage ? (
        <div className="relative aspect-[4/3] w-full bg-stone-100 dark:bg-zinc-800 overflow-hidden">
          <img
            src={primaryImage}
            alt={memory.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Multiple photos badge */}
          {photoCount > 1 && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md text-white text-[11px] font-medium flex items-center space-x-1.5 shadow-sm">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{photoCount} photos</span>
            </div>
          )}

          {/* Location pill if present */}
          {memory.location && (
            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md text-stone-800 dark:text-stone-200 text-[11px] font-medium flex items-center space-x-1 shadow-sm max-w-[80%] truncate">
              <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
              <span className="truncate">{memory.location}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 bg-gradient-to-br from-amber-50/50 via-stone-50 to-orange-50/30 dark:from-zinc-800/40 dark:via-zinc-800/20 dark:to-amber-950/20 border-b border-stone-100 dark:border-zinc-800/50">
          <div className="flex items-center justify-between text-xs text-stone-400 dark:text-zinc-500">
            <span className="font-medium text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
              Family Note
            </span>
            {memory.location && (
              <span className="flex items-center space-x-1 text-stone-500 dark:text-stone-400">
                <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                <span className="truncate">{memory.location}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          {/* Metadata line */}
          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
            <time dateTime={memory.date} className="font-medium text-stone-600 dark:text-stone-300">
              {formatDate(memory.date)}
            </time>
            <div className="flex items-center space-x-1.5 truncate">
              <span>Saved by</span>
              <span className="font-semibold text-stone-700 dark:text-stone-300 truncate max-w-[100px]">
                {memory.creator?.name || 'Family'}
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-serif font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100 leading-snug group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors line-clamp-2">
            {memory.title}
          </h3>

          {/* Story Preview */}
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed line-clamp-3">
            {memory.story}
          </p>
        </div>

        {/* Footer Area: Tagged Members & Engagement */}
        <div className="pt-2 border-t border-stone-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 gap-2">
          {/* Tagged members preview */}
          <div className="flex items-center space-x-1.5 min-w-0">
            {memory.taggedMembers && memory.taggedMembers.length > 0 ? (
              <div className="flex items-center space-x-1">
                <div className="flex -space-x-1.5 overflow-hidden">
                  {memory.taggedMembers.slice(0, 3).map(m => (
                    <img
                      key={m.id}
                      src={m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.id}`}
                      alt={m.name}
                      title={m.name}
                      className="inline-block h-5 w-5 rounded-full ring-2 ring-white dark:ring-zinc-900 object-cover"
                    />
                  ))}
                </div>
                {memory.taggedMembers.length > 3 && (
                  <span className="text-[11px] text-stone-400 font-medium">
                    +{memory.taggedMembers.length - 3}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-stone-400">All Family</span>
            )}
          </div>

          {/* Reactions & Comments Pill */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Quick Heart Button */}
            <button
              type="button"
              id={`btn-heart-${memory.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onQuickReact?.(memory, '❤️');
              }}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                hasUserReactedHeart
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                  : 'text-stone-400 hover:text-rose-500 hover:bg-stone-100 dark:hover:bg-zinc-800'
              }`}
              title={hasUserReactedHeart ? 'Remove love' : 'Love memory'}
            >
              <Heart className={`w-3.5 h-3.5 ${hasUserReactedHeart ? 'fill-current' : ''}`} />
              {totalReactions > 0 && <span>{totalReactions}</span>}
            </button>

            {/* Comments Counter */}
            <div className="flex items-center space-x-1 text-stone-400">
              <MessageCircle className="w-3.5 h-3.5" />
              {commentCount > 0 && <span className="text-[11px]">{commentCount}</span>}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
