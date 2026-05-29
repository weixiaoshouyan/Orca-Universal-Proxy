// ============================================================
// src/index.ts
// Orca DeepSeek Proxy Server
// Bridges Codex CLI (OpenAI Responses API) -> DeepSeek Chat Completions API
// ============================================================

import express from "express";
import dotenv from "dotenv";
import { Readable } from "stream";
import {
  transformRequest,
  createStreamState,
  processChunk,
  generateEndEvents,
  formatError,
  type ResponsesRequest,
} from "./transform";

dotenv.config();

// ---- Configuration --------------------------------------------------------

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = "127.0.0.1";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

const LOG_LEVELS: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[LOG_LEVEL] ?? 1;

function log(level: string, ...args: unknown[]) {
  if ((LOG_LEVELS[level] ?? 1) >= currentLevel) {
    const ts = new Date().toISOString();
    console.log(`[${ts}] [${level.toUpperCase()}]`, ...args);
  }
}

// ---- Startup checks -------------------------------------------------------

if (!DEEPSEEK_API_KEY) {
  console.error("ERROR: DEEPSEEK_API_KEY is not set. Create a .env file or export the variable.");
  process.exit(1);
}

// ---- Express app ----------------------------------------------------------

const app = express();
app.use(express.json({ limit: "10mb" }));

// Request logging middleware
app.use((req, _res, next) => {
  log("info", `${req.method} ${req.url} from ${req.ip}`);
  next();
});

// ---- Health check ---------------------------------------------------------

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "orca-deepseek-proxy", version: "1.0.0" });
});

app.get("/v1/models", async (_req, res) => {
  // Proxy to DeepSeek or return a stub
  try {
    const resp = await fetch(DEEPSEEK_BASE_URL + "/v1/models", {
      headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch {
    res.json({ data: [{ id: "deepseek-chat" }, { id: "deepseek-reasoner" }] });
  }
});

// ---- Main proxy: /v1/responses -------------------------------------------

app.post("/v1/responses", async (req, res) => {
  const startTime = Date.now();

  try {
    const body = req.body as ResponsesRequest;
    log("info", `Model requested: ${body.model}`);
    log("debug", `Input items: ${Array.isArray(body.input) ? body.input.length : "string"}`);

    if (body.previous_response_id) {
      log("warn", "previous_response_id is not supported by this proxy, ignoring:", body.previous_response_id);
    }

    // Transform request
    const chatReq = transformRequest(body);
    log("info", `Model mapped: ${body.model} -> ${chatReq.model}`);
    log("debug", `Messages count: ${chatReq.messages.length}, Tools: ${chatReq.tools?.length ?? 0}`);

    // Prepare SSE response headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Make streaming request to DeepSeek
    const targetUrl = DEEPSEEK_BASE_URL + "/v1/chat/completions";
    log("debug", `Forwarding to: ${targetUrl}`);

    const deepseekResp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(chatReq),
    });

    if (!deepseekResp.ok) {
      const errText = await deepseekResp.text();
      log("error", `DeepSeek returned ${deepseekResp.status}: ${errText}`);
      res.write(formatError(deepseekResp.status, `DeepSeek API error: ${errText}`));
      res.end();
      return;
    }

    if (!deepseekResp.body) {
      log("error", "DeepSeek returned empty body");
      res.write(formatError(502, "Empty response from DeepSeek"));
      res.end();
      return;
    }

    // Stream processing
    const state = createStreamState(chatReq.model);
    const reader = (deepseekResp.body as unknown as ReadableStream).getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let chunkCount = 0;

    // Handle client disconnect
    let clientDisconnected = false;
    req.on("close", () => {
      clientDisconnected = true;
      log("info", "Client disconnected, aborting stream");
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || clientDisconnected) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split("\n");
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue; // skip empty lines and comments

          if (trimmed === "data: [DONE]") {
            // Stream complete - emit final events
            const endEvents = generateEndEvents(state);
            if (endEvents) res.write(endEvents);
            continue;
          }

          if (trimmed.startsWith("data: ")) {
            const jsonStr = trimmed.slice(6);
            try {
              const chunk = JSON.parse(jsonStr);
              chunkCount++;
              const events = processChunk(state, chunk);
              if (events) res.write(events);
            } catch (e) {
              log("warn", "Failed to parse chunk:", jsonStr.slice(0, 200));
            }
          }
        }
      }
    } catch (streamErr) {
      log("error", "Stream reading error:", streamErr);
      if (!res.writableEnded) {
        res.write(formatError(502, "Stream reading error"));
      }
    }

    // Ensure end events are emitted even if [DONE] was missed
    if (!res.writableEnded) {
      const endEvents = generateEndEvents(state);
      if (endEvents) res.write(endEvents);
    }

    const elapsed = Date.now() - startTime;
    log("info", `Completed: ${chunkCount} chunks, ${elapsed}ms, model=${state.model}`);
    if (state.usage) {
      log("info", `Tokens - prompt: ${state.usage.prompt_tokens}, completion: ${state.usage.completion_tokens}, total: ${state.usage.total_tokens}`);
    }

    res.end();
  } catch (err) {
    const elapsed = Date.now() - startTime;
    log("error", `Request failed after ${elapsed}ms:`, err);

    if (!res.headersSent) {
      res.status(500).json({
        error: { message: String(err), type: "proxy_error", code: "internal_error" },
      });
    } else if (!res.writableEnded) {
      res.write(formatError(500, String(err)));
      res.end();
    }
  }
});

// ---- Fallback: pass-through to DeepSeek -----------------------------------

app.all("/v1/*", async (req, res) => {
  const targetUrl = DEEPSEEK_BASE_URL + req.url;
  log("info", `Pass-through: ${req.method} ${req.url} -> ${targetUrl}`);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    };
    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"] as string;
    }

    const resp = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
    });

    const isSse = (resp.headers.get("content-type") || "").includes("text/event-stream");

    if (isSse) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const reader = (resp.body as unknown as ReadableStream).getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
    } else {
      const text = await resp.text();
      res.status(resp.status).setHeader("Content-Type", resp.headers.get("content-type") || "application/json").send(text);
    }
  } catch (err) {
    log("error", "Pass-through error:", err);
    res.status(502).json({ error: { message: String(err), type: "proxy_error" } });
  }
});

// ---- Start server ---------------------------------------------------------

app.listen(PORT, HOST, () => {
  log("info", "===========================================");
  log("info", "  Orca DeepSeek Proxy v1.0.0");
  log("info", `  Listening on http://${HOST}:${PORT}`);
  log("info", `  DeepSeek target: ${DEEPSEEK_BASE_URL}`);
  log("info", `  Log level: ${LOG_LEVEL}`);
  log("info", "===========================================");
  log("info", "");
  log("info", "  Configure Codex CLI:");
  log("info", `    export OPENAI_BASE_URL=http://${HOST}:${PORT}/v1`);
  log("info", "    export OPENAI_API_KEY=sk-dummy");
  log("info", "");
});
