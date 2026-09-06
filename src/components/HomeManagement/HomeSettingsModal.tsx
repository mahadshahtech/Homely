import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Users, 
  Palette, 
  KeyRound, 
  Check, 
  Copy, 
  RefreshCw, 
  Shield, 
  Crown, 
  UserCheck, 
  Trash2, 
  Upload, 
  Sparkles,
  Info,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { HomeMember, UserRole } from '../../types';

interface HomeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'general' | 'appearance' | 'members' | 'invite';
}

const PRESET_COVERS = [
  { label: 'Cozy Hearth', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80' },
  { label: 'Sunlit Kitchen', url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1200&auto=format&fit=crop&q=80' },
  { label: 'Warm Living Room', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80' },
  { label: 'Mountain Cabin', url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&auto=format&fit=crop&q=80' },
  { label: 'Botanical Garden', url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=1200&auto=format&fit=crop&q=80' },
  { label: 'Sunset Haven', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80' },
];

const PRESET_AVATARS = [
  { label: 'Classic Home', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=200&auto=format&fit=crop&q=80' },
  { label: 'Family Hearth', url: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=200&auto=format&fit=crop&q=80' },
  { label: 'Peaceful Plant', url: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=200&auto=format&fit=crop&q=80' },
  { label: 'Warm Sunlight', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=200&auto=format&fit=crop&q=80' },
  { label: 'Cozy Cottage', url: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=200&auto=format&fit=crop&q=80' },
];

const PRESET_ICONS = ['🏡', '🏠', '🌿', '🌻', '🍲', '🐾', '🏔️', '🏖️', '🕯️', '☕', '🏕️', '💛', '🌳', '🥘'];

const PRESET_COLORS = [
  { name: 'Warm Indigo', hex: '#4f46e5' },
  { name: 'Terracotta', hex: '#ea580c' },
  { name: 'Sage Olive', hex: '#15803d' },
  { name: 'Rose Cedar', hex: '#e11d48' },
  { name: 'Warm Amber', hex: '#d97706' },
  { name: 'Deep Navy', hex: '#1e3a8a' },
  { name: 'Ocean Teal', hex: '#0d9488' },
  { name: 'Slate Stone', hex: '#475569' },
];

export const HomeSettingsModal: React.FC<HomeSettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'general'
}) => {
  const { activeHome, userRole, updateActiveHomeData, refreshActiveHome, user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'members' | 'invite'>(defaultTab);
  
  // Form values
  const [name, setName] = useState(activeHome?.name || '');
  const [description, setDescription] = useState(activeHome?.description || '');
  const [avatar, setAvatar] = useState(activeHome?.avatar || '');
  const [coverImage, setCoverImage] = useState(activeHome?.coverImage || PRESET_COVERS[0].url);
  const [icon, setIcon] = useState(activeHome?.icon || '🏡');
  const [themeColor, setThemeColor] = useState(activeHome?.themeColor || '#4f46e5');
  
  // Members
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);

  // Status banners
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Invite code
  const [currentInviteCode, setCurrentInviteCode] = useState(activeHome?.inviteCode || '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [regeneratingInvite, setRegeneratingInvite] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const canEdit = userRole === 'owner' || userRole === 'admin';

  // Sync state whenever activeHome changes or modal opens
  useEffect(() => {
    if (activeHome) {
      setName(activeHome.name);
      setDescription(activeHome.description || '');
      setAvatar(activeHome.avatar);
      setCoverImage(activeHome.coverImage || PRESET_COVERS[0].url);
      setIcon(activeHome.icon || '🏡');
      setThemeColor(activeHome.themeColor || '#4f46e5');
      setCurrentInviteCode(activeHome.inviteCode);
    }
  }, [activeHome, isOpen]);

  // Load members when members tab is selected
  useEffect(() => {
    if (isOpen && activeHome && (activeTab === 'members' || activeTab === 'invite')) {
      loadMembers();
    }
  }, [isOpen, activeTab, activeHome?.id]);

  const loadMembers = async () => {
    if (!activeHome) return;
    setLoadingMembers(true);
    try {
      const res = await api.getHomeMembers(activeHome.id);
      setMembers(res.members);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load members');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHome || !canEdit) return;

    if (!name.trim()) {
      setErrorMessage('Home name cannot be empty');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.updateHome(activeHome.id, {
        name: name.trim(),
        description: description.trim(),
        avatar: avatar.trim(),
        coverImage: coverImage.trim(),
        icon: icon.trim(),
        themeColor: themeColor.trim()
      });

      updateActiveHomeData(res.home);
      setSuccessMessage('Home settings saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save Home settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateInvite = async () => {
    if (!activeHome || !canEdit) return;
    setRegeneratingInvite(true);
    setErrorMessage(null);
    try {
      const res = await api.regenerateInviteCode(activeHome.id);
      setCurrentInviteCode(res.inviteCode);
      updateActiveHomeData(res.home);
      setShowRegenConfirm(false);
      setSuccessMessage('New invitation code generated!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to regenerate invite code');
    } finally {
      setRegeneratingInvite(false);
    }
  };

  const handleCopyCode = () => {
    if (!currentInviteCode) return;
    navigator.clipboard.writeText(currentInviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRoleChange = async (memberUserId: string, newRole: 'admin' | 'member') => {
    if (!activeHome || !canEdit) return;
    setMemberActionLoading(memberUserId);
    setErrorMessage(null);
    try {
      const res = await api.updateMemberRole(activeHome.id, memberUserId, newRole);
      setMembers(res.members);
      setSuccessMessage('Member role updated');
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update member role');
    } finally {
      setMemberActionLoading(null);
    }
  };

  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!activeHome) return;
    const confirmMsg = `Remove ${memberName} from ${activeHome.name}?`;
    if (!window.confirm(confirmMsg)) return;

    setMemberActionLoading(memberUserId);
    setErrorMessage(null);
    try {
      const res = await api.removeHomeMember(activeHome.id, memberUserId);
      setMembers(res.members);
      setSuccessMessage(`${memberName} removed from home`);
      setTimeout(() => setSuccessMessage(null), 2500);
      refreshActiveHome();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove member');
    } finally {
      setMemberActionLoading(null);
    }
  };

  if (!isOpen || !activeHome) return null;

  return (
    <div 
      id="modal-home-settings" 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div 
        className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm border border-stone-200/60 dark:border-zinc-700/60"
              style={{ backgroundColor: `${themeColor}15`, color: themeColor }}
            >
              {icon || '🏡'}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 font-serif tracking-tight">
                {canEdit ? 'Customize Home' : 'Home Information'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {activeHome.name} • {userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Member'}
              </p>
            </div>
          </div>
          
          <button
            id="btn-close-home-settings"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-Only Notice for Regular Members */}
        {!canEdit && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 flex items-start space-x-2.5 text-xs text-amber-800 dark:text-amber-200">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p>
              You are viewing this Home as a <strong>Member</strong>. Only Home Owners and Administrators can modify settings, roles, or appearance.
            </p>
          </div>
        )}

        {/* Status Alerts */}
        {successMessage && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-800 dark:text-red-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-100 dark:border-zinc-800 px-5 pt-2 bg-stone-50/50 dark:bg-zinc-900/50 overflow-x-auto scrollbar-none">
          <button
            id="tab-settings-general"
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-2.5 text-xs font-medium border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'general'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>General</span>
          </button>

          <button
            id="tab-settings-appearance"
            onClick={() => setActiveTab('appearance')}
            className={`px-3.5 py-2.5 text-xs font-medium border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'appearance'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Appearance & Theme</span>
          </button>

          <button
            id="tab-settings-members"
            onClick={() => setActiveTab('members')}
            className={`px-3.5 py-2.5 text-xs font-medium border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'members'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members & Roles</span>
          </button>

          <button
            id="tab-settings-invite"
            onClick={() => setActiveTab('invite')}
            className={`px-3.5 py-2.5 text-xs font-medium border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'invite'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Invitation Code</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* Home Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Home Name
                </label>
                <input
                  id="input-home-name"
                  type="text"
                  disabled={!canEdit}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Shah Family Sanctuary"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Description / Motto
                </label>
                <textarea
                  id="input-home-description"
                  disabled={!canEdit}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  placeholder="A quiet digital retreat for our family moments, memories, and updates."
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60 resize-none"
                />
              </div>

              {/* Icon / Emoji Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Home Icon / Emoji
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ICONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setIcon(emoji)}
                      className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all ${
                        icon === emoji 
                          ? 'ring-2 ring-indigo-600 bg-indigo-50 dark:bg-indigo-950 scale-105' 
                          : 'border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar / Profile Picture */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Home Avatar / Profile Picture
                </label>
                
                <div className="flex items-center space-x-4 mb-3">
                  <img
                    src={avatar || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=200&auto=format&fit=crop&q=80'}
                    alt="Home Avatar Preview"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-stone-200 dark:border-zinc-700 shadow-sm"
                  />
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Select a curated preset or enter a custom image URL:
                    </p>
                    <input
                      type="url"
                      disabled={!canEdit}
                      value={avatar}
                      onChange={e => setAvatar(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-900 dark:text-stone-100 disabled:opacity-60"
                    />
                  </div>
                </div>

                {canEdit && (
                  <div className="grid grid-cols-5 gap-2">
                    {PRESET_AVATARS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatar(preset.url)}
                        className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all group ${
                          avatar === preset.url
                            ? 'border-indigo-600 ring-2 ring-indigo-600/30'
                            : 'border-stone-200 dark:border-zinc-700 hover:border-indigo-400'
                        }`}
                      >
                        <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                        <span className="absolute inset-0 bg-stone-900/40 text-[9px] text-white font-medium flex items-end p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="pt-3 border-t border-stone-100 dark:border-zinc-800 flex justify-end">
                  <button
                    id="btn-save-home-general"
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Cover Banner Preview */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Home Cover Banner
                </label>
                
                <div className="relative rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-700 h-36 sm:h-44 shadow-sm group">
                  <img
                    src={coverImage || PRESET_COVERS[0].url}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/20 to-transparent p-4 flex flex-col justify-end text-white">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{icon || '🏡'}</span>
                      <span className="font-bold text-base tracking-tight font-serif drop-shadow-sm">
                        {name || 'Our Family Home'}
                      </span>
                    </div>
                    <span className="text-xs text-white/80 line-clamp-1 mt-0.5">
                      {description || 'Cover banner preview'}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">
                    Choose a curated family atmosphere or paste your own image URL:
                  </p>
                  <input
                    type="url"
                    disabled={!canEdit}
                    value={coverImage}
                    onChange={e => setCoverImage(e.target.value)}
                    placeholder="Custom cover URL (https://...)"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-900 dark:text-stone-100 mb-3 disabled:opacity-60"
                  />

                  {canEdit && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {PRESET_COVERS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCoverImage(preset.url)}
                          className={`group relative rounded-xl overflow-hidden aspect-[4/3] border-2 transition-all ${
                            coverImage === preset.url
                              ? 'border-indigo-600 ring-2 ring-indigo-600/40'
                              : 'border-stone-200 dark:border-zinc-700 hover:border-indigo-400'
                          }`}
                        >
                          <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                          <span className="absolute inset-x-0 bottom-0 bg-stone-950/70 text-[9px] text-white p-1 text-center font-medium truncate">
                            {preset.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Accent & Theme Color */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Home Accent Color
                  </label>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Customizes the accent badges, icons, and highlights throughout your family home.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5 items-center">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color.hex}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setThemeColor(color.hex)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        themeColor.toLowerCase() === color.hex.toLowerCase()
                          ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-zinc-900 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    >
                      {themeColor.toLowerCase() === color.hex.toLowerCase() && (
                        <Check className="w-4 h-4 text-white drop-shadow-sm" />
                      )}
                    </button>
                  ))}

                  {/* Custom Hex input */}
                  <div className="flex items-center space-x-1.5 ml-2 border border-stone-200 dark:border-zinc-700 rounded-xl px-2 py-1 bg-stone-50 dark:bg-zinc-800">
                    <input
                      type="color"
                      disabled={!canEdit}
                      value={themeColor}
                      onChange={e => setThemeColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={themeColor}
                      onChange={e => setThemeColor(e.target.value)}
                      className="w-16 text-xs font-mono uppercase bg-transparent text-stone-800 dark:text-stone-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {canEdit && (
                <div className="pt-3 border-t border-stone-100 dark:border-zinc-800 flex justify-end">
                  <button
                    id="btn-save-home-appearance"
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Appearance</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* MEMBERS TAB */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                    Family Members ({members.length})
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    {canEdit ? 'Manage family access, administrator privileges, and membership.' : 'People who belong to this Home.'}
                  </p>
                </div>

                <button
                  onClick={loadMembers}
                  disabled={loadingMembers}
                  className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Refresh members"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMembers ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingMembers ? (
                <div className="py-8 text-center text-xs text-stone-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                  Loading family members...
                </div>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-zinc-800 border border-stone-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden bg-stone-50/30 dark:bg-zinc-900/30">
                  {members.map(member => {
                    const isCurrentUser = member.userId === user?.id;
                    const isOwner = member.role === 'owner';
                    const isAdmin = member.role === 'admin';
                    const isActorOwner = userRole === 'owner';

                    return (
                      <div
                        key={member.id}
                        className="p-3.5 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <img
                            src={member.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(member.name)}`}
                            alt={member.name}
                            className="w-10 h-10 rounded-full border border-stone-200 dark:border-zinc-700 object-cover flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                                {member.name}
                              </span>
                              {isCurrentUser && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 dark:bg-zinc-800 text-stone-500 font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                              {member.email || 'Family Member'}
                            </p>
                          </div>
                        </div>

                        {/* Role badge & Management actions */}
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          {isOwner ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center space-x-1">
                              <Crown className="w-3 h-3 text-amber-600" />
                              <span>Owner</span>
                            </span>
                          ) : canEdit && !isCurrentUser && (isActorOwner || !isAdmin) ? (
                            <div className="flex items-center space-x-1.5">
                              <select
                                value={member.role}
                                disabled={memberActionLoading === member.userId}
                                onChange={e => handleRoleChange(member.userId, e.target.value as 'admin' | 'member')}
                                className="text-xs rounded-lg px-2.5 py-1 border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-stone-200 focus:outline-none"
                              >
                                <option value="member">Member</option>
                                <option value="admin">Administrator</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => handleRemoveMember(member.userId, member.name)}
                                disabled={memberActionLoading === member.userId}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                                title={`Remove ${member.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize ${
                              isAdmin
                                ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                                : 'bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300'
                            }`}>
                              {member.role}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* INVITE TAB */}
          {activeTab === 'invite' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                  Invite Family Members
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Anyone with this unique invitation code can join {activeHome.name}.
                </p>
              </div>

              {/* Code Display Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-stone-50 to-purple-50/50 dark:from-indigo-950/30 dark:via-zinc-900 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-4 text-center">
                <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                  Current Family Invitation Code:
                </p>
                
                <div className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-indigo-200 dark:border-indigo-800/80 shadow-inner">
                  <span className="font-mono text-2xl font-extrabold tracking-widest text-indigo-700 dark:text-indigo-300">
                    {currentInviteCode}
                  </span>
                </div>

                <div className="flex justify-center space-x-3 pt-1">
                  <button
                    id="btn-copy-invite-settings"
                    type="button"
                    onClick={handleCopyCode}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-white" />
                        <span>Copy Invite Code</span>
                      </>
                    )}
                  </button>

                  {canEdit && (
                    <button
                      id="btn-regenerate-invite-settings"
                      type="button"
                      onClick={() => setShowRegenConfirm(true)}
                      className="px-3.5 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-700 dark:text-stone-300 text-xs font-medium transition-all flex items-center space-x-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
                      <span>Regenerate Code</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Regenerate Confirmation Box */}
              {showRegenConfirm && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-3 animate-in fade-in">
                  <div className="flex items-start space-x-2 text-xs text-amber-900 dark:text-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Regenerate Invitation Code?</p>
                      <p className="text-amber-700 dark:text-amber-300/80 mt-0.5">
                        Generating a new code will immediately invalidate the existing code ({currentInviteCode}). Anyone who has not joined yet will need the new code.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowRegenConfirm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-200/60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={regeneratingInvite}
                      onClick={handleRegenerateInvite}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center space-x-1"
                    >
                      {regeneratingInvite ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <span>Yes, Generate New Code</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="space-y-2 text-xs text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-stone-200/60 dark:border-zinc-800">
                <p className="font-semibold text-stone-800 dark:text-stone-200">
                  How family members join:
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>Send your family member this code: <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{currentInviteCode}</code></li>
                  <li>Have them sign in or create an account on HOMELY.</li>
                  <li>They click the home selector and choose <strong>Join a Home</strong>, then enter the code.</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
