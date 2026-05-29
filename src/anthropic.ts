// ============================================================
// src/anthropic.ts
// Anthropic Messages API <-> OpenAI Chat Completions 转换
// 用于代理 Claude 桌面端
// ============================================================

import { randomUUID } from "crypto";

// ---- Anthropic 类型定义 ----------------------------------------------------

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string | AnthropicContentBlock[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  tools?: AnthropicTool[];
  tool_choice?: { type: string; name?: string };
  metadata?: Record<string, unknown>;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: "text" | "image" | "tool_use" | "tool_result";
  text?: string;
  tool_use_id?: string;
  content?: string | AnthropicContentBlock[];
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  source?: { type: string; media_type: string; data: string };
}

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

// ---- 转换: Anthropic Request -> OpenAI Chat Request ------------------------

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  stream: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  tools?: OpenAITool[];
  stop?: string[];
}

interface OpenAIMessage {
  role: string;
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export function transformAnthropicRequest(body: AnthropicRequest): OpenAIChatRequest {
  const messages: OpenAIMessage[] = [];

  // system -> system message
  if (body.system) {
    const sysText = typeof body.system === "string"
      ? body.system
      : body.system.filter((b) => b.type === "text").map((b) => b.text || "").join("\n");
    messages.push({ role: "system", content: sysText });
  }

  // messages
  for (const msg of body.messages) {
    if (typeof msg.content === "string") {
      messages.push({ role: msg.role, content: msg.content });
      continue;
    }

    // Array content
    for (const block of msg.content) {
      if (block.type === "text" && msg.role === "user") {
        messages.push({ role: "user", content: block.text || "" });
      } else if (block.type === "text" && msg.role === "assistant") {
        messages.push({ role: "assistant", content: block.text || "" });
      } else if (block.type === "tool_use" && msg.role === "assistant") {
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [{
            id: block.id || `call_${randomUUID().slice(0, 8)}`,
            type: "function",
            function: {
              name: block.name || "",
              arguments: JSON.stringify(block.input || {}),
            },
          }],
        });
      } else if (block.type === "tool_result") {
        const resultContent = typeof block.content === "string"
          ? block.content
          : Array.isArray(block.content)
            ? block.content.filter((b) => b.type === "text").map((b) => b.text || "").join("\n")
            : JSON.stringify(block.content);
        messages.push({
          role: "tool",
          tool_call_id: block.tool_use_id || "",
          content: resultContent,
        });
      }
    }
  }

  // tools
  const tools: OpenAITool[] | undefined = body.tools?.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));

  const req: OpenAIChatRequest = {
    model: body.model,
    messages,
    stream: body.stream !== false,
    max_tokens: body.max_tokens,
  };

  if (body.temperature !== undefined) req.temperature = body.temperature;
  if (body.top_p !== undefined) req.top_p = body.top_p;
  if (tools && tools.length > 0) req.tools = tools;
  if (body.stop_sequences) req.stop = body.stop_sequences;

  return req;
}

// ---- 流式响应转换: OpenAI SSE -> Anthropic SSE ----------------------------

export interface AnthropicStreamState {
  messageId: string;
  model: string;
  role: "assistant";
  fullText: string;
  toolCalls: Map<number, { id: string; name: string; arguments: string }>;
  contentBlockIndex: number;
  started: boolean;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
}

