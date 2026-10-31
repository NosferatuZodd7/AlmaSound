@echo off
rem AlmaSound diagnostics: run this when AlmaSound misbehaves or does not open.
rem It writes diagnostics.txt next to itself (or in %TEMP%) - send that one file.
rem   diagnostics.bat /nogui   skips opening the app window (used by CI).
setlocal
set "HERE=%~dp0"
set "EXE=%HERE%AlmaSound.exe"
set "OUT=%HERE%diagnostics.txt"
(type nul > "%OUT%") 2>nul || set "OUT=%TEMP%\AlmaSound-diagnostics.txt"

echo Collecting AlmaSound diagnostics into "%OUT%" ...
> "%OUT%" echo AlmaSound diagnostics script
>> "%OUT%" echo Date: %DATE% %TIME%
ver >> "%OUT%"

>> "%OUT%" echo.
>> "%OUT%" echo == Files ==
if exist "%EXE%" (>> "%OUT%" echo AlmaSound.exe: present in %HERE%) else (>> "%OUT%" echo AlmaSound.exe: MISSING in %HERE%)

>> "%OUT%" echo.
>> "%OUT%" echo == The app's own report (software rendering) ==
"%EXE%" --software --print-diagnostics="%OUT%"
>> "%OUT%" echo Exit code: %ERRORLEVEL%

if /i "%~1"=="/nogui" goto logs
>> "%OUT%" echo.
>> "%OUT%" echo == The app window in compatibility mode (until it is closed) ==
echo AlmaSound opens in compatibility mode. Reproduce the problem if you can, then close it.
"%EXE%" --software >> "%OUT%" 2>&1
>> "%OUT%" echo Exit code: %ERRORLEVEL%

:logs
>> "%OUT%" echo.
>> "%OUT%" echo == Log file (last 400 lines) ==
set "LOG="
for %%F in ("%APPDATA%\AlmaSound\logs\almasound.log" "%HERE%almasound.log" "%TEMP%\almasound.log") do if not defined LOG if exist "%%~F" set "LOG=%%~F"
if defined LOG (
  >> "%OUT%" echo %LOG%
  powershell -NoProfile -Command "Get-Content -LiteralPath $env:LOG -Tail 400" >> "%OUT%" 2>&1
) else (
  >> "%OUT%" echo No log file found: the app never even started.
)

>> "%OUT%" echo.
>> "%OUT%" echo == Windows Application log: recent application crashes ==
wevtutil qe Application /c:10 /rd:true /f:text /q:"*[System[Provider[@Name='Application Error']]]" >> "%OUT%" 2>&1

echo Done. Send this file: "%OUT%"
endlocal
