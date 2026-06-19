@echo off
chcp 65001 >nul
title UK Driving Trainer - Dev Server

echo.
echo  ============================================
echo   UK Driving Trainer - Development Server
echo  ============================================
echo.

cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules" (
    echo  [INFO] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo  [ERROR] npm install failed. Please check your Node.js installation.
        pause
        exit /b 1
    )
    echo.
)

echo  [INFO] Starting Vite dev server...
echo  [INFO] Browser will open automatically in a few seconds...
echo.

:: Wait briefly then open browser
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

:: Run the dev server (this blocks until Ctrl+C)
call npm run dev

echo.
echo  [INFO] Server stopped.
pause
