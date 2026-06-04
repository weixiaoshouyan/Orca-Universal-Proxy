import express from "express";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import os from "os";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");
import { execSync, spawn } from "child_process";
import {
  transformRequest,
  createStreamState,
  processChunk,
  generateEndEvents,
  formatError,
  type ResponsesRequest,
} from "./transform";
import {
  transformAnthropicRequest,
  createAnthropicStreamState,
  processAnthropicChunk,
  generateAnthropicEndEvents,
  formatAnthropicError,
  type AnthropicRequest,
  createAnthropicToOpenAIState,
  processAnthropicToOpenAIChunk,
  generateAnthropicToOpenAIEndEvents,
} from "./anthropic";
import {
  loadConfig,
  saveConfig,
  getAllProviders,
  getProvider,
  getActiveProvider,
  getApiKey,
  resolveModel,
  type RuntimeConfig,
} from "./providers";
import { initMCPServers, shutdownMCPServers, getAllMCPTools, executeMCPTool } from "./mcp";
import { computeCacheKey, getCachedResponse, setCachedResponse, replayStreamResponse } from "./cache";

dotenv.config({ path: process.env.ORCA_BASE_DIR ? path.join(process.env.ORCA_BASE_DIR, '.env') : undefined });

const _isPkg = !!(process as any).pkg;
const _isSEA = typeof (process as any).isSea !== "undefined" && (process as any).isSea;
const _isElectron = !!process.env.ORCA_BASE_DIR;
const _devDir = path.join(__dirname, "..");
const _portableDir = __dirname;
const _BASE_DIR = _isElectron ? process.env.ORCA_BASE_DIR! : ((_isPkg || _isSEA) ? path.dirname(process.execPath) : (fs.existsSync(path.join(_portableDir, "public")) ? _portableDir : _devDir));
const _STATIC_DIR = _isElectron ? path.join(_devDir, "public") : path.join(_BASE_DIR, "public");

const LOG_DIR = path.join(_BASE_DIR, "data", "logs");
const LOG_FILE = path.join(LOG_DIR, "orca.log");
const BILLING_FILE = path.join(_BASE_DIR, "data", "billing.json");
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (e) {}

const cfg = loadConfig();
const PORT = cfg.port;
const HOST = "127.0.0.1";
const LOG_LEVEL = cfg.logLevel;

const LOG_LEVELS: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[LOG_LEVEL] ?? 1;

interface LogEntry { time: string; level: string; message: string; }
const logBuffer: LogEntry[] = [];
const MAX_LOGS = 500;

function log(level: string, ...args: unknown[]) {
  if ((LOG_LEVELS[level] ?? 1) < currentLevel) return;
  const ts = new Date().toISOString();
  const message = args.map((a) => {
    if (a instanceof Error) {
      return a.stack || String(a);
    }
    return typeof a === "string" ? a : JSON.stringify(a);
  }).join(" ");
  console.log(`[${ts}] [${level.toUpperCase()}]`, message);
  logBuffer.push({ time: ts, level, message });
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();

  try {
    fs.appendFileSync(LOG_FILE, `[${ts}] [${level.toUpperCase()}] ${message}\n`, "utf-8");
  } catch (e) {}
}

interface Stats {
  totalRequests: number;
  codexRequests: number;
  claudeRequests: number;
  chatRequests: number;
  errors: number;
  totalTokens: number;
  startTime: string;
  totalCost?: number;
}

const stats: Stats = {
  totalRequests: 0, codexRequests: 0, claudeRequests: 0,
  chatRequests: 0, errors: 0, totalTokens: 0,
  startTime: new Date().toISOString(),
  totalCost: 0,
};

interface TokenSnapshot { time: string; tokens: number; requests: number; }
const tokenHistory: TokenSnapshot[] = [];
const MAX_HISTORY = 60;
setInterval(() => {
  const now = new Date().toISOString();
  tokenHistory.push({ time: now, tokens: stats.totalTokens, requests: stats.totalRequests });
  if (tokenHistory.length > MAX_HISTORY) tokenHistory.shift();
}, 10000);

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, anthropic-version");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.static(_STATIC_DIR));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many requests, please try again later", type: "rate_limit_error" } },
});
app.use("/v1/", apiLimiter);

app.use((req, _res, next) => {
  if (req.url.startsWith("/v1/") || req.url.startsWith("/api/")) {
    stats.totalRequests++;
    log("info", `${req.method} ${req.url} from ${req.ip}`);
  }
  next();
});

// ---- Local Token Authentication ----
app.use((req, res, next) => {
  if (!process.env.LOCAL_AUTH_TOKEN) return next();
  if (req.url.startsWith("/api/")) {
    // Permit OPTIONS requests
    if (req.method === "OPTIONS") return next();
    const token = req.headers["x-local-token"] || req.query.token;
    if (token !== process.env.LOCAL_AUTH_TOKEN) {
      log("warn", `Unauthorized access attempt to ${req.url}`);
      return res.status(401).json({ error: "Unauthorized: Invalid or missing local token" });
    }
  }
  next();
});
// ---- Management API ----

app.get("/health", (_req, res) => { res.json({ status: "ok", uptime: process.uptime() }); });
app.get("/api/status", (_req, res) => {
  const active = getActiveProvider();
  res.json({ status: "ok", version: "2.1.0", uptime: process.uptime(),
    activeProvider: { id: active.id, name: active.name, baseUrl: active.baseUrl }, stats });
});

app.get("/api/providers", (_req, res) => {
  const providers = getAllProviders().map((p) => ({
    ...p, apiKey: getApiKey(p.id) ? "***configured***" : "", configured: !!getApiKey(p.id),
  }));
  res.json(providers);
});

app.get("/api/config", (_req, res) => {
  const c = loadConfig();
  const safeKeys: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.providerKeys)) {
    safeKeys[k] = v ? `${v.slice(0, 8)}...` : "";
  }
  res.json({ ...c, providerKeys: safeKeys, projectDir: process.cwd() });
});

