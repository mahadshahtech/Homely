import React, { useState } from 'react';
import { X, Plus, Trash2, CheckSquare } from 'lucide-react';
import type { MessagePoll } from '../../types';

interface PollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (poll: MessagePoll) => void;
}

export const PollModal: React.FC<PollModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 8) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuestion = question.trim();
    const cleanOptions = options.map(o => o.trim()).filter(Boolean);

    if (!cleanQuestion || cleanOptions.length < 2) return;

    const poll: MessagePoll = {
      id: `poll_${Date.now()}`,
      question: cleanQuestion,
      isMultipleChoice: isMultiple,
      options: cleanOptions.map((opt, idx) => ({
        id: `opt_${Date.now()}_${idx}`,
        text: opt,
        votes: []
      }))
    };

    onSubmit(poll);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Create Family Poll</h3>
              <p className="text-[11px] text-stone-400">Decide dinner, weekend trips, movie night & more</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Poll Question
            </label>
            <input
              type="text"
              placeholder="e.g. What should we have for dinner tonight?"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
              Options
            </label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-stone-400 w-4 text-center">{i + 1}.</span>
                <input
                  type="text"
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={e => handleOptionChange(i, e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(i)}
                    className="p-1.5 text-stone-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {options.length < 8 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="flex items-center space-x-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 pt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Option</span>
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer text-xs text-stone-600 dark:text-stone-300">
              <input
                type="checkbox"
                checked={isMultiple}
                onChange={e => setIsMultiple(e.target.checked)}
                className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Allow multiple selections</span>
            </label>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40 shadow-sm transition-colors"
            >
              Post Poll to Chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
