import React, { useState } from 'react';

interface AIToolPanelProps {
  projectId: string | null;
}

const AIToolPanel: React.FC<AIToolPanelProps> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'models' | 'settings'>('generate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleOneClickGenerate = async () => {
    if (!projectId) return;
    
    setIsGenerating(true);
    setProgress(0);
    
    // 模拟生成进度
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

  return (
    <div className="ai-tool-panel">
      <h2>AI工具面板</h2>
      
      <div className="tabs">
        <button 
          className={activeTab === 'generate' ? 'active' : ''}
          onClick={() => setActiveTab('generate')}
        >
          生成
        </button>
        <button 
          className={activeTab === 'models' ? 'active' : ''}
          onClick={() => setActiveTab('models')}
        >
          模型
        </button>
        <button 
          className={activeTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveTab('settings')}
        >
          设置
        </button>
      </div>

      {activeTab === 'generate' && (
        <div className="generate-panel">
          <button 
            onClick={handleOneClickGenerate}
            disabled={isGenerating || !projectId}
            className="one-click-generate"
          >
            {isGenerating ? '生成中...' : '一键生成漫剧'}
          </button>
          
          {isGenerating && (
            <div className="progress-bar">
              <div className="progress" style={{ width: `${progress}%` }}></div>
              <span>{progress}%</span>
            </div>
          )}
          
          <div className="step-controls">
            <h3>分步控制</h3>
            <button disabled={!projectId}>1. 生成剧本</button>
            <button disabled={!projectId}>2. 生成分镜</button>
            <button disabled={!projectId}>3. 生成图像</button>
            <button disabled={!projectId}>4. 生成配音</button>
            <button disabled={!projectId}>5. 添加特效</button>
            <button disabled={!projectId}>6. 合成视频</button>
          </div>
        </div>
      )}

      {activeTab === 'models' && (
        <div className="models-panel">
          <h3>AI模型选择</h3>
          <div className="model-select">
            <label>文本生成模型：</label>
            <select>
              <option value="gpt-4">GPT-4</option>
              <option value="claude-3">Claude-3</option>
            </select>
          </div>
          <div className="model-select">
            <label>图像生成模型：</label>
            <select>
              <option value="dall-e-3">DALL-E 3</option>
              <option value="stable-diffusion">Stable Diffusion</option>
            </select>
          </div>
          <div className="model-select">
            <label>语音合成模型：</label>
            <select>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="azure">Azure Speech</option>
            </select>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="settings-panel">
          <h3>生成设置</h3>
          <div className="setting-item">
            <label>生成质量：</label>
            <select>
              <option value="low">低质量（快速）</option>
              <option value="medium">中等质量</option>
              <option value="high">高质量（慢速）</option>
            </select>
          </div>
          <div className="setting-item">
            <label>输出格式：</label>
            <select>
              <option value="mp4">MP4</option>
              <option value="gif">GIF</option>
              <option value="webm">WebM</option>
            </select>
          </div>
          <div className="setting-item">
            <label>分辨率：</label>
            <select>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4k">4K</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIToolPanel;