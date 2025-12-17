import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, StopCircle, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

const AudioPlayer = ({ src, mimeType, title, onEnded, autoPlay = false }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
    };

    const updateProgress = () => {
      setProgress(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      if (onEnded) {
        onEnded();
      }
    };

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);

    if (autoPlay) {
      audio.play().catch(e => console.error("Autoplay failed:", e));
    }

    const handleAudioCommand = (e) => {
      const [command, value] = e.detail;
      switch (command) {
        case 'play':
          handlePlay();
          break;
        case 'pause':
          handlePause();
          break;
        case 'stop':
          handleStop();
          break;
        case 'volume':
          const newVolume = parseInt(value, 10) / 100;
          if (!isNaN(newVolume) && newVolume >= 0 && newVolume <= 1) {
            handleVolumeChange([newVolume]);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('audioCommand', handleAudioCommand);

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnded);
      window.removeEventListener('audioCommand', handleAudioCommand);
      if (src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
    };
  }, [src, onEnded, autoPlay]);

  const handlePlay = () => {
    audioRef.current.play();
    setIsPlaying(true);
  };

  const handlePause = () => {
    audioRef.current.pause();
    setIsPlaying(false);
  };

  const handleStop = () => {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  };

  const handleVolumeChange = (value) => {
    const newVolume = value[0];
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    audioRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const formatTime = (time) => {
    if (isNaN(time) || time === 0) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="bg-black/50 border themed-border-secondary p-3 rounded-md terminal-text">
      <audio ref={audioRef} src={src} type={mimeType} />
      <p className="text-sm themed-text-accent truncate mb-2">{title}</p>
      <div className="flex items-center space-x-3">
        <Button onClick={isPlaying ? handlePause : handlePlay} size="sm" variant="ghost" className="themed-text-primary hover:themed-bg-secondary">
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </Button>
        <Button onClick={handleStop} size="sm" variant="ghost" className="themed-text-primary hover:themed-bg-secondary">
          <StopCircle size={16} />
        </Button>
        <div className="flex-1 flex items-center space-x-2">
          <span className="text-xs themed-text-secondary">{formatTime(progress)}</span>
          <Slider
            value={[progress]}
            max={duration}
            step={1}
            onValueChange={(value) => (audioRef.current.currentTime = value[0])}
            className="w-full"
          />
          <span className="text-xs themed-text-secondary">{formatTime(duration)}</span>
        </div>
        <Button onClick={toggleMute} size="sm" variant="ghost" className="themed-text-primary hover:themed-bg-secondary">
          {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </Button>
        <Slider
          value={[isMuted ? 0 : volume]}
          max={1}
          step={0.01}
          onValueChange={handleVolumeChange}
          className="w-24"
        />
      </div>
    </div>
  );
};

export default AudioPlayer;