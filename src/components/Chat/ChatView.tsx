import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, User as UserIcon, Plus, ArrowLeft, Clock, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { Conversation, Message, HomeMember } from '../../types';

export const ChatView: React.FC = () => {
  const { activeHome, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [showNewDirectModal, setShowNewDirectModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations list
  const loadConversations = async () => {
    if (!activeHome) return;
    try {
      const res = await api.getConversations(activeHome.id);
      setConversations(res.conversations);
      // If none selected, default to the family conversation
      if (!selectedConvId && res.conversations.length > 0) {
        const fam = res.conversations.find(c => c.type === 'family') || res.conversations[0];
        setSelectedConvId(fam.id);
      }
    } catch (err) {
      console.warn('Failed to load conversations:', err);
    } finally {
      setLoading(false);
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

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [activeHome?.id]);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
    }
  }, [selectedConvId, activeHome?.id]);

  // Polling interval (every 3 seconds) for live chat updates
  useEffect(() => {
    if (!selectedConvId || !activeHome) return;
    const timer = setInterval(() => {
      loadMessages(selectedConvId);
      loadConversations();
    }, 3000);
    return () => clearInterval(timer);
  }, [selectedConvId, activeHome?.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load members for direct message creation
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
    } catch (err: any) {
      alert(err.message || 'Could not start direct chat');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHome || !selectedConvId || !inputMessage.trim()) return;

    const content = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    try {
      const res = await api.sendMessage(activeHome.id, selectedConvId, content);
      setMessages(prev => [...prev, res.message]);
      loadConversations();
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const activeConversation = conversations.find(c => c.id === selectedConvId);

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div id="homely-chat-container" className="max-w-md md:max-w-4xl mx-auto px-4 py-2 pb-24 h-[calc(100vh-8rem)] flex flex-col">
      {/* Top Header & Conversation Pills */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-3 mb-3 shadow-sm transition-colors shrink-0">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
            Family Conversations
          </h2>
          <button
            id="btn-new-direct-chat"
            onClick={handleOpenDirectChat}
            className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 py-0.5 px-2 rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Private Chat</span>
          </button>
        </div>

        {/* Conversation Carousel/Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {conversations.map(c => {
            const isSelected = c.id === selectedConvId;
            const isFamily = c.type === 'family';

            return (
              <button
                key={c.id}
                onClick={() => setSelectedConvId(c.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-zinc-700'
                }`}
              >
                {isFamily ? (
                  <Users className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                ) : (
                  <img
                    src={c.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${c.name}`}
                    alt=""
                    className="w-4 h-4 rounded-full bg-stone-200 object-cover"
                  />
                )}
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Conversation Body */}
      <div className="flex-1 bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl shadow-sm flex flex-col overflow-hidden transition-colors">
        {/* Chat Title Subheader */}
        <div className="px-4 py-3 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            {activeConversation?.type === 'family' ? (
              <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            ) : (
              <img
                src={activeConversation?.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${activeConversation?.name}`}
                alt=""
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-zinc-800 object-cover border border-indigo-100 dark:border-indigo-900"
              />
            )}
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                {activeConversation?.name || 'Chat'}
              </h3>
              <p className="text-[10px] text-stone-400">
                {activeConversation?.type === 'family' ? 'All family members' : 'Private family conversation'}
              </p>
            </div>
          </div>

          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Secure</span>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
              <Users className="w-10 h-10 text-stone-300 dark:text-zinc-700 mb-2" />
              <p className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                No messages yet
              </p>
              <p className="text-[11px] text-stone-400 max-w-xs mt-1">
                Say hello, plan dinner, or share something with your family!
              </p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex items-end space-x-2 ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {!msg.isOwn && (
                  <img
                    src={msg.sender.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${msg.sender.name}`}
                    alt=""
                    className="w-7 h-7 rounded-full bg-stone-100 dark:bg-zinc-800 shrink-0 mb-1 object-cover"
                  />
                )}

                <div
                  className={`max-w-[78%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                    msg.isOwn
                      ? 'bg-indigo-600 text-white rounded-br-xs'
                      : 'bg-stone-100 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 rounded-bl-xs'
                  }`}
                >
                  {!msg.isOwn && activeConversation?.type === 'family' && (
                    <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-0.5">
                      {msg.sender.name}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <div
                    className={`text-[9px] mt-1 text-right ${
                      msg.isOwn ? 'text-indigo-200' : 'text-stone-400'
                    }`}
                  >
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50 flex items-center space-x-2 shrink-0">
          <input
            id="input-chat-message"
            type="text"
            placeholder="Type a family message..."
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
          <button
            id="btn-send-chat"
            type="submit"
            disabled={!inputMessage.trim() || sending}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white shadow-sm transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Start Direct Chat Modal */}
      {showNewDirectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Start Private Chat
              </h3>
              <button
                onClick={() => setShowNewDirectModal(false)}
                className="text-xs text-stone-400 hover:text-stone-600"
              >
                Cancel
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-4">
                  No other members in this Home yet. Share your invite code to bring family in!
                </p>
              ) : (
                members.map(m => (
                  <button
                    key={m.userId}
                    onClick={() => handleStartDirectChat(m.userId)}
                    className="w-full flex items-center space-x-3 p-2.5 rounded-2xl hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <img src={m.avatar} alt="" className="w-9 h-9 rounded-full bg-stone-100 object-cover" />
                    <div>
                      <p className="text-xs font-bold text-stone-900 dark:text-stone-100">{m.name}</p>
                      <p className="text-[10px] text-stone-400 capitalize">{m.role}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
