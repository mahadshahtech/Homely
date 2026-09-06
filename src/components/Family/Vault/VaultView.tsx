import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderLock,
  Lock,
  Plus,
  Search,
  KeyRound,
  FileText,
  ShieldCheck,
  Download,
  Copy,
  Check,
  Eye,
  File,
  Image as ImageIcon,
  HeartPulse,
  Home as HomeIcon,
  DollarSign,
  Utensils,
  Layers
} from 'lucide-react';
import { api } from '../../../services/api';
import type { VaultFile, HomeMember } from '../../../types';
import { VaultUploadModal } from './VaultUploadModal';
import { VaultPreviewModal } from './VaultPreviewModal';

interface VaultViewProps {
  homeId: string;
  homeMembers: HomeMember[];
  currentUserId: string;
  userRole?: string;
}

export const VaultView: React.FC<VaultViewProps> = ({
  homeId,
  homeMembers,
  currentUserId,
  userRole
}) => {
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'file' | 'note'>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<VaultFile | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

  const loadVaultFiles = async () => {
    try {
      setLoading(true);
      const res = await api.getVaultFiles(
        homeId,
        selectedCategory !== 'all' ? selectedCategory : undefined,
        searchQuery.trim() || undefined
      );
      setVaultFiles(res.files || []);
    } catch (err) {
      console.error('Error loading vault files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVaultFiles();
  }, [homeId, selectedCategory]);

  // Client-side quick filter for search & itemType
  const filteredFiles = useMemo(() => {
    return vaultFiles.filter(f => {
      if (typeFilter !== 'all') {
        const itemType = f.itemType || 'note';
        if (itemType !== typeFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = f.title.toLowerCase().includes(q);
        const matchDesc = f.description?.toLowerCase().includes(q);
        const matchFile = f.fileName?.toLowerCase().includes(q);
        const matchContent = f.itemType === 'note' && f.contentOrUrl.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchFile && !matchContent) return false;
      }
      return true;
    });
  }, [vaultFiles, typeFilter, searchQuery]);

  const handleQuickCopy = (e: React.MouseEvent, vf: VaultFile) => {
    e.stopPropagation();
    navigator.clipboard.writeText(vf.contentOrUrl);
    setCopiedId(vf.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQuickDownload = async (e: React.MouseEvent, vf: VaultFile) => {
    e.stopPropagation();
    setDownloadingId(vf.id);
    try {
      const res = await api.fetchVaultFileBlob(homeId, vf.id, false);
      const blobUrl = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = res.fileName || vf.fileName || 'vault_document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert(err.message || 'Failed to download file');
    } finally {
      setDownloadingId(null);
    }
  };

  const getCategoryIcon = (category: string, itemType?: string, mimeType?: string) => {
    if (itemType === 'file') {
      if (mimeType?.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-emerald-500" />;
      if (mimeType === 'application/pdf') return <FileText className="w-4 h-4 text-rose-500" />;
      return <File className="w-4 h-4 text-indigo-500" />;
    }
    switch (category) {
      case 'home':
        return <HomeIcon className="w-4 h-4 text-amber-500" />;
      case 'financial':
        return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case 'health':
        return <HeartPulse className="w-4 h-4 text-rose-500" />;
      case 'recipes':
        return <Utensils className="w-4 h-4 text-orange-500" />;
      default:
        return <KeyRound className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Family Vault
            </h3>
            <span className="flex items-center space-x-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-900/60">
              <ShieldCheck className="w-3 h-3" />
              <span>AES-256-GCM ENCRYPTED</span>
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xl">
            Encrypted storage isolated to this home for insurance cards, deeds, WiFi credentials, codes, and emergency documents.
          </p>
        </div>
        <button
          id="btn-add-vault-file"
          onClick={() => setShowUploadModal(true)}
          className="flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add to Vault</span>
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search keys, wifi passwords, documents, IDs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-2xl border border-stone-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
          </div>

          {/* Type switcher (All, Files, Notes) */}
          <div className="flex items-center p-1 bg-stone-100 dark:bg-zinc-800/80 rounded-2xl text-xs font-semibold shrink-0">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                typeFilter === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setTypeFilter('file')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                typeFilter === 'file'
                  ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Documents ({vaultFiles.filter(f => f.itemType === 'file').length})
            </button>
            <button
              onClick={() => setTypeFilter('note')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                typeFilter === 'note'
                  ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Codes & Notes ({vaultFiles.filter(f => f.itemType !== 'file').length})
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Categories' },
            { id: 'documents', label: 'Documents & IDs' },
            { id: 'home', label: 'Home & Keys' },
            { id: 'financial', label: 'Financial & Deeds' },
            { id: 'health', label: 'Medical & Health' },
            { id: 'recipes', label: 'Secret Recipes' },
            { id: 'other', label: 'Other' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-900 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-zinc-800 border border-stone-200/60 dark:border-zinc-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-10 text-center space-y-2">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-stone-500">Decrypting and loading family vault...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 rounded-3xl p-10 text-center space-y-3 shadow-xs">
          <FolderLock className="w-12 h-12 text-stone-300 dark:text-zinc-700 mx-auto" />
          <div className="space-y-1">
            <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">
              {searchQuery || selectedCategory !== 'all' || typeFilter !== 'all'
                ? 'No matching vault items found'
                : 'Your Family Vault is ready'}
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
              {searchQuery || selectedCategory !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your search terms or category filters.'
                : 'Safely store emergency documents, insurance policies, lockbox combinations, and Wi-Fi credentials.'}
            </p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Secure Item</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredFiles.map(vf => {
            const isFile = vf.itemType === 'file';
            const canManage = isOwnerOrAdmin || vf.uploaderId === currentUserId;

            return (
              <div
                key={vf.id}
                onClick={() => setPreviewFile(vf)}
                className="group relative bg-white dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-800/80 rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                {/* Card Top */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="p-2.5 rounded-2xl bg-stone-50 dark:bg-zinc-800/80 border border-stone-100 dark:border-zinc-700/60 shrink-0">
                        {getCategoryIcon(vf.category, vf.itemType, vf.mimeType)}
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {vf.title}
                        </h4>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                            {vf.category}
                          </span>
                          <span className="text-[10px] text-stone-300 dark:text-zinc-700">•</span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Encrypted</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] text-stone-400 shrink-0">
                      {new Date(vf.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {vf.description && (
                    <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed">
                      {vf.description}
                    </p>
                  )}
                </div>

                {/* Card Content Display */}
                {isFile ? (
                  <div className="bg-stone-50/70 dark:bg-zinc-800/50 border border-stone-200/60 dark:border-zinc-700/50 p-2.5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-2 truncate pr-2">
                      <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="text-xs font-mono text-stone-700 dark:text-stone-300 truncate">
                        {vf.fileName || 'Attached Document'}
                      </span>
                    </div>
                    <button
                      onClick={e => handleQuickDownload(e, vf)}
                      disabled={downloadingId === vf.id}
                      className="flex items-center space-x-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-zinc-700 transition-colors shrink-0"
                    >
                      <Download className="w-3 h-3" />
                      <span>{downloadingId === vf.id ? '...' : 'Download'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-stone-50/70 dark:bg-zinc-800/50 border border-stone-200/60 dark:border-zinc-700/50 p-2.5 rounded-2xl flex items-center justify-between">
                    <span className="font-mono text-xs text-stone-800 dark:text-stone-200 truncate pr-2 font-medium">
                      {vf.contentOrUrl}
                    </span>
                    <button
                      onClick={e => handleQuickCopy(e, vf)}
                      className="flex items-center space-x-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-zinc-700 transition-colors shrink-0"
                    >
                      {copiedId === vf.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Card Footer */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-stone-400 border-t border-stone-100/60 dark:border-zinc-800/60">
                  <span>Added by {vf.uploader?.name || 'Family Member'}</span>
                  <span className="group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center space-x-0.5 text-xs font-semibold transition-colors">
                    <span>Inspect</span>
                    <Eye className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Security Info Card */}
      <div className="p-4 rounded-3xl bg-stone-50 dark:bg-zinc-900/60 border border-stone-200/60 dark:border-zinc-800/60 flex items-start space-x-3 text-xs text-stone-500 dark:text-stone-400">
        <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-stone-800 dark:text-stone-200">
            Vault Privacy & Security Assurance
          </p>
          <p>
            All files and sensitive codes stored in this vault are encrypted at rest with industry-standard AES-256-GCM. Files are stored in an isolated, non-public directory and can only be decrypted and downloaded by verified members of <strong>this family home</strong>.
          </p>
        </div>
      </div>

      {/* Modals */}
      {showUploadModal && (
        <VaultUploadModal
          homeId={homeId}
          onClose={() => setShowUploadModal(false)}
          onSuccess={newFile => {
            setVaultFiles(prev => [newFile, ...prev]);
          }}
        />
      )}

      {previewFile && (
        <VaultPreviewModal
          homeId={homeId}
          file={previewFile}
          canManage={isOwnerOrAdmin || previewFile.uploaderId === currentUserId}
          onClose={() => setPreviewFile(null)}
          onDeleted={deletedId => {
            setVaultFiles(prev => prev.filter(f => f.id !== deletedId));
            setPreviewFile(null);
          }}
        />
      )}
    </div>
  );
};
