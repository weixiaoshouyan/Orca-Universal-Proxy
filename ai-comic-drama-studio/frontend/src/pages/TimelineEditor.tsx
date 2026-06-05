import React from 'react';

interface TimelineEditorProps {
  projectId: string;
}

const TimelineEditor: React.FC<TimelineEditorProps> = ({ projectId }) => {
  return (
    <div className="timeline-editor">
      <h1>时间轴编辑器</h1>
      <p>项目ID: {projectId}</p>
      <div className="timeline-content">
        <p>时间轴编辑功能将在这里显示</p>
      </div>
    </div>
  );
};

export default TimelineEditor;