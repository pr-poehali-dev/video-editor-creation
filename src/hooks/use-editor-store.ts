import { create } from 'zustand';
import { EditorState, Track, TimelineClip, MediaAsset, MediaType, ExportSettings } from '@/types/editor';

let clipCounter = 0;
const genId = () => `clip_${Date.now()}_${++clipCounter}`;
const genTrackId = () => `track_${Date.now()}_${++clipCounter}`;
const genAssetId = () => `asset_${Date.now()}_${++clipCounter}`;

interface EditorStore extends EditorState {
  addTrack: (type: MediaType) => void;
  removeTrack: (trackId: string) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  toggleTrackVisibility: (trackId: string) => void;
  addClip: (trackId: string, clip: Partial<TimelineClip>) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  selectClip: (clipId: string | null) => void;
  addAsset: (asset: Omit<MediaAsset, 'id'>) => void;
  removeAsset: (assetId: string) => void;
  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  setZoom: (zoom: number) => void;
  toggleSnap: () => void;
  setActivePanel: (panel: string) => void;
  setExportSettings: (settings: Partial<ExportSettings>) => void;
  moveClip: (clipId: string, newStartTime: number) => void;
  splitClip: (clipId: string, splitTime: number) => void;
  duplicateClip: (clipId: string) => void;
}

const defaultTracks: Track[] = [
  { id: 'v3', name: 'Видео 3', type: 'video', muted: false, locked: false, visible: true, height: 60, clips: [] },
  { id: 'v2', name: 'Видео 2', type: 'video', muted: false, locked: false, visible: true, height: 60, clips: [] },
  { id: 'v1', name: 'Видео 1', type: 'video', muted: false, locked: false, visible: true, height: 60, clips: [
    { id: 'demo1', type: 'video', trackId: 'v1', startTime: 0, duration: 5, offset: 0, name: 'Интро', opacity: 1, volume: 1, speed: 1, filters: [], keyframes: [] },
    { id: 'demo2', type: 'video', trackId: 'v1', startTime: 5.5, duration: 8, offset: 0, name: 'Основная сцена', opacity: 1, volume: 1, speed: 1, filters: [], keyframes: [] },
    { id: 'demo3', type: 'image', trackId: 'v1', startTime: 14, duration: 3, offset: 0, name: 'Фото вставка', opacity: 1, volume: 1, speed: 1, filters: [], keyframes: [] },
  ]},
  { id: 't1', name: 'Текст', type: 'text', muted: false, locked: false, visible: true, height: 40, clips: [
    { id: 'demo4', type: 'text', trackId: 't1', startTime: 1, duration: 4, offset: 0, name: 'Заголовок', text: 'Добро пожаловать', fontSize: 48, fontColor: '#ffffff', opacity: 1, volume: 1, speed: 1, filters: [], keyframes: [] },
  ]},
  { id: 'a1', name: 'Аудио 1', type: 'audio', muted: false, locked: false, visible: true, height: 50, clips: [
    { id: 'demo5', type: 'audio', trackId: 'a1', startTime: 0, duration: 20, offset: 0, name: 'Фоновая музыка', opacity: 1, volume: 0.7, speed: 1, filters: [], keyframes: [] },
  ]},
  { id: 'a2', name: 'Аудио 2', type: 'audio', muted: false, locked: false, visible: true, height: 50, clips: [] },
];

