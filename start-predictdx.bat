@echo off
REM Double-click to start PredictDx: database, API (:3000), website (:5173) and mobile app (:5174).
cd /d "%~dp0"
if not exist node_modules (
  echo First run - installing and creating the demo database...
  call npm run setup || goto :error
)
start "" http://localhost:5173
call npm run dev
goto :eof
:error
echo Setup failed. See the messages above.
pause
