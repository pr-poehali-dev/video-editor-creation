import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import useEditorStore from '@/hooks/use-editor-store';
import useAuth from '@/hooks/use-auth';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

const tools = [
  { id: 'select', icon: 'MousePointer2', label: 'Выделение (V)', key: 'v' },
  { id: 'cut', icon: 'Scissors', label: 'Разрезка (C)', key: 'c' },
  { id: 'slip', icon: 'GripHorizontal', label: 'Сдвиг (Y)', key: 'y' },
  { id: 'text', icon: 'Type', label: 'Текст (T)', key: 't' },
  { id: 'hand', icon: 'Hand', label: 'Рука (H)', key: 'h' },
  { id: 'zoom', icon: 'Search', label: 'Масштаб (Z)', key: 'z' },
];

const Toolbar = () => {
  const { project, isPlaying, togglePlay } = useEditorStore();
  const { user, isAuthenticated, loadProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState('select');
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  return (
    <div className="h-10 flex items-center justify-between px-3 border-b border-border" style={{ background: 'hsl(var(--editor-panel))' }}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 mr-3 relative">
          <button onClick={() => setShowProjectMenu(!showProjectMenu)} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-secondary/50 transition-colors">
            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
              <Icon name="Film" size={11} className="text-primary" />
            </div>
            <span className="text-xs font-semibold">VideoForge</span>
            <Icon name="ChevronDown" size={10} className="text-muted-foreground" />
          </button>
          {showProjectMenu && (
            <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] rounded-md border border-border shadow-lg" style={{ background: 'hsl(var(--popover))' }}>
              <div className="p-1">
                <button className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-secondary/50">
                  <Icon name="FolderOpen" size={11} /> Открыть проект
                </button>
                <button className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-secondary/50">
                  <Icon name="Save" size={11} /> Сохранить
                </button>
                <button className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-secondary/50">
                  <Icon name="FilePlus" size={11} /> Новый проект
                </button>
              </div>
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="h-5 bg-border/50" />

        <div className="flex items-center gap-0.5 ml-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="nle-button"><Icon name="Undo2" size={12} /></button>
            </TooltipTrigger>
            <TooltipContent><p className="text-[10px]">Отменить (Ctrl+Z)</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="nle-button"><Icon name="Redo2" size={12} /></button>
            </TooltipTrigger>
            <TooltipContent><p className="text-[10px]">Повторить (Ctrl+Shift+Z)</p></TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        {tools.map(tool => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActiveTool(tool.id)}
                className={`nle-button ${activeTool === tool.id ? 'active' : ''}`}
              >
                <Icon name={tool.icon} size={13} />
              </button>
            </TooltipTrigger>
            <TooltipContent><p className="text-[10px]">{tool.label}</p></TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">
          {project.width}×{project.height} | {project.fps}fps
        </span>
        <Separator orientation="vertical" className="h-5 bg-border/50" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="nle-button"><Icon name="Settings" size={12} /></button>
          </TooltipTrigger>
          <TooltipContent><p className="text-[10px]">Настройки проекта</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="nle-button"><Icon name="Keyboard" size={12} /></button>
          </TooltipTrigger>
          <TooltipContent><p className="text-[10px]">Горячие клавиши</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => navigate('/shop')} className="nle-button flex items-center gap-1">
              <Icon name="Store" size={11} />
              <span className="text-[10px]">Магазин</span>
            </button>
          </TooltipTrigger>
          <TooltipContent><p className="text-[10px]">Магазин эффектов</p></TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-5 bg-border/50" />
        {isAuthenticated && user ? (
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-secondary/50 transition-colors">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-[9px] font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-[10px]">{user.name}</span>
          </button>
        ) : (
          <button onClick={() => navigate('/auth')} className="nle-button active flex items-center gap-1">
            <Icon name="LogIn" size={11} />
            <span className="text-[10px]">Войти</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Toolbar;