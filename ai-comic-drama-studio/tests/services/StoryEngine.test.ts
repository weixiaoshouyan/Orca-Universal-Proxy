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