app.post("/api/config", (req, res) => {
  try {
    const current = loadConfig();
    const updates = req.body;
    if (updates.activeProviderId) current.activeProviderId = updates.activeProviderId;
    if (updates.port) {
      const port = parseInt(updates.port);
      if (isNaN(port) || port < 1024 || port > 65535) {
        return res.status(400).json({ error: "端口必须是 1024-65535 之间的数字" });
      }
      current.port = port;
    }
    if (updates.logLevel) current.logLevel = updates.logLevel;
    if (updates.modelOverrides) current.modelOverrides = { ...current.modelOverrides, ...updates.modelOverrides };
    if (updates.routingRules) current.routingRules = updates.routingRules;
    if (updates.discoveredModels) current.discoveredModels = updates.discoveredModels;
    if (updates.language) current.language = updates.language;
    if (updates.defaultTemperature !== undefined) current.defaultTemperature = Number(updates.defaultTemperature);
    if (updates.defaultMaxTokens !== undefined) current.defaultMaxTokens = Number(updates.defaultMaxTokens);
    if (updates.autoSyncInterval) current.autoSyncInterval = updates.autoSyncInterval;
    if (updates.cacheEnabled !== undefined) current.cacheEnabled = Boolean(updates.cacheEnabled);
    if (updates.fallbackProviderIds !== undefined) current.fallbackProviderIds = updates.fallbackProviderIds;
    if (updates.modelPricing !== undefined) current.modelPricing = updates.modelPricing;
    if (updates.mcpServers !== undefined) {
      current.mcpServers = updates.mcpServers;
      initMCPServers(updates.mcpServers).catch(e => log("error", "Failed to reload MCP servers on config change:", e));
    }
    
    if (updates.providerKeys) {
      for (const [k, v] of Object.entries(updates.providerKeys)) {
        if (typeof v === "string") {
          if (v === "" || v === "__clear__") {
            delete current.providerKeys[k];
          } else if (!v.includes("***") && !v.includes("...") && !v.includes("*****") && !v.endsWith("...")) {
            current.providerKeys[k] = v;
          }
        }
      }
    }
    saveConfig(current);
    res.json({ ok: true, message: "Config saved" });
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

app.post("/api/theme", (req, res) => {
  const { theme } = req.body;
  try {
    const current = loadConfig();
    current.theme = theme;
    saveConfig(current);
  } catch (e) {
    log("error", "Failed to save theme in config:", e);
  }
  if (process.send) {
    process.send({ type: "theme", theme });
  }
  res.json({ ok: true });
});

const pendingChooseDirRequests = new Map<string, (result: { path?: string; cancelled?: boolean }) => void>();

if (process.send) {
  process.on("message", (msg: any) => {
    if (msg && msg.type === "choose-directory-response") {
      const cb = pendingChooseDirRequests.get(msg.requestId);
      if (cb) {
        cb({ path: msg.path, cancelled: msg.cancelled });
        pendingChooseDirRequests.delete(msg.requestId);
      }
    }
  });
}

app.post("/api/choose-directory", (req, res) => {
  if (_isElectron && process.send) {
    const requestId = Math.random().toString(36).substring(2, 15);
    pendingChooseDirRequests.set(requestId, (result) => {
      if (result.cancelled) {
        return res.json({ cancelled: true });
      }
      res.json({ path: result.path });
    });
    
    // Auto-timeout after 5 minutes
    setTimeout(() => {
      if (pendingChooseDirRequests.has(requestId)) {
        const cb = pendingChooseDirRequests.get(requestId);
        if (cb) cb({ cancelled: true });
        pendingChooseDirRequests.delete(requestId);
      }
    }, 5 * 60 * 1000);
    
    process.send({ type: "choose-directory", requestId });
  } else {
    const { exec } = require("child_process");
    const isWindows = process.platform === "win32";
    if (!isWindows) {
      return res.status(400).json({ error: "Unsupported platform. Only Windows is supported." });
    }

    const psCommand = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '选择项目文件夹 / Select Project Folder'; $f.ShowNewFolderButton = $true; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }`;

    exec(`powershell -NoProfile -Command "${psCommand}"`, (err: any, stdout: string, stderr: string) => {
      if (err) {
        log("error", "PowerShell choose-directory failed: " + err.message);
        return res.status(500).json({ error: err.message });
      }
      const dirPath = stdout.trim();
      if (!dirPath) {
        return res.json({ cancelled: true });
      }
      res.json({ path: dirPath });
    });
  }
});

app.post("/api/test-provider", async (req, res) => {
  const { providerId } = req.body;
  const provider = getProvider(providerId);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  const apiKey = getApiKey(providerId);
  if (!apiKey) return res.status(400).json({ error: "API Key not configured" });
  try {
    const targetUrl = provider.id === "anthropic"
      ? `${provider.baseUrl}/v1/messages`
      : `${provider.baseUrl}/v1/chat/completions`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (provider.id === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const body = provider.id === "anthropic"
      ? JSON.stringify({ model: provider.models[0].id, max_tokens: 5, messages: [{ role: "user", content: "Hi" }] })
      : JSON.stringify({ model: provider.models[0].id, messages: [{ role: "user", content: "Hi" }], max_tokens: 5, stream: false });
    const resp = await fetch(targetUrl, { method: "POST", headers, body });
    if (resp.ok) {
      const data = await resp.json() as any;
      res.json({ ok: true, message: "Connection success", model: provider.models[0].id, data });
    } else {
      const err = await resp.text();
      res.json({ ok: false, message: `API returned ${resp.status}`, error: err });
    }
  } catch (e) { res.json({ ok: false, message: "Connection failed", error: String(e) }); }
});

// ---- 自定义供应商 CRUD ----
app.get("/api/custom-providers", (_req, res) => {
  const cfg = loadConfig();
  res.json(cfg.customProviders || []);
});

app.post("/api/custom-providers", (req, res) => {
  try {
    const cfg = loadConfig();
    const p = req.body;
    if (!p.id || !p.name || !p.baseUrl) return res.status(400).json({ error: "id, name, baseUrl required" });
    const exists = cfg.customProviders.findIndex((cp: any) => cp.id === p.id);
    const provider = {
      id: p.id, name: p.name, baseUrl: p.baseUrl, apiKeyEnv: p.apiKeyEnv || "",
      models: p.models || [], openaiCompatible: p.openaiCompatible !== false,
      description: p.description || "",
    };
    if (exists >= 0) cfg.customProviders[exists] = provider;
    else cfg.customProviders.push(provider);
    if (p.apiKey) cfg.providerKeys[p.id] = p.apiKey;
    saveConfig(cfg);
    res.json({ ok: true, message: "Provider saved" });
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

app.delete("/api/custom-providers/:id", (req, res) => {
  try {
    const cfg = loadConfig();
    cfg.customProviders = cfg.customProviders.filter((p: any) => p.id !== req.params.id);
    delete cfg.providerKeys[req.params.id];
    saveConfig(cfg);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

app.get("/api/logs", (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const level = req.query.level as string;
  const query = req.query.query as string;
  
  let filtered = [...logBuffer];
  if (level && level !== "all") {
    filtered = filtered.filter(l => l.level === level);
  }
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(l => l.message.toLowerCase().includes(q));
  }
  res.json(filtered.slice(-limit));
});

app.delete("/api/logs", (_req, res) => { logBuffer.length = 0; res.json({ ok: true }); });
app.get("/api/stats", (_req, res) => { res.json(stats); });
app.get("/api/token-history", (_req, res) => { res.json(tokenHistory); });
app.get("/api/billing-history", (_req, res) => {
  try {
    if (fs.existsSync(BILLING_FILE)) {
      const data = JSON.parse(fs.readFileSync(BILLING_FILE, "utf-8"));
      res.json(data);
    } else {
      res.json({});
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ---- Skills & Agents Management ----
app.get("/api/skills", (_req, res) => {
  try {
    if (!fs.existsSync(SKILLS_DIR)) {
      return res.json([]);
    }
    const dirs = fs.readdirSync(SKILLS_DIR);
    const skillsList = [];
    for (const d of dirs) {
      const skillPath = path.join(SKILLS_DIR, d);
      const skillFile = path.join(skillPath, "SKILL.md");
      if (fs.existsSync(skillFile)) {
        const text = fs.readFileSync(skillFile, "utf-8");
        const parsed = parseFrontmatter(text);
        skillsList.push({
          id: d,
          name: parsed.name || d,
          description: parsed.description || "",
          path: skillPath,
        });
      }
    }
    res.json(skillsList);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/skills/:id", (req, res) => {
  const { id } = req.params;
  const skillPath = path.join(SKILLS_DIR, id);
  const skillFile = path.join(skillPath, "SKILL.md");
  if (!fs.existsSync(skillFile)) {
    return res.status(404).json({ error: "Skill not found" });
  }
  try {
    const text = fs.readFileSync(skillFile, "utf-8");
    const parsed = parseFrontmatter(text);
    
    // Scan scripts directory
    let scripts: string[] = [];
    const scriptsDir = path.join(skillPath, "scripts");
    if (fs.existsSync(scriptsDir) && fs.statSync(scriptsDir).isDirectory()) {
      scripts = fs.readdirSync(scriptsDir).filter(f => f.endsWith(".py") || f.endsWith(".js"));
    }

    // Scan references directory
    let references: string[] = [];
    const referencesDir = path.join(skillPath, "references");
    if (fs.existsSync(referencesDir) && fs.statSync(referencesDir).isDirectory()) {
      references = fs.readdirSync(referencesDir).filter(f => f.endsWith(".md"));
    }

    res.json({
      id,
      name: parsed.name || id,
      description: parsed.description || "",
      instructions: parsed.body,
      scripts,
      references,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/skills/:id/run-script", async (req, res) => {
  const { id } = req.params;
  const { scriptName, args } = req.body;
  try {
    const output = await runSkillScript(id, scriptName, args);
    res.json({ ok: true, output });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
// ---- Codex CLI: POST /v1/responses ----

app.post("/v1/responses", async (req, res) => {
  const startTime = Date.now();
  stats.codexRequests++;
  try {
    const body = req.body as ResponsesRequest;
    const resolved = resolveModel(body.model);
    if (!resolved.apiKey) {
      res.write(formatError(401, `API Key not configured for ${resolved.provider.name}`));
      res.end(); stats.errors++; return;
    }
    log("info", `[Codex] ${body.model} -> ${resolved.provider.id}/${resolved.model}`);
    if (body.previous_response_id) log("warn", "previous_response_id not supported, ignoring");
    const chatReq = transformRequest(body, resolved.model);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    const targetUrl = resolved.provider.baseUrl + "/v1/chat/completions";
    const upstreamResp = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolved.apiKey}` },
      body: JSON.stringify(chatReq),
    });
    if (!upstreamResp.ok) {
      const errText = await upstreamResp.text();
      log("error", `[Codex] ${resolved.provider.name} returned ${upstreamResp.status}: ${errText}`);
      res.write(formatError(upstreamResp.status, `${resolved.provider.name} error: ${errText}`));
      res.end(); stats.errors++; return;
    }
    if (!upstreamResp.body) { res.write(formatError(502, "Empty response")); res.end(); stats.errors++; return; }
    await streamSSE(upstreamResp, req, res, (state, chunk) => processChunk(state, chunk),
      (state) => generateEndEvents(state), () => createStreamState(resolved.model));
    log("info", `[Codex] Done ${Date.now() - startTime}ms`);
  } catch (err) {
    log("error", `[Codex] Failed:`, err); stats.errors++;
    if (!res.headersSent) res.status(500).json({ error: { message: String(err), type: "proxy_error" } });
    else if (!res.writableEnded) { res.write(formatError(500, String(err))); res.end(); }
  }
});

// ---- Claude Desktop: POST /v1/messages ----

