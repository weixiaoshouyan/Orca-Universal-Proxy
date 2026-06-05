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
              emotion: '坚定',
              timestamp: 0
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