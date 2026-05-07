@echo off
chcp 65001 > nul
setlocal
set NODE_ENV=production
cd /d %~dp0\..

echo.
echo ================================================================
echo   올리브영 랭킹 자동 수집기
echo ================================================================
echo.
echo 어느 환경에 데이터를 저장할까요?
echo.
echo   [1] test  (DB: serverdb_test)
echo   [2] main  (DB: serverdb)        ※ 운영 데이터에 들어갑니다
echo.

:CHOOSE_ENV
set ENV_CHOICE=
set /p ENV_CHOICE="번호 입력 (1 또는 2): "

if "%ENV_CHOICE%"=="1" (
  set DB_NAME=serverdb_test
  set ENV_LABEL=TEST
  goto ENV_SELECTED
)
if "%ENV_CHOICE%"=="2" (
  set DB_NAME=serverdb
  set ENV_LABEL=MAIN ^(운영^)
  goto ENV_SELECTED
)
echo   잘못된 입력입니다. 1 또는 2를 입력해주세요.
goto CHOOSE_ENV

:ENV_SELECTED
echo.
echo ================================================================
echo  선택된 환경: %ENV_LABEL%  /  DB: %DB_NAME%
echo ================================================================
echo.

if "%ENV_CHOICE%"=="2" (
  echo  ⚠️  운영 데이터베이스에 저장됩니다. 계속 진행할까요?
  set CONFIRM=
  set /p CONFIRM="진행하려면 'y' 입력: "
  if /I not "%CONFIRM%"=="y" (
    echo  취소되었습니다.
    pause
    exit /b 0
  )
)

echo.
echo [SSH 터널 시작] PC localhost:5432 -^> EC2 -^> RDS
echo.

rem 기존 SSH 터널 종료 (포트 충돌 방지)
taskkill /FI "WINDOWTITLE eq ranking-ssh-tunnel*" /F > nul 2>&1

rem SSH 터널 백그라운드 실행 (별도 창)
start "ranking-ssh-tunnel" /MIN ssh -i "C:\Users\achil\.ssh\server_rsa_key.pem" -o StrictHostKeyChecking=accept-new -o ExitOnForwardFailure=yes -N -L 5432:serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com:5432 ubuntu@3.38.234.204

echo SSH 터널 연결 중... (5초 대기)
timeout /t 5 /nobreak > nul

echo.
echo ================================================================
echo  랭킹 워커 시작 (환경: %ENV_LABEL%)
echo ================================================================
node scripts/runRankingWorker.js

echo.
echo SSH 터널 종료 중...
taskkill /FI "WINDOWTITLE eq ranking-ssh-tunnel*" /F > nul 2>&1

echo.
echo 아무 키나 누르면 창이 닫힙니다...
pause > nul
endlocal
