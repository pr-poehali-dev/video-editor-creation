import { useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import useEditorStore from '@/hooks/use-editor-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

const effects = [
  { category: 'Цветокоррекция', items: [
    { name: 'Яркость', icon: 'Sun' },
    { name: 'Контраст', icon: 'Contrast' },
    { name: 'Насыщенность', icon: 'Palette' },
    { name: 'Температура', icon: 'Thermometer' },
    { name: 'Кривые', icon: 'TrendingUp' },
  ]},
  { category: 'Стилизация', items: [
    { name: 'Размытие', icon: 'Droplets' },
    { name: 'Резкость', icon: 'Diamond' },
    { name: 'Виньетка', icon: 'Circle' },
    { name: 'Шум', icon: 'Sparkles' },
    { name: 'Глитч', icon: 'Zap' },
  ]},
  { category: 'Хромакей', items: [
    { name: 'Зелёный экран', icon: 'SquareStack' },
    { name: 'Синий экран', icon: 'SquareStack' },
  ]},
];

const transitions = [
  { name: 'Растворение', icon: 'Blend', duration: '0.5с' },
  { name: 'Слайд влево', icon: 'ArrowLeft', duration: '0.5с' },
  { name: 'Слайд вправо', icon: 'ArrowRight', duration: '0.5с' },
  { name: 'Масштаб', icon: 'ZoomIn', duration: '0.7с' },
  { name: 'Поворот', icon: 'RotateCw', duration: '0.6с' },
  { name: 'Вспышка', icon: 'Flashlight', duration: '0.3с' },
  { name: 'Размытие', icon: 'Droplets', duration: '0.5с' },
  { name: 'Пикселизация', icon: 'Grid3x3', duration: '0.4с' },
];

const textPresets = [
  { name: 'Заголовок', icon: 'Type', desc: 'Крупный текст по центру' },
  { name: 'Субтитры', icon: 'Subtitles', desc: 'Текст внизу экрана' },
  { name: 'Нижняя третья', icon: 'PanelBottom', desc: 'Плашка с именем' },
  { name: 'Титры', icon: 'ScrollText', desc: 'Прокручиваемый текст' },
  { name: 'Выноска', icon: 'MessageSquare', desc: 'Текст с указателем' },
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

const MediaPanel = () => {
  const { assets, addAsset, removeAsset, activePanel, setActivePanel, setDraggingAsset } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      let type: 'video' | 'audio' | 'image' = 'video';
      if (file.type.startsWith('audio/')) type = 'audio';
      else if (file.type.startsWith('image/')) type = 'image';

      const duration = type === 'image' ? 0 : Math.random() * 30 + 5;

      addAsset({
        name: file.name,
        type,
        url: URL.createObjectURL(file),
        duration,
        size: file.size,
      });
    });
    e.target.value = '';
  }, [addAsset]);

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

        <TabsContent value="media" className="flex-1 m-0 flex flex-col min-h-0">
          <div className="px-2 py-1.5">
            <button onClick={handleImport} className="w-full flex items-center justify-center gap-1.5 nle-button py-1.5 border border-dashed border-border hover:border-primary">
              <Icon name="Plus" size={12} />
              <span>Импорт медиа</span>
            </button>
            <input ref={fileInputRef} type="file" accept="video/*,audio/*,image/*" multiple onChange={handleFileChange} className="hidden" />
          </div>
          <ScrollArea className="flex-1 px-2 editor-scrollbar">
            <div className="grid grid-cols-2 gap-1.5 pb-2">
              {assets.map(asset => (
                <div key={asset.id} className="group relative bg-secondary/50 rounded p-1.5 cursor-grab hover:bg-secondary transition-colors active:cursor-grabbing" draggable onDragStart={(e) => { e.dataTransfer.setData('application/json', JSON.stringify(asset)); e.dataTransfer.effectAllowed = 'copy'; setDraggingAsset(asset); }} onDragEnd={() => setDraggingAsset(null)}>
                  <div className="aspect-video rounded flex items-center justify-center mb-1" style={{ background: 'hsl(var(--editor-bg))' }}>
                    <Icon name={typeIcon(asset.type)} size={20} className={typeColor(asset.type)} />
                  </div>
                  <div className="text-[10px] truncate">{asset.name}</div>
                  <div className="text-[9px] text-muted-foreground flex justify-between">
                    <span>{asset.duration > 0 ? formatDuration(asset.duration) : '—'}</span>
                    <span>{asset.size ? formatSize(asset.size) : ''}</span>
                  </div>
                  <button onClick={() => removeAsset(asset.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full p-0.5">
                    <Icon name="X" size={8} />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="effects" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full px-2 py-1 editor-scrollbar">
            {effects.map(group => (
              <div key={group.category} className="mb-3">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">{group.category}</div>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <div key={item.name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/50 cursor-pointer transition-colors">
                      <Icon name={item.icon} size={12} className="text-muted-foreground" />
                      <span className="text-xs">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="transitions" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full px-2 py-1 editor-scrollbar">
            <div className="grid grid-cols-2 gap-1.5">
              {transitions.map(tr => (
                <div key={tr.name} className="flex flex-col items-center gap-1 p-2 rounded bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors">
                  <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: 'hsl(var(--editor-bg))' }}>
                    <Icon name={tr.icon} size={16} className="text-primary" />
                  </div>
                  <span className="text-[10px]">{tr.name}</span>
                  <span className="text-[9px] text-muted-foreground">{tr.duration}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="text" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full px-2 py-1 editor-scrollbar">
            <div className="space-y-1">
              {textPresets.map(preset => (
                <div key={preset.name} className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-secondary/50 cursor-pointer transition-colors">
                  <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'hsl(var(--editor-bg))' }}>
                    <Icon name={preset.icon} size={14} className="text-purple-400" />
                  </div>
                  <div>
                    <div className="text-xs font-medium">{preset.name}</div>
                    <div className="text-[10px] text-muted-foreground">{preset.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MediaPanel;