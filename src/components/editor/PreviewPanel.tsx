import { useState, useRef, useCallback, useEffect } from 'react';
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

const PreviewPanel = () => {
  const { currentTime, isPlaying, togglePlay, setCurrentTime, project, tracks } = useEditorStore();
  const [volume, setVolume] = useState(80);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const hasContent = tracks.some(t => t.clips.length > 0);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime(useEditorStore.getState().currentTime + 1 / project.fps);
    }, 1000 / project.fps);
    return () => clearInterval(interval);
  }, [isPlaying, project.fps, setCurrentTime]);

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
  const jumpEnd = () => setCurrentTime(project.duration);
  const skipBack = () => setCurrentTime(Math.max(0, currentTime - 5));
  const skipForward = () => setCurrentTime(Math.min(project.duration, currentTime + 5));

  const activeClips = tracks.flatMap(t => t.clips.filter(c => currentTime >= c.startTime && currentTime < c.startTime + c.duration));

  return (
    <div ref={previewRef} className="flex flex-col h-full editor-panel rounded-lg overflow-hidden">
      <div className="editor-panel-header px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Monitor" size={14} />
          <span className="text-xs font-medium">Предпросмотр</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{project.width}×{project.height} • {project.fps}fps</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-2 min-h-0">
        <div className="relative w-full" style={{ aspectRatio: '16/9', maxHeight: '100%', background: 'hsl(var(--editor-bg))' }}>
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }} />
          {hasContent && activeClips.length > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                {activeClips.map(clip => (
                  <div key={clip.id} className="mb-1">
                    {clip.type === 'text' ? (
                      <span style={{ fontSize: clip.fontSize ? clip.fontSize * 0.3 : 14, color: clip.fontColor || '#fff' }}>
                        {clip.text || clip.name}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <Icon name={clip.type === 'video' ? 'Film' : clip.type === 'image' ? 'Image' : 'Music'} size={16} />
                        <span className="text-xs">{clip.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <Icon name="Clapperboard" size={48} />
              <span className="text-xs mt-2">Перетащите медиа на таймлайн</span>
            </div>
          )}
          <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[10px] font-mono">
            {formatTimecode(currentTime, project.fps)}
          </div>
        </div>
      </div>

      <div className="px-3 py-2 flex items-center justify-between border-t border-border">
        <div className="flex items-center gap-1">
          <button onClick={jumpStart} className="nle-button"><Icon name="SkipBack" size={12} /></button>
          <button onClick={skipBack} className="nle-button"><Icon name="Rewind" size={12} /></button>
          <button onClick={togglePlay} className={`nle-button ${isPlaying ? 'active' : ''}`} style={{ padding: '4px 8px' }}>
            <Icon name={isPlaying ? 'Pause' : 'Play'} size={14} />
          </button>
          <button onClick={skipForward} className="nle-button"><Icon name="FastForward" size={12} /></button>
          <button onClick={jumpEnd} className="nle-button"><Icon name="SkipForward" size={12} /></button>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {formatTimecode(currentTime, project.fps)} / {formatTimecode(project.duration, project.fps)}
        </div>
        <div className="flex items-center gap-2">
          <Icon name="Volume2" size={12} className="text-muted-foreground" />
          <Slider value={[volume]} onValueChange={([v]) => setVolume(v)} max={100} step={1} className="w-16" />
          <button onClick={toggleFullscreen} className="nle-button">
            <Icon name={isFullscreen ? 'Minimize' : 'Maximize'} size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel;
