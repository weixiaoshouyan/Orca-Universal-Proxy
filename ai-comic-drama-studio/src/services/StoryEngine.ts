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