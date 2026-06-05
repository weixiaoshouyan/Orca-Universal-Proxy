@echo off
echo AI漫剧工坊启动脚本
echo ==================

echo 1. 检查Node.js环境...
node --version
if errorlevel 1 (
    echo 错误: 未安装Node.js，请先安装Node.js
    pause
    exit /b 1
)

echo 2. 检查npm环境...
npm --version
if errorlevel 1 (
    echo 错误: 未安装npm，请先安装npm
    pause
    exit /b 1
)

echo 3. 安装项目依赖...
echo 正在安装根目录依赖...
npm install --legacy-peer-deps
if errorlevel 1 (
    echo 警告: 根目录依赖安装失败，继续...
)

echo 正在安装前端依赖...
cd frontend
npm install --legacy-peer-deps
if errorlevel 1 (
    echo 警告: 前端依赖安装失败，继续...
)
cd ..

echo 4. 创建必要目录...
if not exist "output" mkdir output
if not exist "temp" mkdir temp
if not exist "logs" mkdir logs
if not exist "projects" mkdir projects

echo 5. 检查环境变量文件...
if not exist ".env" (
    echo 警告: 未找到.env文件，请手动创建或复制.env.example
    echo 正在创建默认.env文件...
    copy .env.example .env
)

echo 6. 启动开发服务器...
echo 正在启动AI漫剧工坊...
echo 请稍候...
npm run dev

pause