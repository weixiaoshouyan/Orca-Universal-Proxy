import React, { useState } from 'react';

interface StoryEditorProps {
  projectId: string;
}

const StoryEditor: React.FC<StoryEditorProps> = ({ projectId }) => {
  const [topic, setTopic] = useState('');
  const [outline, setOutline] = useState('');
  const [characters, setCharacters] = useState<any[]>([]);
  const [scenes, setScenes] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateStory = async () => {
    if (!topic.trim()) return;
    
    setIsGenerating(true);
    
    // 这里应该调用后端API生成故事
    // 目前使用模拟数据
    setTimeout(() => {
      setOutline(`关于"${topic}"的玄幻修仙故事大纲：
      
      开头：主角意外获得修仙机缘
      发展：开始修炼，遇到各种挑战
      高潮：与反派展开决战
      结局：成功突破，成为强者`);
      
      setCharacters([
        {
          id: 'char_1',
          name: '林风',
          description: '天赋异禀的修仙少年',
          appearance: '英俊潇洒，身穿白色道袍',
          voiceType: 'male_1'
        },
        {
          id: 'char_2',
          name: '苏瑶',
          description: '神秘的修仙少女',
          appearance: '美丽动人，身穿紫色仙裙',
          voiceType: 'female_1'
        }
      ]);
      
      setScenes([
        {
          id: 'scene_1',
          name: '仙山之巅',
          description: '云雾缭绕的山峰',
          dialogues: [
            { characterId: 'char_1', text: '我要开始修仙了', emotion: '坚定' }
          ],
          duration: 30
        }
      ]);
      
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="story-editor">
      <h1>故事编辑器</h1>
      
      <div className="story-input">
        <h2>故事主题</h2>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="输入故事主题，例如：修仙少年逆袭"
          rows={3}
        />
        <button onClick={handleGenerateStory} disabled={isGenerating}>
          {isGenerating ? '生成中...' : 'AI生成故事'}
        </button>
      </div>

      {outline && (
        <div className="story-outline">
          <h2>故事大纲</h2>
          <textarea
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            rows={10}
          />
        </div>
      )}

      {characters.length > 0 && (
        <div className="story-characters">
          <h2>角色列表</h2>
          {characters.map((character) => (
            <div key={character.id} className="character-card">
              <h3>{character.name}</h3>
              <p><strong>描述：</strong>{character.description}</p>
              <p><strong>外貌：</strong>{character.appearance}</p>
            </div>
          ))}
        </div>
      )}

      {scenes.length > 0 && (
        <div className="story-scenes">
          <h2>场景列表</h2>
          {scenes.map((scene) => (
            <div key={scene.id} className="scene-card">
              <h3>{scene.name}</h3>
              <p><strong>描述：</strong>{scene.description}</p>
              <p><strong>时长：</strong>{scene.duration}秒</p>
              <div className="dialogues">
                <h4>对话：</h4>
                {scene.dialogues.map((dialogue: any, index: number) => (
                  <div key={index} className="dialogue">
                    <span className="emotion">[{dialogue.emotion}]</span>
                    <span className="text">{dialogue.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StoryEditor;