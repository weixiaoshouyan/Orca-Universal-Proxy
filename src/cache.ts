import fs from "fs";
import path from "path";
import crypto from "crypto";

interface CacheData {
  [key: string]: {
    response: any;
    timestamp: number;
  };
}

let _cache: CacheData = null as any;

const _isElectron = !!process.env.ORCA_BASE_DIR;
const _devDir = path.join(__dirname, "..");
const _portableDir = __dirname;
const BASE_DIR = _isElectron ? process.env.ORCA_BASE_DIR! : (fs.existsSync(path.join(_portableDir, "public")) ? _portableDir : _devDir);
const CACHE_PATH = path.join(BASE_DIR, "data", "cache.json");

function getCache(): CacheData {
  if (_cache) return _cache;
  try {
    if (fs.existsSync(CACHE_PATH)) {
      _cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
    } else {
      _cache = {};
    }
  } catch {
    _cache = {};
  }
  return _cache;
}

function saveCache() {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(_cache, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save cache file:", e);
  }
}

export function computeCacheKey(body: any): string {
  // Extract key fields that identify the prompt context
  const keyObj = {
    model: body.model,
    messages: body.messages || [],
    temperature: body.temperature ?? 0.7,
    tools: body.tools || [],
  };
  const str = JSON.stringify(keyObj);
  return crypto.createHash("sha256").update(str).digest("hex");
}

export function getCachedResponse(key: string): any | null {
  const cache = getCache();
  if (cache[key]) {
    return cache[key].response;
  }
  return null;
}

export function setCachedResponse(key: string, response: any): void {
  const cache = getCache();
  cache[key] = {
    response,
    timestamp: Date.now(),
  };
  saveCache();
}

// Simulates a streaming response for cached completions
export async function replayStreamResponse(
  res: any,
  fullText: string,
  model: string,
  onDone: () => void
) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const id = "chatcmpl-" + Date.now();
  const created = Math.floor(Date.now() / 1000);

  // Split full text into small chunks to simulate typing speed
  const words = fullText.split(/(\s+)/);
  let index = 0;

  const interval = setInterval(() => {
    if (index >= words.length) {
      clearInterval(interval);
      res.write("data: [DONE]\n\n");
      res.end();
      onDone();
      return;
    }

    const chunkContent = words[index];
    const chunk = {
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [
        {
          index: 0,
          delta: { content: chunkContent },
          finish_reason: null,
        },
      ],
    };

    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    index++;
  }, 30); // 30ms per word chunk simulation
}
