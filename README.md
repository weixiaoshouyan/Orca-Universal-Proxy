# Orca Universal Proxy

通用 AI 代理服务器 — 支持 Codex CLI、Claude 桌面端，适配所有主流国产大模型 API。

## 功能

- **Codex CLI 代理** — 将 OpenAI Responses API 转换为 Chat Completions API
- **Claude 桌面端代理** — 将 Anthropic Messages API 转换为 Chat Completions API
- **多提供商支持** — DeepSeek、通义千问、智谱、月之暗面、百川、零一万物、豆包、硅基流动
- **可视化管理界面** — Web UI 配置提供商、查看日志、监控请求统计
- **智能模型映射** — 自动将 OpenAI/Anthropic 模型名映射到当前提供商
- **流式传输** — 完整 SSE 流式响应支持

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置 API Key（任选一种方式）
#    方式A: 复制 .env.example 为 .env 并填入 Key
cp .env.example .env

#    方式B: 启动后在 Web 管理界面中配置

# 3. 启动代理
npm run dev
```

启动后打开 http://127.0.0.1:3000 即可使用可视化管理界面。

## 使用方式

### Codex CLI

```powershell
$env:OPENAI_BASE_URL = "http://127.0.0.1:3000/v1"
$env:OPENAI_API_KEY = "sk-dummy"
codex "你好"
```

### Claude 桌面端

编辑 `claude_desktop_config.json`，添加代理配置：

```json
{
  "proxy": {
    "url": "http://127.0.0.1:3000"
  }
}
```

配置文件位置：
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

### OpenAI 兼容直通

```bash
curl http://127.0.0.1:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"Hi"}]}'
```

## 支持的提供商

| 提供商 | 环境变量 | 模型 |
|--------|----------|------|
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat, deepseek-reasoner |
| 通义千问 | `DASHSCOPE_API_KEY` | qwen-turbo, qwen-plus, qwen-max |
| 智谱AI | `ZHIPU_API_KEY` | glm-4-flash, glm-4, glm-4-long |
| 月之暗面 | `MOONSHOT_API_KEY` | moonshot-v1-8k/32k/128k |
| 百川智能 | `BAICHUAN_API_KEY` | Baichuan4, Baichuan3-Turbo |
| 零一万物 | `YI_API_KEY` | yi-large, yi-medium, yi-spark |
| 豆包 | `DOUBAO_API_KEY` | doubao-pro-4k/32k/128k |
| 硅基流动 | `SILICONFLOW_API_KEY` | DeepSeek-V3, Qwen2.5-72B 等 |

## 管理界面

启动后访问 http://127.0.0.1:3000 ，可以：

- 查看实时请求统计（总请求数、Codex/Claude 请求数、Token 消耗）
- 切换默认提供商
- 配置各提供商 API Key
- 查看请求日志
- 测试提供商连通性

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | 监听端口 |
| `LOG_LEVEL` | info | 日志级别 (debug/info/warn/error) |

各提供商 API Key 见上方表格，也可通过 Web 界面配置。

## 架构

```
src/
  index.ts       - Express 主服务器，路由，SSE 流处理
  transform.ts   - Responses API <-> Chat Completions 转换
  anthropic.ts   - Anthropic Messages API <-> Chat Completions 转换
  providers.ts   - 提供商注册表，配置管理，模型映射
public/
  index.html     - 可视化管理界面 (SPA)
data/
  config.json    - 运行时配置（自动生成）
```

## License

MIT
