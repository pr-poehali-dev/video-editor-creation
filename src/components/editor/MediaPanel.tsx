import { useRef, useCallback, useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import useEditorStore from '@/hooks/use-editor-store';
import useAuth from '@/hooks/use-auth';
import { media as mediaApi, shop } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ShopPurchase {
  slug: string;
  name: string;
  category: string;
  icon: string;
  features: string[];
  purchased_at: string;
}

const baseEffects = [
  { category: 'Цветокоррекция', items: [
    { name: 'Яркость', icon: 'Sun', free: true },
    { name: 'Контраст', icon: 'Contrast', free: true },
    { name: 'Насыщенность', icon: 'Palette', free: true },
  ]},
  { category: 'Стилизация', items: [
    { name: 'Размытие', icon: 'Droplets', free: true },
    { name: 'Виньетка', icon: 'Circle', free: true },
  ]},
];

const baseTransitions = [
  { name: 'Растворение', icon: 'Blend', duration: '0.5с', free: true },
  { name: 'Слайд влево', icon: 'ArrowLeft', duration: '0.5с', free: true },
  { name: 'Слайд вправо', icon: 'ArrowRight', duration: '0.5с', free: true },
  { name: 'Масштаб', icon: 'ZoomIn', duration: '0.7с', free: true },
];

const baseTextPresets = [
  { name: 'Заголовок', icon: 'Type', desc: 'Крупный текст по центру', free: true },
  { name: 'Субтитры', icon: 'Subtitles', desc: 'Текст внизу экрана', free: true },
  { name: 'Нижняя третья', icon: 'PanelBottom', desc: 'Плашка с именем', free: true },
];

const formatSize = (bytes: number): string => {
  if (bytes > 1e9) return (bytes / 1e9).toFixed(1) + ' ГБ';
  if (bytes > 1e6) return (bytes / 1e6).toFixed(1) + ' МБ';
  if (bytes > 1e3) return (bytes / 1e3).toFixed(1) + ' КБ';
  return bytes + ' Б';
};

const formatDuration = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const typeIcon = (type: string) => {
  switch (type) {
    case 'video': return 'Film';
    case 'audio': return 'Music';
    case 'image': return 'Image';
    default: return 'File';
  }
};

const typeColor = (type: string) => {
  switch (type) {
    case 'video': return 'text-blue-400';
    case 'audio': return 'text-green-400';
    case 'image': return 'text-orange-400';
    default: return 'text-muted-foreground';
  }
};

const getMediaDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      resolve(0);
      return;
    }
    const url = URL.createObjectURL(file);
    const el = file.type.startsWith('audio/') ? new Audio() : document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const dur = isFinite(el.duration) ? el.duration : 10;
      URL.revokeObjectURL(url);
      resolve(dur);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(10);
    };
    el.src = url;
  });
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const MediaPanel = () => {
  const { assets, addAsset, removeAsset, setDraggingAsset, addClipFromAsset, getCompatibleTrack, currentTime, setCurrentTime, project, addClip, selectedClipId, updateClip, setPreviewFilter } = useEditorStore();
  const { isAuthenticated } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [loadedProjectId, setLoadedProjectId] = useState<number | null>(null);
  const [purchases, setPurchases] = useState<ShopPurchase[]>([]);
  const [purchasesLoaded, setPurchasesLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !project.id) return;
    if (loadedProjectId === project.id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mediaApi.list(project.id).then((data: any) => {
      if (data.files) {
        for (const f of data.files) {
          const existing = useEditorStore.getState().assets;
          if (existing.some(a => a.id === `server_${f.id}`)) continue;
          addAsset({
            name: f.file_name,
            type: f.file_type,
            url: f.cdn_url,
            duration: f.duration || 0,
            size: f.file_size,
            width: f.width,
            height: f.height,
          });
          const lastAsset = useEditorStore.getState().assets;
          const added = lastAsset[lastAsset.length - 1];
          if (added) {
            useEditorStore.setState((s) => ({
              assets: s.assets.map(a => a.id === added.id ? { ...a, id: `server_${f.id}` } : a)
            }));
          }
        }
      }
      setLoadedProjectId(project.id!);
    }).catch(() => setLoadedProjectId(project.id!));
  }, [isAuthenticated, project.id, loadedProjectId, addAsset]);

  useEffect(() => {
    if (!isAuthenticated || purchasesLoaded) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shop.myItems().then((data: any) => {
      if (data.items) {
        setPurchases(data.items.map((i: ShopPurchase) => ({
          slug: i.slug,
          name: i.name,
          category: i.category,
          icon: i.icon,
          features: i.features || [],
          purchased_at: i.purchased_at,
        })));
      }
      setPurchasesLoaded(true);
    }).catch(() => setPurchasesLoaded(true));
  }, [isAuthenticated, purchasesLoaded]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    let type: 'video' | 'audio' | 'image' = 'video';
    if (file.type.startsWith('audio/')) type = 'audio';
    else if (file.type.startsWith('image/')) type = 'image';

    const duration = await getMediaDuration(file);
    const localUrl = URL.createObjectURL(file);

    const asset = addAsset({
      name: file.name,
      type,
      url: localUrl,
      duration,
      size: file.size,
    });

    if (!isAuthenticated) return;

    setUploading(prev => [...prev, asset.id]);
    try {
      const b64 = await fileToBase64(file);
      const pid = useEditorStore.getState().project.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await mediaApi.upload({
        file_data: b64,
        file_name: file.name,
        mime_type: file.type,
        duration,
        project_id: pid,
      });
      if (res.file?.cdn_url) {
        useEditorStore.setState((s) => ({
          assets: s.assets.map(a => a.id === asset.id ? { ...a, url: res.file.cdn_url, id: `server_${res.file.id}` } : a)
        }));
      }
    } catch (e) {
      console.error('Upload failed:', e);
    } finally {
      setUploading(prev => prev.filter(id => id !== asset.id));
    }
  }, [addAsset, isAuthenticated]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
    e.target.value = '';
  }, [uploadFile]);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (!files.length) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('video/') && !file.type.startsWith('audio/') && !file.type.startsWith('image/')) continue;
      await uploadFile(file);
    }
  }, [uploadFile]);

  const handleDoubleClick = useCallback((asset: typeof assets[0]) => {
    const trackId = getCompatibleTrack(asset.type);
    addClipFromAsset(asset, trackId, currentTime);
    setCurrentTime(currentTime);
  }, [addClipFromAsset, getCompatibleTrack, currentTime, setCurrentTime]);

  const handleRemoveAsset = useCallback(async (assetId: string) => {
    if (assetId.startsWith('server_')) {
      const serverId = parseInt(assetId.replace('server_', ''));
      mediaApi.remove(serverId).catch(() => {});
    }
    removeAsset(assetId);
  }, [removeAsset]);

  const handleApplyEffect = useCallback((effectName: string) => {
    if (!selectedClipId) return;
    const state = useEditorStore.getState();
    let clip = null;
    for (const t of state.tracks) {
      clip = t.clips.find(c => c.id === selectedClipId);
      if (clip) break;
    }
    if (!clip) return;

    const existingFilters = clip.filters || [];
    const alreadyHas = existingFilters.some(f => f.name === effectName);
    if (alreadyHas) return;

    updateClip(selectedClipId, {
      filters: [...existingFilters, {
        id: `filter_${Date.now()}`,
        name: effectName,
        type: effectName.toLowerCase(),
        params: { intensity: 50 },
      }],
    });
  }, [selectedClipId, updateClip]);

  const handleApplyTransition = useCallback((transitionName: string, duration: number) => {
    if (!selectedClipId) return;
    updateClip(selectedClipId, {
      transition: { type: transitionName.toLowerCase(), duration },
    });
  }, [selectedClipId, updateClip]);

  const handleAddText = useCallback((presetName: string) => {
    const trackId = getCompatibleTrack('text');
    const textDefaults: Record<string, { text: string; fontSize: number }> = {
      'Заголовок': { text: 'Заголовок', fontSize: 72 },
      'Субтитры': { text: 'Субтитры', fontSize: 24 },
      'Нижняя третья': { text: 'Имя автора', fontSize: 28 },
      'Титры': { text: 'Титры', fontSize: 36 },
      'Выноска': { text: 'Примечание', fontSize: 18 },
    };
    const defaults = textDefaults[presetName] || { text: presetName, fontSize: 36 };
    addClip(trackId, {
      type: 'text',
      startTime: currentTime,
      duration: 5,
      name: presetName,
      text: defaults.text,
      fontSize: defaults.fontSize,
      fontColor: '#ffffff',
    });
  }, [getCompatibleTrack, addClip, currentTime]);

  const purchasedEffects = purchases.filter(p => p.category === 'effects');
  const purchasedTransitions = purchases.filter(p => p.category === 'transitions');
  const purchasedTitles = purchases.filter(p => p.category === 'titles');
  const purchasedAudio = purchases.filter(p => p.category === 'audio');
  const purchasedFeatures = purchases.filter(p => p.category === 'features');

  return (
    <div className="flex flex-col h-full editor-panel rounded-lg overflow-hidden">
      <Tabs defaultValue="media" className="flex flex-col h-full">
        <div className="editor-panel-header px-2 py-1">
          <TabsList className="h-7 bg-transparent gap-0.5">
            <TabsTrigger value="media" className="text-[10px] h-6 px-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Медиа</TabsTrigger>
            <TabsTrigger value="effects" className="text-[10px] h-6 px-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Эффекты</TabsTrigger>
            <TabsTrigger value="transitions" className="text-[10px] h-6 px-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Переходы</TabsTrigger>
            <TabsTrigger value="text" className="text-[10px] h-6 px-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Текст</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="media"
          className="flex-1 m-0 flex flex-col min-h-0"
          onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleFileDrop}
        >
          <div className="px-2 py-1.5">
            <button onClick={handleImport} className={`w-full flex items-center justify-center gap-1.5 nle-button py-1.5 border border-dashed transition-colors ${isDraggingOver ? 'border-primary bg-primary/10' : 'border-border hover:border-primary'}`}>
              <Icon name={uploading.length > 0 ? 'Loader2' : 'Plus'} size={12} className={uploading.length > 0 ? 'animate-spin' : ''} />
              <span>{isDraggingOver ? 'Отпустите файлы сюда' : uploading.length > 0 ? `Загрузка (${uploading.length})...` : 'Импорт медиа'}</span>
            </button>
            <input ref={fileInputRef} type="file" accept="video/*,audio/*,image/*" multiple onChange={handleFileChange} className="hidden" />
          </div>
          <ScrollArea className="flex-1 px-2 editor-scrollbar">
            <div className="grid grid-cols-2 gap-1.5 pb-2">
              {assets.map(asset => (
                <div key={asset.id} className="group relative bg-secondary/50 rounded p-1.5 cursor-grab hover:bg-secondary transition-colors active:cursor-grabbing" draggable onDragStart={(e) => { e.dataTransfer.setData('application/json', JSON.stringify(asset)); e.dataTransfer.effectAllowed = 'copy'; setDraggingAsset(asset); }} onDragEnd={() => setDraggingAsset(null)} onDoubleClick={() => handleDoubleClick(asset)}>
                  <div className="aspect-video rounded flex items-center justify-center mb-1 overflow-hidden relative" style={{ background: 'hsl(var(--editor-bg))' }}>
                    {asset.type === 'image' && asset.url ? (
                      <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                    ) : asset.type === 'video' && asset.url ? (
                      <video src={asset.url} className="w-full h-full object-cover" muted />
                    ) : (
                      <Icon name={typeIcon(asset.type)} size={20} className={typeColor(asset.type)} />
                    )}
                    {uploading.includes(asset.id) && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Icon name="Loader2" size={16} className="text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] truncate">{asset.name}</div>
                  <div className="text-[9px] text-muted-foreground flex justify-between">
                    <span>{asset.duration > 0 ? formatDuration(asset.duration) : '—'}</span>
                    <span>{asset.size ? formatSize(asset.size) : ''}</span>
                  </div>
                  <button onClick={() => handleRemoveAsset(asset.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full p-0.5">
                    <Icon name="X" size={8} />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="effects" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full px-2 py-1 editor-scrollbar">
            {!selectedClipId && (
              <div className="text-[10px] text-muted-foreground text-center py-3 px-2">
                Выделите клип на таймлайне, чтобы применить эффект
              </div>
            )}

            {baseEffects.map(group => (
              <div key={group.category} className="mb-3">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">{group.category}</div>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <div
                      key={item.name}
                      onClick={() => handleApplyEffect(item.name)}
                      onMouseEnter={() => selectedClipId && setPreviewFilter(item.name)}
                      onMouseLeave={() => setPreviewFilter(null)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${selectedClipId ? 'hover:bg-secondary/50' : 'opacity-50 cursor-default'}`}
                    >
                      <Icon name={item.icon} size={12} className="text-muted-foreground" />
                      <span className="text-xs">{item.name}</span>
                      <span className="ml-auto text-[8px] text-green-400">FREE</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {purchasedEffects.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1">
                  <Icon name="ShoppingBag" size={10} className="text-primary" /> Из магазина
                </div>
                <div className="space-y-0.5">
                  {purchasedEffects.map(p => (
                    <div key={p.slug} className="mb-2">
                      <div
                        onClick={() => handleApplyEffect(p.name)}
                        onMouseEnter={() => selectedClipId && setPreviewFilter(p.name)}
                        onMouseLeave={() => setPreviewFilter(null)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${selectedClipId ? 'hover:bg-secondary/50' : 'opacity-50 cursor-default'}`}
                      >
                        <Icon name={p.icon || 'Palette'} size={12} className="text-primary" />
                        <span className="text-xs font-medium">{p.name}</span>
                        <span className="ml-auto text-[8px] text-primary">PRO</span>
                      </div>
                      {p.features.length > 0 && (
                        <div className="pl-7 space-y-0.5">
                          {p.features.map((f, i) => (
                            <div
                              key={i}
                              onClick={() => handleApplyEffect(f)}
                              onMouseEnter={() => selectedClipId && setPreviewFilter(f)}
                              onMouseLeave={() => setPreviewFilter(null)}
                              className={`text-[10px] px-2 py-1 rounded cursor-pointer transition-colors ${selectedClipId ? 'hover:bg-secondary/30 text-muted-foreground' : 'opacity-50 cursor-default text-muted-foreground'}`}
                            >
                              {f}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {purchasedFeatures.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1">
                  <Icon name="Cpu" size={10} className="text-yellow-400" /> Расширения
                </div>
                <div className="space-y-0.5">
                  {purchasedFeatures.map(p => (
                    <div key={p.slug} className="flex items-center gap-2 px-2 py-1.5 rounded bg-yellow-500/5">
                      <Icon name={p.icon || 'Cpu'} size={12} className="text-yellow-400" />
                      <div>
                        <div className="text-xs font-medium">{p.name}</div>
                        <div className="text-[9px] text-muted-foreground">Активировано</div>
                      </div>
                      <Icon name="CheckCircle" size={10} className="ml-auto text-green-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="transitions" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full px-2 py-1 editor-scrollbar">
            {!selectedClipId && (
              <div className="text-[10px] text-muted-foreground text-center py-3 px-2">
                Выделите клип на таймлайне, чтобы добавить переход
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              {baseTransitions.map(tr => (
                <div
                  key={tr.name}
                  onClick={() => handleApplyTransition(tr.name, parseFloat(tr.duration))}
                  className={`flex flex-col items-center gap-1 p-2 rounded bg-secondary/30 cursor-pointer transition-colors ${selectedClipId ? 'hover:bg-secondary/50' : 'opacity-50 cursor-default'}`}
                >
                  <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: 'hsl(var(--editor-bg))' }}>
                    <Icon name={tr.icon} size={16} className="text-primary" />
                  </div>
                  <span className="text-[10px]">{tr.name}</span>
                  <span className="text-[9px] text-muted-foreground">{tr.duration}</span>
                </div>
              ))}
            </div>

            {purchasedTransitions.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1">
                  <Icon name="ShoppingBag" size={10} className="text-primary" /> Из магазина
                </div>
                {purchasedTransitions.map(p => (
                  <div key={p.slug} className="mb-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-primary/5">
                      <Icon name={p.icon || 'Sparkles'} size={12} className="text-primary" />
                      <span className="text-xs font-medium">{p.name}</span>
                      <span className="ml-auto text-[8px] text-primary">PRO</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      {p.features.map((f, i) => (
                        <div
                          key={i}
                          onClick={() => handleApplyTransition(f, 0.5)}
                          className={`flex flex-col items-center gap-0.5 p-1.5 rounded bg-secondary/20 text-center cursor-pointer transition-colors ${selectedClipId ? 'hover:bg-secondary/40' : 'opacity-50 cursor-default'}`}
                        >
                          <Icon name={p.icon || 'Sparkles'} size={12} className="text-primary/60" />
                          <span className="text-[9px]">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="text" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full px-2 py-1 editor-scrollbar">
            <div className="space-y-1.5">
              {baseTextPresets.map(tp => (
                <div
                  key={tp.name}
                  onClick={() => handleAddText(tp.name)}
                  className="flex items-center gap-2 p-2 rounded bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                >
                  <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'hsl(var(--editor-bg))' }}>
                    <Icon name={tp.icon} size={14} className="text-purple-400" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium">{tp.name}</div>
                    <div className="text-[9px] text-muted-foreground">{tp.desc}</div>
                  </div>
                </div>
              ))}

              {purchasedTitles.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1">
                    <Icon name="ShoppingBag" size={10} className="text-primary" /> Из магазина
                  </div>
                  {purchasedTitles.map(p => (
                    <div key={p.slug} className="mb-2">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-primary/5">
                        <Icon name={p.icon || 'Type'} size={12} className="text-primary" />
                        <span className="text-xs font-medium">{p.name}</span>
                        <span className="ml-auto text-[8px] text-primary">PRO</span>
                      </div>
                      <div className="space-y-0.5 mt-1">
                        {p.features.map((f, i) => (
                          <div
                            key={i}
                            onClick={() => handleAddText(f)}
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-secondary/30 cursor-pointer transition-colors"
                          >
                            <Icon name="Type" size={10} className="text-purple-400/60" />
                            <span className="text-[10px]">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {purchasedAudio.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1">
                    <Icon name="Music" size={10} className="text-green-400" /> Музыка (магазин)
                  </div>
                  {purchasedAudio.map(p => (
                    <div key={p.slug} className="flex items-center gap-2 px-2 py-1.5 rounded bg-green-500/5">
                      <Icon name={p.icon || 'Music'} size={12} className="text-green-400" />
                      <div>
                        <div className="text-xs font-medium">{p.name}</div>
                        <div className="text-[9px] text-muted-foreground">{p.features.length} элементов</div>
                      </div>
                      <Icon name="CheckCircle" size={10} className="ml-auto text-green-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MediaPanel;