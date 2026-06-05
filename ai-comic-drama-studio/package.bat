@echo off
echo 打包AI漫剧工坊桌面应用...
echo.

echo 1. 检查electron-builder是否安装...
where electron-builder
if errorlevel 1 (
    echo electron-builder未安装，正在安装...
    npm install electron-builder --save-dev
    if errorlevel 1 (
        echo 错误: electron-builder安装失败
        pause
        exit /b 1
    )
)

echo 2. 构建前端应用...
cd frontend
call npm run build
if errorlevel 1 (
    echo 错误: 前端构建失败
    cd ..
    pause
    exit /b 1
)
cd ..

echo 3. 编译TypeScript...
call tsc
if errorlevel 1 (
    echo 错误: TypeScript编译失败
    pause
    exit /b 1
)

echo 4. 打包Electron应用...
call electron-builder --win
if errorlevel 1 (
    echo 错误: 打包失败
    pause
    exit /b 1
)

echo 5. 打包完成！
echo 应用已打包到release目录
echo.

pause