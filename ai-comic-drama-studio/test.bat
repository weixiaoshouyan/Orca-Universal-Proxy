@echo off
echo 运行AI漫剧工坊测试套件...
echo.

echo 1. 检查jest是否安装...
where jest
if errorlevel 1 (
    echo jest未安装，正在安装...
    npm install jest ts-jest @types/jest --save-dev
    if errorlevel 1 (
        echo 错误: jest安装失败
        pause
        exit /b 1
    )
)

echo 2. 运行测试...
npm test

pause