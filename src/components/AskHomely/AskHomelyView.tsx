import React, { useState } from 'react';
import { Sparkles, Send, KeyRound, Calendar, ShieldCheck, Heart, Copy, Check, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: string;
  timestamp: string;
}

export const AskHomelyView: React.FC = () => {
  const { activeHome, user } = useAuth();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: `Hello ${user?.name?.split(' ')[0] || 'there'}! I'm **Ask Homely**, your family assistant for **${activeHome?.name || 'your space'}**.\n\nYou can ask me about family events, spare keys & vault codes, recent posts, or ask me to draft announcements for your Family Chat.`,
      timestamp: 'Just now'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sampleSuggestions = [
    { label: 'Spare Keys & WiFi', prompt: 'Where are the spare keys and WiFi code?' },
    { label: 'Upcoming Events', prompt: 'What events are on our family schedule?' },
    { label: 'Who is in this Home?', prompt: 'Who are all the family members here?' },
    { label: 'Draft Dinner Message', prompt: 'Draft a message for the family chat about dinner tomorrow at 7 PM' }
  ];

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || !activeHome || loading) return;

    const userMsg: AssistantMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: 'Just now'
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.askHomely(activeHome.id, textToSend);
      const assistantMsg: AssistantMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        source: res.source,
        timestamp: 'Just now'
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: "I'm having a little trouble checking family records right now. Please try asking again in a moment.",
          timestamp: 'Just now'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyContent = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div id="ask-homely-view" className="max-w-md md:max-w-2xl mx-auto px-4 py-3 pb-24 h-[calc(100vh-8.5rem)] flex flex-col">
      {/* Friendly Header Card */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-4 mb-3 shadow-sm transition-colors flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Ask Homely
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                Private Family Assistant
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Only has access to {activeHome?.name || 'your family'}'s shared records
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Isolated</span>
        </div>
      </div>

      {/* Suggested chips */}
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

      {/* Chat Messages */}
      <div className="flex-1 bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-4 overflow-y-auto space-y-3.5 shadow-sm transition-colors">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex items-start space-x-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-xs'
                  : 'bg-stone-50 dark:bg-zinc-800/80 text-stone-900 dark:text-stone-100 border border-stone-200/60 dark:border-zinc-700/60 rounded-bl-xs'
              }`}
            >
              <div className="whitespace-pre-line prose prose-xs dark:prose-invert">
                {msg.content}
              </div>

              {msg.role === 'assistant' && (
                <div className="mt-2 pt-2 border-t border-stone-200/40 dark:border-zinc-700/40 flex items-center justify-between text-[10px] text-stone-400">
                  <span>{msg.source === 'ai' ? 'Powered by Homely Gemini' : 'Family Records Assistant'}</span>
                  <button
                    onClick={() => copyContent(msg.id, msg.content)}
                    className="flex items-center space-x-1 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
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
        ))}

        {loading && (
          <div className="flex items-center space-x-2 text-stone-400 text-xs py-2">
            <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center animate-spin">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <span>Checking family space records...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="mt-3 shrink-0">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2 bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-2xl p-2 shadow-sm"
        >
          <input
            id="input-ask-homely-prompt"
            type="text"
            placeholder="Ask anything about your family space..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent px-3 py-1.5 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none"
          />
          <button
            id="btn-submit-ask-homely"
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
