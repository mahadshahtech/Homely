import React, { useState } from 'react';
import { Users, Search, Plus, Sparkles, User, ShieldCheck } from 'lucide-react';
import type { Conversation } from '../../types';

interface ConversationSidebarProps {
  conversations: Conversation[];
  selectedConvId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenNewDirect: () => void;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  selectedConvId,
  onSelectConversation,
  onOpenNewDirect
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const formatConversationTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const nameMatch = conv.name.toLowerCase().includes(term);
    const msgMatch = conv.lastMessage?.content?.toLowerCase().includes(term);
    return nameMatch || msgMatch;
  });

  // Separate family space vs direct chats
  const familyConv = filteredConversations.find(c => c.type === 'family');
  const directConvs = filteredConversations.filter(c => c.type === 'direct');

  return (
    <div className="w-full md:w-80 flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-stone-200/80 dark:border-zinc-800 transition-colors">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-stone-100 dark:border-zinc-800 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Messages
            </h2>
            <span className="text-[11px] font-semibold text-stone-400 bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              {conversations.length}
            </span>
          </div>

          <button
            id="btn-new-direct-chat"
            type="button"
            onClick={onOpenNewDirect}
            className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 py-1 px-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Private Chat</span>
          </button>
        </div>

        {/* Search Conversations Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
          <input
            id="input-search-conversations"
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200/80 dark:border-zinc-800 bg-stone-50/70 dark:bg-zinc-800/70 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
      </div>

      {/* Conversation List Stream */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Primary Family Space Banner */}
        {familyConv && (
          <div>
            <div className="px-2 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
              Family Circle
            </div>
            <button
              id={`conv-item-${familyConv.id}`}
              onClick={() => onSelectConversation(familyConv.id)}
              className={`w-full flex items-center space-x-3 p-3 rounded-2xl transition-all text-left relative group ${
                selectedConvId === familyConv.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-600'
                  : 'bg-stone-50/80 dark:bg-zinc-800/40 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-900 dark:text-stone-100 border border-stone-200/60 dark:border-zinc-800/60'
              }`}
            >
              {/* Family Avatar Icon */}
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                selectedConvId === familyConv.id
                  ? 'bg-white text-indigo-600'
                  : 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60'
              }`}>
                <Users className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className={`text-xs font-bold truncate ${
                    selectedConvId === familyConv.id ? 'text-white' : 'text-stone-900 dark:text-stone-100'
                  }`}>
                    {familyConv.name}
                  </h3>
                  <span className={`text-[10px] shrink-0 font-medium ${
                    selectedConvId === familyConv.id ? 'text-indigo-200' : 'text-stone-400'
                  }`}>
                    {formatConversationTime(familyConv.lastMessage?.createdAt || familyConv.updatedAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <p className={`text-[11px] truncate pr-2 ${
                    selectedConvId === familyConv.id ? 'text-indigo-100' : 'text-stone-500 dark:text-stone-400'
                  }`}>
                    {familyConv.lastMessage
                      ? (familyConv.lastMessage.content || `[${familyConv.lastMessage.mediaType || 'Attachment'}]`)
                      : 'Shared family space'}
                  </p>

                  {/* Unread Counter Badge */}
                  {familyConv.unreadCount && familyConv.unreadCount > 0 ? (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 shadow-2xs ${
                      selectedConvId === familyConv.id
                        ? 'bg-white text-indigo-700'
                        : 'bg-indigo-600 text-white'
                    }`}>
                      {familyConv.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Direct Messages Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
            <span>Direct Messages</span>
            <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Private</span>
            </span>
          </div>

          {directConvs.length === 0 ? (
            <div className="px-3 py-6 text-center text-stone-400 space-y-1">
              <User className="w-6 h-6 mx-auto text-stone-300 dark:text-zinc-700 opacity-60" />
              <p className="text-xs">No direct chats yet</p>
              <p className="text-[10px]">Start a private 1-on-1 chat with any family member.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {directConvs.map(conv => {
                const isSelected = conv.id === selectedConvId;

                return (
                  <button
                    key={conv.id}
                    id={`conv-item-${conv.id}`}
                    onClick={() => onSelectConversation(conv.id)}
                    className={`w-full flex items-center space-x-3 p-2.5 rounded-2xl transition-all text-left relative group ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'hover:bg-stone-100/80 dark:hover:bg-zinc-800/80 text-stone-900 dark:text-stone-100'
                    }`}
                  >
                    {/* User Avatar & Online Indicator */}
                    <div className="relative shrink-0">
                      <img
                        src={conv.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${conv.name}`}
                        alt={conv.name}
                        className="w-10 h-10 rounded-full bg-stone-200 dark:bg-zinc-700 object-cover border border-stone-200/60 dark:border-zinc-700/60"
                      />
                      {conv.isOnline && (
                        <span
                          title="Online now"
                          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900 shadow-2xs"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className={`text-xs font-bold truncate ${
                          isSelected ? 'text-white' : 'text-stone-900 dark:text-stone-100'
                        }`}>
                          {conv.name}
                        </h4>
                        <span className={`text-[10px] shrink-0 ${
                          isSelected ? 'text-indigo-200' : 'text-stone-400'
                        }`}>
                          {formatConversationTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className={`text-[11px] truncate pr-2 ${
                          isSelected ? 'text-indigo-100' : 'text-stone-500 dark:text-stone-400'
                        }`}>
                          {conv.lastMessage
                            ? (conv.lastMessage.content || `[${conv.lastMessage.mediaType || 'Media'}]`)
                            : 'No messages yet'}
                        </p>

                        {/* Unread Counter Badge */}
                        {conv.unreadCount && conv.unreadCount > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            isSelected
                              ? 'bg-white text-indigo-700'
                              : 'bg-indigo-600 text-white'
                          }`}>
                            {conv.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
