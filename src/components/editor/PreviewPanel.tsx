import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Icon from '@/components/ui/icon';
import useEditorStore from '@/hooks/use-editor-store';
import { Slider } from '@/components/ui/slider';

const formatTimecode = (seconds: number, fps: number = 30): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * fps);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
};

const clipColors: Record<string, string> = {
  video: 'rgba(59, 130, 246, 0.5)',
  image: 'rgba(249, 115, 22, 0.4)',
  audio: 'rgba(34, 197, 94, 0.3)',
  text: 'transparent',
};

const PreviewPanel = () => {
  const currentTime = useEditorStore(s => s.currentTime);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const togglePlay = useEditorStore(s => s.togglePlay);
  const setCurrentTime = useEditorStore(s => s.setCurrentTime);
  const project = useEditorStore(s => s.project);
  const tracks = useEditorStore(s => s.tracks);

  const [volume, setVolume] = useState(80);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const activeClips = useMemo(() => {
    const clips: Array<{ id: string; type: string; name: string; text?: string; fontSize?: number; fontColor?: string; opacity: number; trackType: string; trackVisible: boolean; trackMuted: boolean }> = [];
    for (const track of tracks) {
      if (!track.visible) continue;
      for (const clip of track.clips) {
        if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
          clips.push({
            id: clip.id,
            type: clip.type,
            name: clip.name,
            text: clip.text,
            fontSize: clip.fontSize,
            fontColor: clip.fontColor,
            opacity: clip.opacity,
            trackType: track.type,
            trackVisible: track.visible,
            trackMuted: track.muted,
          });
        }
      }
    }
    return clips;
  }, [tracks, currentTime]);

  const maxTime = useMemo(() => {
    let max = 0;
    tracks.forEach(t => t.clips.forEach(c => {
      const end = c.startTime + c.duration;
      if (end > max) max = end;
    }));
    return Math.max(max, project.duration);
  }, [tracks, project.duration]);

  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const store = useEditorStore.getState();
      const next = store.currentTime + delta;

      if (next >= maxTime) {
        store.setCurrentTime(0);
        store.togglePlay();
        return;
      }

      store.setCurrentTime(next);
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, maxTime]);

  const toggleFullscreen = useCallback(() => {
    if (!previewRef.current) return;
    if (!document.fullscreenElement) {
      previewRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const jumpStart = () => setCurrentTime(0);
  const jumpEnd = () => setCurrentTime(maxTime);
  const skipBack = () => setCurrentTime(Math.max(0, currentTime - 2));
  const skipForward = () => setCurrentTime(Math.min(maxTime, currentTime + 2));
  const frameBack = () => setCurrentTime(Math.max(0, currentTime - 1 / project.fps));
  const frameForward = () => setCurrentTime(Math.min(maxTime, currentTime + 1 / project.fps));

  const videoClips = activeClips.filter(c => c.type === 'video' || c.type === 'image');
  const textClips = activeClips.filter(c => c.type === 'text');
  const audioClips = activeClips.filter(c => c.type === 'audio' && !c.trackMuted);
  const hasVisual = videoClips.length > 0 || textClips.length > 0;

  const progressPercent = maxTime > 0 ? (currentTime / maxTime) * 100 : 0;

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    setCurrentTime(Math.max(0, pct * maxTime));
  }, [maxTime, setCurrentTime]);

  return (
    <div ref={previewRef} className="flex flex-col h-full editor-panel rounded-lg overflow-hidden">
      <div className="editor-panel-header px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Monitor" size={14} />
          <span className="text-xs font-medium">Предпросмотр</span>
        </div>
        <div className="flex items-center gap-2">
          {audioClips.length > 0 && (
            <span className="flex items-center gap-1 text-[9px] text-green-400">
              <Icon name="Music" size={9} />
              {audioClips.length}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{project.width}x{project.height} {project.fps}fps</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-2 min-h-0">
        <div
          className="relative w-full rounded overflow-hidden"
          style={{ aspectRatio: '16/9', maxHeight: '100%', background: '#0a0a0f' }}
        >
          {hasVisual ? (
            <div className="absolute inset-0">
              {videoClips.map((clip, i) => (
                <div
                  key={clip.id}
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ opacity: clip.opacity, zIndex: i }}
                >
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: clipColors[clip.type] || 'transparent' }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <Icon name={clip.type === 'video' ? 'Film' : 'Image'} size={24} className="text-white/60" />
                      </div>
                      <span className="text-[11px] text-white/70 font-medium">{clip.name}</span>
                    </div>
                  </div>
                </div>
              ))}
              {textClips.map((clip, i) => (
                <div
                  key={clip.id}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{ opacity: clip.opacity, zIndex: 100 + i }}
                >
                  <span
                    className="drop-shadow-lg"
                    style={{
                      fontSize: Math.max(12, (clip.fontSize || 48) * 0.35),
                      color: clip.fontColor || '#ffffff',
                      fontWeight: 600,
                      textShadow: '0 2px 8px rgba(0,0,0,0.7)',
                    }}
                  >
                    {clip.text || clip.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Icon name="Clapperboard" size={32} />
              </div>
              <span className="text-[11px]">Нет активных клипов</span>
              <span className="text-[9px] mt-0.5 text-muted-foreground/30">Переместите плейхед на клип или нажмите Play</span>
            </div>
          )}

          <div className="absolute top-2 left-2 flex items-center gap-1.5 z-50">
            {isPlaying && (
              <span className="flex items-center gap-1 bg-red-500/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                REC
              </span>
            )}
          </div>

          <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono text-white/80 z-50">
            {formatTimecode(currentTime, project.fps)}
          </div>

          {activeClips.length > 0 && (
            <div className="absolute bottom-2 left-2 flex gap-1 z-50">
              {activeClips.map(c => (
                <span
                  key={c.id}
                  className="text-[8px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    background: c.type === 'video' ? 'rgba(59,130,246,0.6)' : c.type === 'audio' ? 'rgba(34,197,94,0.6)' : c.type === 'image' ? 'rgba(249,115,22,0.6)' : 'rgba(168,85,247,0.6)',
                    color: 'white',
                  }}
                >
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pt-1">
        <div
          className="h-1 rounded-full cursor-pointer group relative"
          style={{ background: 'hsl(var(--editor-bg))' }}
          onClick={handleProgressClick}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progressPercent}%`, background: 'hsl(var(--primary))' }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progressPercent}% - 5px)` }}
          />
        </div>
      </div>

      <div className="px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <button onClick={jumpStart} className="nle-button"><Icon name="SkipBack" size={12} /></button>
          <button onClick={frameBack} className="nle-button"><Icon name="ChevronLeft" size={12} /></button>
          <button onClick={skipBack} className="nle-button"><Icon name="Rewind" size={12} /></button>
          <button onClick={togglePlay} className={`nle-button ${isPlaying ? 'active' : ''}`} style={{ padding: '4px 10px' }}>
            <Icon name={isPlaying ? 'Pause' : 'Play'} size={16} />
          </button>
          <button onClick={skipForward} className="nle-button"><Icon name="FastForward" size={12} /></button>
          <button onClick={frameForward} className="nle-button"><Icon name="ChevronRight" size={12} /></button>
          <button onClick={jumpEnd} className="nle-button"><Icon name="SkipForward" size={12} /></button>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          {formatTimecode(currentTime, project.fps)} / {formatTimecode(maxTime, project.fps)}
        </div>
        <div className="flex items-center gap-1.5">
          <Icon name={volume === 0 ? 'VolumeX' : 'Volume2'} size={11} className="text-muted-foreground cursor-pointer" onClick={() => setVolume(volume === 0 ? 80 : 0)} />
          <Slider value={[volume]} onValueChange={([v]) => setVolume(v)} max={100} step={1} className="w-14" />
          <button onClick={toggleFullscreen} className="nle-button">
            <Icon name={isFullscreen ? 'Minimize' : 'Maximize'} size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel;