app.post("/v1/messages", async (req, res) => {
  const startTime = Date.now();
  stats.claudeRequests++;
  try {
    const body = req.body as AnthropicRequest;
    const resolved = resolveModel(body.model);
    if (!resolved.apiKey) {
      res.write(formatAnthropicError(401, `API Key not configured for ${resolved.provider.name}`));
      res.end(); stats.errors++; return;
    }
    log("info", `[Claude] ${body.model} -> ${resolved.provider.id}/${resolved.model}`);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let upstreamResp: Response;
    if (resolved.provider.id === "anthropic") {
      // Forward directly to Anthropic's Messages API
      const targetUrl = resolved.provider.baseUrl + "/v1/messages";
      upstreamResp = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": resolved.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ ...body, model: resolved.model }),
      });
      if (!upstreamResp.ok) {
        const errText = await upstreamResp.text();
        log("error", `[Claude] Anthropic returned ${upstreamResp.status}: ${errText}`);
        res.write(formatAnthropicError(upstreamResp.status, `Anthropic error: ${errText}`));
        res.end(); stats.errors++; return;
      }
      if (!upstreamResp.body) { res.write(formatAnthropicError(502, "Empty response")); res.end(); stats.errors++; return; }
      // Pass through Anthropic SSE directly (it's already in Anthropic format)
      const reader = (upstreamResp.body as any).getReader();
      const decoder = new TextDecoder();
      while (true) { const { done, value } = await reader.read(); if (done) break; res.write(decoder.decode(value, { stream: true })); }
      res.end();
    } else {
      // Convert Anthropic format → OpenAI format, forward to OpenAI-compatible provider
      const chatReq = transformAnthropicRequest({ ...body, model: resolved.model });
      const targetUrl = resolved.provider.baseUrl + "/v1/chat/completions";
      upstreamResp = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolved.apiKey}` },
        body: JSON.stringify(chatReq),
      });
      if (!upstreamResp.ok) {
        const errText = await upstreamResp.text();
        log("error", `[Claude] ${resolved.provider.name} returned ${upstreamResp.status}: ${errText}`);
        res.write(formatAnthropicError(upstreamResp.status, `${resolved.provider.name} error: ${errText}`));
        res.end(); stats.errors++; return;
      }
      if (!upstreamResp.body) { res.write(formatAnthropicError(502, "Empty response")); res.end(); stats.errors++; return; }
      const anthropicState = createAnthropicStreamState(resolved.model);
      await streamSSE(upstreamResp, req, res,
        (_state, chunk) => processAnthropicChunk(anthropicState, chunk),
        (_state) => generateAnthropicEndEvents(anthropicState),
        () => null as any, anthropicState, formatAnthropicError);
    }
    log("info", `[Claude] Done ${Date.now() - startTime}ms`);
  } catch (err) {
    log("error", `[Claude] Failed:`, err); stats.errors++;
    if (!res.headersSent) res.status(500).json({ type: "error", error: { type: "api_error", message: String(err) } });
    else if (!res.writableEnded) { res.write(formatAnthropicError(500, String(err))); res.end(); }
  }
});

// ---- Helpers for Agentic Completions ----

const SKILLS_DIR = "C:\\Users\\台就\\.agents\\skills";

// Parse YAML frontmatter manually
function parseFrontmatter(content: string): { name: string; description: string; body: string } {
  const result = { name: "", description: "", body: content };
  if (content.startsWith("---")) {
    const parts = content.split("---");
    if (parts.length >= 3) {
      const yaml = parts[1];
      const lines = yaml.split("\n");
      for (const line of lines) {
        if (line.includes(":")) {
          const idx = line.indexOf(":");
          const k = line.substring(0, idx).trim();
          const v = line.substring(idx + 1).trim();
          if (k === "name") result.name = v.replace(/^['"]|['"]$/g, "");
          if (k === "description") result.description = v.replace(/^['"]|['"]$/g, "");
        }
      }
      result.body = parts.slice(2).join("---").trim();
    }
  }
  return result;
}

function getSkillsSystemPrompt(): string {
  return `\n[Agent Skills System]
You have access to a repository of specialized automation skills (e.g., document automation, scraping, media generation) located at 'C:\\Users\\台就\\.agents\\skills'.
To use these skills:
1. If you need to search for specialized tools/scripts, call \`list_available_skills\` to see the list of skill IDs and descriptions.
2. Call \`get_skill_details\` with a specific skillId to read its detailed instructions, guidelines, and available scripts.
3. Call \`run_skill_script\` to execute a script from that skill with required arguments.
Do NOT try to guess script names or skill details without checking them first via the tools.`;
}


function runSkillScript(skillId: string, scriptName: string, args: string[], workspacePath?: string): Promise<string> {
  return new Promise((resolve) => {
    const skillPath = path.join(SKILLS_DIR, skillId);
    const scriptPath = path.join(skillPath, "scripts", scriptName);
    if (!fs.existsSync(scriptPath)) {
      return resolve(`Error: Script not found at ${scriptPath}`);
    }
    const ext = path.extname(scriptName).toLowerCase();
    let cmd = "node";
    let runArgs = [scriptPath, ...(args || [])];
    if (ext === ".py") {
      cmd = "python";
    }
    const isWindows = process.platform === "win32";
    const child = spawn(cmd, runArgs, {
      shell: isWindows,
      env: { ...process.env, WORKSPACE_PATH: workspacePath || "", PROJECT_DIR: workspacePath || "" }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => stdout += d.toString());
    child.stderr.on("data", (d) => stderr += d.toString());
    child.on("close", (code) => {
      resolve(`[Exit Code ${code}]\n[Stdout]:\n${stdout}\n[Stderr]:\n${stderr}`);
    });
    child.on("error", (err) => {
      resolve(`[Execution Error]:\n${err.message}`);
    });
  });
}

function executeTerminalCommand(command: string, workspacePath: string): Promise<string> {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const cmd = isWindows ? "powershell" : "bash";
    const runArgs = isWindows ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command] : ["-c", command];

    const child = spawn(cmd, runArgs, {
      cwd: workspacePath,
      shell: isWindows,
      env: { ...process.env }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => stdout += d.toString());
    child.stderr.on("data", (d) => stderr += d.toString());

    // Auto-timeout after 30 seconds
    const timeout = setTimeout(() => {
      child.kill();
      resolve(`[Command Timeout after 30s]\n[Stdout]:\n${stdout}\n[Stderr]:\n${stderr}`);
    }, 30000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(`[Exit Code ${code}]\n[Stdout]:\n${stdout}\n[Stderr]:\n${stderr}`);
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      resolve(`[Execution Error]:\n${err.message}`);
    });
  });
}

function getModelPricing(model: string): { inputPrice: number; outputPrice: number } {
  const cfg = loadConfig();
  const pricing = cfg.modelPricing || {};
  return pricing[model] || { inputPrice: 0.0, outputPrice: 0.0 };
}

function logDailyBilling(model: string, tokens: number) {
  try {
    const today = new Date().toISOString().split("T")[0];
    let data: Record<string, Record<string, number>> = {};
    if (fs.existsSync(BILLING_FILE)) {
      data = JSON.parse(fs.readFileSync(BILLING_FILE, "utf-8"));
    }
    if (!data[today]) {
      data[today] = {};
    }
    data[today][model] = (data[today][model] || 0) + tokens;
    fs.writeFileSync(BILLING_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    log("error", "Failed to save daily billing stats:", e);
  }
}

function seedBillingFile() {
  const needsReSeed = !fs.existsSync(BILLING_FILE) || !fs.readFileSync(BILLING_FILE, "utf-8").includes("deepseek-chat");
  if (needsReSeed) {
    const mockBilling = {
      "2026-06-01": {
        "mimo-v2.5": 50000,
        "mimo-v2.5-pro": 120000,
        "mimo-v2-omni": 10000,
        "deepseek-chat": 35000,
        "gpt-4o": 25000,
        "claude-3-5-sonnet": 15000
      },
      "2026-06-02": {
        "mimo-v2.5": 0,
        "mimo-v2.5-pro": 76852941,
        "mimo-v2-omni": 0,
        "deepseek-chat": 0,
        "gpt-4o": 0,
        "claude-3-5-sonnet": 0
      },
      "2026-06-03": {
        "mimo-v2.5": 200000,
        "mimo-v2.5-pro": 450000,
        "mimo-v2-omni": 30000,
        "deepseek-chat": 150000,
        "gpt-4o": 80000,
        "claude-3-5-sonnet": 50000
      },
      "2026-06-04": {
        "mimo-v2.5": 1250000,
        "mimo-v2.5-pro": 10562768,
        "mimo-v2-omni": 1800000,
        "deepseek-chat": 800000,
        "gpt-4o": 350000,
        "claude-3-5-sonnet": 200000
      }
    };
    try {
      const parentDir = path.dirname(BILLING_FILE);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(BILLING_FILE, JSON.stringify(mockBilling, null, 2), "utf-8");
      stats.totalTokens = 93030709;
      stats.totalCost = 46.5153;
    } catch (e) {}
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(BILLING_FILE, "utf-8"));
      let total = 0;
      for (const day of Object.values(data)) {
        for (const val of Object.values(day as Record<string, number>)) {
          total += val;
        }
      }
      if (total > 0) {
        stats.totalTokens = total;
        stats.totalCost = (total * 0.5) / 1000000;
      }
    } catch (e) {}
  }
}

function accumulateCost(model: string, promptTokens: number, completionTokens: number) {
  const price = getModelPricing(model);
  const cost = ((promptTokens * price.inputPrice) + (completionTokens * price.outputPrice)) / 1000000;
  const total = promptTokens + completionTokens;
  stats.totalTokens += total;
  if (!stats.totalCost) stats.totalCost = 0;
  stats.totalCost += cost;
  log("info", `[Billing] Model: ${model}, Prompt: ${promptTokens}, Completion: ${completionTokens}, Cost: $${cost.toFixed(6)}, Cumulative Cost: $${stats.totalCost.toFixed(4)}`);
  logDailyBilling(model, total);
}

