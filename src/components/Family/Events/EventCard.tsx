import React from 'react';
import { 
  Clock, 
  MapPin, 
  Users, 
  Check, 
  HelpCircle, 
  XCircle, 
  ChevronRight 
} from 'lucide-react';
import type { FamilyEvent, EventRsvpStatus } from '../../../types';

interface EventCardProps {
  event: FamilyEvent;
  onSelect: (event: FamilyEvent) => void;
  onRsvp: (eventId: string, status: EventRsvpStatus) => Promise<void>;
  currentUserId: string;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onSelect,
  onRsvp,
  currentUserId
}) => {
  // Parse event date
  const { monthStr, dayStr, weekdayStr, isPast } = React.useMemo(() => {
    try {
      const parts = event.date.split('-');
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      const dateObj = new Date(y, m, d);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPastDate = dateObj < today;

      return {
        monthStr: MONTH_SHORT[m] || 'Date',
        dayStr: String(d),
        weekdayStr: WEEKDAYS_SHORT[dateObj.getDay()] || '',
        isPast: isPastDate
      };
    } catch {
      return { monthStr: 'Date', dayStr: '01', weekdayStr: '', isPast: false };
    }
  }, [event.date]);

  const userStatus = event.userRsvpStatus || (event.isAttending ? 'going' : undefined);

  // Attendees
  const goingCount = event.rsvps?.going?.length ?? event.attendeeIds?.length ?? event.attendees?.length ?? 0;
  const attendeesList = event.attendees || [];

  return (
    <div
      onClick={() => onSelect(event)}
      className={`group relative bg-white dark:bg-zinc-900 border rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer ${
        isPast
          ? 'border-stone-200/60 dark:border-zinc-800 opacity-80'
          : 'border-stone-200/80 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-indigo-900'
      }`}
    >
      <div className="flex items-start gap-3.5 sm:gap-4">
        {/* Date Badge */}
        <div className={`shrink-0 w-14 sm:w-16 h-16 sm:h-18 rounded-2xl flex flex-col items-center justify-center border text-center transition-colors ${
          isPast
            ? 'bg-stone-100 dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-stone-500'
            : 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200 group-hover:border-indigo-300'
        }`}>
          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
            {monthStr}
          </span>
          <span className="text-lg sm:text-xl font-extrabold leading-tight">
            {dayStr}
          </span>
          <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500">
            {weekdayStr}
          </span>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {event.title}
            </h4>

            {/* User RSVP status badge */}
            <div className="shrink-0" onClick={e => e.stopPropagation()}>
              {userStatus === 'going' && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <Check className="w-3 h-3" />
                  <span className="hidden xs:inline">You're</span>
                  <span>Going</span>
                </span>
              )}
              {userStatus === 'maybe' && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <HelpCircle className="w-3 h-3" />
                  <span>Maybe</span>
                </span>
              )}
              {userStatus === 'declined' && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-zinc-700">
                  <XCircle className="w-3 h-3" />
                  <span>Can't Go</span>
                </span>
              )}
              {!userStatus && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 dark:bg-zinc-800 text-stone-500">
                  No RSVP
                </span>
              )}
            </div>
          </div>

          {/* Time & Location */}
          <div className="flex items-center space-x-3 text-xs text-stone-500 dark:text-stone-400 flex-wrap gap-y-1">
            <div className="flex items-center space-x-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>
                {event.time}
                {event.endTime ? ` – ${event.endTime}` : ''}
              </span>
            </div>

            {event.location && (
              <div className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="truncate max-w-[150px] sm:max-w-[220px]">{event.location}</span>
              </div>
            )}
          </div>

          {/* Optional description preview */}
          {event.description && (
            <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-1 leading-relaxed">
              {event.description}
            </p>
          )}

          {/* Bottom Bar: Attendees + RSVP Quick Action */}
          <div className="pt-2.5 mt-2 border-t border-stone-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
            {/* Attendees cluster */}
            <div className="flex items-center space-x-2">
              <div className="flex -space-x-1.5 overflow-hidden">
                {attendeesList.slice(0, 4).map(a => (
                  <img
                    key={a.id}
                    src={a.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${a.name}`}
                    alt={a.name}
                    title={a.name}
                    className="inline-block h-5 w-5 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-stone-200 shrink-0"
                  />
                ))}
              </div>
              <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                {goingCount} attending
              </span>
            </div>

            {/* Quick RSVP toggle */}
            <div 
              className="flex items-center space-x-1 bg-stone-100/80 dark:bg-zinc-800/80 p-0.5 rounded-xl"
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onRsvp(event.id, 'going')}
                title="Going"
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center space-x-1 ${
                  userStatus === 'going'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-300'
                }`}
              >
                <Check className="w-3 h-3" />
                <span className="hidden sm:inline">Going</span>
              </button>

              <button
                type="button"
                onClick={() => onRsvp(event.id, 'maybe')}
                title="Maybe"
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center space-x-1 ${
                  userStatus === 'maybe'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-300'
                }`}
              >
                <HelpCircle className="w-3 h-3" />
                <span className="hidden sm:inline">Maybe</span>
              </button>

              <button
                type="button"
                onClick={() => onRsvp(event.id, 'declined')}
                title="Can't Go"
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center space-x-1 ${
                  userStatus === 'declined'
                    ? 'bg-stone-600 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-rose-600'
                }`}
              >
                <XCircle className="w-3 h-3" />
                <span className="hidden sm:inline">No</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
