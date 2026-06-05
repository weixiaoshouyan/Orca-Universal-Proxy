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
      characterId: 'male_1',
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