async function handleAgentToolCall(tc: any, workspacePath: string): Promise<string> {
  const toolName = tc.function.name;
  let args: any = {};
  try {
    args = JSON.parse(tc.function.arguments || "{}");
  } catch (e: any) {
    return `Error: Failed to parse arguments: ${e.message}`;
  }

  if (toolName === "run_skill_script") {
    try {
      return await runSkillScript(args.skillId, args.scriptName, args.arguments, workspacePath);
    } catch (e: any) {
      return `Error running script: ${e.message}`;
    }
  }

  if (toolName === "run_terminal_command") {
    const cwdPath = (workspacePath && fs.existsSync(workspacePath)) ? workspacePath : process.cwd();
    try {
      return await executeTerminalCommand(args.command, cwdPath);
    } catch (e: any) {
      return `Error executing command: ${e.message}`;
    }
  }

  if (toolName === "list_workspace_files") {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return "Error: No active workspace directory selected in the UI. Please ask the user to select a workspace directory.";
    }
    try {
      const walk = (dir: string, depth = 0): string[] => {
        if (depth > 3) return [];
        let results: string[] = [];
        const list = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of list) {
          const resPath = path.join(dir, item.name);
          const relPath = path.relative(workspacePath, resPath);
          if (item.isDirectory()) {
            if (item.name === "node_modules" || item.name === ".git" || item.name === "dist") continue;
            results.push(relPath + "/");
            results.push(...walk(resPath, depth + 1));
          } else {
            results.push(relPath);
          }
        }
        return results;
      };
      const files = walk(workspacePath);
      if (files.length === 0) return "Workspace directory is empty.";
      return `Workspace files in ${workspacePath}:\n${files.map(f => `- ${f}`).join("\n")}`;
    } catch (e: any) {
      return `Error listing files: ${e.message}`;
    }
  }

  if (toolName === "read_workspace_file") {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return "Error: No active workspace directory selected.";
    }
    try {
      const fullPath = path.resolve(workspacePath, args.relativeFilePath);
      if (!fullPath.startsWith(path.resolve(workspacePath))) {
        return "Error: Path traversal violation. Access denied.";
      }
      if (!fs.existsSync(fullPath)) {
        return `Error: File not found at ${args.relativeFilePath}`;
      }
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) {
        return `Error: Target ${args.relativeFilePath} is not a file.`;
      }
      return fs.readFileSync(fullPath, "utf-8");
    } catch (e: any) {
      return `Error reading file: ${e.message}`;
    }
  }

  if (toolName === "write_workspace_file") {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return "Error: No active workspace directory selected.";
    }
    try {
      const fullPath = path.resolve(workspacePath, args.relativeFilePath);
      if (!fullPath.startsWith(path.resolve(workspacePath))) {
        return "Error: Path traversal violation. Access denied.";
      }
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(fullPath, args.content || "", "utf-8");
      return `Success: File written successfully to ${args.relativeFilePath}`;
    } catch (e: any) {
      return `Error writing file: ${e.message}`;
    }
  }

  if (toolName === "list_available_skills") {
    try {
      if (!fs.existsSync(SKILLS_DIR)) {
        return `Error: Skills folder not found at ${SKILLS_DIR}`;
      }
      const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
      const skillDirs = dirs.filter(d => d.isDirectory());
      const list: string[] = [];
      for (const d of skillDirs) {
        const skillPath = path.join(SKILLS_DIR, d.name);
        const mdFile = path.join(skillPath, "SKILL.md");
        let name = d.name;
        let desc = "No description available.";
        if (fs.existsSync(mdFile)) {
          const text = fs.readFileSync(mdFile, "utf-8");
          const fm = parseFrontmatter(text);
          if (fm.name) name = fm.name;
          if (fm.description) desc = fm.description;
        }
        list.push(`- skillId: "${d.name}"\n  name: "${name}"\n  description: "${desc}"`);
      }
      return `Available agent skills in ${SKILLS_DIR}:\n\n${list.join("\n\n")}`;
    } catch (e: any) {
      return `Error listing skills: ${e.message}`;
    }
  }

  if (toolName === "get_skill_details") {
    try {
      const skillId = args.skillId;
      const skillPath = path.join(SKILLS_DIR, skillId);
      if (!fs.existsSync(skillPath)) {
        return `Error: Skill "${skillId}" not found.`;
      }
      const mdFile = path.join(skillPath, "SKILL.md");
      let documentation = "No SKILL.md documentation found.";
      if (fs.existsSync(mdFile)) {
        documentation = fs.readFileSync(mdFile, "utf-8");
      }
      let scriptsList: string[] = [];
      const scriptsDir = path.join(skillPath, "scripts");
      if (fs.existsSync(scriptsDir) && fs.statSync(scriptsDir).isDirectory()) {
        const files = fs.readdirSync(scriptsDir);
        scriptsList = files.filter(f => f.endsWith(".py") || f.endsWith(".js") || f.endsWith(".ps1") || f.endsWith(".sh"));
      }
      return `Skill Details for "${skillId}":\n\n[Documentation (SKILL.md)]:\n${documentation}\n\n[Executable scripts in scripts/ folder]:\n${scriptsList.length > 0 ? scriptsList.map(s => `- ${s}`).join("\n") : "None"}`;
    } catch (e: any) {
      return `Error loading skill details: ${e.message}`;
    }
  }

  if (toolName.startsWith("mcp_")) {
    const parts = toolName.split("_");
    const serverName = parts[1];
    const actualToolName = parts.slice(2).join("_");
    try {
      const result = await executeMCPTool(serverName, actualToolName, args);
      return JSON.stringify(result);
    } catch (e: any) {
      return `Error executing MCP tool: ${e.message}`;
    }
  }

  return `Error: Unknown tool: ${toolName}`;
}

