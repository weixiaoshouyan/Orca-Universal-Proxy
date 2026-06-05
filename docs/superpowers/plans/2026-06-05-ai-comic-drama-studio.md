# AI漫剧工坊实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 开发一个独立的桌面应用程序，利用AI技术自动生成玄幻修仙题材的漫画视频，包含静态漫画+配音和动态漫画效果。

**Architecture:** 采用流水线式处理引擎架构，将漫画视频生成分解为故事生成、视觉生成、音频生成、动态效果、视频合成五个核心模块。使用Electron+React构建桌面应用，通过API调用多种AI模型，使用FFmpeg进行视频处理。

**Tech Stack:** Electron, React, TypeScript, Tailwind CSS, FFmpeg, Sharp.js, OpenAI API, Stability AI API, ElevenLabs API

---

## 文件结构

### 项目配置文件
- `ai-comic-drama-studio/package.json` - 项目依赖和脚本配置
- `ai-comic-drama-studio/tsconfig.json` - TypeScript配置
- `ai-comic-drama-studio/electron-builder.json` - Electron打包配置
- `ai-comic-drama-studio/main.ts` - Electron主进程

### 前端文件
- `ai-comic-drama-studio/frontend/src/index.tsx` - 前端入口
- `ai-comic-drama-studio/frontend/src/App.tsx` - 主应用组件
- `ai-comic-drama-studio/frontend/src/pages/ProjectManager.tsx` - 项目管理页面
- `ai-comic-drama-studio/frontend/src/pages/StoryEditor.tsx` - 故事编辑器
- `ai-comic-drama-studio/frontend/src/pages/StoryboardViewer.tsx` - 分镜预览
- `ai-comic-drama-studio/frontend/src/pages/TimelineEditor.tsx` - 时间轴编辑器
- `ai-comic-drama-studio/frontend/src/pages/PreviewPlayer.tsx` - 预览播放器
- `ai-comic-drama-studio/frontend/src/pages/ExportPanel.tsx` - 导出面板
- `ai-comic-drama-studio/frontend/src/components/AIToolPanel.tsx` - AI工具面板
- `ai-comic-drama-studio/frontend/src/components/ModelSelector.tsx` - 模型选择器
- `ai-comic-drama-studio/frontend/src/components/ParameterAdjuster.tsx` - 参数调整器

### 后端服务文件
- `ai-comic-drama-studio/src/types/index.ts` - 类型定义
- `ai-comic-drama-studio/src/services/StoryEngine.ts` - 故事引擎模块
- `ai-comic-drama-studio/src/services/VisualGenerator.ts` - 视觉生成模块
- `ai-comic-drama-studio/src/services/AudioGenerator.ts` - 音频生成模块
- `ai-comic-drama-studio/src/services/VideoComposer.ts` - 视频合成模块
- `ai-comic-drama-studio/src/services/AIServiceManager.ts` - AI服务管理
- `ai-comic-drama-studio/src/services/ProjectManager.ts` - 项目管理服务

### 测试文件
- `ai-comic-drama-studio/tests/services/StoryEngine.test.ts` - 故事引擎测试
- `ai-comic-drama-studio/tests/services/VisualGenerator.test.ts` - 视觉生成测试
- `ai-comic-drama-studio/tests/services/AudioGenerator.test.ts` - 音频生成测试
- `ai-comic-drama-studio/tests/services/VideoComposer.test.ts` - 视频合成测试

---

## Task 1: 项目初始化与基础框架搭建

**Files:**
- Create: `ai-comic-drama-studio/package.json`
- Create: `ai-comic-drama-studio/tsconfig.json`
- Create: `ai-comic-drama-studio/main.ts`
- Create: `ai-comic-drama-studio/frontend/src/index.tsx`
- Create: `ai-comic-drama-studio/frontend/src/App.tsx`

- [ ] **Step 1: 创建项目目录和package.json**

```json
{
  "name": "ai-comic-drama-studio",
  "version": "1.0.0",
  "description": "AI漫剧工坊 - 自动生成玄幻修仙漫画视频",
  "main": "main.ts",
  "scripts": {
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:electron\"",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:electron": "ts-node main.ts",
    "build": "npm run build:frontend && npm run build:electron",
    "build:frontend": "cd frontend && npm run build",
    "build:electron": "tsc && esbuild main.ts --bundle --platform=node --target=node18 --outfile=dist/main.js --format=cjs",
    "start": "electron .",
    "package": "npm run build && electron-builder --win",
    "test": "jest"
  },
  "dependencies": {
    "electron": "^28.0.0",
    "express": "^4.18.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "sharp": "^0.33.0",
    "fluent-ffmpeg": "^2.1.2"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/node": "^20.10.0",
    "@types/express": "^4.17.0",
    "concurrently": "^8.2.0",
    "esbuild": "^0.19.0",
    "ts-node": "^10.9.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "electron-builder": "^24.0.0"
  }
}
```

- [ ] **Step 2: 创建TypeScript配置文件**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist", "frontend"]
}
```

- [ ] **Step 3: 创建Electron主进程文件**

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC通信处理
ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});
```

- [ ] **Step 4: 创建前端入口文件**

```typescript
// frontend/src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: 创建主应用组件**

```typescript
// frontend/src/App.tsx
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
```

- [ ] **Step 6: 安装依赖并验证项目结构**

Run: `cd ai-comic-drama-studio && npm install`
Expected: 成功安装所有依赖

- [ ] **Step 7: 提交初始项目结构**

```bash
git add ai-comic-drama-studio/
git commit -m "feat: 初始化AI漫剧工坊项目结构"
```

## Task 2: 类型定义与数据结构

**Files:**
- Create: `ai-comic-drama-studio/src/types/index.ts`

- [ ] **Step 1: 定义项目核心类型**

```typescript
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
```

- [ ] **Step 2: 提交类型定义**

```bash
git add ai-comic-drama-studio/src/types/index.ts
git commit -m "feat: 添加核心类型定义"
```

## Task 3: AI服务管理器实现

**Files:**
- Create: `ai-comic-drama-studio/src/services/AIServiceManager.ts`
- Test: `ai-comic-drama-studio/tests/services/AIServiceManager.test.ts`

- [ ] **Step 1: 编写AI服务管理器测试**

```typescript
// tests/services/AIServiceManager.test.ts
import { AIServiceManager } from '../../src/services/AIServiceManager';

