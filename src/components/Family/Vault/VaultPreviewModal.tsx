import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Download,
  Copy,
  Check,
  Trash2,
  FileText,
  KeyRound,
  ShieldCheck,
  Calendar,
  User,
  AlertTriangle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { api } from '../../../services/api';
import type { VaultFile } from '../../../types';

interface VaultPreviewModalProps {
  homeId: string;
  file: VaultFile;
  canManage: boolean;
  onClose: () => void;
  onDeleted: (fileId: string) => void;
}

export const VaultPreviewModal: React.FC<VaultPreviewModalProps> = ({
  homeId,
  file,
  canManage,
  onClose,
  onDeleted
}) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isFile = file.itemType === 'file';
  const isImage = isFile && file.mimeType?.startsWith('image/');
  const isTextDoc = isFile && (file.mimeType?.startsWith('text/') || file.mimeType === 'application/json');

  // Load inline preview if image or text
  useEffect(() => {
    let activeUrl: string | null = null;
    if (isFile && (isImage || isTextDoc)) {
      setLoadingPreview(true);
      api
        .fetchVaultFileBlob(homeId, file.id, true)
        .then(async res => {
          if (isImage) {
            const url = URL.createObjectURL(res.blob);
            activeUrl = url;
            setPreviewBlobUrl(url);
          } else if (isTextDoc) {
            const text = await res.blob.text();
            setPreviewText(text.slice(0, 10000)); // preview up to 10k chars
          }
        })
        .catch(err => {
          console.warn('Failed to load inline preview:', err);
        })
        .finally(() => {
          setLoadingPreview(false);
        });
    }

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [homeId, file.id, isFile, isImage, isTextDoc]);

  const handleCopy = () => {
    navigator.clipboard.writeText(file.contentOrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    setDownloading(true);
    setErrorMsg('');
    try {
      const res = await api.fetchVaultFileBlob(homeId, file.id, false);
      const blobUrl = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = res.fileName || file.fileName || 'vault_download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download encrypted file.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setErrorMsg('');
    try {
      await api.deleteVaultFile(homeId, file.id);
      onDeleted(file.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete vault item.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-100 dark:border-zinc-800 pb-3">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
              {isFile ? <FileText className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300">
                  {file.category}
                </span>
                <span className="flex items-center space-x-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" />
                  <span>AES-256-GCM</span>
                </span>
              </div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-1">
                {file.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* File or Note Content View */}
        {isFile ? (
          <div className="space-y-3">
            {loadingPreview && (
              <div className="flex items-center justify-center p-8 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl border border-stone-200/60 dark:border-zinc-700/60">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mr-2" />
                <span className="text-xs text-stone-500">Decrypting file preview...</span>
              </div>
            )}

            {previewBlobUrl && (
              <div className="rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-800 max-h-72 flex items-center justify-center bg-stone-100 dark:bg-zinc-950">
                <img
                  src={previewBlobUrl}
                  alt={file.title}
                  className="max-h-72 object-contain w-full"
                />
              </div>
            )}

            {previewText && (
              <pre className="p-3 font-mono text-xs bg-stone-50 dark:bg-zinc-950 text-stone-800 dark:text-stone-200 rounded-2xl border border-stone-200/60 dark:border-zinc-800 max-h-60 overflow-y-auto whitespace-pre-wrap">
                {previewText}
              </pre>
            )}

            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/60 dark:border-zinc-700/60 flex items-center justify-between">
              <div className="space-y-0.5 truncate pr-2">
                <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                  {file.fileName || file.title}
                </p>
                <p className="text-[11px] text-stone-400">
                  {file.fileSize ? `${(file.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Encrypted binary'} • {file.mimeType || 'Document'}
                </p>
              </div>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-sm shrink-0"
              >
                {downloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>{downloading ? 'Decrypting...' : 'Download'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Secret Content / Passcode
            </label>
            <div className="bg-stone-50 dark:bg-zinc-800/80 border border-stone-200 dark:border-zinc-700 p-3.5 rounded-2xl flex items-center justify-between">
              <span className="font-mono text-xs text-stone-900 dark:text-stone-100 select-all break-all font-medium pr-2">
                {file.contentOrUrl}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold px-2.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-zinc-700 transition-colors shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Description */}
        {file.description && (
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-500">
              Note / Context
            </label>
            <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed bg-stone-50 dark:bg-zinc-800/40 p-3 rounded-2xl border border-stone-100 dark:border-zinc-800">
              {file.description}
            </p>
          </div>
        )}

        {/* Metadata footer */}
        <div className="pt-2 border-t border-stone-100 dark:border-zinc-800 text-[11px] text-stone-400 space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <User className="w-3 h-3" />
              <span>Added by {file.uploader?.name || 'Family Member'}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>{new Date(file.createdAt).toLocaleDateString()}</span>
            </span>
          </div>
        </div>

        {/* Delete confirmation or action bar */}
        {canManage && (
          <div className="pt-2">
            {confirmDelete ? (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl space-y-2">
                <div className="flex items-center space-x-1.5 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Permanently delete this vault item?</span>
                </div>
                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                  This action removes the database record and deletes the encrypted disk file.
                </p>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="px-3 py-1 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-stone-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center space-x-1 px-3 py-1 text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors"
                  >
                    {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    <span>{deleting ? 'Deleting...' : 'Yes, Delete Permanently'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end pt-1">
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center space-x-1 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Item</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
