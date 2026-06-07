@echo off
echo Starting HR Leave System...
pm2 start ecosystem.config.js
pm2 save
echo.
echo ✅ HR Leave System is running!
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:4000
echo.
pause