export function createAnthropicStreamState(model: string): AnthropicStreamState {
  return {
    messageId: `msg_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    model,
    role: "assistant",
    fullText: "",
    toolCalls: new Map(),
    contentBlockIndex: 0,
    started: false,
    inputTokens: 0,
    outputTokens: 0,
    stopReason: null,
  };
}

function anthropicSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function anthropicStartEvents(state: AnthropicStreamState): string {
  let out = "";
  out += anthropicSse("message_start", {
    type: "message_start",
    message: {
      id: state.messageId,
      type: "message",
      role: state.role,
      content: [],
      model: state.model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: state.inputTokens, output_tokens: 0 },
    },
  });
  out += anthropicSse("ping", { type: "ping" });
  state.started = true;
  return out;
}

export function processAnthropicChunk(
  state: AnthropicStreamState,
  chunk: Record<string, unknown>
): string {
  let out = "";

  if (!state.started) {
    out += anthropicStartEvents(state);
  }

  const usage = chunk.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
  if (usage) {
    if (usage.prompt_tokens) state.inputTokens = usage.prompt_tokens;
    if (usage.completion_tokens) state.outputTokens = usage.completion_tokens;
  }

  const choices = chunk.choices as Array<Record<string, unknown>> | undefined;
  if (!choices || choices.length === 0) return out;

  const choice = choices[0];
  const delta = (choice.delta || {}) as Record<string, unknown>;
  const finishReason = choice.finish_reason as string | null;
  if (finishReason) {
    state.stopReason = finishReason === "tool_calls" ? "tool_use" : "end_turn";
  }

  // Text content
  const content = delta.content as string | undefined;
  if (content) {
    if (state.fullText.length === 0 && state.toolCalls.size === 0) {
      // Start a text content block
      out += anthropicSse("content_block_start", {
        type: "content_block_start",
        index: state.contentBlockIndex,
        content_block: { type: "text", text: "" },
      });
    }
    state.fullText += content;
    out += anthropicSse("content_block_delta", {
      type: "content_block_delta",
      index: state.contentBlockIndex,
      delta: { type: "text_delta", text: content },
    });
  }

  // Tool calls
  const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
  if (toolCalls) {
    for (const tc of toolCalls) {
      const idx = tc.index as number;
      const fn = (tc.function || {}) as Record<string, unknown>;

      if (!state.toolCalls.has(idx)) {
        // Close text block if open
        if (state.fullText.length > 0 && state.toolCalls.size === 0) {
          out += anthropicSse("content_block_stop", {
            type: "content_block_stop",
            index: state.contentBlockIndex,
          });
          state.contentBlockIndex++;
        }

        const callId = (tc.id as string) || `toolu_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
        state.toolCalls.set(idx, { id: callId, name: (fn.name as string) || "", arguments: "" });

        out += anthropicSse("content_block_start", {
          type: "content_block_start",
          index: state.contentBlockIndex + idx,
          content_block: { type: "tool_use", id: callId, name: (fn.name as string) || "", input: {} },
        });
      }

      const tcData = state.toolCalls.get(idx)!;
      if (fn.name) tcData.name = fn.name as string;
      if (fn.arguments) {
        tcData.arguments += fn.arguments as string;
        out += anthropicSse("content_block_delta", {
          type: "content_block_delta",
          index: state.contentBlockIndex + idx,
          delta: { type: "input_json_delta", partial_json: fn.arguments },
        });
      }
    }
  }

  return out;
}

export function generateAnthropicEndEvents(state: AnthropicStreamState): string {
  let out = "";

  if (!state.started) {
    out += anthropicStartEvents(state);
  }

  // Close all open content blocks
  if (state.toolCalls.size > 0) {
    for (let i = 0; i < state.toolCalls.size; i++) {
      out += anthropicSse("content_block_stop", {
        type: "content_block_stop",
        index: state.contentBlockIndex + i,
      });
    }
  } else {
    // Close text block
    out += anthropicSse("content_block_stop", {
      type: "content_block_stop",
      index: state.contentBlockIndex,
    });
  }

  out += anthropicSse("message_delta", {
    type: "message_delta",
    delta: {
      stop_reason: state.stopReason || "end_turn",
      stop_sequence: null,
    },
    usage: { output_tokens: state.outputTokens },
  });

  out += anthropicSse("message_stop", { type: "message_stop" });

  return out;
}

export function formatAnthropicError(statusCode: number, message: string): string {
  return anthropicSse("error", {
    type: "error",
    error: {
      type: statusCode >= 500 ? "api_error" : "invalid_request_error",
      message,
    },
  });
}
