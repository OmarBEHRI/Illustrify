@echo off
echo Starting Illustrify Application Setup...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Start Kokoro TTS Docker container
echo Starting Kokoro TTS Docker container...
start "Kokoro TTS" cmd /k "docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest"

REM Wait a moment for Docker to start
timeout /t 3 /nobreak >nul

REM Start PocketBase server
echo Starting PocketBase server...
start "PocketBase" cmd /k "pocketbase.exe serve"

REM Start Image Generation Server
echo Starting Image Generation Server...
start "Image Gen Server" cmd /k "cd Image-Gen-Server && python app.py"

REM Start Next.js development server
echo Starting Next.js development server...
start "Next.js Dev" cmd /k "npm run dev"

REM Wait for services to start up
echo Waiting for services to start up...
timeout /t 10 /nobreak >nul

REM Open the application in default browser
echo Opening Illustrify in your default browser...
start http://localhost:3000

echo.
echo All services started successfully!
echo - Next.js App: http://localhost:3000
echo - PocketBase Admin: http://localhost:8090/_/
echo - Kokoro TTS: http://localhost:8880
echo - Image Gen Server: Check the Image Gen Server terminal window
echo.
echo Press any key to exit this setup window...
pause >nul