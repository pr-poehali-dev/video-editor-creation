import Toolbar from '@/components/editor/Toolbar';
import PreviewPanel from '@/components/editor/PreviewPanel';
import MediaPanel from '@/components/editor/MediaPanel';
import TimelinePanel from '@/components/editor/TimelinePanel';
import PropertiesPanel from '@/components/editor/PropertiesPanel';
import ExportPanel from '@/components/editor/ExportPanel';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import useEditorStore from '@/hooks/use-editor-store';
import { projects } from '@/lib/api';

const Index = () => {
  const [rightPanel, setRightPanel] = useState<'properties' | 'export'>('properties');
  const { projectId } = useParams<{ projectId: string }>();
  const resetEditor = useEditorStore(s => s.resetEditor);
  const setProject = useEditorStore(s => s.setProject);
  const project = useEditorStore(s => s.project);
  const loadedRef = useRef<string | undefined>(undefined);

  const loadProjectData = useEditorStore(s => s.loadProjectData);

  useEffect(() => {
    const pid = projectId ? parseInt(projectId) : undefined;
    if (loadedRef.current === projectId) return;
    loadedRef.current = projectId;

    if (pid) {
      resetEditor(pid);
      projects.get(pid).then((res: Record<string, unknown>) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = res.project as any;
        if (p) {
          setProject({ id: pid, name: p.name || 'Проект' });
          if (p.project_data && typeof p.project_data === 'object') {
            const pd = p.project_data;
            if (pd.tracks) loadProjectData({ tracks: pd.tracks, project: pd.project, exportSettings: pd.exportSettings });
          }
        }
      }).catch(() => {});
    }
  }, [projectId, resetEditor, setProject, loadProjectData]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: 'hsl(var(--editor-bg))' }}>
      <Toolbar />

      <ResizablePanelGroup direction="vertical" className="flex-1">
        <ResizablePanel defaultSize={60} minSize={30}>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={20} minSize={14} maxSize={30}>
              <div className="h-full p-1">
                <MediaPanel />
              </div>
            </ResizablePanel>

            <ResizableHandle className="bg-transparent hover:bg-primary/20 transition-colors" />

            <ResizablePanel defaultSize={55} minSize={30}>
              <div className="h-full p-1">
                <PreviewPanel />
              </div>
            </ResizablePanel>

            <ResizableHandle className="bg-transparent hover:bg-primary/20 transition-colors" />

            <ResizablePanel defaultSize={25} minSize={16} maxSize={35}>
              <div className="h-full p-1 flex flex-col">
                <div className="flex items-center gap-0.5 mb-1 px-1">
                  <button
                    onClick={() => setRightPanel('properties')}
                    className={`nle-button text-[10px] ${rightPanel === 'properties' ? 'active' : ''}`}
                  >
                    <Icon name="Settings2" size={10} className="inline mr-1" />
                    Свойства
                  </button>
                  <button
                    onClick={() => setRightPanel('export')}
                    className={`nle-button text-[10px] ${rightPanel === 'export' ? 'active' : ''}`}
                  >
                    <Icon name="Download" size={10} className="inline mr-1" />
                    Экспорт
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  {rightPanel === 'properties' ? <PropertiesPanel /> : <ExportPanel />}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle className="bg-transparent hover:bg-primary/20 transition-colors" />

        <ResizablePanel defaultSize={40} minSize={20}>
          <div className="h-full p-1">
            <TimelinePanel />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <div className="h-5 flex items-center justify-between px-3 border-t border-border text-[9px] text-muted-foreground" style={{ background: 'hsl(var(--editor-panel))' }}>
        <div className="flex items-center gap-3">
          <span>VideoForge v1.0</span>
          <span>Проект: {project.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>RAM: 256 МБ</span>
          <span>GPU: Активно</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Готов
          </span>
        </div>
      </div>
    </div>
  );
};

export default Index;