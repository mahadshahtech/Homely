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
import { MemoriesView } from './Memories/MemoriesView';
import { EventsView } from './Events/EventsView';
import { VaultView } from './Vault/VaultView';

type FamilySubTab = 'members' | 'events' | 'memories' | 'vault';

interface FamilyViewProps {
  initialSubTab?: FamilySubTab;
}

export const FamilyView: React.FC<FamilyViewProps> = ({ initialSubTab = 'members' }) => {
  const { activeHome, user, userRole } = useAuth();
  const [subTab, setSubTab] = useState<FamilySubTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Members state
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load section data
  const loadData = async () => {
    if (!activeHome) return;
    setLoading(true);
    try {
      if (subTab === 'members') {
        const res = await api.getHomeMembers(activeHome.id);
        setMembers(res.members);
      }
    } catch (err) {
      console.warn('Error loading family section:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeHome) return;
    api.getHomeMembers(activeHome.id).then(res => setMembers(res.members)).catch(() => {});
  }, [activeHome?.id]);

  useEffect(() => {
    loadData();
  }, [subTab, activeHome?.id]);

  const handleCopyCode = () => {
    if (!activeHome?.inviteCode) return;
    navigator.clipboard.writeText(activeHome.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
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
        <EventsView
          homeId={activeHome.id}
          currentUser={user}
          userRole={userRole}
          homeMembers={members}
        />
      )}

      {/* ----------------- MEMORIES TAB ----------------- */}
      {subTab === 'memories' && (
        <MemoriesView
          homeId={activeHome.id}
          currentUser={user}
          userRole={userRole}
          homeMembers={members}
        />
      )}

      {/* ----------------- VAULT TAB ----------------- */}
      {subTab === 'vault' && (
        <VaultView
          homeId={activeHome.id}
          homeMembers={members}
          currentUserId={user?.id || ''}
          userRole={userRole}
        />
      )}
    </div>
  );
};
