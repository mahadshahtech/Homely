import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  ShieldCheck,
  Check,
  Copy,
  Calendar,
  KeyRound,
  FileText,
  Trash2,
  Bookmark,
  X,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  Megaphone,
  CheckCircle2,
  RefreshCw,
  Heart,
  MessageCircle,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type {
  AskHomelyMessage,
  AskHomelyActionPending,
  AssistantMemory
} from '../../types';

// Lightweight, safe markdown formatter for assistant responses
const FormattedAssistantText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');

  return (
    <div className="space-y-2 text-xs leading-relaxed text-stone-800 dark:text-stone-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Blockquotes (> text)
        if (trimmed.startsWith('>')) {
          const content = trimmed.replace(/^>\s*/, '');
          return (
            <div
              key={idx}
              className="border-l-2 border-indigo-500/80 pl-3 py-1 my-1.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-r-lg text-stone-700 dark:text-stone-300 italic"
            >
              <InlineFormatted text={content} />
            </div>
          );
        }

        // Bullet points (• or - or *)
        if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.replace(/^[•\-*]\s*/, '');
          return (
            <div key={idx} className="flex items-start space-x-2 pl-1 my-0.5">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold leading-none mt-1">•</span>
              <div className="flex-1">
                <InlineFormatted text={content} />
              </div>
            </div>
          );
        }

        // Standard line
        return (
          <p key={idx} className="my-0.5">
            <InlineFormatted text={line} />
          </p>
        );
      })}
    </div>
  );
};

// Inline bolding and italics formatter
const InlineFormatted: React.FC<{ text: string }> = ({ text }) => {
  // Regex to split by bold **text**
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2);
          return (
            <strong key={i} className="font-semibold text-stone-900 dark:text-stone-100">
              {inner}
            </strong>
          );
        }
        return part;
      })}
    </>
  );
};

