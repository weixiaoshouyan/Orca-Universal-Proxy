// ============================================================
// src/providers.ts
// Multi-provider registry for Chinese LLM APIs
// ============================================================

export interface ProviderModel {
  id: string;
  name: string;
  maxTokens?: number;
  reasoning?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  apiKey?: string;
  models: ProviderModel[];
  openaiCompatible: boolean;
  description: string;
}

export const BUILTIN_PROVIDERS: Provider[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    openaiCompatible: true,
    description: "\u6DF1\u5EA6\u6C42\u7D22 - \u9AD8\u6027\u4EF7\u6BD4\u63A8\u7406\u6A21\u578B",
    models: [
      { id: "deepseek-chat", name: "DeepSeek Chat" },
      { id: "deepseek-reasoner", name: "DeepSeek Reasoner", reasoning: true },
    ],
  },
  {
    id: "qwen",
    name: "\u901A\u4E49\u5343\u95EE",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    openaiCompatible: true,
    description: "\u963F\u91CC\u4E91\u901A\u4E49\u5343\u95EE\u7CFB\u5217\u6A21\u578B",
    models: [
      { id: "qwen-turbo", name: "Qwen Turbo" },
      { id: "qwen-plus", name: "Qwen Plus" },
      { id: "qwen-max", name: "Qwen Max" },
      { id: "qwen-long", name: "Qwen Long", maxTokens: 10000 },
    ],
  },
  {
    id: "zhipu",
    name: "\u667A\u8C31AI",
    baseUrl: "https://open.bigmodel.cn/api/paas",
    apiKeyEnv: "ZHIPU_API_KEY",
    openaiCompatible: true,
    description: "\u667A\u8C31 GLM \u7CFB\u5217\u6A21\u578B",
    models: [
      { id: "glm-4-flash", name: "GLM-4 Flash" },
      { id: "glm-4", name: "GLM-4" },
      { id: "glm-4-long", name: "GLM-4 Long" },
    ],
  },
  {
    id: "moonshot",
    name: "\u6708\u4E4B\u6697\u9762",
    baseUrl: "https://api.moonshot.cn",
    apiKeyEnv: "MOONSHOT_API_KEY",
    openaiCompatible: true,
    description: "Moonshot / Kimi \u7CFB\u5217\u6A21\u578B",
    models: [
      { id: "moonshot-v1-8k", name: "Moonshot V1 8K" },
      { id: "moonshot-v1-32k", name: "Moonshot V1 32K" },
      { id: "moonshot-v1-128k", name: "Moonshot V1 128K" },
    ],
  },
  {
    id: "baichuan",
    name: "\u767E\u5DDD\u667A\u80FD",
    baseUrl: "https://api.baichuan-ai.com",
    apiKeyEnv: "BAICHUAN_API_KEY",
    openaiCompatible: true,
    description: "\u767E\u5DDD\u5927\u6A21\u578B",
    models: [
      { id: "Baichuan4", name: "Baichuan 4" },
      { id: "Baichuan3-Turbo", name: "Baichuan 3 Turbo" },
    ],
  },
  {
    id: "yi",
    name: "\u96F6\u4E00\u4E07\u7269",
    baseUrl: "https://api.lingyiwanwu.com",
    apiKeyEnv: "YI_API_KEY",
    openaiCompatible: true,
    description: "Yi / \u96F6\u4E00\u4E07\u7269\u7CFB\u5217\u6A21\u578B",
    models: [
      { id: "yi-large", name: "Yi Large" },
      { id: "yi-medium", name: "Yi Medium" },
      { id: "yi-spark", name: "Yi Spark" },
    ],
  },
  {
    id: "doubao",
    name: "\u8C46\u5305",
    baseUrl: "https://ark.cn-beijing.volces.com/api",
    apiKeyEnv: "DOUBAO_API_KEY",
    openaiCompatible: true,
    description: "\u706B\u5C71\u5F15\u64CE\u8C46\u5305\u5927\u6A21\u578B",
    models: [
      { id: "doubao-pro-4k", name: "Doubao Pro 4K" },
      { id: "doubao-pro-32k", name: "Doubao Pro 32K" },
      { id: "doubao-pro-128k", name: "Doubao Pro 128K" },
    ],
  },
  {
    id: "siliconflow",
    name: "\u7845\u57FA\u6D41\u52A8",
    baseUrl: "https://api.siliconflow.cn",
    apiKeyEnv: "SILICONFLOW_API_KEY",
    openaiCompatible: true,
    description: "SiliconFlow - \u591A\u6A21\u578B\u805A\u5408\u5E73\u53F0",
    models: [
      { id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3" },
      { id: "Qwen/Qwen2.5-72B-Instruct", name: "Qwen 2.5 72B" },
      { id: "meta-llama/Meta-Llama-3.1-70B-Instruct", name: "Llama 3.1 70B" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com",
    apiKeyEnv: "OPENAI_API_KEY",
    openaiCompatible: true,
    description: "OpenAI GPT \u7CFB\u5217\u6A21\u578B",
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    openaiCompatible: false,
    description: "Claude \u7CFB\u5217\u6A21\u578B",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
    ],
  },
];
import path from "path";
import fs from "fs";

export interface RuntimeConfig {
  activeProviderId: string;
  providerKeys: Record<string, string>;
  customProviders: Provider[];
  modelOverrides: Record<string, string>;
  port: number;
  logLevel: string;
}

const CONFIG_PATH = path.join(__dirname, "..", "data", "config.json");

function defaultConfig(): RuntimeConfig {
  return {
    activeProviderId: "deepseek",
    providerKeys: {},
    customProviders: [],
    modelOverrides: {},
    port: 3000,
    logLevel: "info",
  };
}

let _config: RuntimeConfig = null as any;

export function loadConfig(): RuntimeConfig {
  if (_config) return _config;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    _config = { ...defaultConfig(), ...JSON.parse(raw) };
  } catch {
    _config = defaultConfig();
    saveConfig(_config);
  }
  for (const p of BUILTIN_PROVIDERS) {
    if (p.apiKeyEnv && process.env[p.apiKeyEnv]) {
      if (!_config.providerKeys[p.id]) {
        _config.providerKeys[p.id] = process.env[p.apiKeyEnv]!;
      }
    }
  }
  if (process.env.DEEPSEEK_API_KEY && !_config.providerKeys["deepseek"]) {
    _config.providerKeys["deepseek"] = process.env.DEEPSEEK_API_KEY;
  }
  return _config;
}

