@echo off
setlocal
title Xiyue Frontend

cd /d "%~dp0frontend"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm was not found. Install Node.js LTS and run this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing frontend dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed. Check the network and try again.
    pause
    exit /b 1
  )
)

echo Starting Xiyue...
call npm run dev -- --host 127.0.0.1 --open