export const AskHomelyView: React.FC = () => {
  const { activeHome, user } = useAuth();
  const [messages, setMessages] = useState<AskHomelyMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  // Memories Modal state
  const [showMemoriesModal, setShowMemoriesModal] = useState(false);
  const [memories, setMemories] = useState<AssistantMemory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const [searchMemoryQuery, setSearchMemoryQuery] = useState('');

  // Auto-scroll anchor
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // -----------------------------------------------------------
  // Load conversation history on home change
  // -----------------------------------------------------------
  useEffect(() => {
    if (!activeHome) return;

    let isMounted = true;
    setLoadingHistory(true);

    api
      .getAskHomelyMessages(activeHome.id)
      .then(res => {
        if (!isMounted) return;
        if (res.messages && res.messages.length > 0) {
          setMessages(res.messages);
        } else {
          // Initialize with friendly welcoming message
          const welcomeMsg: AskHomelyMessage = {
            id: 'init-welcome',
            homeId: activeHome.id,
            userId: user?.id || 'system',
            role: 'assistant',
            content: `Hello ${user?.name?.split(' ')[0] || 'there'}! I'm **Ask Homely**, your family assistant for **${activeHome.name}**.\n\nI can help you:\n• Find information (like spare keys, vault items, and family posts)\n• Check your family schedule & attendee lists\n• Remember important household details & codes\n• Schedule events, draft announcements, or send family messages\n\nWhat can I help your family with today?`,
            createdAt: new Date().toISOString()
          };
          setMessages([welcomeMsg]);
        }
      })
      .catch(err => {
        console.error('Error fetching conversation history:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeHome?.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // -----------------------------------------------------------
  // Quick Suggestions
  // -----------------------------------------------------------
  const sampleSuggestions = [
    { label: '🔑 Where are the spare keys?', prompt: 'Where are the spare keys?' },
    { label: '📅 Events this week', prompt: 'What events do we have this week?' },
    { label: '👥 Who is attending dinner?', prompt: 'Who is attending the dinner?' },
    { label: '📢 Latest announcement', prompt: 'What was the latest announcement about?' },
    { label: '🧠 Remember key note', prompt: 'Remember that the spare key is with Uncle' },
    { label: '➕ Create dinner event', prompt: 'Create an event for dinner tomorrow at 8 PM' },
    { label: '📣 Create announcement', prompt: 'Create a family announcement saying we are leaving at 9' },
    { label: '💬 Send family message', prompt: 'Send a message to the family saying dinner is ready!' }
  ];

  // -----------------------------------------------------------
  // Send user query
  // -----------------------------------------------------------
  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || !activeHome || loading) return;

    const optimisticUserMsg: AskHomelyMessage = {
      id: `u_${Date.now()}`,
      homeId: activeHome.id,
      userId: user?.id || 'user',
      role: 'user',
      content: textToSend,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticUserMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.askHomely(activeHome.id, textToSend, new Date().toISOString());

      if (res.assistantMessage) {
        setMessages(prev => [...prev, res.assistantMessage!]);
      } else {
        const fallbackMsg: AskHomelyMessage = {
          id: `a_${Date.now()}`,
          homeId: activeHome.id,
          userId: user?.id || 'system',
          role: 'assistant',
          content: res.reply,
          source: res.source,
          actionPending: res.actionPending,
          actionResult: res.actionResult,
          results: res.results,
          sources: res.sources,
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, fallbackMsg]);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          homeId: activeHome.id,
          userId: user?.id || 'system',
          role: 'assistant',
          content: "I'm having a little trouble accessing family records right now. Please try asking again in a moment.",
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------
  // Confirm and execute pending action
  // -----------------------------------------------------------
  const handleConfirmAction = async (action: AskHomelyActionPending, messageId: string) => {
    if (!activeHome) return;
    setExecutingActionId(action.id);

    try {
      const res = await api.confirmAskHomelyAction(activeHome.id, action, messageId);

      // Update local message so action is resolved
      setMessages(prev =>
        prev.map(m => {
          if (m.id === messageId) {
            return {
              ...m,
              actionPending: undefined,
              actionResult: res.result
            };
          }
          return m;
        })
      );

      // Append assistant confirmation message if returned
      if (res.assistantMessage) {
        setMessages(prev => [...prev, res.assistantMessage]);
      }
    } catch (err: any) {
      alert('Failed to execute action: ' + (err?.message || 'Unknown error'));
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleDismissAction = (messageId: string) => {
    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, actionPending: undefined } : m))
    );
  };

  // -----------------------------------------------------------
  // Clear conversation history
  // -----------------------------------------------------------
  const handleClearHistory = async () => {
    if (!activeHome) return;
    if (!window.confirm('Clear all conversation history with Ask Homely in this Home?')) return;

    try {
      await api.clearAskHomelyMessages(activeHome.id);
      setMessages([
        {
          id: `init_${Date.now()}`,
          homeId: activeHome.id,
          userId: user?.id || 'system',
          role: 'assistant',
          content: `Conversation cleared. I'm ready to assist your family in **${activeHome.name}**!`,
          createdAt: new Date().toISOString()
        }
      ]);
    } catch (err) {
      console.error('Failed to clear conversation history:', err);
    }
  };

  // -----------------------------------------------------------
  // Persistent Memories Modal
  // -----------------------------------------------------------
  const openMemoriesModal = async () => {
    if (!activeHome) return;
    setShowMemoriesModal(true);
    setLoadingMemories(true);
    try {
      const res = await api.getAssistantMemories(activeHome.id);
      setMemories(res.memories || []);
    } catch (err) {
      console.error('Failed to load memories:', err);
    } finally {
      setLoadingMemories(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!activeHome) return;
    setDeletingMemoryId(memoryId);
    try {
      await api.deleteAssistantMemory(activeHome.id, memoryId);
      setMemories(prev => prev.filter(m => m.id !== memoryId));
    } catch (err) {
      alert('Failed to delete memory');
    } finally {
      setDeletingMemoryId(null);
    }
  };

  const copyContent = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredMemories = memories.filter(
    m =>
      m.content.toLowerCase().includes(searchMemoryQuery.toLowerCase()) ||
      m.key.toLowerCase().includes(searchMemoryQuery.toLowerCase())
  );

  return (
    <div id="ask-homely-view" className="max-w-md md:max-w-3xl mx-auto px-4 py-3 pb-24 h-[calc(100vh-8rem)] flex flex-col">
      {/* Friendly Header Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-4 mb-3 shadow-xs transition-colors flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Ask Homely
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                Family Assistant
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Private to <span className="font-semibold text-stone-700 dark:text-stone-300">{activeHome?.name || 'this Home'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Saved Memories Button */}
          <button
            id="btn-saved-memories"
            onClick={openMemoriesModal}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-300 transition-colors"
            title="View remembered family facts"
          >
            <Bookmark className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Saved Facts</span>
          </button>

          {/* Clear History Button */}
          <button
            id="btn-clear-ask-history"
            onClick={handleClearHistory}
            className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            title="Clear conversation history"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Privacy badge */}
          <div className="hidden sm:flex items-center space-x-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Home Isolated</span>
          </div>
        </div>
      </div>

      {/* Suggested Quick Questions */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 shrink-0 scrollbar-none">
        {sampleSuggestions.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(item.prompt)}
            className="px-3 py-1.5 text-xs font-medium rounded-2xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-300 whitespace-nowrap transition-colors border border-stone-200/40 dark:border-zinc-700/40"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Message Stream */}
      <div className="flex-1 bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-4 overflow-y-auto space-y-4 shadow-xs transition-colors">
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2 text-stone-400">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
            <span className="text-xs">Loading family assistant...</span>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-start space-x-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-4 text-xs shadow-xs space-y-2.5 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-xs'
                    : 'bg-stone-50 dark:bg-zinc-800/80 text-stone-900 dark:text-stone-100 border border-stone-200/60 dark:border-zinc-700/60 rounded-bl-xs'
                }`}
              >
                {/* Main Content */}
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-line font-medium leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <FormattedAssistantText text={msg.content} />
                )}

                {/* Structured Results (Events, Vault Cards, Memories, Posts) */}
                {msg.results && msg.results.length > 0 && (
                  <div className="pt-2 space-y-2">
                    {msg.results.map((res, rIdx) => (
                      <div
                        key={rIdx}
                        className="bg-white dark:bg-zinc-900/90 border border-stone-200/80 dark:border-zinc-700 rounded-xl p-2.5 shadow-xs flex items-start space-x-2.5"
                      >
                        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                          {res.type === 'event' && <Calendar className="w-4 h-4" />}
                          {res.type === 'vault' && <KeyRound className="w-4 h-4" />}
                          {res.type === 'assistant_memory' && <Bookmark className="w-4 h-4" />}
                          {res.type === 'announcement' && <Megaphone className="w-4 h-4" />}
                          {res.type === 'post' && <FileText className="w-4 h-4" />}
                          {res.type === 'member' && <Users className="w-4 h-4" />}
                          {res.type === 'memory' && <Heart className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                              {res.title}
                            </h4>
                            {res.subtitle && (
                              <span className="text-[10px] text-stone-500 dark:text-stone-400 shrink-0 ml-2">
                                {res.subtitle}
                              </span>
                            )}
                          </div>
                          {res.details && (
                            <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5 line-clamp-2">
                              {res.details}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Pending Card (Confirmation Required) */}
                {msg.actionPending && (
                  <div
                    id={`action-pending-${msg.actionPending.id}`}
                    className="mt-2 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="p-1 rounded-md bg-amber-500 text-white shrink-0">
                        <AlertCircle className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Confirmation Required
                      </span>
                    </div>

                    <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                      <p className="font-semibold text-stone-900 dark:text-stone-100">
                        {msg.actionPending.title}
                      </p>
                      <p className="text-[11px] text-stone-600 dark:text-stone-300">
                        {msg.actionPending.description}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        id={`btn-confirm-action-${msg.actionPending.id}`}
                        onClick={() => handleConfirmAction(msg.actionPending!, msg.id)}
                        disabled={executingActionId === msg.actionPending.id}
                        className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        {executingActionId === msg.actionPending.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Confirm & Execute</span>
                      </button>

                      <button
                        onClick={() => handleDismissAction(msg.id)}
                        disabled={executingActionId === msg.actionPending.id}
                        className="px-3 py-1.5 rounded-lg bg-stone-200 dark:bg-zinc-700 hover:bg-stone-300 dark:hover:bg-zinc-600 text-stone-700 dark:text-stone-200 text-xs font-medium transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Result Card */}
                {msg.actionResult && (
                  <div className="mt-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-2.5 flex items-center space-x-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold">{msg.actionResult.message}</span>
                    </div>
                  </div>
                )}

                {/* Assistant Footer Info (Sources & Copy) */}
                {msg.role === 'assistant' && (
                  <div className="mt-2 pt-2 border-t border-stone-200/50 dark:border-zinc-700/50 flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500">
                    <div className="flex items-center space-x-1.5 truncate">
                      {msg.source === 'persistent-memory' && (
                        <span className="inline-flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 font-medium">
                          <Bookmark className="w-3 h-3" />
                          <span>Persistent Memory</span>
                        </span>
                      )}
                      {msg.source === 'events' && (
                        <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <Calendar className="w-3 h-3" />
                          <span>Calendar Records</span>
                        </span>
                      )}
                      {msg.source === 'family-records' && (
                        <span className="inline-flex items-center space-x-1 text-amber-600 dark:text-amber-400 font-medium">
                          <KeyRound className="w-3 h-3" />
                          <span>Vault & Memories</span>
                        </span>
                      )}
                      {msg.source === 'privacy-guard' && (
                        <span className="inline-flex items-center space-x-1 text-stone-500 font-medium">
                          <Lock className="w-3 h-3" />
                          <span>Confidential DM Shield</span>
                        </span>
                      )}
                      {(!msg.source || msg.source === 'gemini-grounded' || msg.source === 'assistant') && (
                        <span>Verified for {activeHome?.name || 'Home'}</span>
                      )}
                    </div>

                    <button
                      onClick={() => copyContent(msg.id, msg.content)}
                      className="flex items-center space-x-1 hover:text-stone-600 dark:hover:text-stone-200 transition-colors ml-2 shrink-0"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading / Thinking indicator */}
        {loading && (
          <div className="flex items-center space-x-2 text-stone-500 dark:text-stone-400 text-xs py-2 pl-2">
            <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950/80 flex items-center justify-center animate-spin">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <span className="animate-pulse">Checking family records for {activeHome?.name}...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="mt-3 shrink-0">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2 bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-2 shadow-xs"
        >
          <input
            id="input-ask-homely-prompt"
            type="text"
            placeholder={`Ask about ${activeHome?.name || 'family'} events, spare keys, or schedule actions...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none"
          />
          <button
            id="btn-submit-ask-homely"
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Persistent Family Memories Modal */}
      {showMemoriesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    Saved Family Facts
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Facts Ask Homely remembers for {activeHome?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMemoriesModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search filter */}
            <div className="p-3 border-b border-stone-200/60 dark:border-zinc-800/60 bg-stone-50/50 dark:bg-zinc-950/30">
              <input
                type="text"
                placeholder="Search remembered facts..."
                value={searchMemoryQuery}
                onChange={e => setSearchMemoryQuery(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none"
              />
            </div>

            {/* Memories List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {loadingMemories ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-stone-400">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                  <span className="text-xs">Loading remembered facts...</span>
                </div>
              ) : filteredMemories.length === 0 ? (
                <div className="py-12 text-center space-y-2 text-stone-400">
                  <Bookmark className="w-8 h-8 mx-auto text-stone-300 dark:text-stone-600" />
                  <p className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    {searchMemoryQuery ? 'No matching memories found' : 'No memories saved yet'}
                  </p>
                  <p className="text-[11px] text-stone-400 max-w-xs mx-auto">
                    Tell Ask Homely: <span className="font-semibold text-indigo-600 dark:text-indigo-400">"Remember that the spare key is with Uncle"</span> to save facts.
                  </p>
                </div>
              ) : (
                filteredMemories.map(mem => (
                  <div
                    key={mem.id}
                    className="p-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/80 dark:border-zinc-700/60 flex items-start justify-between space-x-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          {mem.key.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {mem.createdAt.slice(0, 10)}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-stone-800 dark:text-stone-200 mt-1.5 leading-relaxed">
                        {mem.content}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteMemory(mem.id)}
                      disabled={deletingMemoryId === mem.id}
                      className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-white dark:hover:bg-zinc-700 transition-colors shrink-0"
                      title="Forget this memory"
                    >
                      {deletingMemoryId === mem.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-950/30 flex justify-end">
              <button
                onClick={() => setShowMemoriesModal(false)}
                className="px-4 py-1.5 rounded-xl bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-300 text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