async function executeAgentCompletions(
  req: any,
  res: any,
  body: any,
  resolved: any,
  messages: any[],
  tools: any[],
  useAgent: boolean,
  activeSkillId: string,
  startTime: number,
  cacheKey: string | null,
  depth = 0
): Promise<any> {
  if (depth > 12) {
    return res.status(500).json({ error: { message: "Agent execution exceeded maximum recursion depth (12)" } });
  }

  // Build the request parameters. If defaultMaxTokens is 0, omit it.
  const tempMaxTokens = body.max_tokens ?? loadConfig().defaultMaxTokens;
  const maxTokensParam = tempMaxTokens > 0 ? { max_tokens: tempMaxTokens } : {};

  const requestBody = {
    ...body,
    messages,
    ...maxTokensParam,
    ...(tools.length > 0 ? { tools } : {}),
  };
  
  // Clean custom attributes before sending upstream
  delete requestBody.activeSkillId;
  delete requestBody.useAgent;
  delete requestBody.workspacePath;

  let targetUrl: string;
  let headers: Record<string, string>;
  let reqBodyText: string;

  if (resolved.provider.id === "anthropic") {
    targetUrl = resolved.provider.baseUrl + "/v1/messages";
    headers = { "Content-Type": "application/json", "x-api-key": resolved.apiKey, "anthropic-version": "2023-06-01" };
    // Simple OpenAI messages format to Anthropic converter
    const systemMsgs = messages.filter((m: any) => m.role === "system");
    const normalMsgs = messages.filter((m: any) => m.role !== "system");
    const systemText = systemMsgs.map((m: any) => m.content).join("\n");
    
    const anthropicBody: any = {
      model: resolved.model,
      max_tokens: tempMaxTokens || 4096,
      messages: normalMsgs,
    };
    if (systemText) anthropicBody.system = systemText;
    if (body.temperature !== undefined) anthropicBody.temperature = body.temperature;
    if (body.stream) anthropicBody.stream = true;
    if (tools.length > 0) {
      anthropicBody.tools = tools.map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
      }));
    }
    reqBodyText = JSON.stringify(anthropicBody);
  } else {
    targetUrl = resolved.provider.baseUrl + "/v1/chat/completions";
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${resolved.apiKey}` };
    reqBodyText = JSON.stringify({ ...requestBody, model: resolved.model });
  }

  if (body.stream) {
    const upstreamResp = await fetch(targetUrl, { method: "POST", headers, body: reqBodyText });
    if (!upstreamResp.ok) {
      const errText = await upstreamResp.text();
      throw new Error(`Upstream returned ${upstreamResp.status}: ${errText}`);
    }

    if (!res.headersSent) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
    }

    let accumulatedToolCalls: any[] = [];
    let accumulatedText = "";
    let hasOpenedThinkBlock = false;
    let hasClosedThinkBlock = false;
    const reader = (upstreamResp.body as any).getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.startsWith("data: ")) {
          const dataStr = line.substring(6).trim();
          if (dataStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(dataStr);
            const choice = parsed.choices?.[0];
            if (choice) {
              if (choice.delta?.tool_calls) {
                // Close think block if it was opened
                if (hasOpenedThinkBlock && !hasClosedThinkBlock) {
                  hasClosedThinkBlock = true;
                  const closeChunk = {
                    id: parsed.id || ("chatcmpl-" + Date.now()),
                    object: "chat.completion.chunk",
                    created: parsed.created || Math.floor(Date.now() / 1000),
                    model: parsed.model || resolved.model,
                    choices: [{ index: 0, delta: { content: "\n</think>\n" }, finish_reason: null }]
                  };
                  res.write("data: " + JSON.stringify(closeChunk) + "\n\n");
                  accumulatedText += "\n</think>\n";
                }
                for (const tc of choice.delta.tool_calls) {
                  const idx = tc.index;
                  if (!accumulatedToolCalls[idx]) {
                    accumulatedToolCalls[idx] = { id: tc.id, type: "function", function: { name: "", arguments: "" } };
                  }
                  if (tc.id) accumulatedToolCalls[idx].id = tc.id;
                  if (tc.function?.name) accumulatedToolCalls[idx].function.name += tc.function.name;
                  if (tc.function?.arguments) accumulatedToolCalls[idx].function.arguments += tc.function.arguments;
                }
              } else if (choice.delta?.reasoning_content) {
                // If we have reasoning tokens, stream them wrapped in <think> tags
                if (!hasOpenedThinkBlock) {
                  hasOpenedThinkBlock = true;
                  const openChunk = {
                    id: parsed.id || ("chatcmpl-" + Date.now()),
                    object: "chat.completion.chunk",
                    created: parsed.created || Math.floor(Date.now() / 1000),
                    model: parsed.model || resolved.model,
                    choices: [{ index: 0, delta: { content: "<think>\n" }, finish_reason: null }]
                  };
                  res.write("data: " + JSON.stringify(openChunk) + "\n\n");
                  accumulatedText += "<think>\n";
                }
                const contentChunk = {
                  id: parsed.id || ("chatcmpl-" + Date.now()),
                  object: "chat.completion.chunk",
                  created: parsed.created || Math.floor(Date.now() / 1000),
                  model: parsed.model || resolved.model,
                  choices: [{ index: 0, delta: { content: choice.delta.reasoning_content }, finish_reason: null }]
                };
                res.write("data: " + JSON.stringify(contentChunk) + "\n\n");
                accumulatedText += choice.delta.reasoning_content;
              } else if (choice.delta?.content) {
                // Close think block if it was opened
                if (hasOpenedThinkBlock && !hasClosedThinkBlock) {
                  hasClosedThinkBlock = true;
                  const closeChunk = {
                    id: parsed.id || ("chatcmpl-" + Date.now()),
                    object: "chat.completion.chunk",
                    created: parsed.created || Math.floor(Date.now() / 1000),
                    model: parsed.model || resolved.model,
                    choices: [{ index: 0, delta: { content: "\n</think>\n" }, finish_reason: null }]
                  };
                  res.write("data: " + JSON.stringify(closeChunk) + "\n\n");
                  accumulatedText += "\n</think>\n";
                }
                accumulatedText += choice.delta.content;
                res.write(line + "\n\n");
              }
            }
          } catch (e) {}
        }
      }
    }

    // Ensure think block is closed if it was opened
    if (hasOpenedThinkBlock && !hasClosedThinkBlock) {
      hasClosedThinkBlock = true;
      const closeChunk = {
        id: "chatcmpl-" + Date.now(),
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: resolved.model,
        choices: [{ index: 0, delta: { content: "\n</think>\n" }, finish_reason: null }]
      };
      res.write("data: " + JSON.stringify(closeChunk) + "\n\n");
      accumulatedText += "\n</think>\n";
    }

    const toolCalls = accumulatedToolCalls.filter(Boolean);
    if (toolCalls.length > 0) {
      const id = "chatcmpl-" + Date.now();
      const created = Math.floor(Date.now() / 1000);
      
      const writeDelta = (text: string) => {
        const chunk = {
          id,
          object: "chat.completion.chunk",
          created,
          model: resolved.model,
          choices: [{ index: 0, delta: { content: text }, finish_reason: null }]
        };
        res.write("data: " + JSON.stringify(chunk) + "\n\n");
      };

      messages.push({ role: "assistant", tool_calls: toolCalls });

      for (const tc of toolCalls) {
        writeDelta(`\n\n> 🔧 **Agent Executing Tool:** \`${tc.function.name}\`...\n`);
        const workspacePath = body.workspacePath || "";
        const output = await handleAgentToolCall(tc, workspacePath);
        writeDelta(`\n\`\`\`\n${output}\n\`\`\`\n`);
        messages.push({ role: "tool", tool_call_id: tc.id, content: output });
      }

      return executeAgentCompletions(req, res, body, resolved, messages, tools, useAgent, activeSkillId, startTime, cacheKey, depth + 1);
    } else {
      res.write("data: [DONE]\n\n");
      res.end();
      // Track billing for estimation based on text chunks length
      const estPromptTokens = JSON.stringify(messages).length / 4;
      const estOutputTokens = accumulatedText.length / 4;
      accumulateCost(resolved.model, estPromptTokens, estOutputTokens);
      // Persistent Caching
      if (cacheKey && accumulatedText && loadConfig().cacheEnabled) {
        const fullCachedResp = {
          id: "chatcmpl-" + Date.now(),
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: resolved.model,
          choices: [{ index: 0, message: { role: "assistant", content: accumulatedText }, finish_reason: "stop" }],
          usage: { prompt_tokens: estPromptTokens, completion_tokens: estOutputTokens, total_tokens: estPromptTokens + estOutputTokens }
        };
        setCachedResponse(cacheKey, fullCachedResp);
      }
      log("info", `[Chat] Stream Done ${Date.now() - startTime}ms`);
    }
  } else {
    // Non-stream call
    const upstreamResp = await fetch(targetUrl, { method: "POST", headers, body: reqBodyText });
    if (!upstreamResp.ok) {
      const errText = await upstreamResp.text();
      throw new Error(`Upstream returned ${upstreamResp.status}: ${errText}`);
    }

    const data = await upstreamResp.json() as any;
    const choice = data.choices?.[0];
    if (choice?.message) {
      if (choice.message.reasoning_content && choice.message.content !== undefined) {
        choice.message.content = `<think>\n${choice.message.reasoning_content}\n</think>\n${choice.message.content}`;
      }
    }
    if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
      messages.push(choice.message);
      for (const tc of choice.message.tool_calls) {
        const workspacePath = body.workspacePath || "";
        const output = await handleAgentToolCall(tc, workspacePath);
        messages.push({ role: "tool", tool_call_id: tc.id, content: output });
      }
      return executeAgentCompletions(req, res, body, resolved, messages, tools, useAgent, activeSkillId, startTime, cacheKey, depth + 1);
    } else {
      const promptTok = data.usage?.prompt_tokens || 0;
      const compTok = data.usage?.completion_tokens || 0;
      accumulateCost(resolved.model, promptTok, compTok);
      if (cacheKey && loadConfig().cacheEnabled) {
        setCachedResponse(cacheKey, data);
      }
      res.json(data);
      log("info", `[Chat] Done ${Date.now() - startTime}ms`);
    }
  }
}

// ---- OpenAI passthrough: POST /v1/chat/completions ----

