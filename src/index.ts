import express from "express";
import dotenv from "dotenv";
import path from "path";
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

dotenv.config();

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

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "..", "public"), {
  setHeaders: (res) => { res.setHeader("Content-Type", "text/html; charset=utf-8"); }
}));

app.use((req, _res, next) => {
  if (!req.url.startsWith("/api/")) log("info", `${req.method} ${req.url} from ${req.ip}`);
  stats.totalRequests++;
  next();
});
// ---- Management API ----

app.get("/api/status", (_req, res) => {
  const active = getActiveProvider();
  res.json({ status: "ok", version: "2.0.0", uptime: process.uptime(),
    activeProvider: { id: active.id, name: active.name, baseUrl: active.baseUrl }, stats });
});

app.get("/api/providers", (_req, res) => {
  const providers = getAllProviders().map((p) => ({
    ...p, apiKey: getApiKey(p.id) ? "***configured***" : "",
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
    if (updates.port) current.port = updates.port;
    if (updates.logLevel) current.logLevel = updates.logLevel;
    if (updates.modelOverrides) current.modelOverrides = { ...current.modelOverrides, ...updates.modelOverrides };
    if (updates.providerKeys) {
      for (const [k, v] of Object.entries(updates.providerKeys)) {
        if (typeof v === "string" && v && !v.includes("***")) current.providerKeys[k] = v;
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
      const data = await resp.json();
      res.json({ ok: true, message: "Connection success", model: provider.models[0].id, data });
    } else {
      const err = await resp.text();
      res.json({ ok: false, message: `API returned ${resp.status}`, error: err });
    }
  } catch (e) { res.json({ ok: false, message: "Connection failed", error: String(e) }); }
});

app.get("/api/logs", (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  res.json(logBuffer.slice(-limit));
});

app.delete("/api/logs", (_req, res) => { logBuffer.length = 0; res.json({ ok: true }); });
app.get("/api/stats", (_req, res) => { res.json(stats); });
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
    const chatReq = transformAnthropicRequest({ ...body, model: resolved.model });
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
      log("error", `[Claude] ${resolved.provider.name} returned ${upstreamResp.status}: ${errText}`);
      res.write(formatAnthropicError(upstreamResp.status, `${resolved.provider.name} error: ${errText}`));
      res.end(); stats.errors++; return;
    }
    if (!upstreamResp.body) { res.write(formatAnthropicError(502, "Empty response")); res.end(); stats.errors++; return; }
    const anthropicState = createAnthropicStreamState(resolved.model);
    await streamSSE(upstreamResp, req, res,
      (_state, chunk) => processAnthropicChunk(anthropicState, chunk),
      (_state) => generateAnthropicEndEvents(anthropicState),
      () => null as any, anthropicState);
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
    const chatReq = { ...body, model: resolved.model };
    const targetUrl = resolved.provider.baseUrl + "/v1/chat/completions";
    const upstreamResp = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolved.apiKey}` },
      body: JSON.stringify(chatReq),
    });
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
    log("info", `[Chat] Done ${Date.now() - startTime}ms`);
  } catch (err) {
    log("error", `[Chat] Failed:`, err); stats.errors++;
    res.status(502).json({ error: { message: String(err), type: "proxy_error" } });
  }
});

// ---- Models ----

app.get("/v1/models", (_req, res) => {
  const providers = getAllProviders();
  const models = providers.flatMap((p) => p.models.map((m) => ({
    id: m.id, object: "model", created: Math.floor(Date.now() / 1000), owned_by: p.id, provider_name: p.name,
  })));
  res.json({ object: "list", data: models });
});

app.get("/", (_req, res) => { res.sendFile(path.join(__dirname, "..", "public", "index.html")); });
// ---- SSE stream helper ----

async function streamSSE(
  upstreamResp: Response, req: express.Request, res: express.Response,
  processFn: (state: any, chunk: Record<string, unknown>) => string,
  endFn: (state: any) => string, createStateFn: () => any, externalState?: any
) {
  const state = externalState || createStateFn();
  const reader = (upstreamResp.body as unknown as ReadableStream).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let clientDisconnected = false;
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
          const endEvents = endFn(state);
          if (endEvents) res.write(endEvents);
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
    if (!res.writableEnded) res.write(formatError(502, "Stream reading error"));
  }
  if (!res.writableEnded) { const endEvents = endFn(state); if (endEvents) res.write(endEvents); }
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
  log("info", "  Orca Universal Proxy v2.0.0");
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