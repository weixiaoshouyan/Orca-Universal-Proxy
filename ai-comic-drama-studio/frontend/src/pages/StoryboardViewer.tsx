import React from 'react';

interface StoryboardViewerProps {
  projectId: string;
}

const StoryboardViewer: React.FC<StoryboardViewerProps> = ({ projectId }) => {
  return (
    <div className="storyboard-viewer">
      <h1>分镜预览</h1>
      <p>项目ID: {projectId}</p>
      <div className="storyboard-content">
        <p>分镜预览功能将在这里显示</p>
      </div>
    </div>
  );
};

export default StoryboardViewer;