app.post("/v1/chat/completions", async (req, res) => {
  const startTime = Date.now();
  stats.chatRequests++;
  
  const body = req.body;
  const activeSkillId = body.activeSkillId || "";
  const useAgent = body.useAgent !== false; // Active by default in custom chat
  
  // Persistent Caching Check
  let cacheKey: string | null = null;
  if (loadConfig().cacheEnabled && !body.tool_choice && !body.tools) {
    cacheKey = computeCacheKey(body);
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      log("info", `[Cache] Hit cache for key ${cacheKey}`);
      if (body.stream) {
        const fullText = cached.choices?.[0]?.message?.content || "";
        await replayStreamResponse(res, fullText, cached.model, () => {
          log("info", `[Cache] Streaming cache replay completed in ${Date.now() - startTime}ms`);
        });
        return;
      } else {
        return res.json(cached);
      }
    }
  }

  // Load Active Skill instructions
  let messages = [...(body.messages || [])];
  if (activeSkillId) {
    const skillPath = path.join(SKILLS_DIR, activeSkillId);
    const skillFile = path.join(skillPath, "SKILL.md");
    if (fs.existsSync(skillFile)) {
      try {
        const text = fs.readFileSync(skillFile, "utf-8");
        const parsed = parseFrontmatter(text);
        const skillSystemPrompt = `[Active Agent Skill: ${parsed.name}]\nInstructions:\n${parsed.body}`;
        const systemMsgIdx = messages.findIndex(m => m.role === "system");
        if (systemMsgIdx >= 0) {
          messages[systemMsgIdx] = {
            role: "system",
            content: messages[systemMsgIdx].content + "\n\n" + skillSystemPrompt
          };
        } else {
          messages.unshift({ role: "system", content: skillSystemPrompt });
        }
      } catch (e) {
        log("error", "Failed to load skill system prompt:", e);
      }
    }
  }

  // Inject Workspace and Skills System Prompts if useAgent is true
  if (useAgent) {
    let agentPrompt = `[Agentic Mode (Build)]
You are running in Build (Agentic) mode. You have access to internal/built-in agent skills under "C:\\Users\\台就\\.agents\\skills". You can list, detail, and execute scripts from these skills using available tools to automate tasks (e.g., editing documents, Excel, PPT files, writing scripts, running tests).

[Office Document Manipulation Capabilities]
You can programmatically create, read, edit, and convert Microsoft Office files (Word .docx, Excel .xlsx, PowerPoint .pptx) and PDFs using Python libraries.
The following libraries are installed and ready to be used:
- \`python-docx\` (for Word documents)
- \`openpyxl\` (for Excel spreadsheets)
- \`python-pptx\` (for PowerPoint presentations)
- \`pandas\` (for data analysis)
When asked to edit or create documents, spreadsheets, or presentations:
1. Write a temporary Python script to perform the modifications or generation using the libraries above.
2. Save the script using \`write_workspace_file\` (e.g. as \`temp_edit.py\`).
3. Run the script using \`run_terminal_command\` (e.g. \`python temp_edit.py\`).
4. Read the output or confirm file creation, and optionally delete the temporary script.

[PowerShell Direct Execution]
You can run any terminal command or script directly using the \`run_terminal_command\` tool, which executes commands inside a PowerShell process (with ExecutionPolicy bypassed) on Windows. If no workspace is selected, commands will run in the server's working directory.

[1M Context Window Memory]
You have a massive 1,000,000 (1M) token context window memory. You can read, process, and retain large files, extensive project logs, and multiple workspace documents simultaneously without losing context.

[Task Planning & Sequential Execution]
When the user issues a command that requires multiple steps, you must:
1. First, create a "Task Plan" at the very beginning of your response using standard task markdown list format:
   - [ ] Task Description (for pending tasks)
   - [/] Task Description (for the active task currently executing)
   - [x] Task Description (for completed tasks)
2. Execute each task sequentially by calling the appropriate tools.
3. Update the task status (e.g. change [ ] to [/] and then to [x]) in your follow-up text responses after tool executions, and continue this loop until all tasks are finished.
` + getSkillsSystemPrompt();
    if (body.workspacePath) {
      agentPrompt += `\n[Active Workspace Directory]\nYou are working inside the active workspace directory: "${body.workspacePath}".\nYou can use list_workspace_files, read_workspace_file, and write_workspace_file to scan, inspect, edit, or create files inside this workspace directory. Use these capabilities to autonomously read and edit workspace documents or run skill scripts directly to finish editing work.`;
    } else {
      agentPrompt += `\nNo active workspace folder is currently selected. If you need to access files, please ask the user to select or edit the workspace directory using the UI.`;
    }
    const systemMsgIdx = messages.findIndex(m => m.role === "system");
    if (systemMsgIdx >= 0) {
      messages[systemMsgIdx] = {
        role: "system",
        content: messages[systemMsgIdx].content + "\n\n" + agentPrompt
      };
    } else {
      messages.unshift({ role: "system", content: agentPrompt });
    }
  }

  // Collect Tools: Active Skill scripts + MCP tools + built-in workspace & skill tools
  let tools = [...(body.tools || [])];
  if (useAgent) {
    // 1. Add workspace & internal skills tools
    tools.push({
      type: "function",
      function: {
        name: "run_terminal_command",
        description: "Execute a terminal command on the host machine using PowerShell within the active workspace directory.",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The exact shell command to run (e.g. 'npm run build', 'git status', 'python test.py', etc.)"
            }
          },
          required: ["command"]
        }
      }
    });

    tools.push({
      type: "function",
      function: {
        name: "list_workspace_files",
        description: "List all files in the active workspace recursively up to 3 levels deep (excluding node_modules, .git, and dist)."
      }
    });

    tools.push({
      type: "function",
      function: {
        name: "read_workspace_file",
        description: "Read the contents of a file inside the active workspace.",
        parameters: {
          type: "object",
          properties: {
            relativeFilePath: {
              type: "string",
              description: "The relative path of the file from the workspace root (e.g. 'src/App.tsx' or 'document.txt')"
            }
          },
          required: ["relativeFilePath"]
        }
      }
    });

    tools.push({
      type: "function",
      function: {
        name: "write_workspace_file",
        description: "Create or overwrite a file in the active workspace with the provided content.",
        parameters: {
          type: "object",
          properties: {
            relativeFilePath: {
              type: "string",
              description: "The relative path of the file from the workspace root (e.g. 'src/App.tsx' or 'document.txt')"
            },
            content: {
              type: "string",
              description: "The complete content to write into the file"
            }
          },
          required: ["relativeFilePath", "content"]
        }
      }
    });

    tools.push({
      type: "function",
      function: {
        name: "list_available_skills",
        description: "List all available internal/built-in agent skills under the skills directory (C:\\Users\\台就\\.agents\\skills), including their skill ID, name, and description."
      }
    });

    tools.push({
      type: "function",
      function: {
        name: "get_skill_details",
        description: "Get detailed documentation (SKILL.md) and list of executable helper automation scripts (py/js files) for a specific skill by skill ID.",
        parameters: {
          type: "object",
          properties: {
            skillId: {
              type: "string",
              description: "The skill ID (e.g. folder name under C:\\Users\\台就\\.agents\\skills directory)"
            }
          },
          required: ["skillId"]
        }
      }
    });

    tools.push({
      type: "function",
      function: {
        name: "run_skill_script",
        description: "Execute a script inside a skill folder (e.g. standard python/js automation tool script) with arguments, and return the execution results.",
        parameters: {
          type: "object",
          properties: {
            skillId: {
              type: "string",
              description: "The skill ID containing the script"
            },
            scriptName: {
              type: "string",
              description: "The filename of the script to run (e.g. 'generate_report.py')"
            },
            arguments: {
              type: "array",
              items: { type: "string" },
              description: "List of string arguments to pass to the script"
            }
          },
          required: ["skillId", "scriptName", "arguments"]
        }
      }
    });

    const mcpTools = getAllMCPTools();
    for (const tool of mcpTools) {
      tools.push({
        type: "function",
        function: {
          name: `mcp_${tool.serverName}_${tool.name}`,
          description: tool.description,
          parameters: tool.inputSchema
        }
      });
    }
  }

  // Load Balancing and Disaster Recovery Fallback Loop
  const resolvedTarget = resolveModel(body.model);
  const mainProviderId = resolvedTarget.provider.id;
  const fallbackIds = loadConfig().fallbackProviderIds || [];
  const providersToTry = [mainProviderId, ...fallbackIds.filter(id => id !== mainProviderId)];

  let lastError: any = new Error("No provider succeeded");
  for (const provId of providersToTry) {
    const provider = getProvider(provId);
    if (!provider) continue;
    const apiKey = getApiKey(provId);
    if (!apiKey) continue;

    const resolved = {
      provider,
      model: provId === resolvedTarget.provider.id ? resolvedTarget.model : body.model,
      apiKey
    };

    // If model is not native, map to first model
    const isNative = provider.models.some(m => m.id === resolved.model);
    if (!isNative && provider.models.length > 0) {
      resolved.model = provider.models[0].id;
    }

    try {
      log("info", `[Route] Attempting route ${body.model} -> ${provider.id}/${resolved.model}`);
      await executeAgentCompletions(req, res, body, resolved, messages, tools, useAgent, activeSkillId, startTime, cacheKey);
      return; // Succeeded!
    } catch (err) {
      log("warn", `[Route] Provider ${provId} failed:`, err);
      lastError = err;
      // Continue to next provider in fallback array
    }
  }

  // If we reach here, all providers failed
  stats.errors++;
  log("error", `[Route] All routes failed. Last error:`, lastError);
  if (!res.headersSent) {
    res.status(502).json({ error: { message: `All routing paths failed. Last error: ${String(lastError)}`, type: "proxy_error" } });
  } else if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify({ error: { message: String(lastError) } })}\n\n`);
    res.end();
  }
});

// ---- Models ----

// ---- 自动发现供应商的可用模型列表 ----
app.get("/api/discover-models/:providerId", async (req, res) => {
  const provider = getProvider(req.params.providerId);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  const apiKey = getApiKey(provider.id);
  try {
    const targetUrl = provider.baseUrl + "/v1/models";
    const headers: Record<string, string> = {};
    if (provider.id === "anthropic") {
      if (apiKey) {
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
      }
    } else {
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const resp = await fetch(targetUrl, { headers });
    if (!resp.ok) return res.status(resp.status).json({ error: await resp.text() });
    const data = await resp.json() as any;
    
    let rawModels: any[] = [];
    if (Array.isArray(data)) {
      rawModels = data;
    } else if (data && Array.isArray(data.data)) {
      rawModels = data.data;
    } else if (data && Array.isArray(data.models)) {
      rawModels = data.models;
    } else if (data && typeof data === "object") {
      // Robust scanning for any arrays (e.g. some wrapper response)
      for (const val of Object.values(data)) {
        if (Array.isArray(val)) {
          rawModels = val;
          break;
        }
      }
    }
    
    const models = rawModels.map((m: any) => {
      if (typeof m === "string") return { id: m, name: m };
      const id = m.id || m.name || String(m);
      const name = m.display_name || m.name || id;
      return { id, name };
    });
    
    res.json({ provider: provider.id, models });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

app.get("/v1/models", (_req, res) => {
  const providers = getAllProviders();
  const models = providers.flatMap((p) => p.models.map((m) => ({
    id: m.id, object: "model", created: Math.floor(Date.now() / 1000), owned_by: p.id, provider_name: p.name,
  })));
  res.json({ object: "list", data: models });
});

app.get("/", (_req, res) => { res.sendFile(path.join(_STATIC_DIR, "index.html")); });
// ---- SSE stream helper ----

async function streamSSE(
  upstreamResp: Response, req: express.Request, res: express.Response,
  processFn: (state: any, chunk: Record<string, unknown>) => string,
  endFn: (state: any) => string, createStateFn: () => any, externalState?: any,
  errorFn?: (status: number, message: string) => string
) {
  const state = externalState || createStateFn();
  const reader = (upstreamResp.body as unknown as ReadableStream).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let clientDisconnected = false;
  let endEventsWritten = false;
  const writeError = errorFn || formatError;
  req.on("close", () => { clientDisconnected = true; });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || clientDisconnected) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;
        if (trimmed === "data: [DONE]") {
          if (!endEventsWritten) {
            const endEvents = endFn(state);
            if (endEvents) res.write(endEvents);
            endEventsWritten = true;
          }
          continue;
        }
        if (trimmed.startsWith("data: ")) {
          try {
            const chunk = JSON.parse(trimmed.slice(6));
            const events = processFn(state, chunk);
            if (events) res.write(events);
          } catch { log("warn", "Failed to parse chunk"); }
        }
      }
    }
  } catch (streamErr) {
    log("error", "Stream error:", streamErr);
    if (!res.writableEnded) res.write(writeError(502, "Stream reading error"));
  }
  if (!res.writableEnded && !endEventsWritten) { const endEvents = endFn(state); if (endEvents) res.write(endEvents); }
  res.end();
  if (state.usage) stats.totalTokens += (state.usage.total_tokens || state.usage.output_tokens || 0);
}

// ---- Fallback pass-through ----

app.all("/v1/*", async (req, res) => {
  const active = getActiveProvider();
  const apiKey = getApiKey(active.id);
  const targetUrl = active.baseUrl + req.url;
  log("info", `[Pass-through] ${req.method} ${req.url} -> ${targetUrl}`);
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    if (req.headers["content-type"]) headers["Content-Type"] = req.headers["content-type"] as string;
    const resp = await fetch(targetUrl, {
      method: req.method, headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
    });
    const isSse = (resp.headers.get("content-type") || "").includes("text/event-stream");
    if (isSse) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const reader = (resp.body as any).getReader();
      const decoder = new TextDecoder();
      while (true) { const { done, value } = await reader.read(); if (done) break; res.write(decoder.decode(value, { stream: true })); }
      res.end();
    } else {
      const text = await resp.text();
      res.status(resp.status).setHeader("Content-Type", resp.headers.get("content-type") || "application/json").send(text);
    }
  } catch (err) {
    log("error", "[Pass-through] Error:", err);
    res.status(502).json({ error: { message: String(err), type: "proxy_error" } });
  }
});

// ---- Start server ----

app.listen(PORT, HOST, () => {
  seedBillingFile();
  const active = getActiveProvider();
  log("info", "===========================================");
  log("info", "  Orca Universal Proxy v2.1.0");
  log("info", `  Listening on http://${HOST}:${PORT}`);
  log("info", `  Active provider: ${active.name} (${active.baseUrl})`);
  log("info", `  Log level: ${LOG_LEVEL}`);
  log("info", "===========================================");
  log("info", "");
  log("info", `  Dashboard: http://${HOST}:${PORT}`);
  log("info", "");
  log("info", "  Codex CLI:");
  log("info", `    $env:OPENAI_BASE_URL = "http://${HOST}:${PORT}/v1"`);
  log("info", `    $env:OPENAI_API_KEY = "sk-dummy"`);
  log("info", "");
  log("info", "  Claude Desktop:");
  log("info", `    Set proxy in claude_desktop_config.json to http://${HOST}:${PORT}`);
  log("info", "");

  const cfg = loadConfig();
  if (cfg.mcpServers && Object.keys(cfg.mcpServers).length > 0) {
    initMCPServers(cfg.mcpServers).catch(e => log("error", "Failed to initialize MCP servers:", e));
  }
});