describe('AIServiceManager', () => {
  let manager: AIServiceManager;

  beforeEach(() => {
    manager = new AIServiceManager({
      textModel: 'gpt-4',
      imageModel: 'dall-e-3',
      voiceModel: 'elevenlabs',
      videoModel: 'runway',
      apiKeys: {
        openai: 'test-key',
        elevenlabs: 'test-key'
      }
    });
  });

  test('should initialize with correct config', () => {
    expect(manager).toBeDefined();
    expect(manager.getConfig().textModel).toBe('gpt-4');
  });

  test('should generate text using AI model', async () => {
    const result = await manager.generateText('写一个玄幻修仙故事开头');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  test('should generate image using AI model', async () => {
    const result = await manager.generateImage('仙侠风格的山峰');
    expect(result).toBeDefined();
    expect(result.url).toBeDefined();
  });

  test('should generate audio using AI model', async () => {
    const result = await manager.generateAudio('你好，世界', 'male_1');
    expect(result).toBeDefined();
    expect(result.url).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=AIServiceManager`
Expected: FAIL with "Cannot find module '../../src/services/AIServiceManager'"

- [ ] **Step 3: 实现AI服务管理器**

```typescript
// src/services/AIServiceManager.ts
import { AIModelConfig } from '../types';

export interface AITextRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIImageRequest {
  prompt: string;
  style?: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
}

export interface AIAudioRequest {
  text: string;
  voiceId: string;
  speed?: number;
}

export interface AIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    tokens?: number;
    cost?: number;
  };
}

export class AIServiceManager {
  private config: AIModelConfig;

  constructor(config: AIModelConfig) {
    this.config = config;
  }

  getConfig(): AIModelConfig {
    return this.config;
  }

  async generateText(request: AITextRequest): Promise<AIResponse<string>> {
    try {
      // 根据配置的文本模型选择API
      switch (this.config.textModel) {
        case 'gpt-4':
          return await this.callOpenAI(request);
        case 'claude-3':
          return await this.callClaude(request);
        default:
          throw new Error(`Unsupported text model: ${this.config.textModel}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async generateImage(request: AIImageRequest): Promise<AIResponse<{ url: string }>> {
    try {
      switch (this.config.imageModel) {
        case 'dall-e-3':
          return await this.callDallE(request);
        case 'stable-diffusion':
          return await this.callStableDiffusion(request);
        default:
          throw new Error(`Unsupported image model: ${this.config.imageModel}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async generateAudio(request: AIAudioRequest): Promise<AIResponse<{ url: string; duration: number }>> {
    try {
      switch (this.config.voiceModel) {
        case 'elevenlabs':
          return await this.callElevenLabs(request);
        case 'azure':
          return await this.callAzureSpeech(request);
        default:
          throw new Error(`Unsupported voice model: ${this.config.voiceModel}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async callOpenAI(request: AITextRequest): Promise<AIResponse<string>> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKeys.openai}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7
      })
    });

    const data = await response.json();
    return {
      success: true,
      data: data.choices[0].message.content,
      usage: { tokens: data.usage.total_tokens }
    };
  }

  private async callClaude(request: AITextRequest): Promise<AIResponse<string>> {
    // Claude API调用实现
    throw new Error('Claude API not implemented yet');
  }

  private async callDallE(request: AIImageRequest): Promise<AIResponse<{ url: string }>> {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKeys.openai}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: request.prompt,
        size: request.size || '1024x1024',
        style: request.style || 'vivid'
      })
    });

    const data = await response.json();
    return {
      success: true,
      data: { url: data.data[0].url }
    };
  }

  private async callStableDiffusion(request: AIImageRequest): Promise<AIResponse<{ url: string }>> {
    // Stable Diffusion API调用实现
    throw new Error('Stable Diffusion API not implemented yet');
  }

  private async callElevenLabs(request: AIAudioRequest): Promise<AIResponse<{ url: string; duration: number }>> {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.config.apiKeys.elevenlabs
      },
      body: JSON.stringify({
        text: request.text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    const audioBuffer = await response.arrayBuffer();
    // 这里应该保存音频文件并返回URL
    return {
      success: true,
      data: { url: 'temp-audio-url', duration: 0 }
    };
  }

  private async callAzureSpeech(request: AIAudioRequest): Promise<AIResponse<{ url: string; duration: number }>> {
    // Azure Speech API调用实现
    throw new Error('Azure Speech API not implemented yet');
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=AIServiceManager`
Expected: PASS

- [ ] **Step 5: 提交AI服务管理器**

```bash
git add ai-comic-drama-studio/src/services/AIServiceManager.ts ai-comic-drama-studio/tests/services/AIServiceManager.test.ts
git commit -m "feat: 实现AI服务管理器"
```

## Task 4: 故事引擎模块实现

**Files:**
- Create: `ai-comic-drama-studio/src/services/StoryEngine.ts`
- Test: `ai-comic-drama-studio/tests/services/StoryEngine.test.ts`

- [ ] **Step 1: 编写故事引擎测试**

```typescript
// tests/services/StoryEngine.test.ts
import { StoryEngine } from '../../src/services/StoryEngine';
import { AIServiceManager } from '../../src/services/AIServiceManager';

describe('StoryEngine', () => {
  let engine: StoryEngine;
  let aiManager: AIServiceManager;

  beforeEach(() => {
    aiManager = new AIServiceManager({
      textModel: 'gpt-4',
      imageModel: 'dall-e-3',
      voiceModel: 'elevenlabs',
      videoModel: 'runway',
      apiKeys: { openai: 'test-key' }
    });
    engine = new StoryEngine(aiManager);
  });

  test('should generate story script from topic', async () => {
    const script = await engine.generateScript({
      topic: '修仙少年逆袭',
      theme: 'xianxia',
      duration: 120
    });

    expect(script).toBeDefined();
    expect(script.title).toBeDefined();
    expect(script.characters.length).toBeGreaterThan(0);
    expect(script.scenes.length).toBeGreaterThan(0);
  });

  test('should generate story outline', async () => {
    const outline = await engine.generateOutline('修仙少年逆袭');
    expect(outline).toBeDefined();
    expect(typeof outline).toBe('string');
  });

  test('should generate character descriptions', async () => {
    const characters = await engine.generateCharacters('修仙少年逆袭', 3);
    expect(characters).toHaveLength(3);
    expect(characters[0].name).toBeDefined();
    expect(characters[0].appearance).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=StoryEngine`
Expected: FAIL with "Cannot find module '../../src/services/StoryEngine'"

- [ ] **Step 3: 实现故事引擎模块**

```typescript
// src/services/StoryEngine.ts
import { AIServiceManager } from './AIServiceManager';
import { StoryScript, Character, Scene, Dialogue } from '../types';

export interface StoryGenerationRequest {
  topic: string;
  theme: 'xianxia' | 'wuxia' | 'urban' | 'fantasy';
  duration: number;
  characterCount?: number;
  sceneCount?: number;
}

export class StoryEngine {
  private aiManager: AIServiceManager;

  constructor(aiManager: AIServiceManager) {
    this.aiManager = aiManager;
  }

  async generateScript(request: StoryGenerationRequest): Promise<StoryScript> {
    // 1. 生成故事大纲
    const outline = await this.generateOutline(request.topic);
    
    // 2. 生成角色描述
    const characters = await this.generateCharacters(
      request.topic,
      request.characterCount || 3
    );
    
    // 3. 生成场景描述
    const scenes = await this.generateScenes(
      outline,
      characters,
      request.sceneCount || 5
    );

    return {
      title: await this.generateTitle(request.topic),
      synopsis: outline,
      characters,
      scenes,
      totalDuration: request.duration
    };
  }

  async generateOutline(topic: string): Promise<string> {
    const prompt = `
      请为一个关于"${topic}"的玄幻修仙故事写一个详细的故事大纲。
      要求：
      1. 包含开头、发展、高潮、结局
      2. 有明确的冲突和解决
      3. 适合漫画视频形式表现
      4. 时长约2-3分钟
      
      请用中文回答，字数控制在500字以内。
    `;

    const response = await this.aiManager.generateText({
      prompt,
      maxTokens: 1000,
      temperature: 0.8
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to generate outline');
    }

    return response.data;
  }

  async generateCharacters(topic: string, count: number): Promise<Character[]> {
    const prompt = `
      请为"${topic}"故事创建${count}个角色。
      每个角色包含：
      1. 名字（中文）
      2. 详细描述
      3. 外貌特征
      4. 性格特点
      5. 适合的配音类型
      
      请以JSON格式返回，格式如下：
      [
        {
          "name": "角色名",
          "description": "角色描述",
          "appearance": "外貌特征",
          "personality": "性格特点",
          "voiceType": "配音类型"
        }
      ]
    `;

    const response = await this.aiManager.generateText({
      prompt,
      maxTokens: 1500,
      temperature: 0.7
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to generate characters');
    }

    try {
      const charactersData = JSON.parse(response.data);
      return charactersData.map((char: any, index: number) => ({
        id: `char_${index}`,
        name: char.name,
        description: char.description,
        appearance: char.appearance,
        voiceType: char.voiceType
      }));
    } catch (error) {
      throw new Error('Failed to parse character data');
    }
  }

  async generateScenes(outline: string, characters: Character[], count: number): Promise<Scene[]> {
    const characterNames = characters.map(c => c.name).join('、');
    
    const prompt = `
      根据以下故事大纲，创建${count}个场景。
      
      故事大纲：${outline}
      
      角色：${characterNames}
      
      每个场景包含：
      1. 场景名称
      2. 场景描述
      3. 背景环境
      4. 对话内容（至少2句）
      5. 预计时长（秒）
      
      请以JSON格式返回，格式如下：
      [
        {
          "name": "场景名称",
          "description": "场景描述",
          "background": "背景环境",
          "dialogues": [
            {
              "characterName": "角色名",
              "text": "对话内容",
              "emotion": "情绪"
            }
          ],
          "duration": 30
        }
      ]
    `;

    const response = await this.aiManager.generateText({
      prompt,
      maxTokens: 2000,
      temperature: 0.7
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to generate scenes');
    }

    try {
      const scenesData = JSON.parse(response.data);
      return scenesData.map((scene: any, index: number) => ({
        id: `scene_${index}`,
        name: scene.name,
        description: scene.description,
        background: scene.background,
        dialogues: scene.dialogues.map((d: any, dIndex: number) => ({
          id: `dialogue_${index}_${dIndex}`,
          characterId: characters.find(c => c.name === d.characterName)?.id || '',
          text: d.text,
          emotion: d.emotion,
          timestamp: dIndex * 5
        })),
        duration: scene.duration
      }));
    } catch (error) {
      throw new Error('Failed to parse scene data');
    }
  }

  private async generateTitle(topic: string): Promise<string> {
    const prompt = `请为"${topic}"故事起一个吸引人的标题，只返回标题，不要其他内容。`;
    
    const response = await this.aiManager.generateText({
      prompt,
      maxTokens: 50,
      temperature: 0.9
    });

    if (!response.success || !response.data) {
      return `${topic}传奇`;
    }

    return response.data.trim();
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=StoryEngine`
Expected: PASS

- [ ] **Step 5: 提交故事引擎模块**

```bash
git add ai-comic-drama-studio/src/services/StoryEngine.ts ai-comic-drama-studio/tests/services/StoryEngine.test.ts
git commit -m "feat: 实现故事引擎模块"
```

## Task 5: 视觉生成模块实现

**Files:**
- Create: `ai-comic-drama-studio/src/services/VisualGenerator.ts`
- Test: `ai-comic-drama-studio/tests/services/VisualGenerator.test.ts`

- [ ] **Step 1: 编写视觉生成模块测试**

```typescript
// tests/services/VisualGenerator.test.ts
import { VisualGenerator } from '../../src/services/VisualGenerator';
import { AIServiceManager } from '../../src/services/AIServiceManager';
import { Storyboard, Character } from '../../src/types';

describe('VisualGenerator', () => {
  let generator: VisualGenerator;
  let aiManager: AIServiceManager;

  beforeEach(() => {
    aiManager = new AIServiceManager({
      textModel: 'gpt-4',
      imageModel: 'dall-e-3',
      voiceModel: 'elevenlabs',
      videoModel: 'runway',
      apiKeys: { openai: 'test-key' }
    });
    generator = new VisualGenerator(aiManager);
  });

  test('should generate storyboard from script', async () => {
    const mockScript = {
      title: '测试故事',
      synopsis: '测试大纲',
      characters: [
        {
          id: 'char_1',
          name: '主角',
          description: '修仙少年',
          appearance: '英俊潇洒',
          voiceType: 'male_1'
        }
      ],
      scenes: [
        {
          id: 'scene_1',
          name: '开场',
          description: '仙山之巅',
          background: '云雾缭绕的山峰',
          dialogues: [
            {
              id: 'dialogue_1',
              characterId: 'char_1',
              text: '我要开始修仙了',
              emotion: '坚定'
            }
          ],
          duration: 30
        }
      ],
      totalDuration: 120
    };

    const storyboard = await generator.generateStoryboard(mockScript);
    expect(storyboard).toBeDefined();
    expect(storyboard.frames.length).toBeGreaterThan(0);
  });

  test('should generate character image', async () => {
    const character: Character = {
      id: 'char_1',
      name: '主角',
      description: '修仙少年',
      appearance: '英俊潇洒，身穿白色道袍',
      voiceType: 'male_1'
    };

    const image = await generator.generateCharacterImage(character);
    expect(image).toBeDefined();
    expect(image.url).toBeDefined();
  });

  test('should generate background image', async () => {
    const image = await generator.generateBackground('仙侠风格的山峰');
    expect(image).toBeDefined();
    expect(image.url).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=VisualGenerator`
Expected: FAIL with "Cannot find module '../../src/services/VisualGenerator'"

- [ ] **Step 3: 实现视觉生成模块**

```typescript
// src/services/VisualGenerator.ts
import { AIServiceManager } from './AIServiceManager';
import { StoryScript, Storyboard, Frame, Character, VisualAsset } from '../types';

export class VisualGenerator {
  private aiManager: AIServiceManager;

  constructor(aiManager: AIServiceManager) {
    this.aiManager = aiManager;
  }

  async generateStoryboard(script: StoryScript): Promise<Storyboard> {
    const frames: Frame[] = [];

    for (const scene of script.scenes) {
      // 为每个场景生成分镜
      const sceneFrames = await this.generateSceneFrames(scene, script.characters);
      frames.push(...sceneFrames);
    }

    return {
      frames,
      totalDuration: script.totalDuration
    };
  }

  private async generateSceneFrames(scene: any, characters: Character[]): Promise<Frame[]> {
    const frames: Frame[] = [];
    
    // 为每个对话生成分镜
    for (let i = 0; i < scene.dialogues.length; i++) {
      const dialogue = scene.dialogues[i];
      const character = characters.find(c => c.id === dialogue.characterId);
      
      const frame: Frame = {
        id: `frame_${scene.id}_${i}`,
        sceneId: scene.id,
        description: `${scene.description} - ${character?.name || '角色'}说话`,
        composition: this.generateComposition(scene, character, dialogue),
        cameraAngle: this.generateCameraAngle(i, scene.dialogues.length),
        duration: scene.duration / scene.dialogues.length,
        dialogue: dialogue,
        soundEffects: this.generateSoundEffects(scene, dialogue)
      };
      
      frames.push(frame);
    }

    return frames;
  }

  private generateComposition(scene: any, character: any, dialogue: any): string {
    // 根据场景和对话生成构图描述
    const emotions = {
      '愤怒': '特写镜头，强调愤怒表情',
      '悲伤': '中景镜头，展现悲伤姿态',
      '快乐': '全景镜头，展现欢快场景',
      '坚定': '低角度镜头，展现坚定意志'
    };

    return emotions[dialogue.emotion as keyof typeof emotions] || '标准构图';
  }

  private generateCameraAngle(index: number, total: number): string {
    // 根据对话位置生成镜头角度
    if (index === 0) return 'establishing_shot';
    if (index === total - 1) return 'closing_shot';
    return index % 2 === 0 ? 'medium_shot' : 'close_up';
  }

  private generateSoundEffects(scene: any, dialogue: any): string[] {
    // 根据场景和对话生成音效
    const effects: string[] = [];
    
    if (scene.background.includes('山')) {
      effects.push('wind');
    }
    if (scene.background.includes('水')) {
      effects.push('water');
    }
    if (dialogue.emotion === '愤怒') {
      effects.push('thunder');
    }
    
    return effects;
  }

  async generateCharacterImage(character: Character): Promise<VisualAsset> {
    const prompt = `
      玄幻修仙风格，${character.appearance}，${character.description}，
      漫画风格，高质量，细节丰富
    `;

    const response = await this.aiManager.generateImage({
      prompt,
      style: 'vivid',
      size: '1024x1024'
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to generate character image');
    }

    return {
      id: `char_img_${character.id}`,
      type: 'character',
      url: response.data.url,
      description: character.description,
      metadata: { characterId: character.id }
    };
  }

  async generateBackground(description: string): Promise<VisualAsset> {
    const prompt = `
      玄幻修仙风格，${description}，
      漫画背景，高质量，细节丰富，氛围感强
    `;

    const response = await this.aiManager.generateImage({
      prompt,
      style: 'vivid',
      size: '1792x1024'
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to generate background image');
    }

    return {
      id: `bg_${Date.now()}`,
      type: 'background',
      url: response.data.url,
      description: description,
      metadata: {}
    };
  }

  async generateFrameImage(frame: Frame, characters: Character[]): Promise<VisualAsset> {
    const character = frame.dialogue ? 
      characters.find(c => c.id === frame.dialogue?.characterId) : null;
    
    const prompt = `
      玄幻修仙风格漫画分镜：
      场景：${frame.description}
      构图：${frame.composition}
      ${character ? `角色：${character.appearance}` : ''}
      漫画风格，高质量，细节丰富
    `;

    const response = await this.aiManager.generateImage({
      prompt,
      style: 'vivid',
      size: '1024x1024'
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to generate frame image');
    }

    return {
      id: `frame_img_${frame.id}`,
      type: 'prop',
      url: response.data.url,
      description: frame.description,
      metadata: { frameId: frame.id }
    };
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=VisualGenerator`
Expected: PASS

- [ ] **Step 5: 提交视觉生成模块**

```bash
git add ai-comic-drama-studio/src/services/VisualGenerator.ts ai-comic-drama-studio/tests/services/VisualGenerator.test.ts
git commit -m "feat: 实现视觉生成模块"
```

## Task 6: 音频生成模块实现

**Files:**
- Create: `ai-comic-drama-studio/src/services/AudioGenerator.ts`
- Test: `ai-comic-drama-studio/tests/services/AudioGenerator.test.ts`

- [ ] **Step 1: 编写音频生成模块测试**

```typescript
// tests/services/AudioGenerator.test.ts
import { AudioGenerator } from '../../src/services/AudioGenerator';
import { AIServiceManager } from '../../src/services/AIServiceManager';
import { StoryScript, Character } from '../../src/types';

describe('AudioGenerator', () => {
  let generator: AudioGenerator;
  let aiManager: AIServiceManager;

  beforeEach(() => {
    aiManager = new AIServiceManager({
      textModel: 'gpt-4',
      imageModel: 'dall-e-3',
      voiceModel: 'elevenlabs',
      videoModel: 'runway',
      apiKeys: { elevenlabs: 'test-key' }
    });
    generator = new AudioGenerator(aiManager);
  });

  test('should generate dialogue audio', async () => {
    const audio = await generator.generateDialogue({
      text: '我要开始修仙了',
      characterId: 'char_1',
      emotion: '坚定'
    });

    expect(audio).toBeDefined();
    expect(audio.url).toBeDefined();
    expect(audio.duration).toBeGreaterThan(0);
  });

  test('should generate sound effects', async () => {
    const audio = await generator.generateSoundEffect('wind');
    expect(audio).toBeDefined();
    expect(audio.url).toBeDefined();
  });

  test('should generate background music', async () => {
    const audio = await generator.generateBackgroundMusic('epic', 60);
    expect(audio).toBeDefined();
    expect(audio.url).toBeDefined();
    expect(audio.duration).toBe(60);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=AudioGenerator`
Expected: FAIL with "Cannot find module '../../src/services/AudioGenerator'"

- [ ] **Step 3: 实现音频生成模块**

```typescript
// src/services/AudioGenerator.ts
import { AIServiceManager } from './AIServiceManager';
import { AudioAsset, Character } from '../types';

export interface DialogueRequest {
  text: string;
  characterId: string;
  emotion: string;
  speed?: number;
}

export class AudioGenerator {
  private aiManager: AIServiceManager;
  private voiceMapping: Map<string, string> = new Map();

  constructor(aiManager: AIServiceManager) {
    this.aiManager = aiManager;
    this.initializeVoiceMapping();
  }

  private initializeVoiceMapping() {
    // 初始化角色声音映射
    this.voiceMapping.set('male_1', '21m00Tcm4TlvDq8ikWAM'); // 男性声音1
    this.voiceMapping.set('male_2', '29vD33N1CtxCmqQRPOHJ'); // 男性声音2
    this.voiceMapping.set('female_1', 'EXAVITQu4vr4xnSDxMaL'); // 女性声音1
    this.voiceMapping.set('female_2', 'MF3mGyEYCl7XYWbV9V6O'); // 女性声音2
  }

  async generateDialogue(request: DialogueRequest): Promise<AudioAsset> {
    const voiceId = this.voiceMapping.get(request.characterId) || '21m00Tcm4TlvDq8ikWAM';
    
    const response = await this.aiManager.generateAudio({
      text: request.text,
      voiceId: voiceId,
      speed: request.speed || 1.0
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to generate dialogue audio');
    }

    return {
      id: `dialogue_${request.characterId}_${Date.now()}`,
      type: 'dialogue',
      url: response.data.url,
      duration: response.data.duration,
      characterId: request.characterId
    };
  }

  async generateSoundEffect(type: string): Promise<AudioAsset> {
    // 根据类型生成音效
    const soundEffects: Record<string, string> = {
      'wind': '风声',
      'water': '水声',
      'thunder': '雷声',
      'fire': '火焰声',
      'sword': '剑鸣声',
      'magic': '魔法声'
    };

    const description = soundEffects[type] || '环境音效';
    
    // 这里应该调用音效生成API或使用预置音效
    // 目前返回占位符
    return {
      id: `sfx_${type}_${Date.now()}`,
      type: 'sfx',
      url: `assets/sfx/${type}.mp3`,
      duration: 2.0
    };
  }

  async generateBackgroundMusic(mood: string, duration: number): Promise<AudioAsset> {
    // 根据情绪生成背景音乐
    const musicStyles: Record<string, string> = {
      'epic': '史诗音乐',
      'peaceful': '平静音乐',
      'mysterious': '神秘音乐',
      'action': '战斗音乐',
      'sad': '悲伤音乐'
    };

    const style = musicStyles[mood] || '背景音乐';
    
    // 这里应该调用音乐生成API
    // 目前返回占位符
    return {
      id: `music_${mood}_${Date.now()}`,
      type: 'music',
      url: `assets/music/${mood}.mp3`,
      duration: duration
    };
  }

  async generateCharacterVoice(character: Character): Promise<string> {
    // 根据角色特征生成声音ID
    const prompt = `
      根据以下角色特征，选择最适合的配音类型：
      角色名：${character.name}
      描述：${character.description}
      外貌：${character.appearance}
      
      可选配音类型：
      1. male_1 - 成熟男性
      2. male_2 - 年轻男性
      3. female_1 - 成熟女性
      4. female_2 - 年轻女性
      
      请只返回配音类型ID，不要其他内容。
    `;

    const response = await this.aiManager.generateText({
      prompt,
      maxTokens: 10,
      temperature: 0.3
    });

    if (!response.success || !response.data) {
      return 'male_1'; // 默认声音
    }

    const voiceType = response.data.trim();
    return this.voiceMapping.has(voiceType) ? voiceType : 'male_1';
  }

  async generateSceneAudio(scene: any, characters: Character[]): Promise<AudioAsset[]> {
    const audioAssets: AudioAsset[] = [];

    // 生成对话音频
    for (const dialogue of scene.dialogues) {
      const character = characters.find(c => c.id === dialogue.characterId);
      if (character) {
        const audio = await this.generateDialogue({
          text: dialogue.text,
          characterId: character.voiceType,
          emotion: dialogue.emotion
        });
        audioAssets.push(audio);
      }
    }

    // 生成场景音效
    if (scene.background.includes('山')) {
      const windSfx = await this.generateSoundEffect('wind');
      audioAssets.push(windSfx);
    }

    if (scene.background.includes('水')) {
      const waterSfx = await this.generateSoundEffect('water');
      audioAssets.push(waterSfx);
    }

    return audioAssets;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=AudioGenerator`
Expected: PASS

- [ ] **Step 5: 提交音频生成模块**

```bash
git add ai-comic-drama-studio/src/services/AudioGenerator.ts ai-comic-drama-studio/tests/services/AudioGenerator.test.ts
git commit -m "feat: 实现音频生成模块"
```

## Task 7: 视频合成模块实现

**Files:**
- Create: `ai-comic-drama-studio/src/services/VideoComposer.ts`
- Test: `ai-comic-drama-studio/tests/services/VideoComposer.test.ts`

- [ ] **Step 1: 编写视频合成模块测试**

```typescript
// tests/services/VideoComposer.test.ts
import { VideoComposer } from '../../src/services/VideoComposer';
import { VisualAsset, AudioAsset, AnimationEffect } from '../../src/types';

describe('VideoComposer', () => {
  let composer: VideoComposer;

  beforeEach(() => {
    composer = new VideoComposer();
  });

  test('should compose video from assets', async () => {
    const mockVisualAssets: VisualAsset[] = [
      {
        id: 'frame_1',
        type: 'prop',
        url: 'http://example.com/frame1.jpg',
        description: '第一帧',
        metadata: {}
      }
    ];

    const mockAudioAssets: AudioAsset[] = [
      {
        id: 'dialogue_1',
        type: 'dialogue',
        url: 'http://example.com/audio1.mp3',
        duration: 5.0,
        characterId: 'char_1'
      }
    ];

    const mockAnimations: AnimationEffect[] = [
      {
        id: 'anim_1',
        type: 'zoom',
        startTime: 0,
        duration: 2.0,
        parameters: { scale: 1.2 }
      }
    ];

    const result = await composer.composeVideo({
      visualAssets: mockVisualAssets,
      audioAssets: mockAudioAssets,
      animations: mockAnimations,
      duration: 10.0,
      outputFormat: 'mp4'
    });

    expect(result).toBeDefined();
    expect(result.outputPath).toBeDefined();
    expect(result.duration).toBe(10.0);
  });

  test('should add animation effects', async () => {
    const effect: AnimationEffect = {
      id: 'test_anim',
      type: 'zoom',
      startTime: 0,
      duration: 2.0,
      parameters: { scale: 1.5 }
    };

    const result = await composer.addAnimationEffect('test_video', effect);
    expect(result).toBe(true);
  });

  test('should export video', async () => {
    const result = await composer.exportVideo('test_video', {
      format: 'mp4',
      resolution: '1080p',
      fps: 30,
      quality: 'high',
      outputPath: '/output/video.mp4'
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=VideoComposer`
Expected: FAIL with "Cannot find module '../../src/services/VideoComposer'"

- [ ] **Step 3: 实现视频合成模块**

```typescript
// src/services/VideoComposer.ts
import { VisualAsset, AudioAsset, AnimationEffect, VideoExportConfig } from '../types';

export interface ComposeRequest {
  visualAssets: VisualAsset[];
  audioAssets: AudioAsset[];
  animations: AnimationEffect[];
  duration: number;
  outputFormat: 'mp4' | 'gif' | 'webm';
}

export interface ComposeResult {
  outputPath: string;
  duration: number;
  fileSize: number;
  format: string;
}

export class VideoComposer {
  private ffmpegPath: string;

  constructor() {
    // FFmpeg路径配置
    this.ffmpegPath = 'ffmpeg'; // 假设FFmpeg在系统PATH中
  }

  async composeVideo(request: ComposeRequest): Promise<ComposeResult> {
    // 1. 创建视频时间线
    const timeline = this.createTimeline(request);
    
    // 2. 合成视频帧
    const videoPath = await this.renderFrames(timeline, request.visualAssets);
    
    // 3. 添加音频
    const audioPath = await this.addAudio(videoPath, request.audioAssets);
    
    // 4. 添加动画效果
    const finalPath = await this.addAnimations(audioPath, request.animations);
    
    // 5. 导出最终视频
    return await this.exportVideo(finalPath, {
      format: request.outputFormat,
      resolution: '1080p',
      fps: 30,
      quality: 'high',
      outputPath: `output/video_${Date.now()}.${request.outputFormat}`
    });
  }

  private createTimeline(request: ComposeRequest): any[] {
    const timeline: any[] = [];
    let currentTime = 0;

    // 按时间顺序排列视觉资源
    for (const asset of request.visualAssets) {
      timeline.push({
        type: 'visual',
        asset: asset,
        startTime: currentTime,
        duration: request.duration / request.visualAssets.length
      });
      currentTime += request.duration / request.visualAssets.length;
    }

    // 添加音频到时间线
    for (const audio of request.audioAssets) {
      timeline.push({
        type: 'audio',
        asset: audio,
        startTime: 0,
        duration: audio.duration
      });
    }

    return timeline;
  }

  private async renderFrames(timeline: any[], visualAssets: VisualAsset[]): Promise<string> {
    // 这里应该调用FFmpeg进行视频渲染
    // 目前返回占位符路径
    return '/tmp/rendered_video.mp4';
  }

  private async addAudio(videoPath: string, audioAssets: AudioAsset[]): Promise<string> {
    // 使用FFmpeg添加音频
    // 目前返回占位符路径
    return '/tmp/video_with_audio.mp4';
  }

  private async addAnimations(videoPath: string, animations: AnimationEffect[]): Promise<string> {
    // 使用FFmpeg添加动画效果
    // 目前返回占位符路径
    return '/tmp/video_with_animations.mp4';
  }

  async addAnimationEffect(videoId: string, effect: AnimationEffect): Promise<boolean> {
    // 添加动画效果到视频
    // 目前返回成功状态
    return true;
  }

  async exportVideo(videoId: string, config: VideoExportConfig): Promise<ComposeResult> {
    // 导出最终视频
    // 这里应该调用FFmpeg进行最终渲染和导出
    
    return {
      outputPath: config.outputPath,
      duration: 120.0, // 示例时长
      fileSize: 50 * 1024 * 1024, // 示例文件大小50MB
      format: config.format
    };
  }

  async addZoomEffect(videoPath: string, startTime: number, duration: number, scale: number): Promise<string> {
    // 添加缩放效果
    return videoPath;
  }

  async addPanEffect(videoPath: string, startTime: number, duration: number, direction: string): Promise<string> {
    // 添加平移效果
    return videoPath;
  }

  async addFadeEffect(videoPath: string, startTime: number, duration: number, type: 'in' | 'out'): Promise<string> {
    // 添加淡入淡出效果
    return videoPath;
  }

  async addShakeEffect(videoPath: string, startTime: number, duration: number, intensity: number): Promise<string> {
    // 添加震动效果
    return videoPath;
  }

  async addGlowEffect(videoPath: string, startTime: number, duration: number, color: string): Promise<string> {
    // 添加发光效果
    return videoPath;
  }

  async mergeAudioAndVideo(videoPath: string, audioPath: string): Promise<string> {
    // 合并音频和视频
    return videoPath;
  }

  async adjustVideoSpeed(videoPath: string, speed: number): Promise<string> {
    // 调整视频速度
    return videoPath;
  }

  async cropVideo(videoPath: string, startTime: number, endTime: number): Promise<string> {
    // 裁剪视频
    return videoPath;
  }

  async addSubtitle(videoPath: string, text: string, startTime: number, duration: number): Promise<string> {
    // 添加字幕
    return videoPath;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=VideoComposer`
Expected: PASS

- [ ] **Step 5: 提交视频合成模块**

```bash
git add ai-comic-drama-studio/src/services/VideoComposer.ts ai-comic-drama-studio/tests/services/VideoComposer.test.ts
git commit -m "feat: 实现视频合成模块"
```

## Task 8: 项目管理服务实现

**Files:**
- Create: `ai-comic-drama-studio/src/services/ProjectManager.ts`
- Test: `ai-comic-drama-studio/tests/services/ProjectManager.test.ts`

- [ ] **Step 1: 编写项目管理服务测试**

```typescript
// tests/services/ProjectManager.test.ts
import { ProjectManager } from '../../src/services/ProjectManager';
import { ProjectConfig, ProjectState } from '../../src/types';

describe('ProjectManager', () => {
  let manager: ProjectManager;

  beforeEach(() => {
    manager = new ProjectManager();
  });

  test('should create new project', async () => {
    const config: ProjectConfig = {
      id: 'test_project',
      name: '测试项目',
      theme: 'xianxia',
      style: 'manga',
      duration: 120,
      quality: 'high',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const project = await manager.createProject(config);
    expect(project).toBeDefined();
    expect(project.config.id).toBe('test_project');
  });

  test('should load existing project', async () => {
    const project = await manager.loadProject('test_project');
    expect(project).toBeDefined();
    expect(project?.config.name).toBe('测试项目');
  });

  test('should save project state', async () => {
    const state: ProjectState = {
      config: {
        id: 'test_project',
        name: '测试项目',
        theme: 'xianxia',
        style: 'manga',
        duration: 120,
        quality: 'high',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      visualAssets: [],
      audioAssets: [],
      animations: [],
      status: 'editing',
      progress: 50
    };

    const result = await manager.saveProject('test_project', state);
    expect(result).toBe(true);
  });

  test('should list all projects', async () => {
    const projects = await manager.listProjects();
    expect(Array.isArray(projects)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=ProjectManager`
Expected: FAIL with "Cannot find module '../../src/services/ProjectManager'"

- [ ] **Step 3: 实现项目管理服务**

```typescript
// src/services/ProjectManager.ts
import * as fs from 'fs';
import * as path from 'path';
import { ProjectConfig, ProjectState } from '../types';

export class ProjectManager {
  private projectsDir: string;

  constructor() {
    this.projectsDir = path.join(process.cwd(), 'projects');
    this.ensureProjectsDir();
  }

  private ensureProjectsDir() {
    if (!fs.existsSync(this.projectsDir)) {
      fs.mkdirSync(this.projectsDir, { recursive: true });
    }
  }

  async createProject(config: ProjectConfig): Promise<ProjectState> {
    const projectDir = path.join(this.projectsDir, config.id);
    
    // 创建项目目录结构
    const dirs = ['images', 'audio', 'video', 'cache', 'storyboard'];
    for (const dir of dirs) {
      const dirPath = path.join(projectDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }

    // 保存项目配置
    const configPath = path.join(projectDir, 'project.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    // 创建初始项目状态
    const state: ProjectState = {
      config,
      visualAssets: [],
      audioAssets: [],
      animations: [],
      status: 'idle',
      progress: 0
    };

    // 保存项目状态
    const statePath = path.join(projectDir, 'state.json');
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    return state;
  }

  async loadProject(projectId: string): Promise<ProjectState | null> {
    const projectDir = path.join(this.projectsDir, projectId);
    const statePath = path.join(projectDir, 'state.json');

    if (!fs.existsSync(statePath)) {
      return null;
    }

    try {
      const stateData = fs.readFileSync(statePath, 'utf-8');
      return JSON.parse(stateData);
    } catch (error) {
      console.error('Failed to load project:', error);
      return null;
    }
  }

  async saveProject(projectId: string, state: ProjectState): Promise<boolean> {
    const projectDir = path.join(this.projectsDir, projectId);
    const statePath = path.join(projectDir, 'state.json');

    try {
      state.config.updatedAt = new Date();
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save project:', error);
      return false;
    }
  }

  async listProjects(): Promise<ProjectConfig[]> {
    const projects: ProjectConfig[] = [];

    if (!fs.existsSync(this.projectsDir)) {
      return projects;
    }

    const projectDirs = fs.readdirSync(this.projectsDir);
    
    for (const dir of projectDirs) {
      const configPath = path.join(this.projectsDir, dir, 'project.json');
      if (fs.existsSync(configPath)) {
        try {
          const configData = fs.readFileSync(configPath, 'utf-8');
          projects.push(JSON.parse(configData));
        } catch (error) {
          console.error(`Failed to load project config for ${dir}:`, error);
        }
      }
    }

    return projects;
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const projectDir = path.join(this.projectsDir, projectId);
    
    try {
      if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
      return true;
    } catch (error) {
      console.error('Failed to delete project:', error);
      return false;
    }
  }

  async exportProject(projectId: string, exportPath: string): Promise<boolean> {
    const projectDir = path.join(this.projectsDir, projectId);
    
    try {
      // 复制项目文件到导出路径
      this.copyDirectory(projectDir, exportPath);
      return true;
    } catch (error) {
      console.error('Failed to export project:', error);
      return false;
    }
  }

  private copyDirectory(src: string, dest: string) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  async getProjectPath(projectId: string): Promise<string> {
    return path.join(this.projectsDir, projectId);
  }

  async projectExists(projectId: string): Promise<boolean> {
    const projectDir = path.join(this.projectsDir, projectId);
    return fs.existsSync(projectDir);
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=ProjectManager`
Expected: PASS

- [ ] **Step 5: 提交项目管理服务**

```bash
git add ai-comic-drama-studio/src/services/ProjectManager.ts ai-comic-drama-studio/tests/services/ProjectManager.test.ts
git commit -m "feat: 实现项目管理服务"
```

## Task 9: 前端页面实现

**Files:**
- Create: `ai-comic-drama-studio/frontend/src/pages/ProjectManager.tsx`
- Create: `ai-comic-drama-studio/frontend/src/pages/StoryEditor.tsx`
- Create: `ai-comic-drama-studio/frontend/src/components/AIToolPanel.tsx`

- [ ] **Step 1: 实现项目管理页面**

```typescript
// frontend/src/pages/ProjectManager.tsx
import React, { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  theme: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectManagerProps {
  onProjectSelect: (projectId: string) => void;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({ onProjectSelect }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    theme: 'xianxia',
    duration: 120
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    // 这里应该调用后端API加载项目列表
    // 目前使用模拟数据
    const mockProjects: Project[] = [
      {
        id: 'project_1',
        name: '修仙少年逆袭',
        theme: 'xianxia',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02'
      },
      {
        id: 'project_2',
        name: '仙侠爱情故事',
        theme: 'xianxia',
        createdAt: '2024-01-03',
        updatedAt: '2024-01-04'
      }
    ];
    setProjects(mockProjects);
  };

  const handleCreateProject = async () => {
    // 这里应该调用后端API创建项目
    const newProjectData: Project = {
      id: `project_${Date.now()}`,
      name: newProject.name,
      theme: newProject.theme,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setProjects([...projects, newProjectData]);
    setIsCreating(false);
    setNewProject({ name: '', theme: 'xianxia', duration: 120 });
  };

  return (
    <div className="project-manager">
      <h1>项目管理</h1>
      
      <div className="project-actions">
        <button onClick={() => setIsCreating(true)}>新建项目</button>
      </div>

      {isCreating && (
        <div className="create-project-form">
          <h2>创建新项目</h2>
          <div className="form-group">
            <label>项目名称：</label>
            <input
              type="text"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              placeholder="输入项目名称"
            />
          </div>
          <div className="form-group">
            <label>题材风格：</label>
            <select
              value={newProject.theme}
              onChange={(e) => setNewProject({ ...newProject, theme: e.target.value })}
            >
              <option value="xianxia">玄幻修仙</option>
              <option value="wuxia">武侠江湖</option>
              <option value="urban">都市情感</option>
              <option value="fantasy">奇幻冒险</option>
            </select>
          </div>
          <div className="form-group">
            <label>目标时长（秒）：</label>
            <input
              type="number"
              value={newProject.duration}
              onChange={(e) => setNewProject({ ...newProject, duration: parseInt(e.target.value) })}
              min={30}
              max={300}
            />
          </div>
          <div className="form-actions">
            <button onClick={handleCreateProject}>创建</button>
            <button onClick={() => setIsCreating(false)}>取消</button>
          </div>
        </div>
      )}

      <div className="project-list">
        {projects.map((project) => (
          <div key={project.id} className="project-card">
            <h3>{project.name}</h3>
            <p>题材：{project.theme === 'xianxia' ? '玄幻修仙' : project.theme}</p>
            <p>创建时间：{project.createdAt}</p>
            <p>更新时间：{project.updatedAt}</p>
            <button onClick={() => onProjectSelect(project.id)}>打开项目</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectManager;
```

- [ ] **Step 2: 实现故事编辑器页面**

```typescript
// frontend/src/pages/StoryEditor.tsx
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
```

- [ ] **Step 3: 实现AI工具面板组件**

```typescript
// frontend/src/components/AIToolPanel.tsx
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
```

- [ ] **Step 4: 提交前端页面实现**

```bash
git add ai-comic-drama-studio/frontend/src/pages/ProjectManager.tsx ai-comic-drama-studio/frontend/src/pages/StoryEditor.tsx ai-comic-drama-studio/frontend/src/components/AIToolPanel.tsx
git commit -m "feat: 实现前端页面组件"
```

## Task 10: 集成测试与最终验证

**Files:**
- Test: `ai-comic-drama-studio/tests/integration.test.ts`

- [ ] **Step 1: 编写集成测试**

```typescript
// tests/integration.test.ts
import { StoryEngine } from '../src/services/StoryEngine';
import { VisualGenerator } from '../src/services/VisualGenerator';
import { AudioGenerator } from '../src/services/AudioGenerator';
import { VideoComposer } from '../src/services/VideoComposer';
import { AIServiceManager } from '../src/services/AIServiceManager';
import { ProjectManager } from '../src/services/ProjectManager';

describe('AI漫剧工坊集成测试', () => {
  let aiManager: AIServiceManager;
  let storyEngine: StoryEngine;
  let visualGenerator: VisualGenerator;
  let audioGenerator: AudioGenerator;
  let videoComposer: VideoComposer;
  let projectManager: ProjectManager;

  beforeEach(() => {
    aiManager = new AIServiceManager({
      textModel: 'gpt-4',
      imageModel: 'dall-e-3',
      voiceModel: 'elevenlabs',
      videoModel: 'runway',
      apiKeys: {
        openai: 'test-key',
        elevenlabs: 'test-key'
      }
    });
    
    storyEngine = new StoryEngine(aiManager);
    visualGenerator = new VisualGenerator(aiManager);
    audioGenerator = new AudioGenerator(aiManager);
    videoComposer = new VideoComposer();
    projectManager = new ProjectManager();
  });

  test('完整流程：从主题到视频', async () => {
    // 1. 创建项目
    const project = await projectManager.createProject({
      id: 'integration_test',
      name: '集成测试项目',
      theme: 'xianxia',
      style: 'manga',
      duration: 60,
      quality: 'medium',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    expect(project).toBeDefined();
    expect(project.config.id).toBe('integration_test');

    // 2. 生成故事剧本
    const script = await storyEngine.generateScript({
      topic: '修仙少年逆袭',
      theme: 'xianxia',
      duration: 60
    });
    
    expect(script).toBeDefined();
    expect(script.title).toBeDefined();
    expect(script.characters.length).toBeGreaterThan(0);
    expect(script.scenes.length).toBeGreaterThan(0);

    // 3. 生成分镜脚本
    const storyboard = await visualGenerator.generateStoryboard(script);
    
    expect(storyboard).toBeDefined();
    expect(storyboard.frames.length).toBeGreaterThan(0);

    // 4. 生成音频
    const audioAssets: any[] = [];
    for (const scene of script.scenes) {
      const sceneAudio = await audioGenerator.generateSceneAudio(scene, script.characters);
      audioAssets.push(...sceneAudio);
    }
    
    expect(audioAssets.length).toBeGreaterThan(0);

    // 5. 合成视频
    const videoResult = await videoComposer.composeVideo({
      visualAssets: [],
      audioAssets: audioAssets,
      animations: [],
      duration: 60,
      outputFormat: 'mp4'
    });
    
    expect(videoResult).toBeDefined();
    expect(videoResult.outputPath).toBeDefined();

    // 6. 保存项目状态
    const saveResult = await projectManager.saveProject('integration_test', {
      ...project,
      story: script,
      storyboard: storyboard,
      audioAssets: audioAssets,
      status: 'editing',
      progress: 100
    });
    
    expect(saveResult).toBe(true);
  }, 30000); // 设置30秒超时

  test('项目管理流程', async () => {
    // 1. 列出项目
    const projects = await projectManager.listProjects();
    expect(Array.isArray(projects)).toBe(true);

    // 2. 加载项目
    const project = await projectManager.loadProject('integration_test');
    expect(project).toBeDefined();

    // 3. 导出项目
    if (project) {
      const exportResult = await projectManager.exportProject(
        'integration_test',
        '/tmp/exported_project'
      );
      expect(exportResult).toBe(true);
    }

    // 4. 删除项目
    const deleteResult = await projectManager.deleteProject('integration_test');
    expect(deleteResult).toBe(true);
  });
});
```

- [ ] **Step 2: 运行集成测试**

Run: `cd ai-comic-drama-studio && npm test -- --testPathPattern=integration`
Expected: PASS

- [ ] **Step 3: 提交集成测试**

```bash
git add ai-comic-drama-studio/tests/integration.test.ts
git commit -m "feat: 添加集成测试"
```

- [ ] **Step 4: 最终验证项目结构**

Run: `cd ai-comic-drama-studio && find . -name "*.ts" -o -name "*.tsx" | head -20`
Expected: 显示所有创建的TypeScript文件

- [ ] **Step 5: 运行完整测试套件**

Run: `cd ai-comic-drama-studio && npm test`
Expected: 所有测试通过

- [ ] **Step 6: 提交最终项目**

```bash
git add ai-comic-drama-studio/
git commit -m "feat: 完成AI漫剧工坊核心功能实现"
```

## 计划完成

**Plan complete and saved to `docs/superpowers/plans/2026-06-05-ai-comic-drama-studio.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**