import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  Image as ImageIcon,
  MapPin,
  Calendar,
  Users,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  Link
} from 'lucide-react';
import type { FamilyMemory, HomeMember } from '../../../types';
import { api } from '../../../services/api';

interface CreateEditMemoryModalProps {
  homeId: string;
  homeMembers: HomeMember[];
  memoryToEdit?: FamilyMemory | null;
  onClose: () => void;
  onSaved: (memory: FamilyMemory) => void;
}

export const CreateEditMemoryModal: React.FC<CreateEditMemoryModalProps> = ({
  homeId,
  homeMembers,
  memoryToEdit,
  onClose,
  onSaved
}) => {
  const isEditing = !!memoryToEdit;

  const [title, setTitle] = useState(memoryToEdit?.title || '');
  const [story, setStory] = useState(memoryToEdit?.story || '');
  const [date, setDate] = useState(memoryToEdit?.date || new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState(memoryToEdit?.location || '');
  const [taggedMemberIds, setTaggedMemberIds] = useState<string[]>(
    memoryToEdit?.taggedMemberIds || []
  );

  // Stored uploaded images
  const initialImages = memoryToEdit?.images && memoryToEdit.images.length > 0
    ? memoryToEdit.images
    : memoryToEdit?.imageUrl
    ? [memoryToEdit.imageUrl]
    : [];
  const [images, setImages] = useState<string[]>(initialImages);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // URL fallback input
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle files selected via file input or drag-and-drop
  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      setErrorMessage('Please select valid image files (JPEG, PNG, WebP, etc.)');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadProgressText(`Uploading photo ${i + 1} of ${fileArray.length}...`);

        // Convert to base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Real upload to server disk
        const res = await api.uploadMemoryPhoto(homeId, base64Data, file.name, file.type);
        if (res.url) {
          uploadedUrls.push(res.url);
        }
      }

      setImages(prev => [...prev, ...uploadedUrls]);
    } catch (err: any) {
      console.error('Photo upload error:', err);
      setErrorMessage(err.message || 'Failed to upload photo. Please check the file and try again.');
    } finally {
      setIsUploading(false);
      setUploadProgressText(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleAddUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/api/')) {
      setErrorMessage('Please enter a valid image URL');
      return;
    }
    setImages(prev => [...prev, trimmed]);
    setCustomUrl('');
    setShowUrlInput(false);
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const toggleMemberTag = (memberId: string) => {
    setTaggedMemberIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedStory = story.trim();

    if (!trimmedTitle) {
      setErrorMessage('Please provide a title for this memory.');
      return;
    }
    if (!trimmedStory) {
      setErrorMessage('Please share the story or caption for this moment.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEditing && memoryToEdit) {
        const res = await api.updateMemory(homeId, memoryToEdit.id, {
          title: trimmedTitle,
          story: trimmedStory,
          date,
          location: location.trim() || undefined,
          images,
          imageUrl: images[0] || undefined,
          taggedMemberIds
        });
        onSaved(res.memory);
      } else {
        const res = await api.createMemory(homeId, {
          title: trimmedTitle,
          story: trimmedStory,
          date,
          location: location.trim() || undefined,
          images,
          imageUrl: images[0] || undefined,
          taggedMemberIds
        });
        onSaved(res.memory);
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to save memory:', err);
      setErrorMessage(err.message || 'Could not save memory. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="create-memory-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="create-memory-modal"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/70 dark:bg-zinc-900/90 shrink-0">
          <div>
            <h3 className="font-serif font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100">
              {isEditing ? 'Edit Family Memory' : 'Add Cherished Family Memory'}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Preserve a moment, vacation, recipe, or milestone in your private album
            </p>
          </div>
          <button
            type="button"
            id="btn-close-create-memory"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start space-x-2.5 text-xs text-rose-800 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Photo Uploader Area */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Photos & Media
            </label>

            {/* Dropzone */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20 scale-[0.99]'
                  : 'border-stone-300 dark:border-zinc-700 hover:border-amber-400 dark:hover:border-amber-600 bg-stone-50/50 dark:bg-zinc-800/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={e => e.target.files && handleFiles(e.target.files)}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <UploadCloud className="w-6 h-6" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                    {uploadProgressText || 'Click to select or drag & drop family photos'}
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Supports multiple photos (JPEG, PNG, WebP) saved securely to your home
                  </p>
                </div>
              </div>
            </div>

            {/* URL Fallback Option */}
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 flex items-center space-x-1"
              >
                <Link className="w-3.5 h-3.5" />
                <span>{showUrlInput ? 'Hide photo URL input' : 'Or add via photo URL'}</span>
              </button>
              {images.length > 0 && (
                <span className="text-stone-500 font-medium">
                  {images.length} {images.length === 1 ? 'photo' : 'photos'} attached
                </span>
              )}
            </div>

            {showUrlInput && (
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddUrl}
                  className="px-3 py-2 rounded-xl bg-stone-200 dark:bg-zinc-700 hover:bg-stone-300 dark:hover:bg-zinc-600 text-xs font-medium text-stone-800 dark:text-stone-200"
                >
                  Add
                </button>
              </div>
            )}

            {/* Image Previews Grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-2">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-stone-200 dark:border-zinc-700 bg-stone-100 dark:bg-zinc-800 shadow-xs"
                  >
                    <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                    {idx === 0 && (
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-amber-600/90 text-white text-[10px] font-medium">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Memory Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-memory-title"
              type="text"
              required
              placeholder="e.g. Grandma's 80th Birthday Celebration"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Story / Caption Textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              The Story / Caption <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="input-memory-story"
              rows={4}
              required
              placeholder="Tell the family story... What made this moment unforgettable? What funny or meaningful things happened?"
              value={story}
              onChange={e => setStory(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed"
            />
          </div>

          {/* Date and Location Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>Date of Memory</span>
              </label>
              <input
                id="input-memory-date"
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>Location (Optional)</span>
              </label>
              <input
                id="input-memory-location"
                type="text"
                placeholder="e.g. Lake Tahoe, Grandma's Garden"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Tagged Family Members */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center space-x-1">
              <Users className="w-3.5 h-3.5 text-stone-400" />
              <span>Tag Family Members Present</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {homeMembers.map(member => {
                const isSelected = taggedMemberIds.includes(member.userId);
                return (
                  <button
                    key={member.userId}
                    type="button"
                    onClick={() => toggleMemberTag(member.userId)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-xs'
                        : 'bg-stone-50 dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-300 hover:border-amber-300'
                    }`}
                  >
                    <img
                      src={member.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.userId}`}
                      alt={member.name}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                    <span>{member.name}</span>
                    {isSelected && <Check className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-stone-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              id="btn-save-memory-submit"
              type="submit"
              disabled={isSubmitting || isUploading}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Album...</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Changes' : 'Add to Family Album'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
