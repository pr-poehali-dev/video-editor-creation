import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Icon from '@/components/ui/icon';
import useEditorStore from '@/hooks/use-editor-store';
import { Slider } from '@/components/ui/slider';
import { ensureFontLoaded } from '@/lib/google-fonts';

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

interface ActiveClip {
  id: string;
  type: string;
  name: string;
  assetId?: string;
  assetUrl?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontColor?: string;
  fontWeight?: number;
  textShadow?: number;
  textStroke?: number;
  textStrokeColor?: string;
  textBg?: boolean;
  textBgColor?: string;
  textBgOpacity?: number;
  textWidth?: number;
  textAlign?: 'left' | 'center' | 'right';
  textAnimation?: 'none' | 'fade' | 'typewriter' | 'slide-up' | 'slide-down' | 'scale';
  textAnimationPerLine?: boolean;
  textAnimationDuration?: number;
  textAnimationDelay?: number;
  subtitleWords?: Array<{ word: string; start: number; end: number }>;
  subtitleMode?: string;
  subtitleBaseColor?: string;
  subtitleActiveColor?: string;
  elapsed: number;
  opacity: number;
  clipVolume: number;
  startTime: number;
  trackType: string;
  trackVisible: boolean;
  duration: number;
  trackMuted: boolean;
  trackIndex: number;
  filters: Array<{ name: string; type: string; params: Record<string, number | string | boolean> }>;
  fadeOpacity: number;
  transitionStyle: string;
  transitionFilter: string;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  fitMode: 'contain' | 'cover' | 'fill';
}

const getFilterStyle = (filters: ActiveClip['filters'], previewFilter?: string | null): string => {
  const allFilters = [...(filters || [])];
  if (previewFilter && !allFilters.some(f => f.name === previewFilter)) {
    allFilters.push({ name: previewFilter, type: previewFilter.toLowerCase(), params: { intensity: 50 } });
  }
  if (allFilters.length === 0) return 'none';
  const parts: string[] = [];
  for (const f of allFilters) {
    const intensity = typeof f.params?.intensity === 'number' ? f.params.intensity : 50;
    const norm = intensity / 100;
    switch (f.name) {
      case 'Яркость': parts.push(`brightness(${0.5 + norm})`); break;
      case 'Контраст': parts.push(`contrast(${0.5 + norm})`); break;
      case 'Насыщенность': parts.push(`saturate(${norm * 2})`); break;
      case 'Температура': parts.push(`sepia(${norm * 0.5}) saturate(${1 + norm * 0.3})`); break;
      case 'Размытие': parts.push(`blur(${norm * 8}px)`); break;
      case 'Резкость': parts.push(`contrast(${1 + norm * 0.3})`); break;
      case 'Виньетка': break;
      case 'Шум': parts.push(`contrast(${1 + norm * 0.1}) brightness(${1 - norm * 0.05})`); break;
      case 'Глитч': parts.push(`hue-rotate(${norm * 90}deg) saturate(${1.5 + norm})`); break;
      case 'Тёплый': parts.push('sepia(0.35) saturate(1.3) brightness(1.05)'); break;
      case 'Холодный': parts.push('saturate(0.9) brightness(1.05) hue-rotate(15deg)'); break;
      case 'Сепия': parts.push('sepia(0.8)'); break;
      case 'Ч/Б': parts.push('grayscale(1)'); break;
      case 'Негатив': parts.push('invert(1)'); break;
      case 'Ретро': parts.push('sepia(0.4) contrast(1.1) brightness(0.95) saturate(0.85)'); break;
      case 'Кинематограф': parts.push('contrast(1.2) saturate(0.85) brightness(0.95)'); break;
      case 'Блёклый': parts.push('contrast(0.85) brightness(1.1) saturate(0.7)'); break;
      case 'Высокий контраст': parts.push('contrast(1.5) saturate(1.2)'); break;
      case 'Мягкий свет': parts.push('brightness(1.1) contrast(0.9) saturate(1.1)'); break;
      case 'Зернистость': parts.push('contrast(1.05) brightness(0.97)'); break;
      case 'Хроматическая аберрация': parts.push('saturate(1.3) contrast(1.1)'); break;
      case 'Виньетка Pro': break;
      case 'Двойная экспозиция': parts.push('brightness(1.2) contrast(0.85)'); break;
      case 'Глитч-наложение': parts.push(`hue-rotate(${norm * 120}deg) saturate(${1.8 + norm}) contrast(1.15)`); break;
      case 'chromaKey': parts.push('saturate(1.1) contrast(1.05)'); break;
      case 'Хромакей': parts.push('saturate(1.1) contrast(1.05)'); break;
      case 'Зелёный экран': break;
      case 'Синий экран': break;
      default: parts.push(`saturate(${1 + norm * 0.3}) contrast(${1 + norm * 0.1})`); break;
    }
  }
  return parts.length > 0 ? parts.join(' ') : 'none';
};

