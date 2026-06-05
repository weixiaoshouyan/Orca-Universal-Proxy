# AI漫剧工坊

AI漫剧工坊是一个利用AI技术自动生成玄幻修仙题材漫画视频的桌面应用程序。

## 功能特性

- **故事剧本AI生成**：根据主题自动生成结构化剧本
- **漫画分镜生成**：将剧本分解为具体画面分镜
- **角色图像生成**：生成漫画风格角色形象
- **配音音效生成**：生成角色配音和背景音效
- **动态效果添加**：添加镜头移动、缩放等动画效果
- **视频合成导出**：合成最终视频并导出

## 快速开始

### 1. 环境准备

确保已安装以下软件：
- Node.js (版本16或更高)
- npm (通常随Node.js一起安装)

### 2. 配置API密钥

1. 复制环境变量模板：
   ```bash
   copy .env.example .env
   ```

2. 编辑 `.env` 文件，填入您的API密钥：
   ```
   OPENAI_API_KEY=your_openai_api_key
   ELEVENLABS_API_KEY=your_elevenlabs_api_key
   STABILITY_API_KEY=your_stability_api_key
   ```

### 3. 安装依赖

运行启动脚本（Windows）：
```bash
start.bat
```

或手动安装：
```bash
# 安装根目录依赖
npm install --legacy-peer-deps

# 安装前端依赖
cd frontend
npm install --legacy-peer-deps
cd ..
```

### 4. 运行应用

```bash
npm run dev
```

这将同时启动前端开发服务器和Electron应用。

## 项目结构

```
ai-comic-drama-studio/
├── frontend/                 # 前端React应用
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── components/      # 通用组件
│   │   ├── App.tsx          # 主应用
│   │   └── index.tsx        # 入口文件
├── src/                     # 后端服务
│   ├── services/            # 核心服务模块
│   └── types/               # 类型定义
├── tests/                   # 测试文件
├── .env                     # 环境变量配置
├── package.json             # 项目配置
└── README.md                # 项目说明
```

## 使用说明

1. **创建项目**：在项目管理页面创建新项目
2. **输入主题**：在故事编辑器输入故事主题
3. **AI生成**：点击"AI生成故事"按钮
4. **一键生成**：使用AI工具面板的"一键生成漫剧"功能
5. **预览导出**：预览效果并导出视频

## API密钥获取

### OpenAI API
1. 访问 https://platform.openai.com/
2. 注册账号并创建API密钥
3. 将密钥填入 `.env` 文件的 `OPENAI_API_KEY`

### ElevenLabs API
1. 访问 https://elevenlabs.io/
2. 注册账号并获取API密钥
3. 将密钥填入 `.env` 文件的 `ELEVENLABS_API_KEY`

### Stability AI API
1. 访问 https://stability.ai/
2. 注册账号并获取API密钥
3. 将密钥填入 `.env` 文件的 `STABILITY_API_KEY`

## 开发说明

### 运行测试
```bash
npm test
```

### 构建应用
```bash
npm run build
```

### 打包桌面应用
```bash
npm run package
```

## 注意事项

1. **API费用**：使用AI API会产生费用，请注意使用量
2. **网络要求**：需要稳定的网络连接访问AI服务
3. **存储空间**：生成的视频文件可能较大，确保有足够存储空间
4. **生成时间**：完整视频生成可能需要几分钟时间

## 故障排除

### 依赖安装失败
- 尝试使用 `npm install --legacy-peer-deps`
- 检查网络连接
- 清除npm缓存：`npm cache clean --force`

### API调用失败
- 检查API密钥是否正确
- 确认API账户有足够额度
- 检查网络连接

### 应用启动失败
- 确保Node.js版本正确
- 检查端口是否被占用
- 查看日志文件排查问题

## 许可证

MIT License