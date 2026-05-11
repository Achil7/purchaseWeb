# RankingCollector (Electron GUI)

올리브영 카테고리 BEST 100 랭킹 수집기 데스크탑 앱.

## 개발자용

### 의존성 설치
```
cd electron-collector
npm install
npx playwright install chromium
```

### 개발 모드
```
npm run dev
```
- Vite Renderer (port 5174) 와 Electron이 동시에 실행됩니다.
- DevTools가 자동으로 분리 창으로 열립니다.

### 빌드 (Windows 인스톨러)
```
npm run build
```
결과물: `dist/RankingCollector-Setup-1.0.0.exe` (약 200~300MB)

빌드 환경 요구사항:
- Windows 또는 macOS/Linux (cross-build 가능)
- Node.js 20+

> 참고: `extraResources` 로 `../backend/src/services/rankingTracker/` 폴더를 동봉합니다. 빌드 시 해당 폴더가 존재해야 합니다.

> ⚠️ **빌드 시 주의:** `playwrightScraper.js`가 `playwright`, `playwright-extra`, `puppeteer-extra-plugin-stealth`, `cheerio` 모듈을 require합니다. 이 모듈들은 electron-collector의 node_modules에 설치되어야 하며, asar 패키징 시 `playwright` 관련 모듈은 `asarUnpack`에 포함되어 있습니다 (이미 설정됨).

## 사용자용

1. `RankingCollector-Setup-1.0.0.exe` 더블클릭 → "다음/다음/완료"
2. 바탕화면의 "올리브영 랭킹 수집기" 아이콘 더블클릭
3. 최초 1회: 환경 선택 → DB 정보 → EC2/SSH 키 등록 → 연결 테스트 → 저장
4. 메인 화면에서 시작/종료 일시 + 인터벌 선택 → "수집 시작"

설정값(DB 비밀번호/SSH 키)은 OS 안전 저장소(Windows DPAPI)로 암호화 저장됩니다.

## 구조

- `src/main/` — Electron Main 프로세스 (Node.js)
  - `index.js` — 앱 진입점, IPC 핸들러
  - `worker.js` — 수집 워커 (Sequelize INSERT)
  - `sshTunnel.js` — ssh2 기반 SSH 터널
  - `dbProbe.js` — DB 연결 테스트 (pg)
  - `playwrightLaunch.js` — rankingTracker 경로 resolution
- `src/preload/preload.js` — contextBridge로 IPC API 노출
- `src/renderer/` — React UI (Vite)
  - `App.jsx`, `components/SetupWizard.jsx`, `components/MainView.jsx`

## 알려진 한계

- 가정용 IP에서만 올리브영 봇 차단 통과 (이는 PC 워커 방식과 동일)
- 1차 버전은 코드 서명 없음 → Windows SmartScreen 경고 발생 가능 ("추가 정보 → 실행")
- 자동 업데이트 미구현 (2차 단계에서 electron-updater 도입 예정)
