import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  MapPin, 
  Check, 
  HelpCircle, 
  XCircle,
  Users
} from 'lucide-react';
import type { FamilyEvent, EventRsvpStatus } from '../../../types';

interface CalendarMonthGridProps {
  events: FamilyEvent[];
  onSelectEvent: (event: FamilyEvent) => void;
  onQuickAddForDate: (dateStr: string) => void;
  onRsvp: (eventId: string, status: EventRsvpStatus) => Promise<void>;
  currentUserId: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const CalendarMonthGrid: React.FC<CalendarMonthGridProps> = ({
  events,
  onSelectEvent,
  onQuickAddForDate,
  onRsvp,
  currentUserId
}) => {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(todayStr);
  };

  // Build calendar matrix
  const { daysInMonth, startDayOfWeek, daysArray } = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startDay = new Date(currentYear, currentMonth, 1).getDay();
    const days: (number | null)[] = [];

    // Pad before 1st of month
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      days.push(d);
    }

    return {
      daysInMonth: totalDays,
      startDayOfWeek: startDay,
      daysArray: days
    };
  }, [currentYear, currentMonth]);

  // Map events to date strings
  const eventsByDate = useMemo(() => {
    const map = new Map<string, FamilyEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events]);

  const getDateString = (day: number) => {
    const m = String(currentMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${currentYear}-${m}-${d}`;
  };

  const selectedDayEvents = useMemo(() => {
    return eventsByDate.get(selectedDate) || [];
  }, [eventsByDate, selectedDate]);

  const formatSelectedDateTitle = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div id="calendar-month-grid-container" className="space-y-4">
      {/* Calendar Header & Controls */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h3>
            <button
              type="button"
              onClick={goToToday}
              className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-300 transition-colors"
            >
              Today
            </button>
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="p-1.5 rounded-xl text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="p-1.5 rounded-xl text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map(w => (
            <div key={w} className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider py-1">
              {w}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {daysArray.map((day, idx) => {
            if (day === null) {
              return <div key={`pad-${idx}`} className="h-14 sm:h-20 rounded-2xl bg-transparent" />;
            }

            const dateStr = getDateString(day);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const dayEvents = eventsByDate.get(dateStr) || [];

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={`h-14 sm:h-20 p-1 sm:p-1.5 rounded-2xl flex flex-col justify-between text-left transition-all border ${
                  isSelected
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm'
                    : isToday
                    ? 'border-indigo-300 dark:border-indigo-800/80 bg-stone-50/60 dark:bg-zinc-800/50'
                    : 'border-stone-100 dark:border-zinc-800/70 hover:border-stone-200 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold ${
                      isToday
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isSelected
                        ? 'text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {day}
                  </span>

                  {dayEvents.length > 0 && (
                    <span className="hidden sm:inline-block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.2 rounded-full">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Event previews or dots */}
                <div className="w-full space-y-0.5 overflow-hidden">
                  {/* Mobile dots */}
                  <div className="flex sm:hidden items-center justify-center space-x-1 pt-1">
                    {dayEvents.slice(0, 3).map((e, dotIdx) => (
                      <span
                        key={e.id || dotIdx}
                        className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="w-1 h-1 rounded-full bg-stone-400" />
                    )}
                  </div>

                  {/* Desktop small title chips */}
                  <div className="hidden sm:block space-y-0.5">
                    {dayEvents.slice(0, 2).map(e => (
                      <div
                        key={e.id}
                        className="truncate text-[10px] px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 text-stone-800 dark:text-stone-200 font-medium hover:bg-indigo-100 dark:hover:bg-indigo-950/80"
                        title={`${e.time} - ${e.title}`}
                      >
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-stone-400 font-medium px-1 block">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Agenda Drawer */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-3">
          <div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Agenda for {formatSelectedDateTitle(selectedDate)}
            </h4>
            <p className="text-xs text-stone-400">
              {selectedDayEvents.length === 1
                ? '1 family gathering scheduled'
                : `${selectedDayEvents.length} family gatherings scheduled`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onQuickAddForDate(selectedDate)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Event</span>
          </button>
        </div>

        {selectedDayEvents.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <CalendarIcon className="w-8 h-8 text-stone-300 dark:text-zinc-700 mx-auto" />
            <p className="text-xs text-stone-500 dark:text-stone-400">
              No family events on this date.
            </p>
            <button
              type="button"
              onClick={() => onQuickAddForDate(selectedDate)}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              + Schedule something for {formatSelectedDateTitle(selectedDate)}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedDayEvents.map(ev => {
              const userStatus = ev.userRsvpStatus || (ev.isAttending ? 'going' : undefined);

              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent(ev)}
                  className="p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-800/50 hover:bg-stone-100 dark:hover:bg-zinc-800 border border-stone-200/60 dark:border-zinc-700/60 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-stone-900 dark:text-stone-100">
                        {ev.title}
                      </span>
                      {userStatus === 'going' && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full flex items-center space-x-0.5">
                          <Check className="w-3 h-3" />
                          <span>Going</span>
                        </span>
                      )}
                      {userStatus === 'maybe' && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full flex items-center space-x-0.5">
                          <HelpCircle className="w-3 h-3" />
                          <span>Maybe</span>
                        </span>
                      )}
                      {userStatus === 'declined' && (
                        <span className="text-[10px] font-semibold text-stone-400 bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full flex items-center space-x-0.5">
                          <XCircle className="w-3 h-3" />
                          <span>Can't Go</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-stone-500 dark:text-stone-400 flex-wrap gap-y-1">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-indigo-500" />
                        <span>{ev.time}{ev.endTime ? ` – ${ev.endTime}` : ''}</span>
                      </span>

                      {ev.location && (
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-rose-500" />
                          <span>{ev.location}</span>
                        </span>
                      )}

                      <span className="flex items-center space-x-1">
                        <Users className="w-3 h-3 text-stone-400" />
                        <span>{ev.attendeeIds?.length || ev.attendees?.length || 0} attending</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 self-end sm:self-center" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onRsvp(ev.id, 'going')}
                      title="Going"
                      className={`p-1.5 rounded-xl text-xs font-semibold transition-all ${
                        userStatus === 'going'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-zinc-900 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-zinc-700 hover:bg-emerald-50'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRsvp(ev.id, 'maybe')}
                      title="Maybe"
                      className={`p-1.5 rounded-xl text-xs font-semibold transition-all ${
                        userStatus === 'maybe'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-white dark:bg-zinc-900 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-zinc-700 hover:bg-amber-50'
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRsvp(ev.id, 'declined')}
                      title="Can't Go"
                      className={`p-1.5 rounded-xl text-xs font-semibold transition-all ${
                        userStatus === 'declined'
                          ? 'bg-stone-600 text-white shadow-xs'
                          : 'bg-white dark:bg-zinc-900 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-zinc-700 hover:bg-stone-100'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
