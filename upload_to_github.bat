@echo off
title Upload Flutter App to GitHub
echo ==========================================
echo   Flutter GitHub Auto Uploader by Andrejs
echo ==========================================

:: Kontrola, jestli je nainstalovaný git
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git neni nainstalovany nebo neni v PATH.
    pause
    exit /b
)

:: Zobraz aktuální složku
echo.
echo Aktualni slozka: %cd%
echo.

:: Přidání všech změn
echo [1/3] Pridavam vsechny zmeny...
git add -A

:: Commit se zprávou s datem a časem
set DATETIME=%date% %time%
echo [2/3] Commituji zmeny s popisem: %DATETIME%
git commit -m "Auto update - %DATETIME%"

:: Push na GitHub (do main větve)
echo [3/3] Odesilam na GitHub...
git push origin main

if errorlevel 1 (
    echo.
    echo [ERROR] Nepodarilo se pushnout na GitHub.
    echo Zkontroluj pripojeni k internetu nebo Git prihlaseni.
    pause
    exit /b
)

echo.
echo ✅ Hotovo! Zmeny byly odeslany na GitHub.
pause
