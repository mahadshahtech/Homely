import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Calendar,
  Filter,
  Users,
  Grid,
  Clock,
  ArrowUpDown,
  BookOpen,
  Sparkles,
  AlertCircle,
  RefreshCw,
  X
} from 'lucide-react';
import type { FamilyMemory, HomeMember, User } from '../../../types';
import { api } from '../../../services/api';
import { MemoryCard } from './MemoryCard';
import { MemoryDetailModal } from './MemoryDetailModal';
import { CreateEditMemoryModal } from './CreateEditMemoryModal';

interface MemoriesViewProps {
  homeId: string;
  currentUser: User | null;
  userRole?: string;
  homeMembers: HomeMember[];
}

export const MemoriesView: React.FC<MemoriesViewProps> = ({
  homeId,
  currentUser,
  userRole,
  homeMembers
}) => {
  const [memories, setMemories] = useState<FamilyMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

  // Modals
  const [selectedMemory, setSelectedMemory] = useState<FamilyMemory | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [memoryToEdit, setMemoryToEdit] = useState<FamilyMemory | null>(null);

  // Load memories from backend
  const loadMemories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getMemories(homeId, {
        search: searchQuery.trim() || undefined,
        personId: selectedPersonId !== 'all' ? selectedPersonId : undefined,
        sort: sortOrder
      });
      setMemories(res.memories || []);
    } catch (err: any) {
      console.error('Failed to load memories:', err);
      setError(err.message || 'Could not load family memories. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, [homeId, searchQuery, selectedPersonId, sortOrder]);

  // Keep selectedMemory in sync when memories array updates
  useEffect(() => {
    if (selectedMemory) {
      const updated = memories.find(m => m.id === selectedMemory.id);
      if (updated) {
        setSelectedMemory(updated);
      }
    }
  }, [memories]);

  // Quick reaction handler from card
  const handleQuickReact = async (memory: FamilyMemory, emoji: string) => {
    try {
      const res = await api.toggleMemoryReaction(homeId, memory.id, emoji);
      if (res.reactions) {
        setMemories(prev =>
          prev.map(m => (m.id === memory.id ? { ...m, reactions: res.reactions } : m))
        );
      }
    } catch (err) {
      console.error('Quick react error:', err);
    }
  };

  // Group memories chronologically for Timeline view
  const timelineGroups = useMemo(() => {
    const groups: { [key: string]: FamilyMemory[] } = {};
    for (const mem of memories) {
      let groupKey = 'Timeless Moments';
      if (mem.date) {
        try {
          const parts = mem.date.split('-');
          if (parts.length >= 2) {
            const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            groupKey = dateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
          }
        } catch {
          groupKey = mem.date;
        }
      }
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(mem);
    }
    return groups;
  }, [memories]);

  const hasActiveFilters = searchQuery.trim() !== '' || selectedPersonId !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedPersonId('all');
  };

  return (
    <div id="family-memories-view" className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-500/15 dark:via-orange-500/5 dark:to-transparent p-5 sm:p-6 rounded-3xl border border-amber-200/60 dark:border-amber-900/30">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📸</span>
            <h2 className="font-serif font-bold text-xl sm:text-2xl text-stone-900 dark:text-stone-100">
              Family Album & Memories
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 max-w-xl leading-relaxed">
            A private, cherished space for your family's favorite photos, milestone stories, vacations, and daily wonders.
          </p>
        </div>

        <button
          id="btn-add-memory"
          onClick={() => setShowCreateModal(true)}
          className="self-start sm:self-auto flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all hover:shadow-md hover:scale-[1.02] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Memory</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-memories"
            type="text"
            placeholder="Search memories by title, story, location, or people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters Controls */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {/* Filter by Person */}
          <div className="relative">
            <select
              id="select-filter-person"
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              className="pl-3 pr-8 py-2 text-xs rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer"
            >
              <option value="all">All Family Members</option>
              {homeMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <button
            id="btn-sort-memories"
            type="button"
            onClick={() => setSortOrder(prev => (prev === 'recent' ? 'oldest' : 'recent'))}
            className="flex items-center space-x-1 px-3 py-2 text-xs rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 font-medium hover:bg-stone-100 dark:hover:bg-zinc-700/60 transition-colors"
            title={`Sort order: ${sortOrder === 'recent' ? 'Newest first' : 'Oldest first'}`}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
            <span>{sortOrder === 'recent' ? 'Newest' : 'Oldest'}</span>
          </button>

          {/* View Mode Toggle: Grid vs Timeline */}
          <div className="flex items-center p-1 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800">
            <button
              id="btn-view-grid"
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-xl transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
              }`}
              title="Album Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-view-timeline"
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded-xl transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
              }`}
              title="Chronological Timeline View"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadMemories}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl overflow-hidden animate-pulse flex flex-col space-y-3"
            >
              <div className="aspect-[4/3] bg-stone-200 dark:bg-zinc-800 w-full" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-stone-200 dark:bg-zinc-800 rounded-md w-3/4" />
                <div className="h-3 bg-stone-200 dark:bg-zinc-800 rounded-md w-full" />
                <div className="h-3 bg-stone-200 dark:bg-zinc-800 rounded-md w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State: No memories yet in home */}
      {!isLoading && !error && memories.length === 0 && !hasActiveFilters && (
        <div
          id="empty-memories-state"
          className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-10 sm:p-14 text-center space-y-4 shadow-sm"
        >
          <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">
              Your Family Album is Waiting
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
              Preserve your vacation memories, birthday celebrations, recipes, and quiet family moments together.
            </p>
          </div>
          <button
            id="btn-empty-add-memory"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-transform hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>Add the First Family Memory</span>
          </button>
        </div>
      )}

      {/* Empty State: Search or filter returned no matches */}
      {!isLoading && !error && memories.length === 0 && hasActiveFilters && (
        <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-8 sm:p-12 text-center space-y-3">
          <Search className="w-10 h-10 text-stone-300 dark:text-zinc-700 mx-auto" />
          <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">
            No memories match your search
          </h4>
          <p className="text-xs text-stone-400 max-w-xs mx-auto">
            Try adjusting your search terms or clearing the filter by family member.
          </p>
          <button
            onClick={clearFilters}
            className="px-4 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-zinc-800"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Memories Content: Grid View */}
      {!isLoading && !error && memories.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              currentUser={currentUser}
              onSelect={setSelectedMemory}
              onQuickReact={handleQuickReact}
            />
          ))}
        </div>
      )}

      {/* Memories Content: Timeline / Chronological Grouping View */}
      {!isLoading && !error && memories.length > 0 && viewMode === 'timeline' && (
        <div className="space-y-8">
          {(Object.entries(timelineGroups) as [string, FamilyMemory[]][]).map(([monthYear, groupMemories]) => (
            <section key={monthYear} className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="px-3.5 py-1 rounded-full bg-amber-100/70 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 text-xs font-bold uppercase tracking-wider font-serif">
                  {monthYear}
                </div>
                <div className="h-px flex-1 bg-stone-200 dark:border-zinc-800" />
                <span className="text-xs text-stone-400 font-medium">
                  {groupMemories.length} {groupMemories.length === 1 ? 'memory' : 'memories'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {groupMemories.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    currentUser={currentUser}
                    onSelect={setSelectedMemory}
                    onQuickReact={handleQuickReact}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Memory Detail Modal */}
      {selectedMemory && (
        <MemoryDetailModal
          memory={selectedMemory}
          currentUser={currentUser}
          userRole={userRole}
          allMemories={memories}
          onClose={() => setSelectedMemory(null)}
          onMemoryUpdated={(updated) => {
            setMemories(prev => prev.map(m => (m.id === updated.id ? updated : m)));
            setSelectedMemory(updated);
          }}
          onMemoryDeleted={(deletedId) => {
            setMemories(prev => prev.filter(m => m.id !== deletedId));
            setSelectedMemory(null);
          }}
          onOpenEdit={(mem) => {
            setMemoryToEdit(mem);
            setShowCreateModal(true);
          }}
          onNavigateToMemory={(mem) => {
            setSelectedMemory(mem);
          }}
        />
      )}

      {/* Add / Edit Memory Modal */}
      {showCreateModal && (
        <CreateEditMemoryModal
          homeId={homeId}
          homeMembers={homeMembers}
          memoryToEdit={memoryToEdit}
          onClose={() => {
            setShowCreateModal(false);
            setMemoryToEdit(null);
          }}
          onSaved={(savedMemory) => {
            setMemories(prev => {
              const existingIndex = prev.findIndex(m => m.id === savedMemory.id);
              if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = savedMemory;
                return next;
              }
              return [savedMemory, ...prev];
            });
            if (selectedMemory && selectedMemory.id === savedMemory.id) {
              setSelectedMemory(savedMemory);
            }
          }}
        />
      )}
    </div>
  );
};
