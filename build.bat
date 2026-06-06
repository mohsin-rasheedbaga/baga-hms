@echo off
title BAGA HMS - Build Windows App
echo.
echo  ============================================
echo   BAGA HMS - Building Windows Application
echo  ============================================
echo.

echo  Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is not installed!
    echo  Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Load GitHub token from .env.local if exists for auto-update
if exist .env.local (
    for /f "tokens=1,2 delims==" %%a in (.env.local) do (
        if "%%a"=="GH_TOKEN" set GH_TOKEN=%%b
    )
)

echo  Step 1: Installing all dependencies...
call npm install
if %errorlevel% neq 0 (
    echo  ERROR: npm install failed!
    pause
    exit /b 1
)

echo.
echo  Step 2: Building Next.js frontend...
call npx next build
if %errorlevel% neq 0 (
    echo  ERROR: Next.js build failed!
    pause
    exit /b 1
)

echo.
echo  Step 3: Building Electron portable app...
call npx electron-builder --win portable
if %errorlevel% neq 0 (
    echo  ERROR: Electron build failed!
    pause
    exit /b 1
)

echo.
echo  ============================================
echo   BUILD SUCCESSFUL!
echo  ============================================
echo.
echo  Your portable app is in the dist-electron folder.
echo  Look for: BAGA-HMS-Portable-3.0.0.exe
echo.
pause
