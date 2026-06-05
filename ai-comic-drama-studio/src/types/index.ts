// src/types/index.ts

// 项目配置
export interface ProjectConfig {
  id: string;
  name: string;
  theme: 'xianxia' | 'wuxia' | 'urban' | 'fantasy';
  style: 'manga' | 'comic' | 'realistic';
  duration: number; // 目标时长（秒）
  quality: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

// 故事剧本
export interface StoryScript {
  title: string;
  synopsis: string;
  characters: Character[];
  scenes: Scene[];
  totalDuration: number;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  appearance: string;
  voiceType: string;
}

export interface Scene {
  id: string;
  name: string;
  description: string;
  dialogues: Dialogue[];
  duration: number;
  background: string;
}

export interface Dialogue {
  id: string;
  characterId: string;
  text: string;
  emotion: string;
  timestamp: number;
}

// 分镜脚本
export interface Storyboard {
  frames: Frame[];
  totalDuration: number;
}

export interface Frame {
  id: string;
  sceneId: string;
  description: string;
  composition: string;
  cameraAngle: string;
  duration: number;
  dialogue?: Dialogue;
  soundEffects: string[];
}

// 视觉资源
export interface VisualAsset {
  id: string;
  type: 'character' | 'background' | 'prop' | 'effect';
  url: string;
  description: string;
  metadata: Record<string, any>;
}

// 音频资源
export interface AudioAsset {
  id: string;
  type: 'dialogue' | 'sfx' | 'music';
  url: string;
  duration: number;
  characterId?: string;
  sceneId?: string;
}

// 动态效果
export interface AnimationEffect {
  id: string;
  type: 'zoom' | 'pan' | 'fade' | 'shake' | 'glow';
  startTime: number;
  duration: number;
  parameters: Record<string, any>;
}

// 视频输出配置
export interface VideoExportConfig {
  format: 'mp4' | 'gif' | 'webm';
  resolution: '720p' | '1080p' | '4k';
  fps: 24 | 30 | 60;
  quality: 'low' | 'medium' | 'high';
  outputPath: string;
}

// AI模型配置
export interface AIModelConfig {
  textModel: 'gpt-4' | 'claude-3' | 'local';
  imageModel: 'dall-e-3' | 'stable-diffusion' | 'midjourney';
  voiceModel: 'elevenlabs' | 'azure' | 'local';
  videoModel: 'runway' | 'pika' | 'local';
  apiKeys: Record<string, string>;
}

// 项目状态
export interface ProjectState {
  config: ProjectConfig;
  story?: StoryScript;
  storyboard?: Storyboard;
  visualAssets: VisualAsset[];
  audioAssets: AudioAsset[];
  animations: AnimationEffect[];
  exportConfig?: VideoExportConfig;
  status: 'idle' | 'generating' | 'editing' | 'exporting';
  progress: number;
}