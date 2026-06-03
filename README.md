# Orca Agentic Universal Proxy (Orca 智能代理网关)

Orca Agentic Universal Proxy 是一款专为 AI 开发工具与桌面客户端打造的本地多模型智能代理服务器。除原生的 **Codex CLI**、**Claude 桌面端**、**Cursor/VSCode** 等工具适配外，全新升级为**智能体代理网关 (Agent Mode)**，支持外部 **Skills (本地脚本技能)** 与 **Model Context Protocol (MCP) 服务** 的深度接入。

项目集成了轻量级 Electron 可视化界面，提供直观的监控、丰富的配置以及便捷的外部应用快捷启动。

---

## 🌟 主要功能

- 🤖 **智能体模式与工具调用 (Agent Mode & Tool Execution Loop)**
  - **本地 Skills 接入**：自动扫描 `C:\Users\台就\.agents\skills` 目录下的所有技能模块，动态注入系统提示词，并将技能中的自动化脚本注册为大模型的 Tool，支持自动循环调用与结果回传。
  - **MCP 服务集成**：支持 Stdio (JSON-RPC over stdin/stdout) 协议的 MCP 服务器注册。大模型在对话中可直接调用 MCP 工具（如 filesystem, git, web-search 等）。
  - **可视化终端日志 (Terminal Visual Logs)**：内置 Chat 页面会以极客风格的 Terminal 终端小部件动态渲染智能体工具调用的入参、执行状态与输出。

- 🔄 **五大灾备与运行优化建议落地**
  - **Disaster Recovery (Failover 故障自愈)**：当当前模型请求失败 (429/5xx) 时，系统会自动依序在备用 Failover 供应商节点中尝试相同或对等模型，确保开发流不中断。
  - **Disk Logging (本地请求审计日志)**：所有的 API 交互日志将持久化存储在本地 `data/logs/orca.log` 中。可以通过 `/api/logs` 进行按关键词与日志级别的实时筛选查询。
  - **Persistent Cache (重复请求拦截缓存)**：使用 SHA-256 对 prompt 进行哈希缓存，相同的请求可立即秒回。针对流式响应，支持完整的 SSE 数据流延迟模拟回放。
  - **Token Cost Tracking (Token 费率估算)**：支持在设置里为不同的模型配置每百万 Tokens 的输入/输出价格 (USD)，并在仪表盘中实时显示当日估算总费用。
  - **Roo Code & Cline 深度整合**：应用管理面板支持一键检测和接管 VS Code 的热门自主编程插件 **Cline** 和 **Roo Code**，自动注入 API 地址并快捷启动 VS Code。

- 🔄 **多 API 协议转发与转译**：
  - **Codex CLI** 适配：自动将 OpenAI Responses API 转换为 Chat Completions API。
  - **Claude 桌面端** 适配：自动将 Anthropic Messages API 转换为 Chat Completions API，并支持流式（SSE）与非流式响应转换。
  - **去除了默认最大 Token 限制**：当默认 `max_tokens` 设置为 `0` 时，系统在转发请求时会自动剥离 `max_tokens` 参数，消除模型的最大生成长度硬限制。

- 📦 **全能的模型提供商集成**：
  - 原生集成 **DeepSeek**（官方 API）、**小米 MiMo / TokenPlan**、**硅基流动 (SiliconFlow)**、**通义千问**、**智谱 AI**、**月之暗面 (Kimi)**、**百川智能**、**零一万物**、**豆包**、**OpenAI**、**Anthropic**。
  - 支持**自定义 OpenAI 兼容供应商**的添加、编辑与删除。

- 🔍 **模型自动发现（Discover）**：
  - 支持一键同步指定 API 密钥下的所有可用模型列表，并快捷同步至聊天选择框。

- 💬 **内置高级 Chat 客户端**：
  - 支持多会话历史记录、模型切换、温度与 Tokens 限制微调、聊天内容回滚（Rollback）。

- 🌍 **双语界面 (i18n)**：
  - 支持中文/英文界面语言切换，提升跨国工作流下的使用体验。

---

## 🚀 快速开始

### 1. 本地安装与开发

```bash
# 克隆仓库并安装依赖
npm install

# 启动开发服务器（后端服务 + 前端打包）
npm run dev
```

### 2. 编译并打包应用

若要以桌面客户端形式运行（利用内置的轻量化 Electron 窗口）：

```bash
# 编译前端及后端代码
npm run build

# 启动 Electron 主程序
npm start

# 打包成免安装的绿色版客户端 (release/ 目录下)
npm run package
```

编译完成后，Electron 界面会自动拉起并为您配置独立的安全性本地 Token。

---

## 🔌 客户端配置指南

### 1. Codex CLI 接入

您可以在系统环境变量中，将 OpenAI 基础 URL 映射为 Orca 代理地址：

```powershell
# PowerShell 环境
$env:OPENAI_BASE_URL = "http://127.0.0.1:18080/v1"
$env:OPENAI_API_KEY = "sk-dummy" # 代理内部会自动路由至您激活的提供商 API 密钥
codex "你好，请写一段快速排序"
```

### 2. Claude 桌面端接入

打开 Claude Desktop 的配置文件：
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

在配置中加入 `proxy` 选项：

```json
{
  "proxy": {
    "url": "http://127.0.0.1:18080"
  }
}
```

重新启动 Claude 桌面端，所有的对话请求将被 Orca 拦截并转译为您设置的默认国产大模型或自定义模型。

---

## 🛠️ 项目结构

```
orca/
├── main.js             - Electron 主进程（窗口生命周期、自适应浅色/深色标题栏）
├── package.json        - 依赖及构建脚本
├── tsconfig.json       - TypeScript 编译配置
├── dist/               - 编译后的后端主 bundle (`bundle.js`)
├── src/                - 后端服务源码
│   ├── index.ts        - Express 路由、流处理转发及 API 安全管理
│   ├── providers.ts    - 模型供应商管理、参数配置
│   ├── transform.ts    - Responses API 相互转译器
│   ├── anthropic.ts    - Anthropic Messages <-> OpenAI 转译逻辑
│   ├── cache.ts        - 磁盘级 SHA-256 拦截缓存与流回放模拟
│   └── mcp.ts          - Stdio MCP 客户端（Handshake, tool lists / calls）
├── frontend/           - 前端源码 (React + Vite + Vanilla CSS)
│   ├── src/
│   │   ├── pages/      - Chat、Settings、Apps (应用集成)、Dashboard、Logs
│   │   ├── api.ts      - 前端 SSE 及 axios 请求库封装
│   │   └── i18n.ts     - 国际化本地化映射表
│   └── index.html      - 单页面 Web 入口
└── data/
    ├── config.json     - 本地持久化配置文件（自动生成）
    ├── cache.json      - 拦截缓存持久化文件（自动生成）
    └── logs/
        └── orca.log    - 磁盘审计日志文件
```

---

## 📝 贡献与许可

本项目基于 MIT 协议开源。欢迎提交 Issue 或 Pull Request 来增加对更多供应商和实用小工具的支持！
