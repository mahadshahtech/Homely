import React from 'react';
import { X, Pin, MessageSquare, Trash2 } from 'lucide-react';
import type { Message } from '../../types';

interface PinnedMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  pinnedMessages: Message[];
  onUnpin: (messageId: string) => void;
  onJumpToMessage: (messageId: string) => void;
}

export const PinnedMessagesModal: React.FC<PinnedMessagesModalProps> = ({
  isOpen,
  onClose,
  pinnedMessages,
  onUnpin,
  onJumpToMessage
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Pin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Pinned Messages ({pinnedMessages.length})
              </h3>
              <p className="text-[11px] text-stone-400">Important family notes, dates, and instructions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {pinnedMessages.length === 0 ? (
            <div className="text-center py-8 text-stone-400 space-y-1">
              <Pin className="w-8 h-8 mx-auto text-stone-300 dark:text-zinc-700 opacity-60" />
              <p className="text-xs font-semibold">No pinned messages yet</p>
              <p className="text-[11px]">Hover any message and click the pin icon to keep it at the top.</p>
            </div>
          ) : (
            pinnedMessages.map((msg) => (
              <div
                key={msg.id}
                className="p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/70 border border-stone-200/70 dark:border-zinc-700/60 flex items-start justify-between space-x-3 group hover:border-amber-400/50 transition-colors"
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    onJumpToMessage(msg.id);
                    onClose();
                  }}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-[11px] font-bold text-stone-900 dark:text-stone-100">
                      {msg.sender.name}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 dark:text-stone-300 line-clamp-2">
                    {msg.content || (msg.mediaType ? `[${msg.mediaType}]` : 'Attachment')}
                  </p>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onJumpToMessage(msg.id);
                      onClose();
                    }}
                    title="Jump to message"
                    className="p-1.5 text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUnpin(msg.id)}
                    title="Unpin message"
                    className="p-1.5 text-stone-400 hover:text-rose-500 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
