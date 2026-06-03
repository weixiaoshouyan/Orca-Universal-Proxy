@echo off
chcp 65001 >nul 2>&1
title Orca Universal Proxy v2.1.0
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     Orca Universal Proxy v2.1.0         ║
echo  ║     AI API 通用代理服务器                ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  启动桌面应用中...
echo.

npx electron .

echo.
echo  应用已退出。按任意键关闭...
pause >nul