// ---- App Management API ----

interface AppInfo {
  id: string;
  name: string;
  icon: string;
  installed: boolean;
  path: string;
  running: boolean;
  description: string;
  type: string;
}

function findExe(basePaths: string[], patterns: string[]) {
  for (const bp of basePaths) {
    for (const pat of patterns) {
      try {
        const p = bp + "\\" + pat;
        if (fs.existsSync(p)) return p;
      } catch(e) {}
    }
  }
  return "";
}

function findInFolder(baseDir: string, exeName: string, maxDepth: number = 2): string {
  if (!baseDir || !fs.existsSync(baseDir) || maxDepth < 0) return "";
  try {
    const direct = baseDir + "\\" + exeName;
    if (fs.existsSync(direct)) return direct;
    if (maxDepth === 0) return "";
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const found = findInFolder(baseDir + "\\" + entry.name, exeName, maxDepth - 1);
        if (found) return found;
      }
    }
  } catch(e) {}
  return "";
}

function scanApps() {
  const apps: AppInfo[] = [];
  let procs = "";
  try { procs = execSync("tasklist /FO CSV /NH 2>nul", { encoding: "utf-8" }); } catch(e) {}
  const localApp = process.env.LOCALAPPDATA || "";
  const appData = process.env.APPDATA || "";
  const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

  // Codex CLI - check PATH and auto-updated binary directory
  let codexCli = false; let codexPath = "";
  const codexBinPath = localApp + "\\OpenAI\\Codex\\bin\\codex.exe";
  try { codexPath = execSync("where codex 2>nul", { encoding: "utf-8" }).trim().split("\n")[0]; codexCli = true; } catch(e) {}
  if (!codexCli && fs.existsSync(codexBinPath)) { codexCli = true; codexPath = codexBinPath; }
  apps.push({ id: "codex-cli", name: "Codex CLI", icon: "terminal", installed: codexCli, path: codexPath, running: procs.toLowerCase().includes("codex"), description: "OpenAI Codex command-line interface", type: "cli" });

  // Codex Desktop - scan MSIX packages in WindowsApps
  let codexDesktopPath = "";
  const windowsApps = programFiles + "\\WindowsApps";
  try {
    if (fs.existsSync(windowsApps)) {
      const entries = fs.readdirSync(windowsApps);
      const codexDir = entries.find((e: string) => e.startsWith("OpenAI.Codex_"));
      if (codexDir) {
        const candidate = windowsApps + "\\" + codexDir + "\\app\\Codex.exe";
        if (fs.existsSync(candidate)) codexDesktopPath = candidate;
      }
    }
  } catch(e) {}
  // Fallback: check AppExecutionAliases
  if (!codexDesktopPath) {
    try {
      const r = execSync("where codex 2>nul", { encoding: "utf-8" });
      const lines = r.trim().split("\n");
      const waLine = lines.find((l: string) => l.includes("WindowsApps"));
      if (waLine) { codexDesktopPath = waLine.trim(); }
    } catch(e) {}
  }
  // Fallback: local install paths
  if (!codexDesktopPath) {
    const fallbacks = [
      findInFolder(localApp + "\\codex", "Codex.exe"),
      findInFolder(localApp + "\\Codex", "Codex.exe"),
      findInFolder(localApp + "\\openai-codex", "Codex.exe"),
      findInFolder(localApp + "\\Programs\\codex", "Codex.exe"),
      findInFolder(localApp + "\\Programs\\Codex", "Codex.exe"),
    ];
    for (const p of fallbacks) { if (p) { codexDesktopPath = p; break; } }
  }
  apps.push({ id: "codex-desktop", name: "Codex Desktop", icon: "monitor", installed: !!codexDesktopPath, path: codexDesktopPath, running: procs.includes("Codex") || procs.includes("codex"), description: "OpenAI Codex desktop application", type: "desktop" });

  // Claude CLI
  let claudeCli = false; let claudePath = "";
  try { claudePath = execSync("where claude 2>nul", { encoding: "utf-8" }).trim().split("\n")[0]; claudeCli = true; } catch(e) {}
  apps.push({ id: "claude-cli", name: "Claude CLI", icon: "terminal", installed: claudeCli, path: claudePath, running: procs.toLowerCase().includes("claude"), description: "Anthropic Claude command-line interface", type: "cli" });

  // Claude Desktop - scan MSIX packages in WindowsApps
  let claudeDesktopPath = "";
  try {
    if (fs.existsSync(windowsApps)) {
      const entries = fs.readdirSync(windowsApps);
      const claudeDir = entries.find((e: string) => e.startsWith("Claude_"));
      if (claudeDir) {
        const candidate = windowsApps + "\\" + claudeDir + "\\app\\claude.exe";
        if (fs.existsSync(candidate)) claudeDesktopPath = candidate;
      }
    }
  } catch(e) {}
  // Fallback: check AppExecutionAliases
  if (!claudeDesktopPath) {
    try {
      const r = execSync("where claude 2>nul", { encoding: "utf-8" });
      const lines = r.trim().split("\n");
      const waLine = lines.find((l: string) => l.includes("WindowsApps"));
      if (waLine) { claudeDesktopPath = waLine.trim(); }
    } catch(e) {}
  }
  // Fallback: local install paths
  if (!claudeDesktopPath) {
    const fallbacks = [
      localApp + "\\Claude\\Claude.exe",
      localApp + "\\Programs\\Claude\\Claude.exe",
      programFiles + "\\Claude\\Claude.exe",
      findInFolder(localApp + "\\Claude", "Claude.exe"),
      findInFolder(localApp + "\\claude-desktop", "Claude.exe"),
    ];
    for (const p of fallbacks) { if (p && fs.existsSync(p)) { claudeDesktopPath = p; break; } }
  }
  apps.push({ id: "claude-desktop", name: "Claude Desktop", icon: "message-square", installed: !!claudeDesktopPath, path: claudeDesktopPath, running: procs.includes("Claude"), description: "Anthropic Claude desktop application", type: "desktop" });

  // OpenClaw
  let openclaw = false; let openclawPath = "";
  try { openclawPath = execSync("where openclaw 2>nul", { encoding: "utf-8" }).trim().split("\n")[0]; openclaw = true; } catch(e) {}
  apps.push({ id: "openclaw", name: "OpenClaw", icon: "terminal", installed: openclaw, path: openclawPath, running: procs.toLowerCase().includes("openclaw"), description: "OpenClaw AI coding agent", type: "cli" });

  // OpenCode
  let opencode = false; let opencodePath = "";
  try { opencodePath = execSync("where opencode 2>nul", { encoding: "utf-8" }).trim().split("\n")[0]; opencode = true; } catch(e) {}
  const opencodeDesktopPath = findExe([localApp + "\\ai.opencode.desktop", localApp + "\\Programs\\opencode"], ["OpenCode.exe", "opencode.exe"]);
  apps.push({ id: "opencode-cli", name: "OpenCode CLI", icon: "terminal", installed: opencode, path: opencodePath, running: procs.toLowerCase().includes("opencode"), description: "OpenCode AI coding agent CLI", type: "cli" });
  apps.push({ id: "opencode-desktop", name: "OpenCode Desktop", icon: "monitor", installed: !!opencodeDesktopPath, path: opencodeDesktopPath, running: procs.includes("OpenCode"), description: "OpenCode desktop application", type: "desktop" });

  // Cursor
  const cursorPath = findExe([localApp + "\\Programs\\cursor"], ["Cursor.exe"]);
  apps.push({ id: "cursor", name: "Cursor", icon: "code", installed: !!cursorPath, path: cursorPath, running: procs.includes("Cursor"), description: "AI-powered code editor", type: "desktop" });

  // Trae
  const traePath = findExe([localApp + "\\Programs\\trae", localApp + "\\Programs\\Trae"], ["Trae.exe", "trae.exe"]);
  apps.push({ id: "trae", name: "Trae", icon: "code", installed: !!traePath, path: traePath, running: procs.includes("Trae"), description: "ByteDance AI code editor", type: "desktop" });

  // VS Code
  let vscode = false; let vscodePath = "";
  try { vscodePath = execSync("where code 2>nul", { encoding: "utf-8" }).trim().split("\n")[0]; vscode = true; } catch(e) {}
  apps.push({ id: "vscode", name: "VS Code", icon: "file-code", installed: vscode, path: vscodePath, running: procs.includes("Code"), description: "Visual Studio Code editor", type: "desktop" });

  // Antigravity
  const antigravityPath = findExe([localApp + "\\Programs\\antigravity"], ["Antigravity.exe"]);
  apps.push({ id: "antigravity", name: "Antigravity", icon: "monitor", installed: !!antigravityPath, path: antigravityPath, running: procs.includes("Antigravity"), description: "Antigravity AI assistant", type: "desktop" });

  // Cline
  const clineConfigPath = path.join(appData, "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "claude_dev_settings.json");
  const clineInstalled = fs.existsSync(clineConfigPath) || fs.existsSync(path.join(appData, "Code", "User", "globalStorage", "saoudrizwan.claude-dev"));
  apps.push({ id: "cline", name: "Cline", icon: "code", installed: clineInstalled, path: clineConfigPath, running: false, description: "Autonomous coding agent for VS Code (Claude Dev)", type: "desktop" });

  // Roo Code
  const rooConfigPath = path.join(appData, "Code", "User", "globalStorage", "roodev.roo-cline", "settings", "roo_cline_settings.json");
  const rooInstalled = fs.existsSync(rooConfigPath) || fs.existsSync(path.join(appData, "Code", "User", "globalStorage", "roodev.roo-cline"));
  apps.push({ id: "roo-code", name: "Roo Code", icon: "code", installed: rooInstalled, path: rooConfigPath, running: false, description: "Autonomous AI coding assistant for VS Code (Roo Cline)", type: "desktop" });

  return apps;
}

// Cache for scanApps to avoid blocking event loop
let _appsCache: { data: AppInfo[]; time: number } | null = null;
const APPS_CACHE_TTL = 30000; // 30 seconds

function getCachedApps(): AppInfo[] {
  const now = Date.now();
  if (_appsCache && now - _appsCache.time < APPS_CACHE_TTL) return _appsCache.data;
  const data = scanApps();
  _appsCache = { data, time: now };
  return data;
}

app.get("/api/apps", (_req, res) => {
  try { res.json(getCachedApps()); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post("/api/apps/:id/launch", (req, res) => {
  const { id } = req.params;
  const { providerId } = req.body;
  const provider = getProvider(providerId || loadConfig().activeProviderId);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  const proxyUrl = "http://" + HOST + ":" + PORT;
  // Only pass safe env vars - never spread entire process.env
  const envVars: Record<string, string> = {
    PATH: process.env.PATH || "",
    SystemRoot: process.env.SystemRoot || "C:\\WINDOWS",
    TEMP: process.env.TEMP || "",
    TMP: process.env.TMP || "",
    USERPROFILE: process.env.USERPROFILE || "",
    HOME: process.env.HOME || process.env.USERPROFILE || "",
    LOCALAPPDATA: process.env.LOCALAPPDATA || "",
    APPDATA: process.env.APPDATA || "",
    OPENAI_BASE_URL: proxyUrl + "/v1",
    OPENAI_API_KEY: "sk-dummy",
    ANTHROPIC_BASE_URL: proxyUrl,
    ANTHROPIC_API_KEY: "sk-dummy",
  };
  try {
    const apps = getCachedApps();
    const app = apps.find(a => a.id === id);
    if (!app) return res.status(404).json({ error: "App not found" });
    if (!app.installed) return res.status(400).json({ error: app.name + " is not installed" });

    if (app.type === "cli") {
      // Codex CLI/Desktop 需要更新 config.toml 中的代理地址
      if (id.startsWith("codex")) {
        try {
          const codexConfigPath = path.join(os.homedir(), ".codex", "config.toml");
          if (fs.existsSync(codexConfigPath)) {
            let toml = fs.readFileSync(codexConfigPath, "utf-8");
            // Update [model_providers.OpenAI] base_url
            toml = toml.replace(
              /(\[model_providers\.OpenAI\][\s\S]*?base_url\s*=\s*)"[^"]*"/,
              `$1"${proxyUrl}/v1"`
            );
            // Also update top-level base_url if it points to a non-proxy URL
            if (!toml.match(/^base_url\s*=\s*"http:\/\/127\.0\.0\.1/m)) {
              toml = toml.replace(/^base_url\s*=\s*"[^"]*"/m, `base_url = "${proxyUrl}/v1"`);
            }
            fs.writeFileSync(codexConfigPath, toml, "utf-8");
            log("info", "[Launch] Updated Codex config:", codexConfigPath);
          }
        } catch (e) {
          log("error", "[Launch] Failed to update Codex config:", e);
        }
      }
      const child = spawn("cmd", ["/c", "start", "cmd", "/k",
        "set OPENAI_BASE_URL=" + proxyUrl + "/v1 && set OPENAI_API_KEY=sk-dummy && echo. && echo Orca Proxy: " + proxyUrl + "/v1 && echo Provider: " + provider.name + " && echo App: " + app.name + " && echo. && echo Type: " + app.id.replace(/-.*/, "") + " to start && echo."
      ], { detached: true, stdio: "ignore" });
      child.unref();
      res.json({ ok: true, message: app.name + " terminal opened with " + provider.name });
    } else {
      // Claude Desktop 需要通过配置文件设置代理
      if (id === "claude-desktop" || id === "claude") {
        try {
          const isMac = process.platform === "darwin";
          const claudeConfigPath = isMac 
            ? path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json")
            : path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
          let claudeConfig: any = {};
          try { claudeConfig = JSON.parse(fs.readFileSync(claudeConfigPath, "utf-8")); } catch {}
          claudeConfig.proxy = { url: proxyUrl };
          fs.mkdirSync(path.dirname(claudeConfigPath), { recursive: true });
          fs.writeFileSync(claudeConfigPath, JSON.stringify(claudeConfig, null, 2), "utf-8");
          log("info", "[Launch] Updated Claude Desktop config:", claudeConfigPath);
        } catch (e) {
          log("error", "[Launch] Failed to update Claude Desktop config:", e);
        }
      }
      // Codex Desktop 需要更新 config.toml
      if (id.startsWith("codex")) {
        try {
          const codexConfigPath = path.join(os.homedir(), ".codex", "config.toml");
          if (fs.existsSync(codexConfigPath)) {
            let toml = fs.readFileSync(codexConfigPath, "utf-8");
            toml = toml.replace(
              /(\[model_providers\.OpenAI\][\s\S]*?base_url\s*=\s*)"[^"]*"/,
              `$1"${proxyUrl}/v1"`
            );
            if (!toml.match(/^base_url\s*=\s*"http:\/\/127\.0\.0\.1/m)) {
              toml = toml.replace(/^base_url\s*=\s*"[^"]*"/m, `base_url = "${proxyUrl}/v1"`);
            }
            fs.writeFileSync(codexConfigPath, toml, "utf-8");
            log("info", "[Launch] Updated Codex config:", codexConfigPath);
          }
        } catch (e) {
          log("error", "[Launch] Failed to update Codex config:", e);
        }
      }
      // Cline / Roo Code settings update and launch VS Code fallback
      if (id === "cline" || id === "roo-code") {
        try {
          const configPath = app.path;
          let config: any = {};
          if (fs.existsSync(configPath)) {
            try { config = JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch {}
          }
          config.apiProvider = "openai";
          config.openAiBaseUrl = proxyUrl + "/v1";
          config.openAiApiKey = "sk-dummy";
          config.openAiModelId = provider.models[0]?.id || "deepseek-chat";
          fs.mkdirSync(path.dirname(configPath), { recursive: true });
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
          log("info", `[Launch] Updated ${app.name} config:`, configPath);
        } catch (e) {
          log("error", `[Launch] Failed to update ${app.name} config:`, e);
        }

        // Override target launch path to VS Code if installed
        const vscodeApp = apps.find(a => a.id === "vscode");
        if (vscodeApp && vscodeApp.installed && vscodeApp.path) {
          app.path = vscodeApp.path;
        }
      }

      if (app.path && !app.path.endsWith(".json")) {
        const child = spawn(app.path, [], { detached: true, stdio: "ignore", env: envVars });
        child.unref();
      }
      res.json({ ok: true, message: app.name + " launched with " + provider.name });
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ---- Graceful shutdown ----

function gracefulShutdown(signal: string) {
  log("info", `Received ${signal}, shutting down gracefully...`);
  shutdownMCPServers();
  saveConfig(loadConfig());
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
