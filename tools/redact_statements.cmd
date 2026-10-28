@echo off
rem Drag one or more statement files (.csv or .pdf) onto this file, or run:  redact_statements.cmd file1.csv file2.pdf
rem Results are saved next to each original as <name>_redacted.csv. Nothing is uploaded.
setlocal
where py >nul 2>nul && (set PY=py) || (set PY=python)
if "%~1"=="" (
  echo Drag your statement files onto this file, or run:  redact_statements.cmd file1.csv file2.pdf
  pause
  exit /b 1
)
%PY% "%~dp0redact_statements.py" %*
echo.
pause