const PreviewPanel = () => {
  const currentTime = useEditorStore(s => s.currentTime);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const togglePlay = useEditorStore(s => s.togglePlay);
  const setCurrentTime = useEditorStore(s => s.setCurrentTime);
  const project = useEditorStore(s => s.project);
  const tracks = useEditorStore(s => s.tracks);
  const assets = useEditorStore(s => s.assets);
  const previewFilter = useEditorStore(s => s.previewFilter);
  const selectedClipId = useEditorStore(s => s.selectedClipId);
  const updateClip = useEditorStore(s => s.updateClip);
  const selectClip = useEditorStore(s => s.selectClip);

  const [volume, setVolume] = useState(80);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [loadErrors, setLoadErrors] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const scrubbing = useRef(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ clipId: string; startMouseX: number; startMouseY: number; startPosX: number; startPosY: number; mode?: 'move' | 'resize'; startWidth?: number; side?: 'left' | 'right' } | null>(null);

  const assetMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assets) {
      if (a.url) map.set(a.id, a.url);
    }
    return map;
  }, [assets]);

  const activeClips = useMemo(() => {
    const clips: ActiveClip[] = [];
    for (let tIdx = 0; tIdx < tracks.length; tIdx++) {
      const track = tracks[tIdx];
      if (!track.visible) continue;
      for (const clip of track.clips) {
        if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
          const elapsed = currentTime - clip.startTime;
          const remaining = clip.duration - elapsed;
          let fadeOpacity = clip.opacity;
          if (clip.duration > 0.2 && (clip.type === 'image' || clip.type === 'video')) {
            const fadeDur = Math.min(0.5, clip.duration / 3);
            if (elapsed < fadeDur) fadeOpacity = clip.opacity * (elapsed / fadeDur);
            else if (remaining < fadeDur) fadeOpacity = clip.opacity * (remaining / fadeDur);
          }

          let transitionStyle = '';
          let transitionFilter = '';
          const tr = clip.transition;
          if (tr && tr.duration > 0 && elapsed < tr.duration) {
            const t = elapsed / tr.duration;
            const e = t * t * (3 - 2 * t);
            fadeOpacity *= t;
            switch (tr.type) {
              case 'растворение': break;
              case 'слайд влево': transitionStyle = `translateX(${(1 - e) * 100}%)`; break;
              case 'слайд вправо': transitionStyle = `translateX(${-(1 - e) * 100}%)`; break;
              case 'слайд вверх': transitionStyle = `translateY(${(1 - e) * 100}%)`; break;
              case 'слайд вниз': transitionStyle = `translateY(${-(1 - e) * 100}%)`; break;
              case 'масштаб': transitionStyle = `scale(${0.3 + 0.7 * e})`; break;
              case 'затемнение': transitionFilter = `brightness(${e})`; break;
              case 'засветка': transitionFilter = `brightness(${1 + (1 - e) * 2})`; break;
              case 'поворот': transitionStyle = `rotate(${(1 - e) * 90}deg) scale(${e})`; break;
              case 'глитч': transitionStyle = `translateX(${(1 - e) * (Math.random() > 0.5 ? 8 : -8)}px) skewX(${(1 - e) * 15}deg)`; transitionFilter = `hue-rotate(${(1 - e) * 180}deg) saturate(${1 + (1 - e) * 3})`; break;
              case 'вспышка': fadeOpacity = t < 0.3 ? t * 3 : 1; transitionFilter = `brightness(${1 + (1 - e) * 3})`; break;
              case 'размытие перехода': transitionFilter = `blur(${(1 - e) * 20}px)`; break;
              case 'пиксели': transitionStyle = `scale(${0.5 + 0.5 * e})`; transitionFilter = `contrast(${1 + (1 - e) * 0.5}) brightness(${0.8 + 0.2 * e})`; break;
              case 'волна': transitionStyle = `scaleY(${0.3 + 0.7 * e}) translateY(${(1 - e) * 30}%)`; break;
              case 'наплыв': fadeOpacity = e * clip.opacity; break;
              case 'сжатие': transitionStyle = `scaleX(${e}) scaleY(${0.5 + 0.5 * e})`; break;
              default: break;
            }
          }

          clips.push({
            id: clip.id,
            type: clip.type,
            name: clip.name,
            assetId: clip.assetId,
            assetUrl: clip.assetId ? assetMap.get(clip.assetId) : undefined,
            text: clip.text,
            fontSize: clip.fontSize,
            fontFamily: clip.fontFamily,
            fontColor: clip.fontColor,
            fontWeight: clip.fontWeight,
            textShadow: clip.textShadow,
            textStroke: clip.textStroke,
            textStrokeColor: clip.textStrokeColor,
            textBg: clip.textBg,
            textBgColor: clip.textBgColor,
            textBgOpacity: clip.textBgOpacity,
            textWidth: clip.textWidth,
            textAlign: clip.textAlign,
            textAnimation: clip.textAnimation,
            textAnimationPerLine: clip.textAnimationPerLine,
            textAnimationDuration: clip.textAnimationDuration,
            textAnimationDelay: clip.textAnimationDelay,
            subtitleWords: clip.subtitleWords,
            subtitleMode: clip.subtitleMode,
            subtitleBaseColor: clip.subtitleBaseColor,
            subtitleActiveColor: clip.subtitleActiveColor,
            elapsed,
            opacity: clip.opacity,
            clipVolume: clip.volume,
            startTime: clip.startTime,
            duration: clip.duration,
            trackType: track.type,
            trackVisible: track.visible,
            trackMuted: track.muted,
            trackIndex: tIdx,
            filters: clip.filters || [],
            fadeOpacity,
            transitionStyle,
            transitionFilter,
            positionX: clip.positionX ?? 50,
            positionY: clip.positionY ?? 50,
            scale: clip.scale ?? 100,
            rotation: clip.rotation ?? 0,
            fitMode: clip.fitMode || 'contain',
          });
        }
      }
    }
    return clips;
  }, [tracks, currentTime, assetMap]);

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
      audioRefs.current.forEach(audio => audio.pause());
      videoRefs.current.forEach(video => video.pause());
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

  const unlockSound = useCallback(() => {
    if (soundUnlocked) return;
    setSoundUnlocked(true);
    videoRefs.current.forEach(v => {
      if (!v.dataset.trackMuted) {
        v.muted = false;
        v.play().catch(() => {});
      }
    });
    const globalVol = volume / 100;
    for (const clip of activeClips) {
      if (clip.type === 'audio' && !clip.trackMuted && clip.assetUrl) {
        let audio = audioRefs.current.get(clip.id);
        if (!audio) {
          audio = new Audio(clip.assetUrl);
          audio.loop = false;
          audioRefs.current.set(clip.id, audio);
        }
        const clipOffset = currentTime - clip.startTime;
        audio.currentTime = clipOffset;
        audio.volume = Math.min(1, clip.clipVolume * globalVol);
        audio.play().catch(() => {});
      }
    }
  }, [soundUnlocked, activeClips, currentTime, volume]);

  useEffect(() => {
    const globalVol = volume / 100;
    const activeAudioIds = new Set<string>();
    const activeVideoIds = new Set<string>();

    for (const clip of activeClips) {
      if (clip.type === 'audio' && !clip.trackMuted && clip.assetUrl && soundUnlocked) {
        activeAudioIds.add(clip.id);
        let audio = audioRefs.current.get(clip.id);
        if (!audio) {
          audio = new Audio(clip.assetUrl);
          audio.loop = false;
          audioRefs.current.set(clip.id, audio);
        }
        const clipOffset = currentTime - clip.startTime;
        if (Math.abs(audio.currentTime - clipOffset) > 0.5) {
          audio.currentTime = clipOffset;
        }
        audio.volume = Math.min(1, clip.clipVolume * globalVol);
        if (isPlaying && audio.paused) {
          audio.play().catch(() => {});
        }
      }

      if (clip.type === 'video' && clip.assetUrl) {
        activeVideoIds.add(clip.id);
        const video = videoRefs.current.get(clip.id);
        if (video) {
          video.dataset.trackMuted = clip.trackMuted ? '1' : '';
          const clipOffset = currentTime - clip.startTime;
          if (Math.abs(video.currentTime - clipOffset) > 0.5) {
            video.currentTime = clipOffset;
          }
          const wantMuted = clip.trackMuted || !soundUnlocked;
          video.muted = wantMuted;
          video.volume = wantMuted ? 0 : Math.min(1, clip.clipVolume * globalVol);
          if (isPlaying && video.paused) {
            video.play().catch(() => {});
          }
        }
      }
    }

    audioRefs.current.forEach((audio, id) => {
      if (!activeAudioIds.has(id)) {
        audio.pause();
        audioRefs.current.delete(id);
      }
    });

    videoRefs.current.forEach((video, id) => {
      if (!activeVideoIds.has(id)) {
        video.pause();
      }
    });
  }, [activeClips, isPlaying, currentTime, volume, soundUnlocked]);

  useEffect(() => {
    return () => {
      audioRefs.current.forEach(a => { a.pause(); a.src = ''; });
      audioRefs.current.clear();
    };
  }, []);

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

  const handleProgressSeek = useCallback((clientX: number) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setCurrentTime(pct * maxTime);
  }, [maxTime, setCurrentTime]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    scrubbing.current = true;
    handleProgressSeek(e.clientX);

    const onMove = (ev: MouseEvent) => {
      if (scrubbing.current) handleProgressSeek(ev.clientX);
    };
    const onUp = () => {
      scrubbing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [handleProgressSeek]);

  const handleDragStart = useCallback((clipId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = activeClips.find(c => c.id === clipId);
    if (!clip || (clip.type !== 'image' && clip.type !== 'video' && clip.type !== 'text')) return;
    selectClip(clipId);
    dragRef.current = {
      clipId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: clip.positionX ?? 50,
      startPosY: clip.positionY ?? 50,
      mode: 'move',
    };
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ev.clientX - dragRef.current.startMouseX;
      const dy = ev.clientY - dragRef.current.startMouseY;
      if (dragRef.current.mode === 'resize') {
        const dxPct = (dx / rect.width) * 100;
        const startW = dragRef.current.startWidth ?? 50;
        const side = dragRef.current.side;
        const delta = side === 'left' ? -dxPct * 2 : dxPct * 2;
        const newW = Math.max(10, Math.min(100, Math.round(startW + delta)));
        updateClip(dragRef.current.clipId, { textWidth: newW });
      } else {
        const newX = dragRef.current.startPosX + (dx / rect.width) * 100;
        const newY = dragRef.current.startPosY + (dy / rect.height) * 100;
        updateClip(dragRef.current.clipId, {
          positionX: Math.round(newX * 10) / 10,
          positionY: Math.round(newY * 10) / 10,
        });
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [activeClips, selectClip, updateClip]);

  const handleResizeStart = useCallback((clipId: string, side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = activeClips.find(c => c.id === clipId);
    if (!clip || clip.type !== 'text') return;
    selectClip(clipId);
    dragRef.current = {
      clipId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: clip.positionX ?? 50,
      startPosY: clip.positionY ?? 50,
      mode: 'resize',
      startWidth: clip.textWidth ?? 50,
      side,
    };
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ev.clientX - dragRef.current.startMouseX;
      const dxPct = (dx / rect.width) * 100;
      const startW = dragRef.current.startWidth ?? 50;
      const delta = dragRef.current.side === 'left' ? -dxPct * 2 : dxPct * 2;
      const newW = Math.max(10, Math.min(100, Math.round(startW + delta)));
      updateClip(dragRef.current.clipId, { textWidth: newW });
    };

    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [activeClips, selectClip, updateClip]);

  const totalTracks = tracks.length;

  const renderMediaClip = (clip: ActiveClip, _i: number) => {
    const hasUrl = !!clip.assetUrl;
    const hasChromaKey = clip.filters?.some(f => f.type === 'chromaKey');
    const layerZ = totalTracks - clip.trackIndex;

    if (clip.type === 'image' && hasUrl) {
      if (loadErrors.has(clip.id)) {
        return (
          <div key={clip.id} className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: layerZ, background: '#0a0a0f' }}>
            <Icon name="ImageOff" size={28} className="text-red-400 mb-2" />
            <span className="text-[11px] text-red-400 font-medium">Не удалось загрузить</span>
            <span className="text-[9px] text-muted-foreground mt-0.5">{clip.name}</span>
          </div>
        );
      }
      const clipPreview = selectedClipId === clip.id ? previewFilter : null;
      const isBottomLayer = clip.trackIndex === totalTracks - 1;
      const hasCustomTransform = clip.positionX !== 50 || clip.positionY !== 50 || clip.scale !== 100 || clip.rotation !== 0;
      const clipTransform = hasCustomTransform
        ? `translate(${clip.positionX - 50}%, ${clip.positionY - 50}%) scale(${clip.scale / 100}) rotate(${clip.rotation}deg)`
        : '';
      const combinedTransform = [clip.transitionStyle, clipTransform].filter(Boolean).join(' ') || undefined;
      const baseFilter = getFilterStyle(clip.filters, clipPreview);
      const combinedFilter = [baseFilter !== 'none' ? baseFilter : '', clip.transitionFilter].filter(Boolean).join(' ') || undefined;
      const fitClass = clip.fitMode === 'cover' ? 'object-cover' : clip.fitMode === 'fill' ? 'object-fill' : 'object-contain';
      const isSelected = selectedClipId === clip.id;
      return (
        <div
          key={clip.id}
          className="absolute inset-0"
          style={{ opacity: clip.fadeOpacity, zIndex: layerZ, filter: combinedFilter, transform: combinedTransform }}
        >
          <img
            src={clip.assetUrl}
            alt={clip.name}
            className={`w-full h-full ${fitClass}`}
            style={{ background: isBottomLayer ? '#0a0a0f' : 'transparent' }}
            draggable={false}
            onError={() => setLoadErrors(prev => new Set(prev).add(clip.id))}
          />
          <div
            className="absolute inset-0 cursor-move"
            style={{
              outline: isSelected ? '2px solid hsl(var(--primary))' : 'none',
              outlineOffset: '-2px',
            }}
            onMouseDown={(e) => handleDragStart(clip.id, e)}
          >
            {isSelected && (
              <>
                <div className="absolute top-0 left-0 w-2.5 h-2.5 bg-primary rounded-br-sm" />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-primary rounded-bl-sm" />
                <div className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-primary rounded-tr-sm" />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary rounded-tl-sm" />
              </>
            )}
            {hasChromaKey && (
              <div
                className="absolute inset-1 pointer-events-none rounded"
                style={{ border: '2px dashed #00ff00', boxShadow: 'inset 0 0 12px rgba(0,255,0,0.15)' }}
              />
            )}
          </div>
        </div>
      );
    }

    if (clip.type === 'video' && hasUrl) {
      if (loadErrors.has(clip.id)) {
        return (
          <div key={clip.id} className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: layerZ, background: isBottomLayer ? '#0a0a0f' : 'transparent' }}>
            <Icon name="AlertTriangle" size={28} className="text-red-400 mb-2" />
            <span className="text-[11px] text-red-400 font-medium">Не удалось загрузить видео</span>
            <span className="text-[9px] text-muted-foreground mt-0.5">{clip.name}</span>
          </div>
        );
      }
      const clipPreview = selectedClipId === clip.id ? previewFilter : null;
      const isBottomLayer = clip.trackIndex === totalTracks - 1;
      const hasCustomTransform = clip.positionX !== 50 || clip.positionY !== 50 || clip.scale !== 100 || clip.rotation !== 0;
      const clipTransform = hasCustomTransform
        ? `translate(${clip.positionX - 50}%, ${clip.positionY - 50}%) scale(${clip.scale / 100}) rotate(${clip.rotation}deg)`
        : '';
      const combinedTransform = [clip.transitionStyle, clipTransform].filter(Boolean).join(' ') || undefined;
      const baseFilter = getFilterStyle(clip.filters, clipPreview);
      const combinedFilter = [baseFilter !== 'none' ? baseFilter : '', clip.transitionFilter].filter(Boolean).join(' ') || undefined;
      const fitClass = clip.fitMode === 'cover' ? 'object-cover' : clip.fitMode === 'fill' ? 'object-fill' : 'object-contain';
      const isSelected = selectedClipId === clip.id;
      return (
        <div
          key={clip.id}
          className="absolute inset-0"
          style={{ opacity: clip.fadeOpacity, zIndex: layerZ, filter: combinedFilter, transform: combinedTransform }}
        >
          <video
            ref={(el) => {
              if (el) {
                videoRefs.current.set(clip.id, el);
                el.muted = clip.trackMuted || !soundUnlocked;
              } else {
                videoRefs.current.delete(clip.id);
              }
            }}
            src={clip.assetUrl}
            className={`w-full h-full ${fitClass}`}
            style={{ background: isBottomLayer ? '#0a0a0f' : 'transparent' }}
            playsInline
            draggable={false}
            onError={() => setLoadErrors(prev => new Set(prev).add(clip.id))}
          />
          <div
            className="absolute inset-0 cursor-move"
            style={{
              outline: isSelected ? '2px solid hsl(var(--primary))' : 'none',
              outlineOffset: '-2px',
            }}
            onMouseDown={(e) => handleDragStart(clip.id, e)}
          >
            {isSelected && (
              <>
                <div className="absolute top-0 left-0 w-2.5 h-2.5 bg-primary rounded-br-sm" />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-primary rounded-bl-sm" />
                <div className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-primary rounded-tr-sm" />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary rounded-tl-sm" />
              </>
            )}
            {hasChromaKey && (
              <div
                className="absolute inset-1 pointer-events-none rounded"
                style={{ border: '2px dashed #00ff00', boxShadow: 'inset 0 0 12px rgba(0,255,0,0.15)' }}
              />
            )}
          </div>
        </div>
      );
    }

    const isMissing = clip.assetId && !clip.assetUrl;
    return (
      <div
        key={clip.id}
        className="absolute inset-0 flex items-center justify-center"
        style={{ opacity: clip.opacity, zIndex: layerZ }}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: isMissing ? 'rgba(220,38,38,0.15)' : (clipColors[clip.type] || 'transparent') }}
        >
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <Icon name={isMissing ? 'FileWarning' : clip.type === 'video' ? 'Film' : 'Image'} size={24} className={isMissing ? 'text-red-400' : 'text-white/60'} />
            </div>
            <span className={`text-[11px] font-medium ${isMissing ? 'text-red-400' : 'text-white/70'}`}>{isMissing ? 'Файл не найден' : clip.name}</span>
            {isMissing && <span className="text-[9px] text-muted-foreground">{clip.name}</span>}
          </div>
        </div>
      </div>
    );
  };

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
          ref={canvasRef}
          className="relative w-full rounded overflow-hidden"
          style={{ aspectRatio: '16/9', maxHeight: '100%', background: '#0a0a0f' }}
        >
          {hasVisual ? (
            <div className="absolute inset-0">
              {videoClips.map((clip, i) => renderMediaClip(clip, i))}
              {videoClips.some(c => c.filters.some(f => f.name === 'Виньетка')) && (
                <div className="absolute inset-0 pointer-events-none z-[99]" style={{
                  background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)'
                }} />
              )}
              {textClips.map((clip, i) => {
                const shadow = clip.textShadow ?? 8;
                const stroke = clip.textStroke ?? 0;
                const strokeColor = clip.textStrokeColor || '#000000';
                const weight = clip.fontWeight || 600;
                const fontSize = Math.max(12, (clip.fontSize || 48) * 0.35);
                const shadowStyle = shadow > 0 ? `0 2px ${shadow}px rgba(0,0,0,0.7)` : 'none';
                const fontFamily = ensureFontLoaded(clip.fontFamily);
                const anim = clip.textAnimation || 'none';
                const perLine = clip.textAnimationPerLine ?? false;
                const animDur = clip.textAnimationDuration ?? 0.5;
                const animDelay = clip.textAnimationDelay ?? 0.3;
                const clipElapsed = clip.elapsed;
                const fullText = clip.text || clip.name;
                const hasSubWords = clip.subtitleWords && clip.subtitleWords.length > 0;
                const lines = perLine ? fullText.split('\n').filter(l => l.length > 0) : [fullText];
                if (lines.length === 0) lines.push(fullText);

                const getLineStyle = (lineIdx: number): React.CSSProperties => {
                  if (anim === 'none') return { opacity: clip.opacity };
                  const lineStart = lineIdx * animDelay;
                  const progress = Math.max(0, Math.min(1, (clipElapsed - lineStart) / animDur));
                  const ease = progress * progress * (3 - 2 * progress);
                  if (progress <= 0) return { opacity: 0 };
                  switch (anim) {
                    case 'fade':
                      return { opacity: ease * clip.opacity, transition: 'none' };
                    case 'typewriter':
                      return { opacity: clip.opacity, clipPath: `inset(0 ${(1 - ease) * 100}% 0 0)`, transition: 'none' };
                    case 'slide-up':
                      return { opacity: ease * clip.opacity, transform: `translateY(${(1 - ease) * 20}px)`, transition: 'none' };
                    case 'slide-down':
                      return { opacity: ease * clip.opacity, transform: `translateY(${-(1 - ease) * 20}px)`, transition: 'none' };
                    case 'scale':
                      return { opacity: ease * clip.opacity, transform: `scale(${0.5 + 0.5 * ease})`, transition: 'none' };
                    default:
                      return { opacity: clip.opacity };
                  }
                };

                const posX = clip.positionX ?? 50;
                const posY = clip.positionY ?? 50;
                const textW = clip.textWidth;
                const textAl = clip.textAlign || 'center';

                return (
                  <div
                    key={clip.id}
                    className={`absolute cursor-grab active:cursor-grabbing ${selectedClipId === clip.id ? 'ring-1 ring-purple-400/60 ring-offset-0' : ''}`}
                    style={{
                      zIndex: 100 + (totalTracks - clip.trackIndex),
                      left: `${posX}%`,
                      top: `${posY}%`,
                      transform: 'translate(-50%, -50%)',
                      width: textW ? `${textW}%` : undefined,
                      maxWidth: '96%',
                      textAlign: textAl,
                    }}
                    onMouseDown={e => handleDragStart(clip.id, e)}
                  >
                    {selectedClipId === clip.id && (
                      <>
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 group"
                          style={{ transform: 'translateX(-100%)' }}
                          onMouseDown={e => handleResizeStart(clip.id, 'left', e)}
                        >
                          <div className="absolute inset-y-1 left-0 w-1 rounded-full bg-cyan-400/70 group-hover:bg-cyan-400 transition-colors" />
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 group"
                          style={{ transform: 'translateX(100%)' }}
                          onMouseDown={e => handleResizeStart(clip.id, 'right', e)}
                        >
                          <div className="absolute inset-y-1 right-0 w-1 rounded-full bg-cyan-400/70 group-hover:bg-cyan-400 transition-colors" />
                        </div>
                      </>
                    )}
                    {perLine && anim !== 'none' ? (
                      <div className="flex flex-col gap-0.5 relative" style={{ alignItems: textAl === 'left' ? 'flex-start' : textAl === 'right' ? 'flex-end' : 'center' }}>
                        {clip.textBg && (
                          <div
                            className="absolute inset-0 rounded px-3 py-1 -m-1"
                            style={{
                              backgroundColor: clip.textBgColor || '#000000',
                              opacity: clip.textBgOpacity ?? 0.6,
                            }}
                          />
                        )}
                        {lines.map((line, li) => (
                          <span
                            key={li}
                            style={{
                              fontSize,
                              fontFamily,
                              color: clip.fontColor || '#ffffff',
                              fontWeight: weight,
                              textShadow: shadowStyle,
                              WebkitTextStroke: stroke > 0 ? `${stroke}px ${strokeColor}` : undefined,
                              paintOrder: stroke > 0 ? 'stroke fill' : undefined,
                              position: 'relative',
                              display: 'block',
                              whiteSpace: textW ? 'pre-wrap' : 'pre',
                              wordBreak: textW ? 'break-word' : undefined,
                              ...getLineStyle(li),
                            }}
                          >
                            {line}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <>
                        {clip.textBg && (
                          <div
                            className="absolute rounded px-3 py-1"
                            style={{
                              backgroundColor: clip.textBgColor || '#000000',
                              opacity: clip.textBgOpacity ?? 0.6,
                            }}
                          >
                            <span style={{ fontSize, visibility: 'hidden', fontWeight: weight, fontFamily }}>{fullText}</span>
                          </div>
                        )}
                        {hasSubWords ? (() => {
                          const subMode = clip.subtitleMode || 'highlight';
                          const baseColor = clip.subtitleBaseColor || clip.fontColor || '#ffffff';
                          const activeColor = clip.subtitleActiveColor || '#FFD700';
                          return (
                            <span
                              style={{
                                fontSize,
                                fontFamily,
                                fontWeight: weight,
                                textShadow: shadowStyle,
                                WebkitTextStroke: stroke > 0 ? `${stroke}px ${strokeColor}` : undefined,
                                paintOrder: stroke > 0 ? 'stroke fill' : undefined,
                                position: 'relative',
                                whiteSpace: 'pre-wrap',
                                wordBreak: textW ? 'break-word' : undefined,
                                ...getLineStyle(0),
                              }}
                            >
                              {clip.subtitleWords!.map((sw, wi) => {
                                const isActive = clipElapsed >= sw.start && clipElapsed < sw.end;
                                const isPast = clipElapsed >= sw.end;
                                const isFuture = clipElapsed < sw.start;
                                const wordProgress = isActive ? Math.min(1, (clipElapsed - sw.start) / Math.max(0.05, sw.end - sw.start)) : 0;
                                if (subMode === 'reveal' && isFuture) {
                                  return (
                                    <span
                                      key={wi}
                                      style={{
                                        display: 'inline-block',
                                        marginRight: '0.2em',
                                        opacity: 0,
                                      }}
                                    >
                                      {sw.word}
                                    </span>
                                  );
                                }
                                return (
                                  <span
                                    key={wi}
                                    style={{
                                      color: isActive || isPast ? activeColor : baseColor,
                                      transform: isActive ? `scale(${1 + wordProgress * 0.08})` : undefined,
                                      display: 'inline-block',
                                      transition: 'color 0.1s, transform 0.1s',
                                      marginRight: '0.2em',
                                      ...(subMode === 'reveal' && isActive ? { opacity: 0.5 + wordProgress * 0.5 } : {}),
                                    }}
                                  >
                                    {sw.word}
                                  </span>
                                );
                              })}
                            </span>
                          );
                        })() : (
                          <span
                            style={{
                              fontSize,
                              fontFamily,
                              color: clip.fontColor || '#ffffff',
                              fontWeight: weight,
                              textShadow: shadowStyle,
                              WebkitTextStroke: stroke > 0 ? `${stroke}px ${strokeColor}` : undefined,
                              paintOrder: stroke > 0 ? 'stroke fill' : undefined,
                              position: 'relative',
                              whiteSpace: 'pre-wrap',
                              wordBreak: textW ? 'break-word' : undefined,
                              ...getLineStyle(0),
                            }}
                          >
                            {fullText}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
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

          {isDragging && selectedClipId && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[200] bg-black/80 text-white text-[10px] font-mono px-2 py-1 rounded pointer-events-none">
              {(() => {
                const c = activeClips.find(a => a.id === selectedClipId);
                if (!c) return '';
                if (dragRef.current?.mode === 'resize') return `Ширина: ${c.textWidth ?? 'Авто'}%`;
                return `X: ${(c.positionX ?? 50).toFixed(1)}  Y: ${(c.positionY ?? 50).toFixed(1)}`;
              })()}
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

          {!soundUnlocked && tracks.some(t => t.clips.some(c => c.type === 'video' || c.type === 'audio')) && (
            <button
              onClick={unlockSound}
              className="absolute top-2 right-2 z-50 flex items-center gap-1.5 bg-yellow-500/90 hover:bg-yellow-500 text-black text-[10px] font-semibold px-2.5 py-1 rounded-md cursor-pointer transition-colors animate-pulse"
            >
              <Icon name="VolumeX" size={12} />
              Включить звук
            </button>
          )}

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
          ref={progressBarRef}
          className="h-2 rounded-full cursor-pointer group relative"
          style={{ background: 'hsl(var(--editor-bg))' }}
          onMouseDown={handleProgressMouseDown}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${progressPercent}%`, background: 'hsl(var(--primary))' }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progressPercent}% - 6px)` }}
          />
        </div>
      </div>

      <div className="px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <button onClick={jumpStart} className="nle-button"><Icon name="SkipBack" size={12} /></button>
          <button onClick={frameBack} className="nle-button"><Icon name="ChevronLeft" size={12} /></button>
          <button onClick={skipBack} className="nle-button"><Icon name="Rewind" size={12} /></button>
          <button onClick={() => { unlockSound(); togglePlay(); }} className={`nle-button ${isPlaying ? 'active' : ''}`} style={{ padding: '4px 10px' }}>
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