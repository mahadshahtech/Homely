import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, 
  ListFilter, 
  Plus, 
  Search, 
  X, 
  Clock, 
  CalendarDays, 
  Users, 
  AlertCircle, 
  Sparkles,
  Loader2,
  RefreshCw
} from 'lucide-react';
import type { FamilyEvent, HomeMember, EventRsvpStatus } from '../../../types';
import { api } from '../../../services/api';
import { EventCard } from './EventCard';
import { CalendarMonthGrid } from './CalendarMonthGrid';
import { EventFormModal } from './EventFormModal';
import { EventDetailsModal } from './EventDetailsModal';

interface EventsViewProps {
  homeId: string;
  currentUser: { id: string; name: string; avatar?: string } | null;
  userRole: string;
  homeMembers: HomeMember[];
}

export const EventsView: React.FC<EventsViewProps> = ({
  homeId,
  currentUser,
  userRole,
  homeMembers
}) => {
  const currentUserId = currentUser?.id || '';
  const canManageHome = userRole === 'owner' || userRole === 'admin';

  // State
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [selectedAttendeeFilter, setSelectedAttendeeFilter] = useState<string>('all');

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FamilyEvent | null>(null);
  const [initialFormDate, setInitialFormDate] = useState<string | undefined>(undefined);
  
  const [selectedEventDetails, setSelectedEventDetails] = useState<FamilyEvent | null>(null);

  // Load events from backend
  const fetchEvents = useCallback(async () => {
    if (!homeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getEvents(homeId, {
        search: searchQuery.trim() || undefined,
        filter: timeFilter !== 'all' ? timeFilter : undefined,
        attendeeId: selectedAttendeeFilter !== 'all' ? selectedAttendeeFilter : undefined
      });
      setEvents(res.events || []);

      // If details modal is open, refresh its data
      if (selectedEventDetails) {
        const refreshed = res.events?.find(e => e.id === selectedEventDetails.id);
        if (refreshed) {
          setSelectedEventDetails(refreshed);
        }
      }
    } catch (err: any) {
      console.error('Failed to load events:', err);
      setError(err?.message || 'Unable to load family events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [homeId, searchQuery, timeFilter, selectedAttendeeFilter, selectedEventDetails?.id]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Handle RSVP
  const handleRsvp = async (eventId: string, status: EventRsvpStatus) => {
    try {
      // Optimistic update
      setEvents(prev => prev.map(ev => {
        if (ev.id === eventId) {
          const isGoing = status === 'going';
          const newAttendeeIds = isGoing
            ? Array.from(new Set([...ev.attendeeIds, currentUserId]))
            : ev.attendeeIds.filter(id => id !== currentUserId);

          return {
            ...ev,
            userRsvpStatus: status,
            isAttending: isGoing,
            attendeeIds: newAttendeeIds
          };
        }
        return ev;
      }));

      const res = await api.setEventRsvp(homeId, eventId, status);
      if (res.event) {
        setEvents(prev => prev.map(ev => ev.id === eventId ? res.event : ev));
        if (selectedEventDetails?.id === eventId) {
          setSelectedEventDetails(res.event);
        }
      }
    } catch (err) {
      console.error('RSVP update failed:', err);
      fetchEvents();
    }
  };

  // Handle Create or Update
  const handleFormSubmit = async (formData: {
    title: string;
    description?: string;
    date: string;
    time: string;
    endTime?: string;
    location?: string;
    reminder?: string;
    attendeeIds?: string[];
  }) => {
    if (editingEvent) {
      const res = await api.updateEvent(homeId, editingEvent.id, formData);
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? res.event : e));
      if (selectedEventDetails?.id === editingEvent.id) {
        setSelectedEventDetails(res.event);
      }
    } else {
      const res = await api.createEvent(homeId, formData);
      setEvents(prev => [res.event, ...prev]);
    }
    setEditingEvent(null);
    setInitialFormDate(undefined);
  };

  // Handle Delete
  const handleDeleteEvent = async (eventId: string) => {
    await api.deleteEvent(homeId, eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
    if (selectedEventDetails?.id === eventId) {
      setSelectedEventDetails(null);
    }
  };

  // Quick add from specific calendar date
  const handleQuickAddForDate = (dateStr: string) => {
    setInitialFormDate(dateStr);
    setEditingEvent(null);
    setShowFormModal(true);
  };

  // Open Edit flow
  const handleEditClick = (event: FamilyEvent) => {
    setSelectedEventDetails(null);
    setEditingEvent(event);
    setInitialFormDate(undefined);
    setShowFormModal(true);
  };

  // Filtered & sorted events for list view
  const displayEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      // Sort upcoming ascending, past descending
      const dateA = `${a.date}T${a.time || '00:00'}`;
      const dateB = `${b.date}T${b.time || '00:00'}`;
      if (timeFilter === 'past') {
        return dateB.localeCompare(dateA);
      }
      return dateA.localeCompare(dateB);
    });
  }, [events, timeFilter]);

  return (
    <div id="homely-family-events-view" className="space-y-4">
      {/* Top Header & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-2">
            <span>Family Calendar & Events</span>
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Coordinate gatherings, birthdays, appointments, and family plans
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Segmented View Mode Toggle */}
          <div className="bg-stone-100 dark:bg-zinc-800 p-1 rounded-2xl flex items-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-900 dark:text-indigo-300 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>List</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-900 dark:text-indigo-300 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Month</span>
            </button>
          </div>

          {/* Schedule Event CTA */}
          <button
            id="btn-schedule-event"
            type="button"
            onClick={() => {
              setEditingEvent(null);
              setInitialFormDate(undefined);
              setShowFormModal(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Event</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search events by title, description, or location..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-2xl border border-stone-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Attendee Filter Selector */}
          <div className="sm:w-48">
            <select
              value={selectedAttendeeFilter}
              onChange={e => setSelectedAttendeeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-2xl border border-stone-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            >
              <option value="all">All Family Members</option>
              {homeMembers.map(m => (
                <option key={m.userId} value={m.userId}>
                  {m.name} {m.userId === currentUserId ? '(You)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Time Filters (Upcoming / All / Past) */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setTimeFilter('upcoming')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              timeFilter === 'upcoming'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-600 dark:text-stone-400'
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              timeFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-600 dark:text-stone-400'
            }`}
          >
            All Events
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter('past')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              timeFilter === 'past'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-600 dark:text-stone-400'
            }`}
          >
            Past Events
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchEvents}
            className="flex items-center space-x-1 font-semibold text-rose-800 dark:text-rose-200 hover:underline"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Content Rendering: List vs Month View */}
      {loading ? (
        <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
          <p className="text-xs text-stone-500 font-medium">Loading family events...</p>
        </div>
      ) : viewMode === 'calendar' ? (
        <CalendarMonthGrid
          events={events}
          onSelectEvent={ev => setSelectedEventDetails(ev)}
          onQuickAddForDate={handleQuickAddForDate}
          onRsvp={handleRsvp}
          currentUserId={currentUserId}
        />
      ) : displayEvents.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-10 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <CalendarIcon className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
              {searchQuery || timeFilter !== 'upcoming' || selectedAttendeeFilter !== 'all'
                ? 'No matching events found'
                : 'No upcoming family events'}
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
              {searchQuery || timeFilter !== 'upcoming' || selectedAttendeeFilter !== 'all'
                ? 'Try adjusting your search query or filters to see more events.'
                : 'Plan your next family dinner, birthday, game night, or school milestone together.'}
            </p>
          </div>

          {searchQuery || timeFilter !== 'upcoming' || selectedAttendeeFilter !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTimeFilter('upcoming');
                setSelectedAttendeeFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 text-xs font-semibold transition-colors"
            >
              Clear filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingEvent(null);
                setInitialFormDate(undefined);
                setShowFormModal(true);
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule First Event</span>
            </button>
          )}
        </div>
      ) : (
        /* Event Cards List */
        <div className="space-y-3">
          {displayEvents.map(ev => (
            <EventCard
              key={ev.id}
              event={ev}
              onSelect={ev => setSelectedEventDetails(ev)}
              onRsvp={handleRsvp}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Event Modal */}
      <EventFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingEvent(null);
          setInitialFormDate(undefined);
        }}
        onSubmit={handleFormSubmit}
        initialEvent={editingEvent}
        initialDate={initialFormDate}
        homeMembers={homeMembers}
        currentUserId={currentUserId}
      />

      {/* Event Details Modal */}
      <EventDetailsModal
        event={selectedEventDetails}
        isOpen={Boolean(selectedEventDetails)}
        onClose={() => setSelectedEventDetails(null)}
        onRsvp={handleRsvp}
        onEdit={handleEditClick}
        onDelete={handleDeleteEvent}
        currentUserId={currentUserId}
        canManage={canManageHome || (selectedEventDetails ? selectedEventDetails.creatorId === currentUserId : false)}
      />
    </div>
  );
};
