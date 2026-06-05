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
    const result = await manager.generateText({
      prompt: '写一个玄幻修仙故事开头',
      maxTokens: 100,
      temperature: 0.7
    });
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
  });

  test('should generate image using AI model', async () => {
    const result = await manager.generateImage({
      prompt: '仙侠风格的山峰',
      style: 'vivid',
      size: '1024x1024'
    });
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
  });

  test('should generate audio using AI model', async () => {
    const result = await manager.generateAudio({
      text: '你好，世界',
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      speed: 1.0
    });
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
  });
});