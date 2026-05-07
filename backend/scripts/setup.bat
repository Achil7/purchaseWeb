@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

cd /d %~dp0\..

echo.
echo ================================================================
echo   올리브영 랭킹 수집기 - 최초 셋업
echo ================================================================
echo.
echo 이 작업은 처음 한 번만 실행하면 됩니다. (시간 약 5~15분)
echo.
pause

echo.
echo [1/5] Node.js 설치 확인 중...
where node > nul 2>&1
if errorlevel 1 (
  echo.
  echo ❌ Node.js가 설치되지 않았습니다!
  echo.
  echo    1. 인터넷 브라우저로 https://nodejs.org/ko 접속
  echo    2. 큰 초록색 LTS 버튼 클릭하여 다운로드
  echo    3. 설치 파일 실행 - 모두 "Next/다음" 클릭
  echo    4. 설치 완료 후 이 창을 닫고 setup.bat 다시 실행
  echo.
  pause
  exit /b 1
)
node -v
echo ✅ Node.js 확인 완료
echo.

echo [2/5] SSH 키 파일 확인 중...
if not exist "%USERPROFILE%\.ssh\server_rsa_key.pem" (
  echo.
  echo ❌ SSH 키 파일이 없습니다!
  echo.
  echo    개발자에게 받은 'server_rsa_key.pem' 파일을 아래 위치에 두세요:
  echo    %USERPROFILE%\.ssh\
  echo.
  echo    폴더가 없으면 자동으로 만들겠습니다...
  mkdir "%USERPROFILE%\.ssh" 2>nul
  echo    폴더 만들었습니다: %USERPROFILE%\.ssh\
  echo.
  echo    이 폴더에 .pem 파일 두고 setup.bat 다시 실행해주세요.
  echo.
  pause
  exit /b 1
)
echo ✅ SSH 키 파일 확인 완료

echo [3/5] SSH 키 권한 설정 중...
icacls "%USERPROFILE%\.ssh\server_rsa_key.pem" /inheritance:r > nul
icacls "%USERPROFILE%\.ssh\server_rsa_key.pem" /grant:r "%USERNAME%:R" > nul
echo ✅ SSH 키 권한 설정 완료
echo.

echo [4/5] .env 파일 확인 중...
if not exist ".env" (
  echo.
  echo ❌ .env 파일이 없습니다!
  echo.
  echo    개발자에게 받은 .env 파일을 아래 위치에 두세요:
  echo    %CD%\.env
  echo.
  echo    그 후 setup.bat 다시 실행해주세요.
  echo.
  pause
  exit /b 1
)
echo ✅ .env 파일 확인 완료
echo.

echo [5/5] 프로그램 의존성 설치 중... (시간 5~15분 걸려요. 인터넷 끊지 마세요)
echo.
call npm install
if errorlevel 1 (
  echo.
  echo ❌ npm install 실패. 인터넷 연결 확인 후 다시 시도해주세요.
  pause
  exit /b 1
)
echo.
echo Chromium 브라우저 다운로드 중... (200MB, 시간 더 걸림)
call npx playwright install chromium
if errorlevel 1 (
  echo.
  echo ❌ Chromium 설치 실패. 인터넷 연결 확인 후 다시 시도해주세요.
  pause
  exit /b 1
)

echo.
echo ================================================================
echo ✅ 셋업 완료!
echo ================================================================
echo.
echo 이제 scripts\runRankingWorker.bat 을 더블클릭하면 수집이 시작됩니다.
echo.
echo 마지막 권장 사항:
echo   윈도우 설정 ^> 시스템 ^> 전원 ^> "절전 모드로 전환" : 안 함
echo   (수집 중 컴퓨터가 잠들면 안 됩니다)
echo.
pause
endlocal
