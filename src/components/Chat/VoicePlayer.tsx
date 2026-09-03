import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface VoicePlayerProps {
  url: string;
  duration?: number;
  isOwn?: boolean;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({ url, duration = 0, isOwn = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.warn('Audio play error:', err));
      setIsPlaying(true);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progress = totalDuration > 0 ? Math.min((currentTime / totalDuration) * 100, 100) : 0;

  return (
    <div className={`flex items-center space-x-3 py-1 px-1 rounded-2xl min-w-[200px] sm:min-w-[240px] select-none ${
      isOwn ? 'text-white' : 'text-stone-800 dark:text-stone-100'
    }`}>
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-sm ${
          isOwn
            ? 'bg-white text-indigo-700 hover:bg-stone-100'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500'
        }`}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
      </button>

      <div className="flex-1 space-y-1">
        {/* Waveform bars simulation */}
        <div className="flex items-center space-x-0.5 h-6">
          {[40, 65, 30, 85, 55, 95, 45, 75, 35, 90, 60, 80, 50, 70, 40, 85, 30, 60, 45].map((h, i) => {
            const barProgress = (i / 19) * 100;
            const isFilled = progress >= barProgress;
            return (
              <div
                key={i}
                style={{ height: `${Math.max(15, h)}%` }}
                className={`w-1 rounded-full transition-colors ${
                  isOwn
                    ? isFilled ? 'bg-white' : 'bg-white/40'
                    : isFilled ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-stone-300 dark:bg-zinc-700'
                }`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] opacity-80 font-medium">
          <span>{formatSeconds(currentTime)}</span>
          <span className="flex items-center space-x-1">
            <Volume2 className="w-2.5 h-2.5" />
            <span>{formatSeconds(totalDuration || duration)}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
