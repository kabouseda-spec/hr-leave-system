@echo off
echo Stopping HR Leave System...
pm2 stop hr-backend hr-frontend
echo ✅ Stopped.
pause
