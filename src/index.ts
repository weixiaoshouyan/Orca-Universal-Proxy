import express from "express";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
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

dotenv.config({ path: process.env.ORCA_BASE_DIR ? path.join(process.env.ORCA_BASE_DIR, '.env') : undefined });

const _isPkg = !!(process as any).pkg;
const _isSEA = typeof (process as any).isSea !== "undefined" && (process as any).isSea;
const _isElectron = !!process.env.ORCA_BASE_DIR;
const _devDir = path.join(__dirname, "..");
const _portableDir = __dirname;
const _BASE_DIR = _isElectron ? process.env.ORCA_BASE_DIR! : ((_isPkg || _isSEA) ? path.dirname(process.execPath) : (fs.existsSync(path.join(_portableDir, "public")) ? _portableDir : _devDir));
const _STATIC_DIR = _isElectron ? path.join(_devDir, "public") : path.join(_BASE_DIR, "public");

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
  const message = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  console.log(`[${ts}] [${level.toUpperCase()}]`, message);
  logBuffer.push({ time: ts, level, message });
  if (logBuffer.length > MAX_LOGS) logBuffer.shift();
}

interface Stats {
  totalRequests: number;
  codexRequests: number;
  claudeRequests: number;
  chatRequests: number;
  errors: number;
  totalTokens: number;
  startTime: string;
}

const stats: Stats = {
  totalRequests: 0, codexRequests: 0, claudeRequests: 0,
  chatRequests: 0, errors: 0, totalTokens: 0,
  startTime: new Date().toISOString(),
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
  if (req.url.startsWith("/v1/") || req.url.startsWith("/api/")) {
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
  res.json({ ...c, providerKeys: safeKeys });
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
    if (updates.providerKeys) {
      for (const [k, v] of Object.entries(updates.providerKeys)) {
        if (typeof v === "string") {
          if (v === "" || v === "__clear__") {
            delete current.providerKeys[k];
          } else if (!v.includes("***")) {
            current.providerKeys[k] = v;
          }
        }
      }
    }
    saveConfig(current);
    res.json({ ok: true, message: "Config saved" });
  } catch (e) { res.status(400).json({ error: String(e) }); }
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
  res.json(logBuffer.slice(-limit));
});

app.delete("/api/logs", (_req, res) => { logBuffer.length = 0; res.json({ ok: true }); });
app.get("/api/stats", (_req, res) => { res.json(stats); });
app.get("/api/token-history", (_req, res) => { res.json(tokenHistory); });
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

// ---- OpenAI passthrough: POST /v1/chat/completions ----

