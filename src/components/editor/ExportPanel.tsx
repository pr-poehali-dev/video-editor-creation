import { useState } from 'react';
import Icon from '@/components/ui/icon';
import useEditorStore from '@/hooks/use-editor-store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

const formats = [
  { value: 'mp4', label: 'MP4 (H.264)', desc: 'Универсальный формат' },
  { value: 'webm', label: 'WebM (VP9)', desc: 'Для веба' },
  { value: 'mov', label: 'MOV (ProRes)', desc: 'Профессиональный' },
  { value: 'avi', label: 'AVI', desc: 'Совместимость' },
  { value: 'gif', label: 'GIF', desc: 'Анимация' },
];

const qualities = [
  { value: 'low', label: 'Низкое', desc: '720p, 2 Mbps' },
  { value: 'medium', label: 'Среднее', desc: '1080p, 5 Mbps' },
  { value: 'high', label: 'Высокое', desc: '1080p, 8 Mbps' },
  { value: 'ultra', label: 'Ультра', desc: '4K, 20 Mbps' },
];

const resolutions = ['640x360', '1280x720', '1920x1080', '2560x1440', '3840x2160'];

const ExportPanel = () => {
  const { exportSettings, setExportSettings, project } = useEditorStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportDone, setExportDone] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportDone(false);

    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          setExportDone(true);
          return 100;
        }
        return prev + Math.random() * 3 + 1;
      });
    }, 200);
  };

  return (
    <div className="flex flex-col h-full editor-panel rounded-lg overflow-hidden">
      <div className="editor-panel-header px-3 py-1.5 flex items-center gap-2">
        <Icon name="Download" size={14} />
        <span className="text-xs font-medium">Экспорт</span>
      </div>

      <ScrollArea className="flex-1 editor-scrollbar">
        <div className="p-3 space-y-3">
          <div className="p-2 rounded text-center" style={{ background: 'hsl(var(--editor-bg))' }}>
            <div className="text-lg font-semibold">{project.name}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {project.width}×{project.height} • {project.fps}fps • {project.duration}с
            </div>
          </div>

          <Separator className="bg-border/50" />

          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Формат</Label>
            <Select value={exportSettings.format} onValueChange={v => setExportSettings({ format: v as any })}>
              <SelectTrigger className="mt-1 h-8 text-xs bg-secondary/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formats.map(f => (
                  <SelectItem key={f.value} value={f.value} className="text-xs">
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{f.label}</span>
                      <span className="text-[10px] text-muted-foreground">{f.desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Качество</Label>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {qualities.map(q => (
                <button
                  key={q.value}
                  onClick={() => setExportSettings({ quality: q.value as any })}
                  className={`p-2 rounded text-left transition-colors ${exportSettings.quality === q.value ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 hover:bg-secondary'}`}
                >
                  <div className="text-xs font-medium">{q.label}</div>
                  <div className="text-[9px] opacity-70">{q.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Разрешение</Label>
            <Select value={exportSettings.resolution} onValueChange={v => setExportSettings({ resolution: v })}>
              <SelectTrigger className="mt-1 h-8 text-xs bg-secondary/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resolutions.map(r => (
                  <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">FPS</Label>
              <Input
                type="number"
                value={exportSettings.fps}
                onChange={e => setExportSettings({ fps: parseInt(e.target.value) || 30 })}
                className="h-7 text-xs mt-0.5 bg-secondary/50 border-border"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Битрейт (kbps)</Label>
              <Input
                type="number"
                value={exportSettings.bitrate}
                onChange={e => setExportSettings({ bitrate: parseInt(e.target.value) || 8000 })}
                className="h-7 text-xs mt-0.5 bg-secondary/50 border-border"
              />
            </div>
          </div>

          <Separator className="bg-border/50" />

          {isExporting ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Экспорт...</span>
                <span>{Math.min(100, Math.round(exportProgress))}%</span>
              </div>
              <Progress value={Math.min(100, exportProgress)} className="h-2" />
              <p className="text-[10px] text-muted-foreground text-center">Рендеринг видео, пожалуйста подождите</p>
            </div>
          ) : exportDone ? (
            <div className="text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                <Icon name="Check" size={20} className="text-green-400" />
              </div>
              <p className="text-xs font-medium">Экспорт завершён!</p>
              <button onClick={() => setExportDone(false)} className="nle-button active w-full py-2">
                <Icon name="Download" size={12} className="inline mr-1" /> Скачать файл
              </button>
            </div>
          ) : (
            <button onClick={handleExport} className="w-full py-2.5 rounded font-medium text-sm transition-colors bg-primary text-primary-foreground hover:bg-primary/90">
              <Icon name="Rocket" size={14} className="inline mr-1.5" />
              Начать экспорт
            </button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ExportPanel;
