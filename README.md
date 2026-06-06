# Orca Agentic Universal Proxy (Orca 智能代理网关)

Orca Agentic Universal Proxy 是一款专为 AI 开发工具与桌面客户端打造的本地多模型智能代理服务器。除原生的 **Codex CLI**、**Claude 桌面端**、**Cursor/VSCode** 等工具适配外，全新升级为**智能体代理网关 (Agent Mode)**，支持外部 **Skills (本地脚本技能)** 与 **Model Context Protocol (MCP) 服务** 的深度接入。

项目集成了轻量级 Electron 可视化界面，提供直观的监控、丰富的配置以及便捷的外部应用快捷启动。

---

## 🌟 主要功能

- 🤖 **智能体模式与工具调用 (Agent Mode & Tool Execution Loop)**
  - **Plan vs Build 双轨代理模式 (仿 OpenCode)**：聊天面板底部配有直观的下拉菜单选择器，支持在 **Plan 规划模式** 与 **Build 执行模式** 之间任意切换。
    - **Plan 规划模式**：智能体只读权限，仅获得读取、搜索、列表文件及技能详情等只读工具（如 `list_workspace_files`, `read_workspace_file`, `search_grep` 等），防止智能体擅自修改代码或运行有害脚本，专注于调查研究与任务规划。
    - **Build 执行模式**：智能体完全权限，在拥有只读工具的基础上，额外注册写入文件、修补代码、终端指令执行、技能脚本执行及 MCP 服务等全部修改与执行工具，直接落地方案。
  - **本地 Skills 技能库与一键导入**：项目内置了 53 个默认自动化技能，在客户端首次启动时自动分发至用户数据目录 `data/skills` 下。彻底废除了繁琐的表单输入，全新支持**一键导入外部技能**功能——只需点击添加技能并选择其 `README.md` 或 `SKILL.md` 文件，系统即可自动锁定父目录并完整复制技能包（自动过滤无用系统及缓存文件），对缺失 `SKILL.md` 的普通 README 提供智能兼容与重构。
  - **本地 PowerShell 命令行沙箱 (`run_terminal_command`)**：允许大模型根据需要自主运行本地的 shell/PowerShell 命令行，完成各种复杂自动化任务。系统在调用 PowerShell 时默认启用 `-ExecutionPolicy Bypass` 参数，彻底绕过 Windows系统对自定义脚本的安全执行策略限制。
  - **支持大文件读取**：移除了 2MB 的文件大小读取限制，智能体可直接阅读与分析大型工作区文件和超长日志。
  - **Office 文档与表格操纵**：系统后台集成并预置了 `python-docx`、`openpyxl`、`python-pptx` 与 `pandas` 等专业 Office 处理库。智能体可通过自写 Python 脚本并在后台执行的形式，自主完成 Word、Excel 和 PPT 的读写与编辑工作。
  - **可收缩折叠的极客终端 (Collapsible Console Logs)**：工具执行过程日志采用高级深色控制台重置设计。为了防止日志刷屏，工具执行状态默认折叠，用户可点击标题行展开以查看实时终端输出。
  - **任务清单与进度跟踪 (Task Checklists)**：在智能体执行复杂指令时，模型会在前端生成交互式进度卡片，显示进度条及任务完成百分比，以动画形式呈现正在运行、等待中或已完成的任务。
  - **MCP 服务集成**：支持 Stdio (JSON-RPC over stdin/stdout) 协议 of MCP 服务器注册。大模型在对话中可直接调用 MCP 工具（如 filesystem, git, web-search 等）。

- 📐 **高级 UI/UX 体验布局**
  - **单模型消耗分布 (横状柱状图)**：在仪表盘的**列表/表格视图 (List View)** 顶部，新引入了累积 Token 消耗模型横向柱状图，实时将模型按 Token 总消耗量降序排布，并与各模型专属色彩进行视觉对齐，帮助直观分析多模型的费用及用量。
  - **ECharts 视图防崩溃与鲁棒性优化**：彻底重构了图表与列表视图切换时的 ECharts 实例销毁与重置生命周期，引入 `echarts.getInstanceByDom(dom)` 检测与防御性 `try-catch` 容错，彻底消除了频繁在折线图与列表之间切换时可能导致的 React 界面崩溃 Bug。
  - **可伸缩双栏面板**：聊天历史面板支持水平鼠标拖拽调整大小，方便用户在屏幕上最大化聊天区域，面板大小偏好会自动缓存。
  - **极简折叠主导航栏**：主导航栏支持折叠/展开，在折叠状态下自动切换为 72px 极简图标导航，并带有悬浮气泡提示（i18n 支持），右侧主视图宽度平滑过渡。
  - **系统原生文件/目录选择**：取代原先受沙箱限制的普通网页上传路径方式，使用 Electron 级别的原生系统目录对话框进行工作区的选择和编辑（如修改已有项目路径）。

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

### 1. 一键安装与运行（推荐其他用户使用）
如果您是其他用户，或者想在另外一台电脑上直接运行本软件，**无需安装 Node.js/Electron 等开发依赖**，直接使用打包好的单文件可执行安装包即可：
1. 直接使用 Git 克隆或下载本仓库源码。
2. 双击打开项目目录下的 **`release/Orca Proxy Setup 2.1.0.exe`** 安装包程序。
3. 软件配备了图形化安装向导，用户可以**自主选择自定义的安装路径**。安装完成后软件即可一键启动并自动在后台运行（可选择开机自启并隐藏至系统托盘）。

> [!NOTE]
> 如果您想让智能体执行 Word、Excel、PPT 和 PDF 文件的自动操纵与修改，请确保您的计算机中安装了 **Python 3 环境**。

### 2. 本地源码安装与开发
如果您想调试源码或者自行打包，可使用如下步骤：

```bash
# 安装依赖
npm install

# 启动开发服务器（后端服务运行，前端热更新）
npm run dev
```

### 3. 编译并打包应用
编译项目并打包生成绿色版及安装包客户端：

```bash
# 编译前端及后端代码
npm run build

# 启动 Electron 主程序
npm start

# 打包成 Windows 客户端（包含绿色版 win-unpacked 目录与单文件 Setup 安装包）
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

---

## ⚖️ 致谢与开源借鉴声明

本项目在二次开发与智能体聊天模块的优化中，借鉴了以下开源项目的优秀设计与核心方案：

- **OpenCode** ([anomalyco/opencode](https://github.com/anomalyco/opencode)): 本项目的“Build / Plan 智能体双轨运行模式”、“智能体工具调用循环 (Tool Execution Loop)”以及“聊天中终端工具卡片与进度状态展示”的设计逻辑，合法借鉴并二次开发自 OpenCode 开源软件的优秀实现。在此特别致谢！本项目严格遵守所有相关的开源版权规范与署名声明。
