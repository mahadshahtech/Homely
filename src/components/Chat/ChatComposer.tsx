import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  Smile,
  X,
  Plus,
  Square,
  Trash2,
  Image as ImageIcon,
  CheckSquare,
  MapPin,
  Megaphone,
  Check
} from 'lucide-react';
import type { Message } from '../../types';

interface ChatComposerProps {
  onSendMessage: (payload: {
    content: string;
    replyToId?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'file' | 'voice' | 'location' | 'poll' | 'announcement';
    mediaName?: string;
    mediaSize?: number;
    mediaDuration?: number;
    extraData?: any;
    isPinned?: boolean;
  }) => Promise<void>;
  replyingTo: Message | null;
  onCancelReply: () => void;
  editingMessage: Message | null;
  onSaveEdit: (messageId: string, newContent: string) => Promise<void>;
  onCancelEdit: () => void;
  onTyping: (isTyping: boolean) => void;
  onOpenPollModal: () => void;
  onOpenLocationModal: () => void;
  onUploadMedia: (file: File) => Promise<{
    url: string;
    fileName: string;
    mimeType: string;
    size: number;
    duration?: number;
  }>;
}

const COMMON_EMOJIS = ['❤️', '😊', '😂', '👍', '🙏', '🎉', '🥰', '🍕', '🏠', '✨', '👏', '👀'];

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  replyingTo,
  onCancelReply,
  editingMessage,
  onSaveEdit,
  onCancelEdit,
  onTyping,
  onOpenPollModal,
  onOpenLocationModal,
  onUploadMedia
}) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [isAnnouncement, setIsAnnouncement] = useState(false);

  // File attachment state
  const [attachedFile, setAttachedFile] = useState<{
    url: string;
    fileName: string;
    mimeType: string;
    size: number;
    type: 'image' | 'video' | 'file';
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimerRef = useRef<any>(null);

  // Sync editing message
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content || '');
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  // Handle typing indicator
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    onTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  // File upload trigger
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploaded = await onUploadMedia(file);
      let mediaType: 'image' | 'video' | 'file' = 'file';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('video/')) mediaType = 'video';

      setAttachedFile({
        url: uploaded.url,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        type: mediaType
      });
    } catch (err: any) {
      alert(err.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Real voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone error:', err);
      alert('Microphone access is required to record a voice message.');
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const duration = recordingSeconds;

    mediaRecorderRef.current.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const uploaded = await onUploadMedia(
            new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
          );

          await onSendMessage({
            content: '',
            mediaUrl: uploaded.url,
            mediaType: 'voice',
            mediaDuration: duration,
            replyToId: replyingTo?.id
          });

          if (replyingTo) onCancelReply();
        };
        reader.readAsDataURL(audioBlob);
      } catch (err: any) {
        alert(err.message || 'Failed to send voice message');
      } finally {
        setIsRecording(false);
        setRecordingSeconds(0);
        mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
      }
    };

    mediaRecorderRef.current.stop();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (editingMessage) {
      if (!text.trim()) return;
      await onSaveEdit(editingMessage.id, text.trim());
      setText('');
      return;
    }

    if (!text.trim() && !attachedFile) return;

    const content = text.trim();
    setText('');
    onTyping(false);

    let mediaUrl = attachedFile?.url;
    let mediaType = attachedFile?.type;
    let mediaName = attachedFile?.fileName;
    let mediaSize = attachedFile?.size;

    if (isAnnouncement) {
      mediaType = 'announcement';
    }

    setAttachedFile(null);
    setIsAnnouncement(false);
    setShowQuickMenu(false);
    setShowEmojiPicker(false);

    await onSendMessage({
      content,
      replyToId: replyingTo?.id,
      mediaUrl,
      mediaType,
      mediaName,
      mediaSize,
      isPinned: isAnnouncement
    });

    if (replyingTo) onCancelReply();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="border-t border-stone-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm p-3 transition-colors relative shrink-0">
      {/* Replying Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 text-xs">
          <div className="flex items-center space-x-2 truncate">
            <span className="font-bold text-indigo-600 dark:text-indigo-400">Replying to {replyingTo.sender.name}:</span>
            <span className="text-stone-600 dark:text-stone-300 truncate">{replyingTo.content || '[Attachment]'}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-amber-50 dark:bg-amber-950/60 rounded-xl border border-amber-200/60 dark:border-amber-800/40 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-amber-600 dark:text-amber-400">Editing message</span>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Preview Banner */}
      {attachedFile && (
        <div className="flex items-center justify-between px-3 py-2 mb-2 bg-stone-100 dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700 text-xs">
          <div className="flex items-center space-x-2 truncate">
            <span className="font-bold text-indigo-600 dark:text-indigo-400 capitalize">{attachedFile.type}:</span>
            <span className="text-stone-700 dark:text-stone-300 truncate">{attachedFile.fileName}</span>
            <span className="text-stone-400 text-[10px]">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
          </div>
          <button
            type="button"
            onClick={() => setAttachedFile(null)}
            className="p-1 rounded-full text-stone-400 hover:text-rose-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Announcement Mode Indicator */}
      {isAnnouncement && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-amber-500/10 rounded-xl border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center space-x-1.5">
            <Megaphone className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-semibold">Family Announcement Mode (will be pinned)</span>
          </div>
          <button
            type="button"
            onClick={() => setIsAnnouncement(false)}
            className="text-[10px] text-stone-400 hover:text-stone-600"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Quick Action Drawer Menu */}
      {showQuickMenu && (
        <div className="absolute bottom-full left-3 mb-2 p-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-stone-200 dark:border-zinc-800 z-30 flex items-center space-x-2 animate-in fade-in zoom-in-95">
          <button
            type="button"
            onClick={() => {
              fileInputRef.current?.click();
              setShowQuickMenu(false);
            }}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-700 dark:text-stone-300 transition-colors"
          >
            <ImageIcon className="w-4 h-4 text-indigo-500" />
            <span>Photo / File</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenPollModal();
              setShowQuickMenu(false);
            }}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-700 dark:text-stone-300 transition-colors"
          >
            <CheckSquare className="w-4 h-4 text-amber-500" />
            <span>Family Poll</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenLocationModal();
              setShowQuickMenu(false);
            }}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-700 dark:text-stone-300 transition-colors"
          >
            <MapPin className="w-4 h-4 text-emerald-500" />
            <span>Location</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsAnnouncement(!isAnnouncement);
              setShowQuickMenu(false);
            }}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-700 dark:text-stone-300 transition-colors"
          >
            <Megaphone className="w-4 h-4 text-amber-600" />
            <span>Announcement</span>
          </button>
        </div>
      )}

      {/* Emoji Picker Drawer */}
      {showEmojiPicker && (
        <div className="absolute bottom-full left-12 mb-2 p-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-stone-200 dark:border-zinc-800 z-30 flex flex-wrap gap-1 max-w-xs animate-in fade-in zoom-in-95">
          {COMMON_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setText(prev => prev + emoji);
                setShowEmojiPicker(false);
                textareaRef.current?.focus();
              }}
              className="w-8 h-8 flex items-center justify-center text-lg rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 hover:scale-110 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
      />

      {/* Live Voice Recording Bar OR Normal Composer */}
      {isRecording ? (
        <div className="flex items-center justify-between p-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 animate-in fade-in">
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
              Recording Voice Note... {formatSeconds(recordingSeconds)}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-rose-100/50 transition-colors"
              title="Cancel recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={stopAndSendRecording}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Send Voice</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-end space-x-2">
          {/* Quick Menu Plus Button */}
          <button
            type="button"
            onClick={() => {
              setShowQuickMenu(!showQuickMenu);
              setShowEmojiPicker(false);
            }}
            className="p-2.5 rounded-xl text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors shrink-0 mb-0.5"
            title="Add media, poll, location, announcement"
          >
            <Plus className={`w-4 h-4 transition-transform ${showQuickMenu ? 'rotate-45' : ''}`} />
          </button>

          {/* Emoji Trigger */}
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowQuickMenu(false);
            }}
            className="p-2.5 rounded-xl text-stone-500 dark:text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors shrink-0 mb-0.5"
            title="Emoji"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Text Area */}
          <div className="flex-1 relative rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isAnnouncement
                  ? 'Type an important family announcement...'
                  : editingMessage
                  ? 'Update message content...'
                  : 'Type a message (Press Enter to send)...'
              }
              className="w-full px-3.5 py-2.5 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 bg-transparent resize-none focus:outline-none max-h-32 min-h-[40px]"
            />
          </div>

          {/* Voice Record Button or Send Button */}
          {!text.trim() && !attachedFile && !editingMessage ? (
            <button
              type="button"
              onClick={startRecording}
              className="p-2.5 rounded-xl bg-stone-100 hover:bg-indigo-50 dark:bg-zinc-800 dark:hover:bg-indigo-950/60 text-stone-600 hover:text-indigo-600 dark:text-stone-300 dark:hover:text-indigo-400 shadow-2xs transition-colors shrink-0 mb-0.5"
              title="Record voice message"
            >
              <Mic className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={uploading}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors shrink-0 mb-0.5 disabled:opacity-40"
              title={editingMessage ? 'Save changes' : 'Send message'}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
