@echo off
title MediaSnap Launcher
cd /d "%~dp0"

echo.
echo  Unblocking all files...
powershell -Command "Get-ChildItem -Recurse | Unblock-File" >nul 2>&1
echo  Done.
echo.

echo  Setting PowerShell execution policy...
powershell -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" >nul 2>&1
echo  Done.
echo.

echo  Launching MediaSnap...
powershell -ExecutionPolicy Bypass -File "%~dp0Run-MediaSnap.ps1"