export function saveConfig(cfg: RuntimeConfig): void {
  _config = cfg;
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save config:", e);
  }
}

export function getAllProviders(): Provider[] {
  const cfg = loadConfig();
  return [...BUILTIN_PROVIDERS, ...cfg.customProviders];
}

export function getProvider(id: string): Provider | undefined {
  return getAllProviders().find((p) => p.id === id);
}

export function getActiveProvider(): Provider {
  const cfg = loadConfig();
  return getProvider(cfg.activeProviderId) || BUILTIN_PROVIDERS[0];
}

export function getApiKey(providerId: string): string {
  const cfg = loadConfig();
  return cfg.providerKeys[providerId] || "";
}

export function resolveModel(requested: string): { provider: Provider; model: string; apiKey: string } {
  const cfg = loadConfig();
  if (cfg.modelOverrides[requested]) {
    const mapped = cfg.modelOverrides[requested];
    const [provId, modelId] = mapped.includes("/") ? mapped.split("/", 2) : [cfg.activeProviderId, mapped];
    const prov = getProvider(provId) || getActiveProvider();
    return { provider: prov, model: modelId, apiKey: getApiKey(prov.id) };
  }
  for (const prov of getAllProviders()) {
    if (prov.id === cfg.activeProviderId) continue;
    if (!getApiKey(prov.id)) continue;
    for (const m of prov.models) {
      if (m.id === requested) {
        return { provider: prov, model: requested, apiKey: getApiKey(prov.id) };
      }
    }
  }
  const active = getActiveProvider();
  const isNative = active.models.some(m => m.id === requested);
  const finalModel = isNative ? requested : (active.models[0]?.id || requested);
  return { provider: active, model: finalModel, apiKey: getApiKey(active.id) };
}