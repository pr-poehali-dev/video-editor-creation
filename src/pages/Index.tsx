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
import { useState } from 'react';
import Icon from '@/components/ui/icon';

const Index = () => {
  const [rightPanel, setRightPanel] = useState<'properties' | 'export'>('properties');

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
          <span>Проект: Новый проект</span>
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
