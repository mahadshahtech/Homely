import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Search,
  Pin,
  Sparkles,
  ArrowLeft,
  ChevronDown,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { Conversation, Message, HomeMember, MessagePoll, MessageLocation } from '../../types';
import { ConversationSidebar } from './ConversationSidebar';
import { MessageItem } from './MessageItem';
import { ChatComposer } from './ChatComposer';
import { PollModal } from './PollModal';
import { LocationModal } from './LocationModal';
import { PinnedMessagesModal } from './PinnedMessagesModal';
import { ChatSearchModal } from './ChatSearchModal';

export const ChatView: React.FC = () => {
  const { activeHome, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<HomeMember[]>([]);

  // UI Modals & Panels
  const [showNewDirectModal, setShowNewDirectModal] = useState(false);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Message Interaction State
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Typing & Presence
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Fetch conversations list
  const loadConversations = async () => {
    if (!activeHome) return;
    try {
      const res = await api.getConversations(activeHome.id);
      setConversations(res.conversations);

      if (!selectedConvId && res.conversations.length > 0) {
        const fam = res.conversations.find(c => c.type === 'family') || res.conversations[0];
        setSelectedConvId(fam.id);
      }
    } catch (err) {
      console.warn('Failed to load conversations:', err);
    }
  };

  // Fetch messages for active conversation
  const loadMessages = async (convId: string) => {
    if (!activeHome) return;
    try {
      const res = await api.getMessages(activeHome.id, convId);
      setMessages(res.messages);
    } catch (err) {
      console.warn('Failed to load messages:', err);
    }
  };

  // Fetch pinned messages
  const loadPinnedMessages = async (convId: string) => {
    if (!activeHome) return;
    try {
      const res = await api.getPinnedMessages(activeHome.id, convId);
      setPinnedMessages(res.pinnedMessages);
    } catch (err) {
      console.warn('Failed to load pinned messages:', err);
    }
  };

  // Initial Load
  useEffect(() => {
    loadConversations();
  }, [activeHome?.id]);

  // When selected conversation changes
  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
      loadPinnedMessages(selectedConvId);
      setReplyingTo(null);
      setEditingMessage(null);
      setMobileShowChat(true);
    }
  }, [selectedConvId, activeHome?.id]);

  // Polling interval (every 3 seconds) for live chat updates & presence
  useEffect(() => {
    if (!selectedConvId || !activeHome) return;
    const timer = setInterval(() => {
      loadMessages(selectedConvId);
      loadConversations();
    }, 3000);
    return () => clearInterval(timer);
  }, [selectedConvId, activeHome?.id]);

  // Auto-scroll on new messages unless user scrolled up
  useEffect(() => {
    if (!showScrollBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleScroll = () => {
    if (!messageContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottom(isUp);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
  };

  // Load members for new direct message modal
  const handleOpenDirectChat = async () => {
    if (!activeHome) return;
    try {
      const res = await api.getHomeMembers(activeHome.id);
      setMembers(res.members.filter(m => m.userId !== user?.id));
      setShowNewDirectModal(true);
    } catch (err) {
      console.warn('Failed to load members:', err);
    }
  };

  const handleStartDirectChat = async (targetUserId: string) => {
    if (!activeHome) return;
    try {
      const res = await api.startDirectChat(activeHome.id, targetUserId);
      setShowNewDirectModal(false);
      await loadConversations();
      setSelectedConvId(res.conversation.id);
      setMobileShowChat(true);
    } catch (err: any) {
      alert(err.message || 'Could not start direct chat');
    }
  };

  // Send Message
  const handleSendMessage = async (payload: {
    content: string;
    replyToId?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'file' | 'voice' | 'location' | 'poll' | 'announcement';
    mediaName?: string;
    mediaSize?: number;
    mediaDuration?: number;
    extraData?: any;
    isPinned?: boolean;
  }) => {
    if (!activeHome || !selectedConvId) return;

    try {
      const res = await api.sendMessage(activeHome.id, selectedConvId, payload);
      setMessages(prev => [...prev, res.message]);
      loadConversations();
      if (payload.isPinned) {
        loadPinnedMessages(selectedConvId);
      }
      setTimeout(() => scrollToBottom(), 100);
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    }
  };

  // Edit Message
  const handleSaveEdit = async (messageId: string, newContent: string) => {
    if (!activeHome || !selectedConvId) return;
    try {
      await api.editMessage(activeHome.id, selectedConvId, messageId, newContent);
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, content: newContent, isEdited: true } : m))
      );
      setEditingMessage(null);
    } catch (err: any) {
      alert(err.message || 'Failed to edit message');
    }
  };

  // Delete Message
  const handleDeleteMessage = async (messageId: string) => {
    if (!activeHome || !selectedConvId) return;
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      await api.deleteMessage(activeHome.id, selectedConvId, messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setPinnedMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete message');
    }
  };

  // Toggle Reaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!activeHome || !selectedConvId) return;
    try {
      const res = await api.toggleMessageReaction(activeHome.id, selectedConvId, messageId, emoji);
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, reactions: res.reactions } : m))
      );
    } catch (err) {
      console.warn('Failed to toggle reaction:', err);
    }
  };

  // Toggle Pin
  const handleTogglePin = async (messageId: string) => {
    if (!activeHome || !selectedConvId) return;
    try {
      const res = await api.togglePinMessage(activeHome.id, selectedConvId, messageId);
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, isPinned: res.isPinned } : m))
      );
      loadPinnedMessages(selectedConvId);
    } catch (err: any) {
      alert(err.message || 'Failed to pin message');
    }
  };

  // Vote on Poll
  const handleVotePoll = async (messageId: string, optionId: string) => {
    if (!activeHome || !selectedConvId) return;
    try {
      const res = await api.votePoll(activeHome.id, selectedConvId, messageId, optionId);
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, poll: res.poll } : m))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to vote on poll');
    }
  };

  // File Upload Helper
  const handleUploadMedia = async (file: File) => {
    if (!activeHome) throw new Error('No active home');

    return new Promise<{
      url: string;
      fileName: string;
      mimeType: string;
      size: number;
      duration?: number;
    }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await api.uploadChatMedia(
            activeHome.id,
            base64,
            file.name,
            file.type
          );
          resolve(res);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Typing heartbeat
  const handleTyping = async (isTyping: boolean) => {
    if (!activeHome || !selectedConvId) return;
    try {
      const res = await api.sendHeartbeat(activeHome.id, selectedConvId, isTyping);
      setTypingUsers(res.typingUsers || []);
    } catch {
      // ignore
    }
  };

  // Jump to specific message
  const handleJumpToMessage = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2500);
    }
  };

  // Search handler
  const handleSearchMessages = async (query?: string, date?: string) => {
    if (!activeHome || !selectedConvId) return [];
    const res = await api.searchMessages(activeHome.id, selectedConvId, query, date);
    return res.results;
  };

  const activeConversation = conversations.find(c => c.id === selectedConvId);

  // Group messages by Date
  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { dateLabel: string; messages: Message[] }[] = [];
    msgs.forEach(msg => {
      const d = new Date(msg.createdAt);
      const now = new Date();
      let dateLabel = d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });

      if (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      ) {
        dateLabel = 'Today';
      } else {
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        if (
          d.getDate() === yesterday.getDate() &&
          d.getMonth() === yesterday.getMonth() &&
          d.getFullYear() === yesterday.getFullYear()
        ) {
          dateLabel = 'Yesterday';
        }
      }

      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.dateLabel === dateLabel) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({ dateLabel, messages: [msg] });
      }
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div
      id="homely-messenger-root"
      className="max-w-6xl mx-auto px-2 sm:px-4 py-2 pb-24 h-[calc(100vh-7.5rem)] flex flex-col"
    >
      {/* Container Frame */}
      <div className="flex-1 bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl shadow-sm flex overflow-hidden transition-colors">
        {/* Left Column: Conversation Sidebar (Always on Desktop, Conditionally on Mobile) */}
        <div
          className={`${
            mobileShowChat ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 shrink-0 h-full`}
        >
          <ConversationSidebar
            conversations={conversations}
            selectedConvId={selectedConvId}
            onSelectConversation={id => {
              setSelectedConvId(id);
              setMobileShowChat(true);
            }}
            onOpenNewDirect={handleOpenDirectChat}
          />
        </div>

        {/* Right Column: Active Conversation Panel */}
        <div
          className={`${
            mobileShowChat ? 'flex' : 'hidden md:flex'
          } flex-1 flex flex-col h-full bg-stone-50/40 dark:bg-zinc-900/40 overflow-hidden`}
        >
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="px-4 py-3 bg-white dark:bg-zinc-900 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between shrink-0 shadow-2xs">
                <div className="flex items-center space-x-3 min-w-0">
                  {/* Mobile Back Button to list */}
                  <button
                    type="button"
                    onClick={() => setMobileShowChat(false)}
                    className="md:hidden p-1.5 -ml-1 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  {/* Header Avatar */}
                  {activeConversation.type === 'family' ? (
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/60 shadow-2xs">
                      <Users className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="relative shrink-0">
                      <img
                        src={
                          activeConversation.avatar ||
                          `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${activeConversation.name}`
                        }
                        alt=""
                        className="w-10 h-10 rounded-full bg-stone-100 dark:bg-zinc-800 object-cover border border-stone-200/80 dark:border-zinc-700"
                      />
                      {activeConversation.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
                      )}
                    </div>
                  )}

                  {/* Name and Status */}
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                        {activeConversation.name}
                      </h3>
                      {activeConversation.type === 'direct' && (
                        <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/40">
                          Direct
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-stone-400 truncate">
                      {typingUsers.length > 0 ? (
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                        </span>
                      ) : activeConversation.type === 'family' ? (
                        'Shared family circle • Everyone'
                      ) : activeConversation.isOnline ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active now</span>
                      ) : (
                        'Private conversation'
                      )}
                    </p>
                  </div>
                </div>

                {/* Right Action Icons */}
                <div className="flex items-center space-x-1 shrink-0">
                  {/* Pinned Messages Button */}
                  <button
                    type="button"
                    onClick={() => setShowPinnedModal(true)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors text-xs font-semibold"
                    title="View pinned messages"
                  >
                    <Pin className={`w-4 h-4 ${pinnedMessages.length > 0 ? 'text-amber-500 fill-amber-500' : ''}`} />
                    {pinnedMessages.length > 0 && (
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded-full font-bold">
                        {pinnedMessages.length}
                      </span>
                    )}
                  </button>

                  {/* Search Messages Button */}
                  <button
                    type="button"
                    onClick={() => setShowSearchModal(true)}
                    className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Search conversation"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message Stream Area */}
              <div
                ref={messageContainerRef}
                onScroll={handleScroll}
                className="flex-1 p-4 overflow-y-auto relative space-y-4"
              >
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400 space-y-2">
                    <div className="w-14 h-14 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center shadow-inner">
                      <MessageSquare className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200">
                        {activeConversation.type === 'family' ? 'Family Circle Ready' : 'Start Your Private Chat'}
                      </h4>
                      <p className="text-xs text-stone-400 max-w-xs mt-1">
                        Send a message, voice note, photo, or family poll to get the conversation rolling!
                      </p>
                    </div>
                  </div>
                ) : (
                  messageGroups.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-2">
                      {/* Date Divider Pill */}
                      <div className="flex items-center justify-center my-3">
                        <span className="px-3 py-1 rounded-full bg-white dark:bg-zinc-800 border border-stone-200/80 dark:border-zinc-700/80 text-[10px] font-bold text-stone-500 dark:text-stone-400 shadow-2xs">
                          {group.dateLabel}
                        </span>
                      </div>

                      {/* Messages within group */}
                      {group.messages.map(msg => (
                        <MessageItem
                          key={msg.id}
                          message={msg}
                          currentUserId={user?.id}
                          isGroup={activeConversation.type === 'family'}
                          onReply={m => setReplyingTo(m)}
                          onReact={handleToggleReaction}
                          onPin={handleTogglePin}
                          onEdit={m => setEditingMessage(m)}
                          onDelete={handleDeleteMessage}
                          onVotePoll={handleVotePoll}
                          onJumpToMessage={handleJumpToMessage}
                          isHighlighted={highlightedMessageId === msg.id}
                        />
                      ))}
                    </div>
                  ))
                )}

                {/* Floating Scroll to Bottom Button */}
                {showScrollBottom && (
                  <button
                    type="button"
                    onClick={scrollToBottom}
                    className="sticky bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-lg flex items-center space-x-1 animate-bounce"
                  >
                    <span>New messages</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Message Composer */}
              <ChatComposer
                onSendMessage={handleSendMessage}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                editingMessage={editingMessage}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingMessage(null)}
                onTyping={handleTyping}
                onOpenPollModal={() => setShowPollModal(true)}
                onOpenLocationModal={() => setShowLocationModal(true)}
                onUploadMedia={handleUploadMedia}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8 text-stone-400">
              Select or start a conversation
            </div>
          )}
        </div>
      </div>

      {/* Start Direct Chat Modal */}
      {showNewDirectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    Start Private Chat
                  </h3>
                  <p className="text-[10px] text-stone-400">Strictly 1-on-1 and confidential</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewDirectModal(false)}
                className="text-xs text-stone-400 hover:text-stone-600"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {members.length === 0 ? (
                <div className="text-center py-6 text-stone-400 space-y-1">
                  <p className="text-xs font-semibold">No other members in Home</p>
                  <p className="text-[11px]">Invite your spouse, kids, or parents using the invite code on the Dashboard!</p>
                </div>
              ) : (
                members.map(m => (
                  <button
                    key={m.userId}
                    onClick={() => handleStartDirectChat(m.userId)}
                    className="w-full flex items-center space-x-3 p-3 rounded-2xl hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors text-left group"
                  >
                    <img
                      src={m.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${m.name}`}
                      alt=""
                      className="w-10 h-10 rounded-full bg-stone-100 dark:bg-zinc-800 object-cover border border-stone-200 dark:border-zinc-700"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-stone-900 dark:text-stone-100 group-hover:text-indigo-600 transition-colors">
                        {m.name}
                      </p>
                      <p className="text-[10px] text-stone-400 capitalize">{m.role}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pinned Messages Modal */}
      <PinnedMessagesModal
        isOpen={showPinnedModal}
        onClose={() => setShowPinnedModal(false)}
        pinnedMessages={pinnedMessages}
        onUnpin={handleTogglePin}
        onJumpToMessage={handleJumpToMessage}
      />

      {/* Search Messages Modal */}
      <ChatSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSearch={handleSearchMessages}
        onJumpToMessage={handleJumpToMessage}
      />

      {/* Poll Creation Modal */}
      <PollModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onSubmit={poll => {
          handleSendMessage({
            content: poll.question,
            mediaType: 'poll',
            extraData: poll
          });
        }}
      />

      {/* Location Modal */}
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSubmit={location => {
          handleSendMessage({
            content: `Shared location: ${location.name}`,
            mediaType: 'location',
            extraData: location
          });
        }}
      />
    </div>
  );
};
