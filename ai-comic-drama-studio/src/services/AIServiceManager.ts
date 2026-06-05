import { AIModelConfig } from '../types';
import { getAIModelConfig } from '../config';

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

  constructor(config?: AIModelConfig) {
    this.config = config || getAIModelConfig();
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