app.post("/v1/chat/completions", async (req, res) => {
  const startTime = Date.now();
  stats.chatRequests++;
  try {
    const body = req.body;
    const resolved = resolveModel(body.model);
    if (!resolved.apiKey) return res.status(401).json({ error: { message: `API Key not configured for ${resolved.provider.name}` } });
    log("info", `[Chat] ${body.model} -> ${resolved.provider.id}/${resolved.model}`);

    let targetUrl: string;
    let headers: Record<string, string>;
    let reqBody: string;

    if (resolved.provider.id === "anthropic") {
      // Convert OpenAI format to Anthropic Messages format
      targetUrl = resolved.provider.baseUrl + "/v1/messages";
      headers = { "Content-Type": "application/json", "x-api-key": resolved.apiKey, "anthropic-version": "2023-06-01" };
      const messages = (body.messages || []).filter((m: any) => m.role !== "system");
      const systemMsgs = (body.messages || []).filter((m: any) => m.role === "system");
      const systemText = systemMsgs.map((m: any) => typeof m.content === "string" ? m.content : "").join("\n");
      const anthropicBody: any = { model: resolved.model, max_tokens: body.max_tokens || 4096, messages };
      if (systemText) anthropicBody.system = systemText;
      if (body.temperature !== undefined) anthropicBody.temperature = body.temperature;
      if (body.stream) anthropicBody.stream = true;
      reqBody = JSON.stringify(anthropicBody);
    } else {
      // Standard OpenAI-compatible
      targetUrl = resolved.provider.baseUrl + "/v1/chat/completions";
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${resolved.apiKey}` };
      reqBody = JSON.stringify({ ...body, model: resolved.model });
    }

    const upstreamResp = await fetch(targetUrl, { method: "POST", headers, body: reqBody });

    if (resolved.provider.id === "anthropic") {
      // Convert Anthropic response back to OpenAI format
      const isSse = (upstreamResp.headers.get("content-type") || "").includes("text/event-stream");
      if (isSse) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        const a2oState = createAnthropicToOpenAIState(resolved.model);
        await streamSSE(upstreamResp, req, res,
          (_state, chunk) => processAnthropicToOpenAIChunk(a2oState, chunk),
          (_state) => generateAnthropicToOpenAIEndEvents(a2oState),
          () => null as any, a2oState);
      } else {
        const data = await upstreamResp.json() as any;
        const textParts = (data.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text);
        const usage = data.usage || {};
        const openaiResp = { id: data.id || "chatcmpl-" + Date.now(), object: "chat.completion", created: Math.floor(Date.now() / 1000), model: resolved.model,
          choices: [{ index: 0, message: { role: "assistant", content: textParts.join("") }, finish_reason: data.stop_reason === "end_turn" ? "stop" : (data.stop_reason || "stop") }],
          usage: { prompt_tokens: usage.input_tokens || 0, completion_tokens: usage.output_tokens || 0, total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0) } };
        res.json(openaiResp);
      }
    } else {
      // Standard OpenAI-compatible passthrough
      const isSse = (upstreamResp.headers.get("content-type") || "").includes("text/event-stream");
      if (isSse) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        const reader = (upstreamResp.body as any).getReader();
        const decoder = new TextDecoder();
        while (true) { const { done, value } = await reader.read(); if (done) break; res.write(decoder.decode(value, { stream: true })); }
        res.end();
      } else {
        const text = await upstreamResp.text();
        res.status(upstreamResp.status).setHeader("Content-Type", upstreamResp.headers.get("content-type") || "application/json").send(text);
      }
    }
    log("info", `[Chat] Done ${Date.now() - startTime}ms`);
  } catch (err) {
    log("error", `[Chat] Failed:`, err); stats.errors++;
    res.status(502).json({ error: { message: String(err), type: "proxy_error" } });
  }
});

// ---- Models ----

// ---- 自动发现供应商的可用模型列表 ----
app.get("/api/discover-models/:providerId", async (req, res) => {
  const provider = getProvider(req.params.providerId);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  const apiKey = getApiKey(provider.id);
  if (!apiKey) return res.status(400).json({ error: "API Key not configured" });
  try {
    const targetUrl = provider.baseUrl + "/v1/models";
    const resp = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) return res.status(resp.status).json({ error: await resp.text() });
    const data = await resp.json() as any;
    const models = (data.data || []).map((m: any) => ({ id: m.id, name: m.id }));
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

function findInFolder(baseDir: string, exeName: string): string {
  if (!baseDir || !fs.existsSync(baseDir)) return "";
  try {
    const direct = baseDir + "\\" + exeName;
    if (fs.existsSync(direct)) return direct;
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const nested = baseDir + "\\" + entry.name + "\\" + exeName;
        if (fs.existsSync(nested)) return nested;
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
          const codexConfigPath = path.join(process.env.USERPROFILE || process.env.HOME || "", ".codex", "config.toml");
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
          const claudeConfigPath = path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
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
          const codexConfigPath = path.join(process.env.USERPROFILE || process.env.HOME || "", ".codex", "config.toml");
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
      const child = spawn(app.path, [], { detached: true, stdio: "ignore", env: envVars });
      child.unref();
      res.json({ ok: true, message: app.name + " launched with " + provider.name });
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ---- Graceful shutdown ----

function gracefulShutdown(signal: string) {
  log("info", `Received ${signal}, shutting down gracefully...`);
  saveConfig(loadConfig());
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
