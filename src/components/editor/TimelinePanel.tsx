import { useState, useRef, useCallback, useMemo } from 'react';
import Icon from '@/components/ui/icon';
import useEditorStore from '@/hooks/use-editor-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const PIXELS_PER_SECOND = 80;
const TRACK_HEADER_WIDTH = 160;

const formatTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const clipTypeClass = (type: string) => {
  switch (type) {
    case 'video': return 'clip-video';
    case 'audio': return 'clip-audio';
    case 'text': return 'clip-text';
    case 'image': return 'clip-image';
    default: return 'clip-video';
  }
};

const clipTypeIcon = (type: string) => {
  switch (type) {
    case 'video': return 'Film';
    case 'audio': return 'Music';
    case 'text': return 'Type';
    case 'image': return 'Image';
    default: return 'File';
  }
};

const TimelinePanel = () => {
  const {
    tracks, currentTime, zoom, snapEnabled, isPlaying, project,
    setCurrentTime, setZoom, toggleSnap, togglePlay,
    selectClip, selectedClipId, removeClip,
    toggleTrackMute, toggleTrackLock, toggleTrackVisibility,
    addTrack, splitClip, duplicateClip,
  } = useEditorStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [hoveredClip, setHoveredClip] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);

  const pps = PIXELS_PER_SECOND * zoom;
  const totalWidth = project.duration * pps;

  const timeMarkers = useMemo(() => {
    const markers: { time: number; label: string; major: boolean }[] = [];
    let interval = 1;
    if (zoom < 0.3) interval = 10;
    else if (zoom < 0.7) interval = 5;
    else if (zoom < 1.5) interval = 2;

    for (let t = 0; t <= project.duration; t += interval) {
      markers.push({ time: t, label: formatTime(t), major: t % (interval * 2) === 0 });
    }
    return markers;
  }, [zoom, project.duration]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const time = Math.max(0, x / pps);
    setCurrentTime(time);
  }, [pps, setCurrentTime]);

  const handlePlayheadDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPlayhead(true);

    const handleMove = (ev: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left + timelineRef.current.scrollLeft;
      setCurrentTime(Math.max(0, Math.min(project.duration, x / pps)));
    };

    const handleUp = () => {
      setIsDraggingPlayhead(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [pps, project.duration, setCurrentTime]);

  const handleClipContextMenu = useCallback((e: React.MouseEvent, clipId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, clipId });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  return (
    <div className="flex flex-col h-full editor-panel rounded-lg overflow-hidden" onClick={closeContextMenu}>
      <div className="editor-panel-header px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Layers" size={14} />
          <span className="text-xs font-medium">Таймлайн</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={toggleSnap} className={`nle-button ${snapEnabled ? 'active' : ''}`}>
                <Icon name="Magnet" size={11} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-[10px]">Привязка</p></TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setZoom(zoom - 0.2)} className="nle-button"><Icon name="ZoomOut" size={11} /></button>
            <span className="text-[10px] text-muted-foreground w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(zoom + 0.2)} className="nle-button"><Icon name="ZoomIn" size={11} /></button>
          </div>

          <div className="flex items-center gap-0.5 ml-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => addTrack('video')} className="nle-button"><Icon name="Film" size={11} /></button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-[10px]">Добавить видео дорожку</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => addTrack('audio')} className="nle-button"><Icon name="Music" size={11} /></button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-[10px]">Добавить аудио дорожку</p></TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-shrink-0" style={{ width: TRACK_HEADER_WIDTH }}>
          <div className="h-6 border-b border-border" style={{ background: 'hsl(var(--editor-panel-header))' }} />
          {tracks.map(track => (
            <div key={track.id} className="flex items-center gap-1 px-2 border-b border-border" style={{ height: track.height, background: 'hsl(var(--editor-panel))' }}>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium truncate">{track.name}</div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => toggleTrackVisibility(track.id)} className={`p-0.5 rounded hover:bg-secondary/50 ${!track.visible ? 'text-muted-foreground/30' : 'text-muted-foreground'}`}>
                  <Icon name={track.visible ? 'Eye' : 'EyeOff'} size={10} />
                </button>
                <button onClick={() => toggleTrackMute(track.id)} className={`p-0.5 rounded hover:bg-secondary/50 ${track.muted ? 'text-destructive' : 'text-muted-foreground'}`}>
                  <Icon name={track.muted ? 'VolumeX' : 'Volume2'} size={10} />
                </button>
                <button onClick={() => toggleTrackLock(track.id)} className={`p-0.5 rounded hover:bg-secondary/50 ${track.locked ? 'text-accent' : 'text-muted-foreground'}`}>
                  <Icon name={track.locked ? 'Lock' : 'Unlock'} size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div ref={timelineRef} className="flex-1 overflow-x-auto overflow-y-hidden editor-scrollbar relative" style={{ background: 'hsl(var(--editor-timeline))' }}>
          <div style={{ width: totalWidth, minWidth: '100%' }}>
            <div className="h-6 border-b border-border relative cursor-pointer" style={{ background: 'hsl(var(--editor-panel-header))' }} onClick={handleTimelineClick}>
              {timeMarkers.map((m, i) => (
                <div key={i} className="absolute top-0 h-full flex flex-col items-center" style={{ left: m.time * pps }}>
                  <span className="text-[8px] text-muted-foreground/60 mt-0.5">{m.label}</span>
                  <div className={`w-px flex-1 ${m.major ? 'bg-border' : 'bg-border/40'}`} />
                </div>
              ))}
            </div>

            {tracks.map(track => (
              <div key={track.id} className="relative border-b border-border/50" style={{ height: track.height }}>
                {track.clips.map(clip => (
                  <div
                    key={clip.id}
                    className={`absolute top-1 rounded cursor-pointer transition-all ${clipTypeClass(clip.type)} ${selectedClipId === clip.id ? 'ring-1 ring-white shadow-lg' : 'hover:brightness-110'}`}
                    style={{
                      left: clip.startTime * pps,
                      width: clip.duration * pps,
                      height: track.height - 8,
                      opacity: clip.opacity,
                    }}
                    onClick={(e) => { e.stopPropagation(); selectClip(clip.id); }}
                    onContextMenu={(e) => handleClipContextMenu(e, clip.id)}
                    onMouseEnter={() => setHoveredClip(clip.id)}
                    onMouseLeave={() => setHoveredClip(null)}
                  >
                    <div className="flex items-center gap-1 px-1.5 h-full overflow-hidden">
                      <Icon name={clipTypeIcon(clip.type)} size={10} className="flex-shrink-0 opacity-70" />
                      <span className="text-[9px] font-medium truncate text-white/90">{clip.name}</span>
                    </div>
                    <div className="absolute left-0 top-0 w-1 h-full cursor-col-resize rounded-l hover:bg-white/20" />
                    <div className="absolute right-0 top-0 w-1 h-full cursor-col-resize rounded-r hover:bg-white/20" />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div
            className="absolute top-0 bottom-0 z-10 pointer-events-none"
            style={{ left: currentTime * pps, width: 1 }}
          >
            <div
              className="w-3 h-3 -ml-1.5 cursor-pointer pointer-events-auto"
              style={{ background: 'hsl(var(--editor-playhead))' }}
              onMouseDown={handlePlayheadDrag}
            >
              <svg viewBox="0 0 12 12" className="w-3 h-3"><polygon points="0,0 12,0 6,10" fill="hsl(var(--editor-playhead))" /></svg>
            </div>
            <div className="w-px h-full mx-auto" style={{ background: 'hsl(var(--editor-playhead))' }} />
          </div>
        </div>
      </div>

      {contextMenu && (
        <div className="fixed z-50 min-w-[140px] rounded-md border border-border shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y, background: 'hsl(var(--popover))' }}>
          <div className="p-1">
            <button onClick={() => { splitClip(contextMenu.clipId, currentTime); closeContextMenu(); }} className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-secondary/50">
              <Icon name="Scissors" size={11} /> Разрезать
            </button>
            <button onClick={() => { duplicateClip(contextMenu.clipId); closeContextMenu(); }} className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-secondary/50">
              <Icon name="Copy" size={11} /> Дублировать
            </button>
            <button onClick={() => { removeClip(contextMenu.clipId); closeContextMenu(); }} className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-destructive/20 text-destructive">
              <Icon name="Trash2" size={11} /> Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelinePanel;
