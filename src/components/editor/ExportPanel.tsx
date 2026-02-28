import { useState, useCallback, useRef } from 'react';
import Icon from '@/components/ui/icon';
import useEditorStore from '@/hooks/use-editor-store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import type { ExportSettings } from '@/types/editor';

const formats = [
  { value: 'mp4', label: 'MP4 (H.264)', desc: 'Универсальный формат' },
  { value: 'webm', label: 'WebM (VP9)', desc: 'Для веба' },
  { value: 'mov', label: 'MOV', desc: 'Профессиональный' },
  { value: 'gif', label: 'GIF', desc: 'Анимация без звука' },
];

const qualities: Array<{ value: ExportSettings['quality']; label: string; desc: string }> = [
  { value: 'low', label: 'Низкое', desc: '720p' },
  { value: 'medium', label: 'Среднее', desc: '1080p' },
  { value: 'high', label: 'Высокое', desc: '1080p HQ' },
  { value: 'ultra', label: 'Ультра', desc: '4K' },
];

const ExportPanel = () => {
  const { exportSettings, setExportSettings, project, tracks, assets } = useEditorStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('');
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [resultFileName, setResultFileName] = useState('');
  const [resultSize, setResultSize] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendererRef = useRef<any>(null);

  const clipCount = tracks.reduce((sum, t) => sum + t.clips.length, 0);

  const handleExport = useCallback(async () => {
    if (clipCount === 0) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportStage('Загрузка движка...');
    setExportDone(false);
    setExportError('');
    setResultUrl('');

    try {
      const { VideoRenderer } = await import('@/lib/video-renderer');
      const renderer = new VideoRenderer();
      rendererRef.current = renderer;

      setExportStage('Инициализация FFmpeg...');
      await renderer.init();

      const result = await renderer.render(
        tracks,
        assets,
        exportSettings,
        (progress, stage) => {
          setExportProgress(Math.round(progress * 100));
          const stageLabels: Record<string, string> = {
            'Loading assets': 'Загрузка файлов...',
            'Building render graph': 'Построение графа...',
            'Rendering': 'Рендеринг видео...',
            'Encoding': 'Кодирование...',
            'Reading output': 'Чтение результата...',
            'Complete': 'Готово!',
          };
          setExportStage(stageLabels[stage] || stage);
        }
      );

      setResultUrl(result.url);
      setResultFileName(result.fileName);
      setResultSize(result.blob.size);
      setExportDone(true);
      renderer.terminate();
      rendererRef.current = null;
    } catch (err) {
      console.error('Export failed:', err);
      setExportError(err instanceof Error ? err.message : 'Ошибка рендеринга');
      if (rendererRef.current) {
        rendererRef.current.terminate();
        rendererRef.current = null;
      }
    }

    setIsExporting(false);
  }, [tracks, assets, exportSettings, clipCount]);

  const handleCancel = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.terminate();
      rendererRef.current = null;
    }
    setIsExporting(false);
    setExportProgress(0);
    setExportStage('');
  }, []);

  const handleDownload = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = resultFileName || `video.${exportSettings.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [resultUrl, resultFileName, exportSettings.format]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full editor-panel rounded-lg overflow-hidden">
      <div className="editor-panel-header px-3 py-1.5 flex items-center gap-2">
        <Icon name="Film" size={14} />
        <span className="text-xs font-medium">Экспорт видео</span>
      </div>

      <ScrollArea className="flex-1 editor-scrollbar">
        <div className="p-3 space-y-3">
          <div className="p-2 rounded text-center" style={{ background: 'hsl(var(--editor-bg))' }}>
            <div className="text-lg font-semibold">{project.name}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {project.width}×{project.height} &bull; {project.fps}fps &bull; {clipCount} клипов
            </div>
          </div>

          {exportDone ? (
            <div className="space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                <Icon name="Check" size={28} className="text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">Видео готово!</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {resultFileName} &bull; {formatSize(resultSize)}
                </p>
              </div>

              {resultUrl && (
                <div className="rounded-lg overflow-hidden border border-border" style={{ background: 'hsl(var(--editor-bg))' }}>
                  <video
                    src={resultUrl}
                    controls
                    className="w-full max-h-[200px]"
                    style={{ background: '#000' }}
                  />
                </div>
              )}

              <button
                onClick={handleDownload}
                className="w-full py-3 rounded-lg font-medium text-sm bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="Download" size={16} />
                Скачать видео
              </button>

              <button
                onClick={() => { setExportDone(false); setResultUrl(''); setExportError(''); }}
                className="nle-button w-full py-2 text-[10px]"
              >
                Назад к настройкам
              </button>
            </div>
          ) : isExporting ? (
            <div className="space-y-3 py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                <Icon name="Clapperboard" size={24} className="text-primary animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">{exportStage}</p>
                <p className="text-2xl font-bold mt-1">{exportProgress}%</p>
              </div>
              <Progress value={exportProgress} className="h-2" />
              <p className="text-[10px] text-muted-foreground text-center">
                Рендеринг выполняется в браузере с помощью FFmpeg
              </p>
              <button
                onClick={handleCancel}
                className="nle-button w-full py-2 text-[10px] text-destructive"
              >
                Отменить
              </button>
            </div>
          ) : (
            <>
              {exportError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">
                  <Icon name="AlertCircle" size={14} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Ошибка рендеринга</p>
                    <p className="text-[10px] mt-0.5 opacity-80">{exportError}</p>
                  </div>
                </div>
              )}

              <Separator className="bg-border/50" />

              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Формат</Label>
                <Select value={exportSettings.format} onValueChange={(v: string) => setExportSettings({ format: v as ExportSettings['format'] })}>
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
                      onClick={() => setExportSettings({ quality: q.value })}
                      className={`p-2 rounded text-left transition-colors ${exportSettings.quality === q.value ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 hover:bg-secondary'}`}
                    >
                      <div className="text-xs font-medium">{q.label}</div>
                      <div className="text-[9px] opacity-70">{q.desc}</div>
                    </button>
                  ))}
                </div>
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

              <button
                onClick={handleExport}
                disabled={clipCount === 0}
                className="w-full py-3 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Icon name="Rocket" size={16} />
                Создать видео
              </button>

              {clipCount === 0 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Добавьте файлы на таймлайн, чтобы создать видео
                </p>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ExportPanel;
