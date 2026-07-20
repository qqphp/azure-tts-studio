import { Download, Pause, Play, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/player-store';

const formatTime = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { source, title, clear } = usePlayerStore();
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!source || !audioRef.current) return;
    const audio = audioRef.current;
    audio.load();
    audio.play().catch(() => setPlaying(false));
  }, [source]);

  if (!source) return null;
  const toggle = () => { const audio = audioRef.current; if (!audio) return; if (audio.paused) audio.play(); else audio.pause(); };
  return <div className="audio-player"><audio ref={audioRef} src={source} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} />
    <button className="player-play" onClick={toggle}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><div className="player-main"><b>{title || '当前音频'}</b><div className="player-progress"><span>{formatTime(currentTime)}</span><input aria-label="播放进度" type="range" min="0" max={Number.isFinite(duration) ? duration : 0} value={currentTime} onChange={(event) => { const value = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = value; setCurrentTime(value); }} /><span>{formatTime(duration)}</span></div></div><a className="icon-button" href={source} download title="下载"><Download size={16} /></a><button className="icon-button" onClick={clear} title="关闭播放器"><X size={16} /></button>
  </div>;
}
