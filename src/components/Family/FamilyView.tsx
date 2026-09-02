import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Sparkles, 
  FolderLock, 
  Plus, 
  Clock, 
  MapPin, 
  Check, 
  Copy, 
  Trash2, 
  BookOpen, 
  FileText,
  KeyRound,
  Shield,
  Heart
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { HomeMember, FamilyEvent, FamilyMemory, VaultFile } from '../../types';

type FamilySubTab = 'members' | 'events' | 'memories' | 'vault';

export const FamilyView: React.FC = () => {
  const { activeHome, user, userRole } = useAuth();
  const [subTab, setSubTab] = useState<FamilySubTab>('members');

  // Members state
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);

  // Events state
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('18:00');
  const [eventLocation, setEventLocation] = useState('');

  // Memories state
  const [memories, setMemories] = useState<FamilyMemory[]>([]);
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryStory, setMemoryStory] = useState('');
  const [memoryDate, setMemoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [memoryImage, setMemoryImage] = useState('');

  // Vault state
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [showAddVault, setShowAddVault] = useState(false);
  const [vaultTitle, setVaultTitle] = useState('');
  const [vaultCategory, setVaultCategory] = useState<'documents' | 'health' | 'home' | 'recipes' | 'other'>('home');
  const [vaultContent, setVaultContent] = useState('');
  const [vaultDesc, setVaultDesc] = useState('');

  const [loading, setLoading] = useState(false);

  // Load section data
  const loadData = async () => {
    if (!activeHome) return;
    setLoading(true);
    try {
      if (subTab === 'members') {
        const res = await api.getHomeMembers(activeHome.id);
        setMembers(res.members);
      } else if (subTab === 'events') {
        const res = await api.getEvents(activeHome.id);
        setEvents(res.events);
      } else if (subTab === 'memories') {
        const res = await api.getMemories(activeHome.id);
        setMemories(res.memories);
      } else if (subTab === 'vault') {
        const res = await api.getVaultFiles(activeHome.id);
        setVaultFiles(res.files);
      }
    } catch (err) {
      console.warn('Error loading family section:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subTab, activeHome?.id]);

  const handleCopyCode = () => {
    if (!activeHome?.inviteCode) return;
    navigator.clipboard.writeText(activeHome.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Event handlers
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHome || !eventTitle.trim() || !eventDate) return;

    try {
      await api.createEvent(activeHome.id, {
        title: eventTitle.trim(),
        description: eventDesc.trim(),
        date: eventDate,
        time: eventTime,
        location: eventLocation.trim() || undefined
      });
      setShowAddEvent(false);
      setEventTitle('');
      setEventDesc('');
      setEventLocation('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Could not create event');
    }
  };

  const handleToggleRsvp = async (eventId: string) => {
    if (!activeHome) return;
    try {
      await api.toggleRsvp(activeHome.id, eventId);
      loadData();
    } catch (err) {
      console.warn('RSVP toggle failed:', err);
    }
  };

  // Memory handlers
  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHome || !memoryTitle.trim() || !memoryStory.trim()) return;

    try {
      await api.createMemory(activeHome.id, {
        title: memoryTitle.trim(),
        story: memoryStory.trim(),
        date: memoryDate,
        imageUrl: memoryImage.trim() || undefined
      });
      setShowAddMemory(false);
      setMemoryTitle('');
      setMemoryStory('');
      setMemoryImage('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Could not save memory');
    }
  };

  // Vault handlers
  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHome || !vaultTitle.trim() || !vaultContent.trim()) return;

    try {
      await api.createVaultFile(activeHome.id, {
        title: vaultTitle.trim(),
        category: vaultCategory,
        contentOrUrl: vaultContent.trim(),
        description: vaultDesc.trim() || undefined
      });
      setShowAddVault(false);
      setVaultTitle('');
      setVaultContent('');
      setVaultDesc('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Could not save vault file');
    }
  };

  return (
    <div id="homely-family-section" className="max-w-md md:max-w-3xl mx-auto px-4 py-4 space-y-4 pb-24">
      {/* Subtab Segmented Navigation */}
      <div className="bg-stone-200/60 dark:bg-zinc-800/80 p-1 rounded-2xl flex items-center justify-between text-xs font-semibold">
        <button
          id="tab-family-members"
          onClick={() => setSubTab('members')}
          className={`flex-1 py-2 px-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
            subTab === 'members'
              ? 'bg-white dark:bg-zinc-900 text-indigo-900 dark:text-indigo-300 shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Members</span>
        </button>

        <button
          id="tab-family-events"
          onClick={() => setSubTab('events')}
          className={`flex-1 py-2 px-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
            subTab === 'events'
              ? 'bg-white dark:bg-zinc-900 text-indigo-900 dark:text-indigo-300 shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Events</span>
        </button>

        <button
          id="tab-family-memories"
          onClick={() => setSubTab('memories')}
          className={`flex-1 py-2 px-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
            subTab === 'memories'
              ? 'bg-white dark:bg-zinc-900 text-indigo-900 dark:text-indigo-300 shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Memories</span>
        </button>

        <button
          id="tab-family-vault"
          onClick={() => setSubTab('vault')}
          className={`flex-1 py-2 px-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
            subTab === 'vault'
              ? 'bg-white dark:bg-zinc-900 text-indigo-900 dark:text-indigo-300 shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
        >
          <FolderLock className="w-3.5 h-3.5" />
          <span>Vault</span>
        </button>
      </div>

      {/* ----------------- MEMBERS TAB ----------------- */}
      {subTab === 'members' && (
        <div className="space-y-4">
          {/* Invite Code Hero Card */}
          <div className="bg-gradient-to-tr from-indigo-900 via-indigo-950 to-stone-900 text-white p-5 rounded-3xl shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Family Invitation
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-800/60 text-indigo-200 font-medium">
                {members.length} {members.length === 1 ? 'Member' : 'Members'}
              </span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              Share this private code with your parents, siblings, or children so they can join {activeHome?.name}.
            </p>
            <div className="flex items-center justify-between bg-black/40 border border-white/10 p-3 rounded-2xl">
              <span className="font-mono text-base tracking-widest font-bold text-white">
                {activeHome?.inviteCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          {/* Members List */}
          <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Family Circle
            </h3>
            <div className="divide-y divide-stone-100 dark:divide-zinc-800">
              {members.map(m => (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={m.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${m.name}`}
                      alt=""
                      className="w-10 h-10 rounded-full bg-stone-100 dark:bg-zinc-800 object-cover border border-indigo-100 dark:border-indigo-900/60"
                    />
                    <div>
                      <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        {m.name} {m.userId === user?.id && '(You)'}
                      </p>
                      <p className="text-xs text-stone-400">{m.email}</p>
                    </div>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${
                      m.role === 'owner'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        : m.role === 'admin'
                        ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                        : 'bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- EVENTS TAB ----------------- */}
      {subTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Family Calendar & Gatherings
            </h3>
            <button
              id="btn-add-event"
              onClick={() => setShowAddEvent(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Event</span>
            </button>
          </div>

          {events.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-8 text-center space-y-2">
              <Calendar className="w-10 h-10 text-stone-300 dark:text-zinc-700 mx-auto" />
              <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">No events scheduled</h4>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                Keep the family in sync for Sunday dinners, birthdays, holidays, or school events.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(ev => (
                <div
                  key={ev.id}
                  className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                        {ev.title}
                      </h4>
                      {ev.description && (
                        <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 leading-relaxed">
                          {ev.description}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleToggleRsvp(ev.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        ev.isAttending
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {ev.isAttending ? 'Attending' : 'RSVP'}
                    </button>
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-stone-500 dark:text-stone-400 flex-wrap gap-y-1">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{ev.date} at {ev.time}</span>
                    </div>
                    {ev.location && (
                      <div className="flex items-center space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-stone-400" />
                        <span>{ev.location}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-stone-400 font-medium">Attendees ({ev.attendees.length}):</span>
                      <div className="flex -space-x-1.5 overflow-hidden">
                        {ev.attendees.map(a => (
                          <img
                            key={a.id}
                            src={a.avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${a.name}`}
                            alt={a.name}
                            title={a.name}
                            className="inline-block h-5 w-5 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-stone-200"
                          />
                        ))}
                      </div>
                    </div>

                    <span className="text-[10px] text-stone-400">Created by {ev.creator.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----------------- MEMORIES TAB ----------------- */}
      {subTab === 'memories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Family Album & Stories
            </h3>
            <button
              id="btn-add-memory"
              onClick={() => setShowAddMemory(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Memory</span>
            </button>
          </div>

          {memories.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-8 text-center space-y-2">
              <BookOpen className="w-10 h-10 text-stone-300 dark:text-zinc-700 mx-auto" />
              <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">No memories recorded yet</h4>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                Preserve cherished family moments, vacation stories, and childhood milestones forever.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {memories.map(m => (
                <div
                  key={m.id}
                  className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm flex flex-col transition-colors"
                >
                  {m.imageUrl && (
                    <div className="h-44 w-full bg-stone-100 dark:bg-zinc-800 overflow-hidden">
                      <img src={m.imageUrl} alt={m.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1">
                        <span>{m.date}</span>
                        <span>Saved by {m.creator.name}</span>
                      </div>
                      <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 font-serif">
                        {m.title}
                      </h4>
                      <p className="text-xs text-stone-600 dark:text-stone-300 mt-1.5 leading-relaxed line-clamp-4">
                        {m.story}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----------------- VAULT TAB ----------------- */}
      {subTab === 'vault' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Secure Family Vault
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Encrypted notes for WiFi, spare keys, emergency docs, recipes
              </p>
            </div>
            <button
              id="btn-add-vault-file"
              onClick={() => setShowAddVault(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-sm shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Note / Code</span>
            </button>
          </div>

          {vaultFiles.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-8 text-center space-y-2">
              <FolderLock className="w-10 h-10 text-stone-300 dark:text-zinc-700 mx-auto" />
              <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Vault is empty</h4>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                Safely store details like "Spare key is under the blue pot" or "Home WiFi credentials".
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {vaultFiles.map(vf => (
                <div
                  key={vf.id}
                  className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-2 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                          {vf.title}
                        </h4>
                        <span className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                          {vf.category}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-stone-400">Added by {vf.uploader.name}</span>
                  </div>

                  {vf.description && (
                    <p className="text-xs text-stone-600 dark:text-stone-300">
                      {vf.description}
                    </p>
                  )}

                  <div className="bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/60 dark:border-zinc-700/60 p-3 rounded-2xl flex items-center justify-between">
                    <span className="font-mono text-xs text-stone-800 dark:text-stone-200 select-all font-medium">
                      {vf.contentOrUrl}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(vf.contentOrUrl);
                        alert('Copied to clipboard');
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-zinc-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----------------- MODALS ----------------- */}

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Schedule Family Event
            </h3>
            <form onSubmit={handleCreateEvent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunday Family Dinner"
                  value={eventTitle}
                  onChange={e => setEventTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Time</label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={e => setEventTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Location</label>
                <input
                  type="text"
                  placeholder="e.g. Grandma's House or Living Room"
                  value={eventLocation}
                  onChange={e => setEventLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Details</label>
                <textarea
                  rows={2}
                  placeholder="Notes, what to bring, or agenda..."
                  value={eventDesc}
                  onChange={e => setEventDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEvent(false)}
                  className="px-3 py-2 text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Memory Modal */}
      {showAddMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Add Cherished Memory
            </h3>
            <form onSubmit={handleCreateMemory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Memory Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Road Trip to Lake Tahoe"
                  value={memoryTitle}
                  onChange={e => setMemoryTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">The Story / Moment</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe what happened and why it's special to the family..."
                  value={memoryStory}
                  onChange={e => setMemoryStory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={memoryDate}
                    onChange={e => setMemoryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Photo URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={memoryImage}
                    onChange={e => setMemoryImage(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemory(false)}
                  className="px-3 py-2 text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm"
                >
                  Save Memory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Vault File Modal */}
      {showAddVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Add Secure Family Vault Item
            </h3>
            <form onSubmit={handleCreateVault} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Item Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Spare House Key Location, WiFi Password"
                  value={vaultTitle}
                  onChange={e => setVaultTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Category</label>
                <select
                  value={vaultCategory}
                  onChange={e => setVaultCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
                >
                  <option value="home">Home & Keys</option>
                  <option value="documents">Documents & IDs</option>
                  <option value="health">Medical & Health</option>
                  <option value="recipes">Secret Recipes</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Content, Code or Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Spare key is under flowerpot near back porch"
                  value={vaultContent}
                  onChange={e => setVaultContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Optional Note</label>
                <textarea
                  rows={2}
                  placeholder="Any details or guidance..."
                  value={vaultDesc}
                  onChange={e => setVaultDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddVault(false)}
                  className="px-3 py-2 text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm"
                >
                  Save to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
