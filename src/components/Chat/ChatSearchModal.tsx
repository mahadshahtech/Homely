import React, { useState } from 'react';
import { X, Search, Calendar, MessageSquare, ArrowRight } from 'lucide-react';
import type { Message } from '../../types';

interface ChatSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query?: string, date?: string) => Promise<Message[]>;
  onJumpToMessage: (messageId: string) => void;
}

export const ChatSearchModal: React.FC<ChatSearchModalProps> = ({
  isOpen,
  onClose,
  onSearch,
  onJumpToMessage
}) => {
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  if (!isOpen) return null;

  const handleExecuteSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() && !date) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const msgs = await onSearch(query.trim() || undefined, date || undefined);
      setResults(msgs);
    } catch (err) {
      console.warn('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setDate('');
    setResults([]);
    setHasSearched(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-2xl space-y-4 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Search Conversation
              </h3>
              <p className="text-[11px] text-stone-400">Find memories, recipes, chores, plans & dates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleExecuteSearch} className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
              <input
                type="text"
                placeholder="Search keywords or names..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <div className="relative w-40">
              <Calendar className="w-4 h-4 absolute left-2.5 top-3 text-stone-400" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full pl-8 pr-2 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            {hasSearched && (
              <button
                type="button"
                onClick={handleClear}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 text-[11px]"
              >
                Clear filters
              </button>
            )}
            <div className="ml-auto flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={(!query.trim() && !date) || loading}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 shadow-sm transition-colors"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </form>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
          {loading ? (
            <div className="py-10 text-center text-xs text-stone-400 animate-pulse">
              Searching chat archives...
            </div>
          ) : hasSearched && results.length === 0 ? (
            <div className="py-10 text-center text-stone-400 space-y-1">
              <MessageSquare className="w-8 h-8 mx-auto text-stone-300 dark:text-zinc-700 opacity-60" />
              <p className="text-xs font-semibold">No messages found</p>
              <p className="text-[11px]">Try searching with a different term or date.</p>
            </div>
          ) : (
            results.map(msg => (
              <div
                key={msg.id}
                onClick={() => {
                  onJumpToMessage(msg.id);
                  onClose();
                }}
                className="p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/70 dark:border-zinc-700/60 hover:border-indigo-400 cursor-pointer transition-all flex items-start justify-between space-x-3 group"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {msg.sender.name}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at{' '}
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 dark:text-stone-300 line-clamp-2">
                    {msg.content || (msg.mediaType ? `[${msg.mediaType}]` : 'Media attachment')}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-indigo-600 transition-colors shrink-0 mt-1" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
