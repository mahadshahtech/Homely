import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  Bell, 
  Users, 
  Check, 
  HelpCircle, 
  XCircle, 
  Edit3, 
  Trash2, 
  Share2, 
  Download, 
  AlertTriangle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import type { FamilyEvent, EventRsvpStatus } from '../../../types';

interface EventDetailsModalProps {
  event: FamilyEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onRsvp: (eventId: string, status: EventRsvpStatus) => Promise<void>;
  onEdit: (event: FamilyEvent) => void;
  onDelete: (eventId: string) => Promise<void>;
  currentUserId: string;
  canManage: boolean;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  event,
  isOpen,
  onClose,
  onRsvp,
  onEdit,
  onDelete,
  currentUserId,
  canManage
}) => {
  if (!isOpen || !event) return null;

  const [rsvpTab, setRsvpTab] = useState<'all' | 'going' | 'maybe' | 'declined'>('going');
  const [isUpdatingRsvp, setIsUpdatingRsvp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentUserStatus = event.userRsvpStatus || (event.isAttending ? 'going' : undefined);

  const goingAttendees = event.rsvps?.going || event.attendees.filter(a => event.attendeeIds.includes(a.id));
  const maybeAttendees = event.rsvps?.maybe || [];
  const declinedAttendees = event.rsvps?.declined || [];

  const handleRsvpClick = async (status: EventRsvpStatus) => {
    setIsUpdatingRsvp(true);
    try {
      await onRsvp(event.id, status);
    } finally {
      setIsUpdatingRsvp(false);
    }
  };

  const handleDeleteClick = async () => {
    setIsDeleting(true);
    try {
      await onDelete(event.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to generate iCalendar (.ics) download
  const handleDownloadIcs = () => {
    const formatIcsDate = (dateStr: string, timeStr: string) => {
      const cleanDate = dateStr.replace(/-/g, '');
      const cleanTime = timeStr.replace(/:/g, '') + '00';
      return `${cleanDate}T${cleanTime}`;
    };

    const startDateTime = formatIcsDate(event.date, event.time);
    const endDateTime = event.endTime 
      ? formatIcsDate(event.date, event.endTime)
      : formatIcsDate(event.date, '20:00');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Homely//Family Calendar//EN',
      'BEGIN:VEVENT',
      `UID:${event.id}@homely.family`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString().slice(0, 10), '12:00')}Z`,
      `DTSTART:${startDateTime}`,
      `DTEND:${endDateTime}`,
      `SUMMARY:${event.title.replace(/,/g, '\\,')}`,
      event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
      event.location ? `LOCATION:${event.location.replace(/,/g, '\\,')}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format date readable
  const formatReadableDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(undefined, { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div 
      id="event-details-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-details-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-stone-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
              Family Event
            </span>
            {event.reminder && event.reminder !== 'none' && (
              <span className="flex items-center space-x-1 text-[11px] text-stone-500 dark:text-stone-400">
                <Bell className="w-3 h-3 text-amber-500" />
                <span>{event.reminder} reminder</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={handleDownloadIcs}
              title="Add to personal calendar (.ics)"
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>

            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(event)}
                  title="Edit event"
                  className="p-1.5 rounded-xl text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Delete event"
                  className="p-1.5 rounded-xl text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title & Date Banner */}
          <div className="space-y-2">
            <h2 id="event-details-title" className="text-xl font-bold text-stone-900 dark:text-stone-100">
              {event.title}
            </h2>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
              <div className="flex items-center space-x-1.5 font-medium">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>{formatReadableDate(event.date)}</span>
              </div>
              <span className="hidden sm:inline text-stone-300 dark:text-zinc-700">•</span>
              <div className="flex items-center space-x-1.5 font-medium">
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>
                  {event.time}
                  {event.endTime ? ` – ${event.endTime}` : ''}
                </span>
              </div>
            </div>

            {event.location && (
              <div className="flex items-center space-x-1.5 text-xs text-stone-600 dark:text-stone-300 pt-1">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{event.location}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-100 dark:border-zinc-800 text-xs text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
              {event.description}
            </div>
          )}

          {/* Creator info */}
          <div className="flex items-center space-x-2.5 py-1 text-xs text-stone-500 dark:text-stone-400">
            <img
              src={event.creator.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${event.creator.name}`}
              alt={event.creator.name}
              className="w-5 h-5 rounded-full"
            />
            <span>Organized by <strong className="font-semibold text-stone-700 dark:text-stone-300">{event.creator.name}</strong></span>
          </div>

          {/* RSVP Selection Box */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Your RSVP Status
              </span>
              {isUpdatingRsvp && (
                <div className="flex items-center space-x-1 text-[11px] text-indigo-600 dark:text-indigo-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Updating...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isUpdatingRsvp}
                onClick={() => handleRsvpClick('going')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  currentUserStatus === 'going'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-zinc-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Going</span>
              </button>

              <button
                type="button"
                disabled={isUpdatingRsvp}
                onClick={() => handleRsvpClick('maybe')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  currentUserStatus === 'maybe'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-zinc-700 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Maybe</span>
              </button>

              <button
                type="button"
                disabled={isUpdatingRsvp}
                onClick={() => handleRsvpClick('declined')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  currentUserStatus === 'declined'
                    ? 'bg-stone-600 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-zinc-700 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Can't Go</span>
              </button>
            </div>
          </div>

          {/* Attendee breakdown */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-2">
              <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-stone-400" />
                <span>Attendees ({goingAttendees.length + maybeAttendees.length + declinedAttendees.length})</span>
              </span>

              {/* RSVP status tabs */}
              <div className="flex space-x-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setRsvpTab('going')}
                  className={`px-2 py-0.5 rounded-lg font-medium transition-colors ${
                    rsvpTab === 'going'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                  }`}
                >
                  Going ({goingAttendees.length})
                </button>

                {maybeAttendees.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRsvpTab('maybe')}
                    className={`px-2 py-0.5 rounded-lg font-medium transition-colors ${
                      rsvpTab === 'maybe'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                    }`}
                  >
                    Maybe ({maybeAttendees.length})
                  </button>
                )}

                {declinedAttendees.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRsvpTab('declined')}
                    className={`px-2 py-0.5 rounded-lg font-medium transition-colors ${
                      rsvpTab === 'declined'
                        ? 'bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-stone-300'
                        : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                    }`}
                  >
                    Can't Go ({declinedAttendees.length})
                  </button>
                )}
              </div>
            </div>

            {/* List for active tab */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {rsvpTab === 'going' && (
                goingAttendees.length === 0 ? (
                  <p className="text-xs text-stone-400 py-3 text-center">No one marked going yet</p>
                ) : (
                  goingAttendees.map(attendee => (
                    <div
                      key={attendee.id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/50"
                    >
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={attendee.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${attendee.name}`}
                          alt={attendee.name}
                          className="w-6 h-6 rounded-full bg-stone-200"
                        />
                        <span className="text-xs font-medium text-stone-800 dark:text-stone-200">
                          {attendee.name}
                          {attendee.id === currentUserId && ' (You)'}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Going</span>
                      </span>
                    </div>
                  ))
                )
              )}

              {rsvpTab === 'maybe' && (
                maybeAttendees.length === 0 ? (
                  <p className="text-xs text-stone-400 py-3 text-center">No one marked maybe</p>
                ) : (
                  maybeAttendees.map(attendee => (
                    <div
                      key={attendee.id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/50"
                    >
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={attendee.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${attendee.name}`}
                          alt={attendee.name}
                          className="w-6 h-6 rounded-full bg-stone-200"
                        />
                        <span className="text-xs font-medium text-stone-800 dark:text-stone-200">
                          {attendee.name}
                          {attendee.id === currentUserId && ' (You)'}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center space-x-1">
                        <HelpCircle className="w-3 h-3" />
                        <span>Maybe</span>
                      </span>
                    </div>
                  ))
                )
              )}

              {rsvpTab === 'declined' && (
                declinedAttendees.length === 0 ? (
                  <p className="text-xs text-stone-400 py-3 text-center">No one declined</p>
                ) : (
                  declinedAttendees.map(attendee => (
                    <div
                      key={attendee.id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800/50"
                    >
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={attendee.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${attendee.name}`}
                          alt={attendee.name}
                          className="w-6 h-6 rounded-full bg-stone-200"
                        />
                        <span className="text-xs font-medium text-stone-500 dark:text-stone-400 line-through">
                          {attendee.name}
                          {attendee.id === currentUserId && ' (You)'}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-stone-400 flex items-center space-x-1">
                        <XCircle className="w-3 h-3" />
                        <span>Can't Go</span>
                      </span>
                    </div>
                  ))
                )
              )}
            </div>
          </div>

          {/* Delete Confirmation Alert if requested */}
          {showDeleteConfirm && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 space-y-2.5 animate-in fade-in">
              <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-200 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Are you sure you want to remove this event?</span>
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                This will delete "{event.title}" from the family calendar for all members.
              </p>
              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900"
                >
                  Keep Event
                </button>
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm flex items-center space-x-1.5"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Confirm Delete</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-stone-50/50 dark:bg-zinc-900/50">
          <span className="text-[11px] text-stone-400">
            Homely Family Calendar
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 dark:hover:bg-zinc-700 text-stone-800 dark:text-stone-200 text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
