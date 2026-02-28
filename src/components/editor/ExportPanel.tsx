import { useState, useCallback } from 'react';
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
  const { exportSettings, setExportSettings, project, tracks, assets } = useEditorStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportDone, setExportDone] = useState(false);
  const [exportedFiles, setExportedFiles] = useState<Array<{ name: string; url: string }>>([]);

  const collectMediaUrls = useCallback(() => {
    const usedAssetIds = new Set<string>();
    tracks.forEach(t => t.clips.forEach(c => {
      if (c.assetId) usedAssetIds.add(c.assetId);
    }));

    const files: Array<{ name: string; url: string }> = [];
    assets.forEach(a => {
      if (a.url && usedAssetIds.has(a.id)) {
        files.push({ name: a.name, url: a.url });
      }
    });
    return files;
  }, [tracks, assets]);

  const handleExport = useCallback(() => {
    setIsExporting(true);
    setExportProgress(0);
    setExportDone(false);
    setExportedFiles([]);

    const files = collectMediaUrls();
    let progress = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 8 + 4;
      if (progress >= 100) {
        clearInterval(interval);
        setExportProgress(100);
        setIsExporting(false);
        setExportDone(true);
        setExportedFiles(files);
      } else {
        setExportProgress(progress);
      }
    }, 150);
  }, [collectMediaUrls]);

  const downloadFile = useCallback(async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  }, []);

  const downloadAll = useCallback(async () => {
    for (const f of exportedFiles) {
      await downloadFile(f.url, f.name);
      await new Promise(r => setTimeout(r, 500));
    }
  }, [exportedFiles, downloadFile]);

  const downloadProjectJson = useCallback(() => {
    const data = useEditorStore.getState();
    const exportData = {
      project: data.project,
      tracks: data.tracks,
      assets: data.assets.map(a => ({ ...a, url: a.url.startsWith('blob:') ? '' : a.url })),
      exportSettings: data.exportSettings,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.project.name || 'project'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

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
            { }
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Формат</Label>
            <Select value={exportSettings.format} onValueChange={(v: string) => setExportSettings({ format: v as 'mp4' | 'webm' | 'mov' | 'avi' | 'gif' })}>
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
                  onClick={() => setExportSettings({ quality: q.value as 'low' | 'medium' | 'high' | 'ultra' })}
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
                <span>Подготовка файлов...</span>
                <span>{Math.min(100, Math.round(exportProgress))}%</span>
              </div>
              <Progress value={Math.min(100, exportProgress)} className="h-2" />
              <p className="text-[10px] text-muted-foreground text-center">Подготовка медиафайлов к скачиванию</p>
            </div>
          ) : exportDone ? (
            <div className="space-y-2">
              <div className="w-10 h-10 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                <Icon name="Check" size={20} className="text-green-400" />
              </div>
              <p className="text-xs font-medium text-center">Готово к скачиванию!</p>

              {exportedFiles.length > 0 ? (
                <div className="space-y-1">
                  {exportedFiles.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => downloadFile(f.url, f.name)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-secondary/50 transition-colors text-left"
                    >
                      <Icon name="FileDown" size={12} className="text-primary flex-shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                  <Separator className="bg-border/30" />
                  <button onClick={downloadAll} className="nle-button active w-full py-2">
                    <Icon name="Download" size={12} className="inline mr-1" /> Скачать все файлы
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground text-center">
                  Нет медиафайлов на таймлайне. Добавьте файлы и перетяните их на дорожки.
                </p>
              )}

              <button onClick={() => setExportDone(false)} className="nle-button w-full py-1.5 text-[10px]">
                Назад к настройкам
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button onClick={handleExport} className="w-full py-2.5 rounded font-medium text-sm transition-colors bg-primary text-primary-foreground hover:bg-primary/90">
                <Icon name="Rocket" size={14} className="inline mr-1.5" />
                Экспорт медиафайлов
              </button>
              <button onClick={downloadProjectJson} className="nle-button w-full py-2 text-[10px]">
                <Icon name="FileJson" size={12} className="inline mr-1" /> Скачать проект (.json)
              </button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ExportPanel;
