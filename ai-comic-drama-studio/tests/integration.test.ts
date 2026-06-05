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