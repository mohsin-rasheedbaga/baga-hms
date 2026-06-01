@echo off
title BAGA Hospital Management System
echo.
echo  ============================================
echo   BAGA Hospital Management System v3.0
echo  ============================================
echo.

echo  Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is not installed!
    echo  Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  Node.js found.
echo  Installing dependencies if needed...
call npm install --production 2>nul
echo.
echo  Starting BAGA HMS...
echo.

REM Load GitHub token from .env.local if exists for auto-update
if exist .env.local (
    for /f "tokens=1,2 delims==" %%a in (.env.local) do (
        if "%%a"=="GH_TOKEN" set GH_TOKEN=%%b
    )
)

npx electron .
