# Orca Universal Proxy

Orca Universal Proxy 是一款专为 AI 开发工具与桌面客户端打造的本地多模型智能代理服务器。支持 **Codex CLI**、**Claude 桌面端**、**Cursor/VSCode** 等外部工具，能够一键适配所有主流国产大模型 API 及国际一流服务。

项目集成了轻量级 Electron 可视化界面，提供直观的监控、丰富的配置以及便捷的外部应用快捷启动。

---

## 🌟 主要功能

- 🔄 **多 API 协议转发与翻译**：
  - **Codex CLI** 适配：自动将 OpenAI Responses API 转换为 Chat Completions API。
  - **Claude 桌面端** 适配：自动将 Anthropic Messages API 转换为 Chat Completions API，并支持流式（SSE）与非流式响应转换。
- 📦 **全能的模型提供商集成**：
  - 原生集成 **DeepSeek**（官方 API）、**小米 MiMo / TokenPlan**、**硅基流动 (SiliconFlow)**、**通义千问**、**智谱 AI**、**月之暗面 (Kimi)**、**百川智能**、**零一万物**、**豆包**、**OpenAI**、**Anthropic**。
  - 支持**自定义 OpenAI 兼容供应商**的添加、编辑与删除。
- 🔍 **模型自动发现（Discover）**：
  - 支持一键同步指定 API 密钥下的所有可用模型列表，并快捷同步至聊天选择框。
- 🖥️ **一键启动应用集成**：
  - 内置应用路径扫描与快捷启动（支持 **Codex CLI**、**Claude Desktop**、**Antigravity** 等），一键配置代理环境变量并打开终端或应用。
- 💬 **内置高级 Chat 客户端**：
  - 支持多会话历史记录、模型切换、温度与 Tokens 限制微调、聊天内容回滚（Rollback）。
- 🌍 **双语界面 (i18n)**：
  - 支持中文/英文界面语言切换，提升跨国工作流下的使用体验。
- ⚙️ **高级全局参数配置**：
  - 可定制服务器端口（默认 `18080`）、日志级别、默认生成温度、最大回复 Tokens、模型自动发现同步周期及缓存控制。
- 🔒 **安全性保障**：
  - 管理 API (`/api/*`) 受本地自动生成的会话密钥 `x-local-token` 保护，防止本地跨站请求攻击；同时代理接口 (`/v1/*`) 完全免签，确保第三方开发工具流畅接入。

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

### 3. Cursor / VSCode 等其它工具

在第三方工具的 OpenAI 兼容配置（OpenAI Compatible）中填入：
- **Base URL / API 基础 URL**: `http://127.0.0.1:18080/v1`
- **API Key**: `sk-dummy`

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
│   ├── providers.ts    - 模型供应商管理、映射及 runtime 配置保存
│   ├── transform.ts    - Responses API 相互转译器
│   └── anthropic.ts    - Anthropic Messages <-> OpenAI 转译逻辑
├── frontend/           - 前端源码 (React + Vite + Vanilla CSS)
│   ├── src/
│   │   ├── pages/      - Chat、Settings、Apps (应用集成)、Dashboard
│   │   ├── api.ts      - 前端 SSE 及 axios 请求库封装
│   │   └── i18n.ts     - 国际化本地化映射表
│   └── index.html      - 单页面 Web 入口
└── data/
    └── config.json     - 本地持久化配置文件（自动生成）
```

---

## 📝 贡献与许可

本项目基于 MIT 协议开源。欢迎提交 Issue 或 Pull Request 来增加对更多供应商和实用小工具的支持！
