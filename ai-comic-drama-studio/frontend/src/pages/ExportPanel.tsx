import React from 'react';

interface ExportPanelProps {
  projectId: string;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ projectId }) => {
  return (
    <div className="export-panel">
      <h1>导出面板</h1>
      <p>项目ID: {projectId}</p>
      <div className="export-content">
        <p>视频导出功能将在这里显示</p>
      </div>
    </div>
  );
};

export default ExportPanel;