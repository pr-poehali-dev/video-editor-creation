import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import useEditorStore from '@/hooks/use-editor-store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const resolutionPresets = [
  { label: '1920×1080 (Full HD)', w: 1920, h: 1080 },
  { label: '1080×1920 (Вертикальное)', w: 1080, h: 1920 },
  { label: '1080×1080 (Квадрат)', w: 1080, h: 1080 },
  { label: '3840×2160 (4K)', w: 3840, h: 2160 },
  { label: '2560×1440 (2K)', w: 2560, h: 1440 },
  { label: '1280×720 (HD)', w: 1280, h: 720 },
];

const fpsPresets = [24, 25, 30, 50, 60];

const parseDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return { minutes: m, seconds: s };
};

const ProjectSettingsDialog = ({ open, onOpenChange }: Props) => {
  const { project, setProject } = useEditorStore();

  const [name, setName] = useState(project.name);
  const [width, setWidth] = useState(project.width);
  const [height, setHeight] = useState(project.height);
  const [fps, setFps] = useState(project.fps);
  const [durMin, setDurMin] = useState(0);
  const [durSec, setDurSec] = useState(30);

  useEffect(() => {
    if (open) {
      setName(project.name);
      setWidth(project.width);
      setHeight(project.height);
      setFps(project.fps);
      const { minutes, seconds } = parseDuration(project.duration);
      setDurMin(minutes);
      setDurSec(seconds);
    }
  }, [open, project]);

  const handleSave = () => {
    const totalSeconds = Math.max(1, durMin * 60 + durSec);
    setProject({
      name: name.trim() || 'Без названия',
      width: Math.max(1, width),
      height: Math.max(1, height),
      fps: Math.max(1, fps),
      duration: totalSeconds,
    });
    onOpenChange(false);
  };

  const handlePreset = (w: number, h: number) => {
    setWidth(w);
    setHeight(h);
  };

  const [customRes, setCustomRes] = useState(false);
  const currentPreset = resolutionPresets.find(p => p.w === width && p.h === height);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]" style={{ background: 'hsl(var(--editor-panel))' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Icon name="Settings2" size={16} />
            Настройки проекта
          </DialogTitle>
          <DialogDescription className="text-xs">
            Параметры видео: разрешение, частота кадров и длительность
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Название</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-8 text-xs bg-secondary/50 border-border/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Разрешение</Label>
            {!customRes ? (
              <>
                <div className="flex flex-wrap gap-1">
                  {resolutionPresets.map(p => (
                    <button
                      key={p.label}
                      onClick={() => handlePreset(p.w, p.h)}
                      className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                        p.w === width && p.h === height
                          ? 'border-primary bg-primary/20 text-primary'
                          : 'border-border/50 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCustomRes(true)}
                  className="text-[10px] text-muted-foreground hover:text-foreground mt-0.5 flex items-center gap-1"
                >
                  <Icon name="Pencil" size={9} /> Свои размеры
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={width}
                    onChange={e => setWidth(Number(e.target.value))}
                    className="h-7 text-[10px] w-20 bg-secondary/50 border-border/50"
                    min={1}
                  />
                  <span className="text-[10px] text-muted-foreground">×</span>
                  <Input
                    type="number"
                    value={height}
                    onChange={e => setHeight(Number(e.target.value))}
                    className="h-7 text-[10px] w-20 bg-secondary/50 border-border/50"
                    min={1}
                  />
                </div>
                {currentPreset && (
                  <button
                    onClick={() => setCustomRes(false)}
                    className="text-[10px] text-muted-foreground hover:text-foreground mt-0.5 flex items-center gap-1"
                  >
                    <Icon name="List" size={9} /> Выбрать из пресетов
                  </button>
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Частота кадров (FPS)</Label>
            <div className="flex gap-1">
              {fpsPresets.map(f => (
                <button
                  key={f}
                  onClick={() => setFps(f)}
                  className={`px-2.5 py-1 text-[10px] rounded border transition-colors ${
                    f === fps
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-border/50 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Длительность проекта</Label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={durMin}
                  onChange={e => setDurMin(Math.max(0, Number(e.target.value)))}
                  className="h-8 text-xs w-16 bg-secondary/50 border-border/50 text-center"
                  min={0}
                  max={60}
                />
                <span className="text-[10px] text-muted-foreground">мин</span>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={durSec}
                  onChange={e => setDurSec(Math.max(0, Math.min(59, Number(e.target.value))))}
                  className="h-8 text-xs w-16 bg-secondary/50 border-border/50 text-center"
                  min={0}
                  max={59}
                />
                <span className="text-[10px] text-muted-foreground">сек</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Итого: {durMin * 60 + durSec} сек. Таймлайн автоматически расширится, если клипы длиннее.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
            Отмена
          </Button>
          <Button size="sm" onClick={handleSave} className="text-xs h-8">
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectSettingsDialog;