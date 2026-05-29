# Orca DeepSeek Proxy

A lightweight proxy server that bridges **Codex CLI** (OpenAI Responses API) to **DeepSeek Chat Completions API**.

Use DeepSeek models as a drop-in replacement for OpenAI in Codex CLI.

## How It Works

```
Codex CLI  -->  POST /v1/responses (Responses API)  -->  Orca Proxy
                                                          |
                                                          v  (transform)
                                                    POST /v1/chat/completions
                                                          |
                                                          v
                                                    DeepSeek API
                                                          |
                                                          v  (transform back)
Codex CLI  <--  SSE stream (Responses API format)  <--  Orca Proxy
```

The proxy translates between two different OpenAI API formats:
- **Responses API** (used by Codex CLI) `/v1/responses`
- **Chat Completions API** (used by DeepSeek) `/v1/chat/completions`

## Quick Start

### 1. Install

```bash
git clone https://github.com/user/orca.git
cd orca
npm install
```

### 2. Configure

Copy `.env.example` to `.env` and set your DeepSeek API key:

```bash
cp .env.example .env
```

Edit `.env`:
```env
DEEPSEEK_API_KEY=sk-your-actual-deepseek-key
```

### 3. Start the proxy

```bash
# Development (with ts-node, auto-reload not included)
npm run dev

# Or build and run
npm run build
npm start
```

You should see:
```
[2025-XX-XX] [INFO] ===========================================
[2025-XX-XX] [INFO]   Orca DeepSeek Proxy v1.0.0
[2025-XX-XX] [INFO]   Listening on http://127.0.0.1:3000
[2025-XX-XX] [INFO]   DeepSeek target: https://api.deepseek.com
[2025-XX-XX] [INFO] ===========================================
```

### 4. Use with Codex CLI

In a **separate terminal**, set these environment variables and use Codex normally:

```bash
export OPENAI_BASE_URL=http://127.0.0.1:3000/v1
export OPENAI_API_KEY=sk-dummy

# Now use Codex as usual
codex "help me write a Python script"
```

Or on Windows PowerShell:
```powershell
$env:OPENAI_BASE_URL = "http://127.0.0.1:3000/v1"
$env:OPENAI_API_KEY = "sk-dummy"
codex "help me write a Python script"
```

## Configuration

All settings via environment variables (or `.env` file):

| Variable | Default | Description |
|---|---|---|
| `DEEPSEEK_API_KEY` | (required) | Your DeepSeek API key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek API endpoint |
| `DEEPSEEK_DEFAULT_MODEL` | `deepseek-chat` | Fallback model when no mapping matches |
| `MODEL_MAP` | (see below) | JSON mapping of OpenAI model names to DeepSeek models |
| `PORT` | `3000` | Proxy listen port |
| `LOG_LEVEL` | `info` | Logging verbosity: debug, info, warn, error |

### Model Mapping

By default, these mappings are active:

| OpenAI Model | DeepSeek Model |
|---|---|
| gpt-4, gpt-4o, gpt-4o-mini, gpt-4-turbo | deepseek-chat |
| gpt-3.5-turbo | deepseek-chat |
| o1, o1-mini, o1-pro, o3, o3-mini, o4-mini | deepseek-reasoner |

Override with `MODEL_MAP` env var (JSON string):
```env
MODEL_MAP={"gpt-4o":"deepseek-reasoner","gpt-4":"deepseek-chat"}
```

Models starting with `deepseek-` are passed through unchanged.

## Features

- **Request transformation**: Converts Responses API `input` format to Chat Completions `messages`, including `instructions` -> system message
- **Tool/function call support**: Converts tool definitions between formats and streams tool call arguments correctly
- **Streaming (SSE)**: Full streaming support with proper Responses API event types
- **Model mapping**: Automatically maps OpenAI model names to DeepSeek equivalents
- **Pass-through**: Non-responses endpoints (`/v1/*`) are forwarded directly to DeepSeek
- **Detailed logging**: Request/response logging with token usage tracking
- **Security**: Listens only on 127.0.0.1 (localhost)
- **Error handling**: Errors are returned in Responses API format

## Architecture

```
src/
  index.ts      - Express server, routing, streaming proxy logic
  transform.ts  - Request/response format conversion logic
```

### Key transformations

**Request** (Responses API -> Chat Completions):
- `input` (string or array) -> `messages` array
- `instructions` -> system message prepended
- `tools[].{name,description,parameters}` -> `tools[].function.{name,description,parameters}`
- `max_output_tokens` -> `max_tokens`
- `previous_response_id` -> ignored (logged as warning)

**Response stream** (Chat Completions SSE -> Responses API SSE):
- Text deltas -> `response.output_text.delta` events
- Tool call deltas -> `response.function_call_arguments.delta` events
- Stream lifecycle -> `response.created` / `response.in_progress` / `response.completed`
- Usage info embedded in `response.completed` event

## Troubleshooting

**Port already in use**: Change `PORT` in `.env` or kill the process on port 3000.

**DeepSeek API error 401**: Check your `DEEPSEEK_API_KEY`.

**Codex still uses OpenAI**: Make sure `OPENAI_BASE_URL` is set in the **same terminal** where you run `codex`.

**Tools not working**: DeepSeek function calling support varies by model. `deepseek-chat` generally works well; `deepseek-reasoner` may have limitations.

## License

MIT
