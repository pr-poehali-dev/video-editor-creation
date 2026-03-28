import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import useEditorStore from '@/hooks/use-editor-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const PIXELS_PER_SECOND = 80;
const TRACK_HEADER_WIDTH = 160;
const SNAP_THRESHOLD = 8;

const formatTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const textPresetClass: Record<string, string> = {
  'Заголовок': 'clip-text-title',
  'Субтитры': 'clip-text-subtitle',
  'Нижняя третья': 'clip-text-lower',
  'Титры': 'clip-text-credits',
  'Выноска': 'clip-text-callout',
};

const clipTypeClass = (type: string, name?: string) => {
  if (type === 'text' && name && textPresetClass[name]) return textPresetClass[name];
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
    tracks, currentTime, zoom, snapEnabled, project,
    setCurrentTime, setZoom, toggleSnap,
    selectClip, selectedClipId, removeClip, moveClip, moveClipToTrack,
    toggleTrackMute, toggleTrackLock, toggleTrackVisibility,
    addTrack, splitClip, duplicateClip, resizeClip,
    addClipFromAsset, draggingAsset, setDraggingAsset,
    removeTrack, updateClip, reorderTracks, renameTrack,
  } = useEditorStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize-left' | 'resize-right';
    clipId: string;
    startX: number;
    originalStart: number;
    originalDuration: number;
    sourceTrackId: string;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ trackId: string; time: number } | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [trackDrag, setTrackDrag] = useState<{ fromIdx: number; overIdx: number } | null>(null);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingTrackName, setEditingTrackName] = useState('');

  const pps = PIXELS_PER_SECOND * zoom;

  const maxClipEnd = useMemo(() => {
    let max = 0;
    tracks.forEach(t => t.clips.forEach(c => {
      max = Math.max(max, c.startTime + c.duration);
    }));
    return max;
  }, [tracks]);

  const effectiveDuration = Math.max(project.duration, maxClipEnd + 10);
  const totalWidth = Math.max(effectiveDuration * pps, 800);

  const allClipEdges = useMemo(() => {
    const edges: number[] = [0];
    tracks.forEach(t => t.clips.forEach(c => {
      edges.push(c.startTime, c.startTime + c.duration);
    }));
    return [...new Set(edges)].sort((a, b) => a - b);
  }, [tracks]);

  const snapToEdge = useCallback((time: number): number => {
    if (!snapEnabled) return time;
    for (const edge of allClipEdges) {
      if (Math.abs((edge - time) * pps) < SNAP_THRESHOLD) {
        setSnapLine(edge);
        return edge;
      }
    }
    if (Math.abs((currentTime - time) * pps) < SNAP_THRESHOLD) {
      setSnapLine(currentTime);
      return currentTime;
    }
    setSnapLine(null);
    return time;
  }, [snapEnabled, allClipEdges, pps, currentTime]);

  const timeMarkers = useMemo(() => {
    const markers: { time: number; label: string; major: boolean }[] = [];
    let interval = 1;
    if (zoom < 0.3) interval = 10;
    else if (zoom < 0.7) interval = 5;
    else if (zoom < 1.5) interval = 2;
    for (let t = 0; t <= effectiveDuration; t += interval) {
      markers.push({ time: t, label: formatTime(t), major: t % (interval * 2) === 0 });
    }
    return markers;
  }, [zoom, effectiveDuration]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState) return;
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const time = Math.max(0, x / pps);
    setCurrentTime(time);
  }, [pps, setCurrentTime, dragState]);

  const handlePlayheadDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const handleMove = (ev: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left + timelineRef.current.scrollLeft;
      setCurrentTime(Math.max(0, Math.min(effectiveDuration, x / pps)));
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [pps, effectiveDuration, setCurrentTime]);

  const handleClipMouseDown = useCallback((e: React.MouseEvent, clipId: string, type: 'move' | 'resize-left' | 'resize-right', trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = tracks.flatMap(t => t.clips).find(c => c.id === clipId);
    if (!clip) return;

    const track = tracks.find(t => t.id === trackId);
    if (track?.locked) return;

    selectClip(clipId);
    setDragState({
      type,
      clipId,
      startX: e.clientX,
      originalStart: clip.startTime,
      originalDuration: clip.duration,
      sourceTrackId: trackId,
    });
  }, [tracks, selectClip]);

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / pps;

      if (dragState.type === 'move') {
        const newStart = snapToEdge(Math.max(0, dragState.originalStart + deltaTime));
        moveClip(dragState.clipId, newStart);

        if (timelineRef.current) {
          const rect = timelineRef.current.getBoundingClientRect();
          const relY = e.clientY - rect.top;
          let accHeight = 24;
          for (const track of tracks) {
            if (relY >= accHeight && relY < accHeight + track.height) {
              if (track.id !== dragState.sourceTrackId && !track.locked) {
                moveClipToTrack(dragState.clipId, track.id, newStart);
                setDragState(prev => prev ? { ...prev, sourceTrackId: track.id } : null);
              }
              break;
            }
            accHeight += track.height;
          }
        }
      } else if (dragState.type === 'resize-left') {
        const newStart = snapToEdge(Math.max(0, dragState.originalStart + deltaTime));
        const actualDelta = newStart - dragState.originalStart;
        const newDuration = dragState.originalDuration - actualDelta;
        if (newDuration >= 0.2) {
          useEditorStore.getState().updateClip(dragState.clipId, {
            startTime: newStart,
            duration: newDuration,
          });
        }
      } else if (dragState.type === 'resize-right') {
        let newDuration = Math.max(0.2, dragState.originalDuration + deltaTime);
        const endTime = dragState.originalStart + newDuration;
        const snappedEnd = snapToEdge(endTime);
        if (snappedEnd !== endTime) {
          newDuration = snappedEnd - dragState.originalStart;
        }
        if (newDuration >= 0.2) {
          useEditorStore.getState().updateClip(dragState.clipId, { duration: newDuration });
        }
      }
    };

    const handleUp = () => {
      setDragState(null);
      setSnapLine(null);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, pps, tracks, moveClip, moveClipToTrack, snapToEdge]);

  const getTrackAtY = useCallback((clientY: number): { trackId: string; time: number } | null => {
    if (!timelineRef.current) return null;
    const rect = timelineRef.current.getBoundingClientRect();
    const relY = clientY - rect.top;
    const relX = clientY; // unused but keeping for clarity
    let accHeight = 24;
    for (const track of tracks) {
      if (relY >= accHeight && relY < accHeight + track.height) {
        return { trackId: track.id, time: 0 };
      }
      accHeight += track.height;
    }
    return null;
  }, [tracks]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!draggingAsset) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const time = snapToEdge(Math.max(0, x / pps));
    const relY = e.clientY - rect.top;
    let accHeight = 24;
    for (const track of tracks) {
      if (relY >= accHeight && relY < accHeight + track.height) {
        setDropTarget({ trackId: track.id, time });
        return;
      }
      accHeight += track.height;
    }
    setDropTarget(null);
  }, [draggingAsset, pps, tracks, snapToEdge]);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
    setSnapLine(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingAsset || !timelineRef.current) {
      setDropTarget(null);
      return;
    }

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const time = snapToEdge(Math.max(0, x / pps));
    const relY = e.clientY - rect.top;
    let accHeight = 24;
    let targetTrackId: string | null = null;

    for (const track of tracks) {
      if (relY >= accHeight && relY < accHeight + track.height) {
        const assetTrackType = draggingAsset.type === 'audio' ? 'audio' : 'video';
        if (track.type === assetTrackType || (draggingAsset.type === 'image' && track.type === 'video')) {
          targetTrackId = track.id;
        }
        break;
      }
      accHeight += track.height;
    }

    if (!targetTrackId) {
      targetTrackId = useEditorStore.getState().getCompatibleTrack(draggingAsset.type);
    }

    if (targetTrackId) {
      addClipFromAsset(draggingAsset, targetTrackId, time);
      setCurrentTime(time);
    }

    setDropTarget(null);
    setSnapLine(null);
    setDraggingAsset(null);
  }, [draggingAsset, pps, tracks, addClipFromAsset, setDraggingAsset, snapToEdge]);

  const handleClipContextMenu = useCallback((e: React.MouseEvent, clipId: string) => {
    e.preventDefault();
    e.stopPropagation();
    selectClip(clipId);
    setContextMenu({ x: e.clientX, y: e.clientY, clipId });
  }, [selectClip]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleZoomWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(zoom + delta);
    }
  }, [zoom, setZoom]);

  return (
    <div className="flex flex-col h-full editor-panel rounded-lg overflow-hidden select-none" onClick={closeContextMenu}>
      <div className="editor-panel-header px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Layers" size={14} />
          <span className="text-xs font-medium">Таймлайн</span>
          <span className="text-[9px] text-muted-foreground ml-1">{tracks.length} дорожек</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={toggleSnap} className={`nle-button ${snapEnabled ? 'active' : ''}`}>
                <Icon name="Magnet" size={11} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-[10px]">Привязка к краям</p></TooltipContent>
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
              <TooltipContent side="top"><p className="text-[10px]">+ Видео дорожка</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => addTrack('audio')} className="nle-button"><Icon name="Music" size={11} /></button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-[10px]">+ Аудио дорожка</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => addTrack('text')} className="nle-button"><Icon name="Type" size={11} /></button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-[10px]">+ Текст дорожка</p></TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-shrink-0 overflow-y-auto editor-scrollbar" style={{ width: TRACK_HEADER_WIDTH }}>
          <div className="h-6 border-b border-border flex items-center px-2" style={{ background: 'hsl(var(--editor-panel-header))' }}>
            <span className="text-[8px] text-muted-foreground uppercase tracking-widest">Дорожки</span>
          </div>
          {tracks.map((track, idx) => (
            <div
              key={track.id}
              draggable
              onDragStart={(e) => {
                setTrackDrag({ fromIdx: idx, overIdx: idx });
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(idx));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (trackDrag && trackDrag.overIdx !== idx) {
                  setTrackDrag({ ...trackDrag, overIdx: idx });
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (trackDrag && trackDrag.fromIdx !== idx) {
                  reorderTracks(trackDrag.fromIdx, idx);
                }
                setTrackDrag(null);
              }}
              onDragEnd={() => setTrackDrag(null)}
              className={`flex items-center gap-1 px-1.5 border-b transition-all ${track.locked ? 'opacity-50' : ''} group ${
                trackDrag?.overIdx === idx && trackDrag.fromIdx !== idx
                  ? trackDrag.fromIdx > idx
                    ? 'border-t-2 border-t-primary border-b-border/50'
                    : 'border-b-2 border-b-primary'
                  : 'border-b-border/50'
              } ${trackDrag?.fromIdx === idx ? 'opacity-40' : ''}`}
              style={{ height: track.height, background: 'hsl(var(--editor-panel))' }}
            >
              <div className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
                <Icon name="GripVertical" size={10} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <Icon
                    name={track.type === 'video' ? 'Film' : track.type === 'audio' ? 'Music' : 'Type'}
                    size={9}
                    className={track.type === 'video' ? 'text-blue-400' : track.type === 'audio' ? 'text-green-400' : 'text-purple-400'}
                  />
                  {editingTrackId === track.id ? (
                    <input
                      autoFocus
                      value={editingTrackName}
                      onChange={(e) => setEditingTrackName(e.target.value)}
                      onBlur={() => { renameTrack(track.id, editingTrackName); setEditingTrackId(null); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { renameTrack(track.id, editingTrackName); setEditingTrackId(null); }
                        if (e.key === 'Escape') setEditingTrackId(null);
                      }}
                      className="text-[10px] font-medium bg-secondary/80 border border-border rounded px-1 py-0 w-full outline-none focus:border-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="text-[10px] font-medium truncate cursor-default"
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingTrackId(track.id); setEditingTrackName(track.name); }}
                    >{track.name}</span>
                  )}
                </div>
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
                <button onClick={() => removeTrack(track.id)} className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon name="X" size={9} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div
          ref={timelineRef}
          className={`flex-1 overflow-x-auto overflow-y-auto editor-scrollbar relative ${draggingAsset ? 'ring-1 ring-primary/30 ring-inset' : ''}`}
          style={{ background: 'hsl(var(--editor-timeline))' }}
          onWheel={handleZoomWheel}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div style={{ width: totalWidth, minWidth: '100%' }}>
            <div
              className="h-6 border-b border-border relative cursor-pointer sticky top-0 z-20"
              style={{ background: 'hsl(var(--editor-panel-header))' }}
              onClick={handleTimelineClick}
            >
              {timeMarkers.map((m, i) => (
                <div key={i} className="absolute top-0 h-full flex flex-col items-center" style={{ left: m.time * pps }}>
                  <span className="text-[8px] text-muted-foreground/60 mt-0.5 select-none">{m.label}</span>
                  <div className={`w-px flex-1 ${m.major ? 'bg-border' : 'bg-border/40'}`} />
                </div>
              ))}
            </div>

            {tracks.map(track => (
              <div
                key={track.id}
                className={`relative border-b border-border/30 transition-colors ${
                  dropTarget?.trackId === track.id ? 'bg-primary/10' : ''
                } ${!track.visible ? 'opacity-30' : ''}`}
                style={{ height: track.height }}
              >
                {track.clips.map(clip => {
                  const isSelected = selectedClipId === clip.id;
                  const isDragging = dragState?.clipId === clip.id;
                  const clipWidth = clip.duration * pps;

                  return (
                    <div
                      key={clip.id}
                      className={`absolute top-1 rounded cursor-pointer transition-shadow ${clipTypeClass(clip.type, clip.name)} ${
                        isSelected ? 'ring-2 ring-white/80 shadow-lg shadow-black/30 z-10' :
                        isDragging ? 'ring-1 ring-primary/50 shadow-md z-10 opacity-90' :
                        'hover:brightness-125 hover:shadow-md'
                      }`}
                      style={{
                        left: clip.startTime * pps,
                        width: Math.max(clipWidth, 8),
                        height: track.height - 8,
                        ...(clip.color ? { background: clip.color } : {}),
                      }}
                      onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'move', track.id)}
                      onContextMenu={(e) => handleClipContextMenu(e, clip.id)}
                    >
                      <div className="flex items-center gap-1 px-1.5 h-full overflow-hidden pointer-events-none">
                        <Icon name={clipTypeIcon(clip.type)} size={10} className="flex-shrink-0 opacity-70" />
                        {clipWidth > 50 && (
                          <span className="text-[9px] font-medium truncate text-white/90 drop-shadow-sm">{clip.name}</span>
                        )}
                        {clipWidth > 100 && clip.type === 'audio' && (
                          <div className="flex-1 flex items-center gap-px h-3 ml-1 opacity-40">
                            {Array.from({ length: Math.min(30, Math.floor(clipWidth / 4)) }, (_, i) => (
                              <div
                                key={i}
                                className="w-0.5 bg-white rounded-full"
                                style={{ height: `${20 + Math.sin(i * 0.7) * 40 + Math.random() * 40}%` }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div
                        className="absolute left-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-white/30 active:bg-white/50 rounded-l transition-colors z-20"
                        onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'resize-left', track.id)}
                      />
                      <div
                        className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-white/30 active:bg-white/50 rounded-r transition-colors z-20"
                        onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'resize-right', track.id)}
                      />
                    </div>
                  );
                })}

                {dropTarget?.trackId === track.id && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-primary z-30 pointer-events-none"
                    style={{ left: dropTarget.time * pps }}
                  >
                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-primary rounded-full" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {snapLine !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-yellow-400/60 z-20 pointer-events-none"
              style={{ left: snapLine * pps }}
            />
          )}

          <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none"
            style={{ left: currentTime * pps }}
          >
            <div
              className="w-3 h-3 -ml-1.5 cursor-pointer pointer-events-auto z-40 sticky top-0"
              onMouseDown={handlePlayheadDrag}
            >
              <svg viewBox="0 0 12 12" className="w-3 h-3">
                <polygon points="0,0 12,0 6,10" fill="hsl(var(--editor-playhead))" />
              </svg>
            </div>
            <div className="w-px h-full mx-auto" style={{ background: 'hsl(var(--editor-playhead))', marginTop: '-1px' }} />
          </div>
        </div>
      </div>

      {contextMenu && (() => {
        const ctxClip = tracks.flatMap(t => t.clips).find(c => c.id === contextMenu.clipId);
        return (
          <div
            className="fixed z-50 min-w-[170px] rounded-md border border-border shadow-xl animate-in fade-in-0 zoom-in-95"
            style={{ left: contextMenu.x, top: contextMenu.y, background: 'hsl(var(--popover))' }}
          >
            <div className="p-1">
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon name="Palette" size={11} className="text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Цвет клипа</span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#f43f5e','#14b8a6','#6366f1','#a855f7','#78716c','#475569'].map(c => (
                    <button
                      key={c}
                      onClick={() => updateClip(contextMenu.clipId, { color: c })}
                      className={`w-5 h-5 rounded-sm border transition-transform hover:scale-110 ${ctxClip?.color === c ? 'border-white ring-1 ring-white/50 scale-110' : 'border-white/10'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  <label className="flex-1 flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    <input
                      type="color"
                      value={ctxClip?.color || '#3b82f6'}
                      onChange={(e) => updateClip(contextMenu.clipId, { color: e.target.value })}
                      className="w-4 h-4 rounded border-0 cursor-pointer p-0 bg-transparent"
                    />
                    Свой цвет
                  </label>
                  {ctxClip?.color && (
                    <button onClick={() => updateClip(contextMenu.clipId, { color: undefined })} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                      Сброс
                    </button>
                  )}
                </div>
              </div>
              <div className="h-px bg-border/50 my-0.5" />
              <button onClick={() => { splitClip(contextMenu.clipId, currentTime); closeContextMenu(); }} className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-secondary/50 transition-colors">
                <Icon name="Scissors" size={11} /> Разрезать
              </button>
              <button onClick={() => { duplicateClip(contextMenu.clipId); closeContextMenu(); }} className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-secondary/50 transition-colors">
                <Icon name="Copy" size={11} /> Дублировать
              </button>
              <div className="h-px bg-border/50 my-0.5" />
              <button onClick={() => { removeClip(contextMenu.clipId); closeContextMenu(); }} className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-destructive/20 text-destructive transition-colors">
                <Icon name="Trash2" size={11} /> Удалить
              </button>
            </div>
          </div>
        );
      })()}

      {draggingAsset && (
        <div className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center">
          <div className="px-3 py-1.5 rounded-lg bg-primary/90 text-primary-foreground text-xs font-medium shadow-lg backdrop-blur-sm">
            <Icon name="Plus" size={12} className="inline mr-1" />
            Перетащите на дорожку
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelinePanel;