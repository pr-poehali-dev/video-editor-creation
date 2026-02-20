import Icon from '@/components/ui/icon';
import useEditorStore from '@/hooks/use-editor-store';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

const PropertiesPanel = () => {
  const { tracks, selectedClipId, updateClip, removeClip, duplicateClip, splitClip, currentTime } = useEditorStore();

  const selectedClip = selectedClipId
    ? tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId)
    : null;

  if (!selectedClip) {
    return (
      <div className="flex flex-col h-full editor-panel rounded-lg overflow-hidden">
        <div className="editor-panel-header px-3 py-1.5 flex items-center gap-2">
          <Icon name="Settings2" size={14} />
          <span className="text-xs font-medium">Свойства</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
          <Icon name="MousePointerClick" size={32} />
          <span className="text-xs mt-2 text-center">Выберите клип на таймлайне для редактирования</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full editor-panel rounded-lg overflow-hidden">
      <div className="editor-panel-header px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Settings2" size={14} />
          <span className="text-xs font-medium">Свойства</span>
        </div>
        <span className="text-[10px] text-muted-foreground capitalize">{selectedClip.type}</span>
      </div>

      <ScrollArea className="flex-1 editor-scrollbar">
        <div className="p-3 space-y-3">
          <div>
            <Label className="text-[10px] text-muted-foreground">Название</Label>
            <Input
              value={selectedClip.name}
              onChange={e => updateClip(selectedClip.id, { name: e.target.value })}
              className="h-7 text-xs mt-1 bg-secondary/50 border-border"
            />
          </div>

          <Separator className="bg-border/50" />

          <div className="space-y-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Позиция</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Начало (с)</Label>
                <Input
                  type="number"
                  value={selectedClip.startTime.toFixed(1)}
                  onChange={e => updateClip(selectedClip.id, { startTime: parseFloat(e.target.value) || 0 })}
                  className="h-7 text-xs mt-0.5 bg-secondary/50 border-border"
                  step="0.1"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Длительность (с)</Label>
                <Input
                  type="number"
                  value={selectedClip.duration.toFixed(1)}
                  onChange={e => updateClip(selectedClip.id, { duration: parseFloat(e.target.value) || 1 })}
                  className="h-7 text-xs mt-0.5 bg-secondary/50 border-border"
                  step="0.1"
                  min="0.1"
                />
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          <div className="space-y-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Параметры</span>

            <div>
              <div className="flex justify-between">
                <Label className="text-[10px] text-muted-foreground">Прозрачность</Label>
                <span className="text-[10px] text-muted-foreground">{Math.round(selectedClip.opacity * 100)}%</span>
              </div>
              <Slider
                value={[selectedClip.opacity * 100]}
                onValueChange={([v]) => updateClip(selectedClip.id, { opacity: v / 100 })}
                max={100}
                step={1}
                className="mt-1"
              />
            </div>

            {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
              <div>
                <div className="flex justify-between">
                  <Label className="text-[10px] text-muted-foreground">Громкость</Label>
                  <span className="text-[10px] text-muted-foreground">{Math.round(selectedClip.volume * 100)}%</span>
                </div>
                <Slider
                  value={[selectedClip.volume * 100]}
                  onValueChange={([v]) => updateClip(selectedClip.id, { volume: v / 100 })}
                  max={200}
                  step={1}
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <div className="flex justify-between">
                <Label className="text-[10px] text-muted-foreground">Скорость</Label>
                <span className="text-[10px] text-muted-foreground">{selectedClip.speed.toFixed(1)}x</span>
              </div>
              <Slider
                value={[selectedClip.speed * 100]}
                onValueChange={([v]) => updateClip(selectedClip.id, { speed: v / 100 })}
                min={10}
                max={400}
                step={10}
                className="mt-1"
              />
            </div>
          </div>

          {selectedClip.type === 'text' && (
            <>
              <Separator className="bg-border/50" />
              <div className="space-y-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Текст</span>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Содержание</Label>
                  <Input
                    value={selectedClip.text || ''}
                    onChange={e => updateClip(selectedClip.id, { text: e.target.value })}
                    className="h-7 text-xs mt-0.5 bg-secondary/50 border-border"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Размер шрифта</Label>
                    <Input
                      type="number"
                      value={selectedClip.fontSize || 48}
                      onChange={e => updateClip(selectedClip.id, { fontSize: parseInt(e.target.value) || 48 })}
                      className="h-7 text-xs mt-0.5 bg-secondary/50 border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Цвет</Label>
                    <Input
                      type="color"
                      value={selectedClip.fontColor || '#ffffff'}
                      onChange={e => updateClip(selectedClip.id, { fontColor: e.target.value })}
                      className="h-7 mt-0.5 p-0.5 bg-secondary/50 border-border cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator className="bg-border/50" />

          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Действия</span>
            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => splitClip(selectedClip.id, currentTime)} className="nle-button flex items-center justify-center gap-1 py-1.5">
                <Icon name="Scissors" size={10} /> Разрезать
              </button>
              <button onClick={() => duplicateClip(selectedClip.id)} className="nle-button flex items-center justify-center gap-1 py-1.5">
                <Icon name="Copy" size={10} /> Копия
              </button>
              <button onClick={() => removeClip(selectedClip.id)} className="nle-button flex items-center justify-center gap-1 py-1.5 hover:bg-destructive/20 hover:text-destructive">
                <Icon name="Trash2" size={10} /> Удалить
              </button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default PropertiesPanel;
