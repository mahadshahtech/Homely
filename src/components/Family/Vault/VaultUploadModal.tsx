import React, { useState, useRef } from 'react';
import {
  X,
  Lock,
  UploadCloud,
  FileText,
  KeyRound,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { api } from '../../../services/api';
import type { VaultFile } from '../../../types';

interface VaultUploadModalProps {
  homeId: string;
  onClose: () => void;
  onSuccess: (newFile: VaultFile) => void;
}

export const VaultUploadModal: React.FC<VaultUploadModalProps> = ({
  homeId,
  onClose,
  onSuccess
}) => {
  const [tab, setTab] = useState<'note' | 'file'>('file');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'documents' | 'health' | 'home' | 'recipes' | 'financial' | 'other'>('documents');
  const [description, setDescription] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE_MB = 20;

  const handleFileSelect = (file: File) => {
    setErrorMsg('');
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrorMsg(`File exceeds the ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }

    setSelectedFile(file);
    if (!title) {
      // Auto-set clean title from filename without extension
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read selected file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Please enter a title.');
      return;
    }

    if (tab === 'note' && !noteContent.trim()) {
      setErrorMsg('Please enter note content or code.');
      return;
    }

    if (tab === 'file' && (!selectedFile || !fileBase64)) {
      setErrorMsg('Please select a file to upload.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (tab === 'file' && selectedFile) {
        const res = await api.createVaultFile(homeId, {
          title: title.trim(),
          category,
          description: description.trim() || undefined,
          itemType: 'file',
          fileName: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          fileBase64
        });
        onSuccess(res.file);
      } else {
        const res = await api.createVaultFile(homeId, {
          title: title.trim(),
          category,
          description: description.trim() || undefined,
          itemType: 'note',
          contentOrUrl: noteContent.trim()
        });
        onSuccess(res.file);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save item to vault.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Add to Family Vault
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                AES-256-GCM encrypted storage for your home
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 p-1 bg-stone-100 dark:bg-zinc-800 rounded-2xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('file')}
            className={`flex items-center justify-center space-x-2 py-2 rounded-xl transition-all ${
              tab === 'file'
                ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Encrypted Document / File</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('note')}
            className={`flex items-center justify-center space-x-2 py-2 rounded-xl transition-all ${
              tab === 'note'
                ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Secret Note / Passcode</span>
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center space-x-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'file' && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Upload File (PDF, IDs, Deeds, Images, Scans - max 20MB)
              </label>
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-stone-200 dark:border-zinc-700 hover:border-stone-300 dark:hover:border-zinc-600 bg-stone-50/50 dark:bg-zinc-800/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                {selectedFile ? (
                  <div className="space-y-1">
                    <FileText className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate max-w-xs mx-auto">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready for encryption
                    </p>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setFileBase64('');
                      }}
                      className="text-[11px] text-stone-400 hover:text-stone-600 underline pt-1"
                    >
                      Choose another file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadCloud className="w-8 h-8 text-stone-400 dark:text-zinc-600 mx-auto" />
                    <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                      Click to browse or drag & drop file here
                    </p>
                    <p className="text-[11px] text-stone-400">
                      Passports, insurance cards, birth certificates, lease agreements, receipts
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Item Title *
            </label>
            <input
              type="text"
              required
              placeholder={tab === 'file' ? 'e.g. Home Deed & Insurance Policy 2026' : 'e.g. Spare Key Location, Router Password'}
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="documents">Documents & IDs</option>
                <option value="home">Home & Keys</option>
                <option value="financial">Financial & Property</option>
                <option value="health">Medical & Health</option>
                <option value="recipes">Family Recipes</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Security Protocol
              </label>
              <div className="flex items-center space-x-1.5 px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-100/50 dark:bg-zinc-800/50 text-emerald-700 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>AES-256-GCM Authenticated</span>
              </div>
            </div>
          </div>

          {tab === 'note' && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Secret Note, Code, or Location *
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. WiFi Password: SweetHome2026! or Spare key is in the magnetic lockbox by garage pillar code 4491"
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                className="w-full px-3 py-2 font-mono text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Provide context or instructions for your family members..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-sm"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Encrypting & Saving...' : 'Encrypt & Save to Vault'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
