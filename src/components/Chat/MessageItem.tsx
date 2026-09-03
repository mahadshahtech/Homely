import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Pin,
  Smile,
  Reply,
  Copy,
  Edit2,
  Trash2,
  FileText,
  Download,
  MapPin,
  ExternalLink,
  Megaphone,
  CheckCircle2
} from 'lucide-react';
import type { Message, MessagePoll, MessageLocation } from '../../types';
import { VoicePlayer } from './VoicePlayer';

interface MessageItemProps {
  message: Message;
  currentUserId?: string;
  isGroup?: boolean;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
  onPin: (messageId: string) => void;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onVotePoll: (messageId: string, optionId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  isHighlighted?: boolean;
}

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🎉'];

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUserId,
  isGroup = false,
  onReply,
  onReact,
  onPin,
  onEdit,
  onDelete,
  onVotePoll,
  onJumpToMessage,
  isHighlighted = false
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOwn = message.isOwn || message.senderId === currentUserId;

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const poll: MessagePoll | undefined = message.poll;
  const location: MessageLocation | undefined = message.location;

  // Calculate poll vote totals
  const totalPollVotes = poll
    ? poll.options.reduce((acc, opt) => acc + (opt.votes ? opt.votes.length : 0), 0)
    : 0;

  return (
    <div
      id={`message-${message.id}`}
      className={`group relative flex flex-col my-1.5 transition-colors duration-500 rounded-2xl px-2 py-1 ${
        isHighlighted ? 'bg-amber-100/50 dark:bg-amber-950/30 ring-2 ring-amber-400/60' : ''
      } ${isOwn ? 'items-end' : 'items-start'}`}
      onMouseLeave={() => {
        setShowEmojiPicker(false);
        setShowActionMenu(false);
      }}
    >
      {/* Pinned Badge */}
      {message.isPinned && (
        <div className={`flex items-center space-x-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 mb-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/40 shrink-0 ${
          isOwn ? 'self-end' : 'self-start'
        }`}>
          <Pin className="w-3 h-3 fill-amber-500 text-amber-500" />
          <span>Pinned in conversation</span>
        </div>
      )}

      <div className={`flex items-end space-x-2 max-w-[88%] sm:max-w-[76%] ${isOwn ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
        {/* Sender Avatar */}
        {!isOwn && (
          <img
            src={message.sender.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${message.sender.name}`}
            alt={message.sender.name}
            className="w-7 h-7 rounded-full bg-stone-100 dark:bg-zinc-800 shrink-0 mb-1 object-cover border border-stone-200/60 dark:border-zinc-700/60 shadow-2xs"
          />
        )}

        {/* Message Bubble Container */}
        <div className="flex flex-col relative group/bubble">
          {/* Group Chat Sender Name */}
          {!isOwn && isGroup && (
            <div className="flex items-center space-x-1.5 ml-2 mb-0.5">
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                {message.sender.name}
              </span>
              {message.sender.role && (
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-stone-400 font-medium">
                  {message.sender.role}
                </span>
              )}
            </div>
          )}

          {/* Reply Quote Banner */}
          {message.replyTo && (
            <div
              onClick={() => onJumpToMessage && onJumpToMessage(message.replyTo!.id)}
              className={`text-[11px] rounded-t-2xl px-3 py-1.5 mb-[-2px] border-l-3 cursor-pointer opacity-90 transition-opacity hover:opacity-100 ${
                isOwn
                  ? 'bg-indigo-700/60 text-indigo-100 border-white'
                  : 'bg-stone-200 dark:bg-zinc-700 text-stone-700 dark:text-stone-300 border-indigo-500'
              }`}
            >
              <div className="flex items-center space-x-1 font-semibold text-[10px]">
                <Reply className="w-3 h-3" />
                <span>{message.replyTo.senderName || 'Original message'}</span>
              </div>
              <p className="truncate line-clamp-1">{message.replyTo.content || '[Attachment]'}</p>
            </div>
          )}

          {/* Core Bubble Content */}
          <div
            className={`relative rounded-2xl px-3.5 py-2.5 shadow-sm text-xs leading-relaxed transition-all ${
              message.mediaType === 'announcement'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-2xl border border-amber-400 shadow-md'
                : isOwn
                ? 'bg-indigo-600 text-white rounded-br-xs'
                : 'bg-stone-100 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 rounded-bl-xs border border-stone-200/60 dark:border-zinc-700/50'
            }`}
          >
            {/* Announcement Banner Header */}
            {message.mediaType === 'announcement' && (
              <div className="flex items-center space-x-1.5 mb-1.5 pb-1 border-b border-amber-400/40 text-[11px] font-bold uppercase tracking-wider text-amber-100">
                <Megaphone className="w-3.5 h-3.5" />
                <span>Family Announcement</span>
              </div>
            )}

            {/* Media: Image */}
            {message.mediaType === 'image' && message.mediaUrl && (
              <div className="mb-2 rounded-xl overflow-hidden max-w-sm border border-black/10">
                <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={message.mediaUrl}
                    alt={message.mediaName || 'Chat photo'}
                    className="w-full max-h-72 object-cover hover:opacity-95 transition-opacity"
                    loading="lazy"
                  />
                </a>
              </div>
            )}

            {/* Media: Video */}
            {message.mediaType === 'video' && message.mediaUrl && (
              <div className="mb-2 rounded-xl overflow-hidden max-w-sm">
                <video
                  src={message.mediaUrl}
                  controls
                  className="w-full max-h-72 rounded-xl bg-black"
                />
              </div>
            )}

            {/* Media: Voice */}
            {message.mediaType === 'voice' && message.mediaUrl && (
              <div className="mb-1">
                <VoicePlayer
                  url={message.mediaUrl}
                  duration={message.mediaDuration}
                  isOwn={isOwn}
                />
              </div>
            )}

            {/* Media: Document / Generic File */}
            {message.mediaType === 'file' && message.mediaUrl && (
              <div className={`flex items-center space-x-3 p-2.5 rounded-xl mb-2 border ${
                isOwn
                  ? 'bg-indigo-700/50 border-indigo-500/50 text-white'
                  : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-stone-200'
              }`}>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs truncate">{message.mediaName || 'Document'}</p>
                  <p className="text-[10px] opacity-70">
                    {message.mediaSize ? `${(message.mediaSize / 1024).toFixed(1)} KB` : 'File'}
                  </p>
                </div>
                <a
                  href={message.mediaUrl}
                  download={message.mediaName || 'download'}
                  className="p-1.5 rounded-lg hover:bg-black/10 transition-colors shrink-0"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Media: Location Pin */}
            {location && (
              <div className={`p-3 rounded-xl mb-2 border space-y-1.5 ${
                isOwn
                  ? 'bg-indigo-700/50 border-indigo-500/50 text-white'
                  : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-stone-200'
              }`}>
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold">{location.name}</h4>
                    {location.address && (
                      <p className="text-[10px] opacity-80">{location.address}</p>
                    )}
                  </div>
                </div>
                {location.latitude && location.longitude && (
                  <a
                    href={`https://maps.google.com/?q=${location.latitude},${location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-[10px] font-semibold text-emerald-400 hover:underline pt-0.5"
                  >
                    <span>Open in Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* Media: Poll */}
            {poll && (
              <div className={`p-3 rounded-xl mb-2 border space-y-2.5 min-w-[220px] sm:min-w-[260px] ${
                isOwn
                  ? 'bg-indigo-700/60 border-indigo-500/50 text-white'
                  : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-stone-100'
              }`}>
                <div className="font-bold text-xs">{poll.question}</div>
                <div className="space-y-1.5">
                  {poll.options.map(opt => {
                    const voteCount = opt.votes ? opt.votes.length : 0;
                    const percent = totalPollVotes > 0 ? Math.round((voteCount / totalPollVotes) * 100) : 0;
                    const hasVoted = currentUserId && opt.votes && opt.votes.includes(currentUserId);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onVotePoll(message.id, opt.id)}
                        className={`w-full relative overflow-hidden text-left p-2 rounded-xl text-xs border transition-all ${
                          hasVoted
                            ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/40 font-semibold'
                            : 'border-stone-200 dark:border-zinc-700/70 hover:bg-stone-50 dark:hover:bg-zinc-800/40'
                        }`}
                      >
                        {/* Fill Progress Bar */}
                        <div
                          style={{ width: `${percent}%` }}
                          className={`absolute inset-0 opacity-20 transition-all duration-500 ${
                            isOwn ? 'bg-white' : 'bg-indigo-500'
                          }`}
                        />
                        <div className="relative z-10 flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            {hasVoted && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                            <span>{opt.text}</span>
                          </div>
                          <span className="text-[10px] opacity-75 font-mono ml-2 shrink-0">
                            {percent}% ({voteCount})
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] opacity-75 text-right font-medium">
                  {totalPollVotes} total {totalPollVotes === 1 ? 'vote' : 'votes'}
                </div>
              </div>
            )}

            {/* Text Message Content */}
            {message.content && (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}

            {/* Message Meta Info: Timestamp, Edited tag, Delivery status */}
            <div className={`flex items-center justify-end space-x-1 text-[9px] mt-1 ${
              isOwn ? 'text-indigo-200' : 'text-stone-400'
            }`}>
              {message.isEdited && (
                <span className="italic opacity-80">(edited)</span>
              )}
              <span>{formatTime(message.createdAt)}</span>

              {/* Delivery / Read Status for Own Messages */}
              {isOwn && (
                <span className="ml-1" title={
                  message.seenBy && message.seenBy.length > 0
                    ? `Seen by ${message.seenBy.map(u => u.name).join(', ')}`
                    : message.status === 'delivered'
                    ? 'Delivered'
                    : 'Sent'
                }>
                  {message.status === 'read' ? (
                    <CheckCheck className="w-3 h-3 text-cyan-300 stroke-[2.5]" />
                  ) : message.status === 'delivered' ? (
                    <CheckCheck className="w-3 h-3 text-indigo-200" />
                  ) : (
                    <Check className="w-3 h-3 text-indigo-200" />
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Emoji Reactions Bar */}
          {message.reactions && message.reactions.length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              {message.reactions.map((r, i) => {
                const userReacted = currentUserId && r.userIds.includes(currentUserId);
                return (
                  <button
                    key={i}
                    onClick={() => onReact(message.id, r.emoji)}
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-transform active:scale-95 shadow-2xs ${
                      userReacted
                        ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
                        : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-stone-300'
                    }`}
                    title={`${r.users.map(u => u.name).join(', ')}`}
                  >
                    <span>{r.emoji}</span>
                    <span className="text-[10px] font-bold">{r.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Floating Quick Actions Bar (Visible on Hover/Focus) */}
        <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-full px-1 py-0.5 shadow-md self-center mb-1 shrink-0 ${
          isOwn ? 'order-first mr-1' : 'order-last ml-1'
        }`}>
          {/* Reaction Picker Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 rounded-full text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
              title="React"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {/* Quick Emoji Menu */}
            {showEmojiPicker && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 flex items-center space-x-1 p-1.5 bg-white dark:bg-zinc-900 rounded-full shadow-xl border border-stone-200 dark:border-zinc-700 z-30 animate-in fade-in zoom-in-95">
                {QUICK_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReact(message.id, emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="w-7 h-7 flex items-center justify-center text-sm rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reply Button */}
          <button
            type="button"
            onClick={() => onReply(message)}
            className="p-1 rounded-full text-stone-400 hover:text-indigo-600 hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          {/* Pin Button */}
          <button
            type="button"
            onClick={() => onPin(message.id)}
            className={`p-1 rounded-full transition-colors ${
              message.isPinned
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-zinc-700'
            }`}
            title={message.isPinned ? 'Unpin message' : 'Pin message'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {/* Copy Button */}
          {message.content && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
              title={copied ? 'Copied!' : 'Copy text'}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Edit (For Own Messages) */}
          {isOwn && message.content && (
            <button
              type="button"
              onClick={() => onEdit(message)}
              className="p-1 rounded-full text-stone-400 hover:text-indigo-600 hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
              title="Edit message"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete (For Own Messages or Home Admins) */}
          {isOwn && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="p-1 rounded-full text-stone-400 hover:text-rose-600 hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
              title="Delete message"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
