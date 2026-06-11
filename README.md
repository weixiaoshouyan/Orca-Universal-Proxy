# Orca Agentic Universal Proxy

Orca 是一款专为 AI 开发工具打造的本地多模型智能代理服务器。

---

## 主要功能

### 智能体模式

- **Build 模式**：完全权限，可读写文件、执行命令
- **Plan 模式**：只读权限，专注调研与任务规划
- **任务进度面板**：实时显示任务执行进度
- **智能滚动**：执行任务时可自由查看历史消息

### 工具集成

- 53 个内置自动化技能
- PowerShell 命令行沙箱
- Office 文档操作 (Word/Excel/PPT)
- MCP 服务集成

### 模型供应商

DeepSeek / 通义千问 / 智谱AI / 小米MiMo / OpenAI / Anthropic

### 协议转译

- Codex CLI 适配 (OpenAI API)
- Claude Desktop 适配 (Anthropic API)

---

## 快速开始

### 方式一：直接运行（推荐）

`
release/win-unpacked/electron.exe
`

### 方式二：源码运行

`ash
npm install
npm start
`

### 方式三：开发模式

`ash
npm install
npm run dev
`

---

## 使用说明

### 1. 配置 API 密钥

启动应用后，进入「供应商」页面，选择模型供应商并输入 API 密钥。

### 2. 选择工作区

在聊天页面左侧点击「+」按钮，选择你的项目目录。

### 3. 开始对话

- 选择 **Build** 或 **Plan** 模式
- 输入任务描述
- 智能体会自动执行并显示进度

### 4. Codex CLI 接入

`powershell
$env:OPENAI_BASE_URL = "http://127.0.0.1:18080/v1"
$env:OPENAI_API_KEY = "sk-dummy"
codex "你好"
`

### 5. Claude Desktop 接入

编辑配置文件 %APPDATA%\Claude\claude_desktop_config.json：

`json
{
  "proxy": {
    "url": "http://127.0.0.1:18080"
  }
}
`

---

## 项目结构

`
orca/
├── main.js           # Electron 主进程
├── src/              # 后端源码
│   ├── index.ts      # 服务端路由
│   ├── providers.ts  # 模型供应商
│   └── ...
├── frontend/         # 前端源码 (React)
├── skills/           # 内置技能库
└── release/          # 打包输出
`

---

## 常见问题

**Q: 出现 "unexpected end of data" 错误**

A: 工具输出过大导致，应用已自动限制输出大小。

**Q: 智能体执行任务时卡住**

A: 检查网络连接和 API 密钥是否正确。

**Q: 如何切换模型？**

A: 点击聊天窗口底部的模型名称即可切换。

---

## 许可证

MIT License