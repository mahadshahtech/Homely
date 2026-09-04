import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  Bell, 
  Users, 
  AlertCircle, 
  Check, 
  Loader2 
} from 'lucide-react';
import type { FamilyEvent, HomeMember } from '../../../types';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    date: string;
    time: string;
    endTime?: string;
    location?: string;
    reminder?: string;
    attendeeIds?: string[];
  }) => Promise<void>;
  initialEvent?: FamilyEvent | null;
  initialDate?: string;
  homeMembers: HomeMember[];
  currentUserId: string;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialEvent,
  initialDate,
  homeMembers,
  currentUserId
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(initialEvent);

  const [title, setTitle] = useState(initialEvent?.title || '');
  const [description, setDescription] = useState(initialEvent?.description || '');
  const [date, setDate] = useState(initialEvent?.date || initialDate || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(initialEvent?.time || '18:00');
  const [endTime, setEndTime] = useState(initialEvent?.endTime || '');
  const [location, setLocation] = useState(initialEvent?.location || '');
  const [reminder, setReminder] = useState(initialEvent?.reminder || '24h');
  
  // Selected attendees: default to current user and other members if new, or existing attendees if editing
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>(() => {
    if (initialEvent) {
      return initialEvent.attendeeIds || [currentUserId];
    }
    // Default to all home members invited
    return homeMembers.map(m => m.userId);
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleAttendee = (userId: string) => {
    setSelectedAttendeeIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please provide an event title.');
      return;
    }

    if (!date.trim()) {
      setError('Please choose an event date.');
      return;
    }

    if (endTime && time && endTime <= time) {
      setError('End time must be later than the start time.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        date: date.trim(),
        time: time.trim() || '18:00',
        endTime: endTime.trim() || undefined,
        location: location.trim() || undefined,
        reminder: reminder.trim() || '24h',
        attendeeIds: selectedAttendeeIds.length > 0 ? selectedAttendeeIds : [currentUserId]
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save event. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      id="event-form-modal-backdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-form-modal-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-stone-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 id="event-form-modal-title" className="text-sm font-bold text-stone-900 dark:text-stone-100">
                {isEditing ? 'Edit Family Event' : 'Schedule Family Event'}
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Keep everyone informed and coordinated
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="event-input-title" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Event Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="event-input-title"
              type="text"
              required
              maxLength={100}
              placeholder="e.g. Sunday Family Dinner, Maya's Recital, Game Night"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/80 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Date & Times */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="event-input-date" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="event-input-date"
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/80 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="event-input-start-time" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Start Time
              </label>
              <div className="relative">
                <input
                  id="event-input-start-time"
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/80 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="event-input-end-time" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                End Time <span className="text-[10px] text-stone-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <input
                  id="event-input-end-time"
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/80 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="event-input-location" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Location <span className="text-[10px] text-stone-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
              <input
                id="event-input-location"
                type="text"
                maxLength={120}
                placeholder="e.g. Home Dining Room, Central Park, 124 Oak Street"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/80 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Reminder */}
          <div>
            <label htmlFor="event-input-reminder" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Reminder Notification
            </label>
            <div className="relative">
              <Bell className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
              <select
                id="event-input-reminder"
                value={reminder}
                onChange={e => setReminder(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/80 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="none">No reminder</option>
                <option value="1h">1 hour before</option>
                <option value="2h">2 hours before</option>
                <option value="24h">1 day before (24h)</option>
                <option value="2d">2 days before</option>
                <option value="1w">1 week before</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="event-input-desc" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Notes & Agenda <span className="text-[10px] text-stone-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="event-input-desc"
              rows={3}
              maxLength={500}
              placeholder="What to bring, dress code, surprise details, or parking notes..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/80 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Invite Family Members */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
              Invite Family Members ({selectedAttendeeIds.length} selected)
            </label>
            <div className="flex flex-wrap gap-2">
              {homeMembers.map(member => {
                const isSelected = selectedAttendeeIds.includes(member.userId);
                return (
                  <button
                    key={member.userId}
                    type="button"
                    onClick={() => toggleAttendee(member.userId)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        : 'bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-400 border border-transparent hover:border-stone-200 dark:hover:border-zinc-700'
                    }`}
                  >
                    <img
                      src={member.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${member.name}`}
                      alt={member.name}
                      className="w-4 h-4 rounded-full"
                    />
                    <span>{member.name}</span>
                    {isSelected && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditing ? 'Update Event' : 'Schedule Event'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
