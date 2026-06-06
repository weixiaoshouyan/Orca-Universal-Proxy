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
  // Normalize messages for consistent caching regardless of API format
  const normalizeMessages = (msgs: any[]): any[] => {
    if (!msgs) return [];
    return msgs.map((m: any) => {
      // Handle Anthropic content blocks (array of {type, text})
      if (Array.isArray(m.content)) {
        return {
          role: m.role,
          content: m.content
            .filter((b: any) => b.type === "text" || b.type === "input_text" || b.type === "output_text")
            .map((b: any) => b.text || "")
            .join("")
        };
      }
      return { role: m.role, content: m.content || "" };
    });
  };

  const keyObj = {
    model: body.model,
    messages: normalizeMessages(body.messages),
    temperature: body.temperature ?? 0.7,
    max_tokens: body.max_tokens ?? 0,
    top_p: body.top_p ?? 1.0,
    tools: (body.tools || []).map((t: any) => ({
      name: t.function?.name || t.name,
      description: t.function?.description || t.description || ""
    })),
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
  let closed = false;

  const interval = setInterval(() => {
    if (closed) {
      clearInterval(interval);
      return;
    }
    if (index >= words.length) {
      clearInterval(interval);
    try {
      if (!res.writableEnded) {
        res.write("data: [DONE]\n\n");
        res.end();
      }
    } catch (e) { console.error("Failed to write final SSE event:", e); }
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

    try {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (_) {
      closed = true;
      clearInterval(interval);
    }
    index++;
  }, 30);

  res.on("close", () => {
    closed = true;
    clearInterval(interval);
    onDone();
  });
}
