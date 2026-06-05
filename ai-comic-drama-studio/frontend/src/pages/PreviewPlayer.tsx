import React from 'react';

interface PreviewPlayerProps {
  projectId: string;
}

const PreviewPlayer: React.FC<PreviewPlayerProps> = ({ projectId }) => {
  return (
    <div className="preview-player">
      <h1>预览播放器</h1>
      <p>项目ID: {projectId}</p>
      <div className="preview-content">
        <p>视频预览功能将在这里显示</p>
      </div>
    </div>
  );
};

export default PreviewPlayer;