const useEditorStore = create<EditorStore>((set, get) => ({
  project: { name: 'Новый проект', width: 1920, height: 1080, fps: 30, duration: 30 },
  tracks: defaultTracks,
  assets: [
    { id: 'a1', name: 'intro.mp4', type: 'video', url: '', duration: 5, size: 15400000 },
    { id: 'a2', name: 'scene_main.mp4', type: 'video', url: '', duration: 8, size: 42000000 },
    { id: 'a3', name: 'background.mp3', type: 'audio', url: '', duration: 180, size: 5200000 },
    { id: 'a4', name: 'photo_01.jpg', type: 'image', url: '', duration: 0, size: 2100000, width: 1920, height: 1080 },
    { id: 'a5', name: 'overlay.png', type: 'image', url: '', duration: 0, size: 890000, width: 800, height: 600 },
  ],
  selectedClipId: null,
  selectedTrackId: null,
  currentTime: 0,
  isPlaying: false,
  zoom: 1,
  snapEnabled: true,
  activePanel: 'media',
  exportSettings: { format: 'mp4', quality: 'high', resolution: '1920x1080', fps: 30, codec: 'H.264', bitrate: 8000 },

  addTrack: (type) => set((state) => ({
    tracks: [...state.tracks, {
      id: genTrackId(),
      name: `${type === 'video' ? 'Видео' : type === 'audio' ? 'Аудио' : 'Текст'} ${state.tracks.filter(t => t.type === type).length + 1}`,
      type,
      muted: false,
      locked: false,
      visible: true,
      height: type === 'audio' ? 50 : type === 'text' ? 40 : 60,
      clips: [],
    }],
  })),

  removeTrack: (trackId) => set((state) => ({
    tracks: state.tracks.filter(t => t.id !== trackId),
  })),

  toggleTrackMute: (trackId) => set((state) => ({
    tracks: state.tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t),
  })),

  toggleTrackLock: (trackId) => set((state) => ({
    tracks: state.tracks.map(t => t.id === trackId ? { ...t, locked: !t.locked } : t),
  })),

  toggleTrackVisibility: (trackId) => set((state) => ({
    tracks: state.tracks.map(t => t.id === trackId ? { ...t, visible: !t.visible } : t),
  })),

  addClip: (trackId, clip) => set((state) => ({
    tracks: state.tracks.map(t => t.id === trackId ? {
      ...t,
      clips: [...t.clips, {
        id: genId(),
        type: t.type,
        trackId,
        startTime: clip.startTime || 0,
        duration: clip.duration || 5,
        offset: 0,
        name: clip.name || 'Новый клип',
        opacity: 1,
        volume: 1,
        speed: 1,
        filters: [],
        keyframes: [],
        ...clip,
      } as TimelineClip],
    } : t),
  })),

  removeClip: (clipId) => set((state) => ({
    tracks: state.tracks.map(t => ({
      ...t,
      clips: t.clips.filter(c => c.id !== clipId),
    })),
    selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
  })),

  updateClip: (clipId, updates) => set((state) => ({
    tracks: state.tracks.map(t => ({
      ...t,
      clips: t.clips.map(c => c.id === clipId ? { ...c, ...updates } : c),
    })),
  })),

  selectClip: (clipId) => set({ selectedClipId: clipId }),

  addAsset: (asset) => set((state) => ({
    assets: [...state.assets, { ...asset, id: genAssetId() }],
  })),

  removeAsset: (assetId) => set((state) => ({
    assets: state.assets.filter(a => a.id !== assetId),
  })),

  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),

  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

  setActivePanel: (panel) => set({ activePanel: panel }),

  setExportSettings: (settings) => set((state) => ({
    exportSettings: { ...state.exportSettings, ...settings },
  })),

  moveClip: (clipId, newStartTime) => set((state) => ({
    tracks: state.tracks.map(t => ({
      ...t,
      clips: t.clips.map(c => c.id === clipId ? { ...c, startTime: Math.max(0, newStartTime) } : c),
    })),
  })),

  splitClip: (clipId, splitTime) => set((state) => {
    const newTracks = state.tracks.map(t => {
      const clipIndex = t.clips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) return t;
      const clip = t.clips[clipIndex];
      const relativeTime = splitTime - clip.startTime;
      if (relativeTime <= 0 || relativeTime >= clip.duration) return t;
      const clip1 = { ...clip, duration: relativeTime };
      const clip2 = { ...clip, id: genId(), startTime: splitTime, duration: clip.duration - relativeTime, offset: clip.offset + relativeTime, name: clip.name + ' (2)' };
      const newClips = [...t.clips];
      newClips.splice(clipIndex, 1, clip1, clip2);
      return { ...t, clips: newClips };
    });
    return { tracks: newTracks };
  }),

  duplicateClip: (clipId) => set((state) => ({
    tracks: state.tracks.map(t => {
      const clip = t.clips.find(c => c.id === clipId);
      if (!clip) return t;
      const newClip = { ...clip, id: genId(), startTime: clip.startTime + clip.duration + 0.1, name: clip.name + ' (копия)' };
      return { ...t, clips: [...t.clips, newClip] };
    }),
  })),
}));

export default useEditorStore;
