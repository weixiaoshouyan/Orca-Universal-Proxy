import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

export interface AppConfig {
  openai: {
    apiKey: string;
    baseUrl: string;
  };
  elevenlabs: {
    apiKey: string;
  };
  stability: {
    apiKey: string;
  };
  project: {
    defaultTheme: string;
    defaultStyle: string;
    defaultDuration: number;
    defaultQuality: string;
  };
  output: {
    dir: string;
    tempDir: string;
  };
  log: {
    level: string;
    file: string;
  };
}

export function loadConfig(): AppConfig {
  return {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY || ''
    },
    stability: {
      apiKey: process.env.STABILITY_API_KEY || ''
    },
    project: {
      defaultTheme: process.env.DEFAULT_THEME || 'xianxia',
      defaultStyle: process.env.DEFAULT_STYLE || 'manga',
      defaultDuration: parseInt(process.env.DEFAULT_DURATION || '120'),
      defaultQuality: process.env.DEFAULT_QUALITY || 'high'
    },
    output: {
      dir: process.env.OUTPUT_DIR || './output',
      tempDir: process.env.TEMP_DIR || './temp'
    },
    log: {
      level: process.env.LOG_LEVEL || 'info',
      file: process.env.LOG_FILE || './logs/app.log'
    }
  };
}

export function getAIModelConfig(): any {
  const config = loadConfig();
  
  return {
    textModel: 'gpt-4',
    imageModel: 'dall-e-3',
    voiceModel: 'elevenlabs',
    videoModel: 'runway',
    apiKeys: {
      openai: config.openai.apiKey,
      elevenlabs: config.elevenlabs.apiKey,
      stability: config.stability.apiKey
    }
  };
}