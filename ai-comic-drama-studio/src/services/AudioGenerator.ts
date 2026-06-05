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