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
    const emotions: Record<string, string> = {
      '愤怒': '特写镜头，强调愤怒表情',
      '悲伤': '中景镜头，展现悲伤姿态',
      '快乐': '全景镜头，展现欢快场景',
      '坚定': '低角度镜头，展现坚定意志'
    };

    return emotions[dialogue.emotion] || '标准构图';
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