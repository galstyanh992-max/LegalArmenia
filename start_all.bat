@echo off
chcp 65001 >nul
echo =======================================================
echo   AI LEGAL ARMENIA - ЗАПУСК ВСЕХ СЕРВИСОВ
echo =======================================================
echo.

echo [1/3] Запуск сервера эмбеддингов (Порт 8088)...
cd scripts
start "Embedding Server (Port 8088)" cmd /k "title Embedding Server && py -m uvicorn embedding_server:app --host 127.0.0.1 --port 8088"
cd ..
:: Ждем 5 секунд, чтобы сервер успел запуститься
timeout /t 5 /nobreak >nul

echo [2/3] Запуск Cloudflare Tunnel для сервера эмбеддингов...
start "Cloudflare Tunnel" cmd /k "title Cloudflare Tunnel && cloudflared tunnel --url http://localhost:8088"
:: Ждем 5 секунд
timeout /t 5 /nobreak >nul

echo [3/3] Запуск сервера проекта (Frontend)...
start "Vite Frontend Server" cmd /k "title Frontend Server && npm run dev"

echo.
echo =======================================================
echo ГОТОВО! Все 3 процесса запущены в отдельных окнах.
echo =======================================================
echo ВНИМАНИЕ: 
echo 1. Откройте окно "Cloudflare Tunnel" и скопируйте ссылку (https://...trycloudflare.com)
echo 2. Зайдите в дашборд Supabase -^> Edge Functions -^> Secrets
echo 3. Обновите секрет EMBEDDING_ENDPOINT на новую ссылку
echo 4. Фронтенд проекта доступен по адресу http://localhost:8080
echo =======================================================
echo.
pause
