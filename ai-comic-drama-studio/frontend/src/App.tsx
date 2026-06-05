import React, { useState } from 'react';
import ProjectManager from './pages/ProjectManager';
import StoryEditor from './pages/StoryEditor';
import StoryboardViewer from './pages/StoryboardViewer';
import TimelineEditor from './pages/TimelineEditor';
import PreviewPlayer from './pages/PreviewPlayer';
import ExportPanel from './pages/ExportPanel';
import AIToolPanel from './components/AIToolPanel';

type Page = 'project' | 'story' | 'storyboard' | 'timeline' | 'preview' | 'export';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('project');
  const [projectId, setProjectId] = useState<string | null>(null);

  const renderPage = () => {
    switch (currentPage) {
      case 'project':
        return <ProjectManager onProjectSelect={(id) => {
          setProjectId(id);
          setCurrentPage('story');
        }} />;
      case 'story':
        return <StoryEditor projectId={projectId!} />;
      case 'storyboard':
        return <StoryboardViewer projectId={projectId!} />;
      case 'timeline':
        return <TimelineEditor projectId={projectId!} />;
      case 'preview':
        return <PreviewPlayer projectId={projectId!} />;
      case 'export':
        return <ExportPanel projectId={projectId!} />;
      default:
        return <ProjectManager onProjectSelect={(id) => {
          setProjectId(id);
          setCurrentPage('story');
        }} />;
    }
  };

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="nav-items">
          <button 
            className={currentPage === 'project' ? 'active' : ''}
            onClick={() => setCurrentPage('project')}
          >
            项目管理
          </button>
          <button 
            className={currentPage === 'story' ? 'active' : ''}
            onClick={() => setCurrentPage('story')}
          >
            故事编辑
          </button>
          <button 
            className={currentPage === 'storyboard' ? 'active' : ''}
            onClick={() => setCurrentPage('storyboard')}
          >
            分镜预览
          </button>
          <button 
            className={currentPage === 'timeline' ? 'active' : ''}
            onClick={() => setCurrentPage('timeline')}
          >
            时间轴
          </button>
          <button 
            className={currentPage === 'preview' ? 'active' : ''}
            onClick={() => setCurrentPage('preview')}
          >
            预览
          </button>
          <button 
            className={currentPage === 'export' ? 'active' : ''}
            onClick={() => setCurrentPage('export')}
          >
            导出
          </button>
        </div>
      </nav>
      <main className="content">
        {renderPage()}
      </main>
      <AIToolPanel projectId={projectId} />
    </div>
  );
}

export default App;