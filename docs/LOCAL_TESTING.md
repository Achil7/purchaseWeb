# 로컬 테스트 가이드

## 개요
로컬에서 프론트엔드와 백엔드를 띄워 테스트하는 방법입니다.

> 중요: 이 앱은 **DB 없이 동작하지 않습니다.** 백엔드는 시작 시 PostgreSQL에 연결하고 마이그레이션된 스키마를 사용하므로, 로컬 테스트에도 **실제 PostgreSQL(예: AWS RDS 또는 로컬 Postgres)** 이 필요합니다. 아래 "데이터베이스 설정"을 먼저 끝내세요.

## 디렉토리 구조

```
purchaseweb/
├── backend/     # Express API (server.js, src/, migrations/, seeders/, src/seeders/)
└── frontend/    # React 앱 (CRA / react-scripts 5, React 19, Handsontable 16, recharts)
```

- 백엔드 작업 디렉토리: `backend/`
- 프론트엔드 작업 디렉토리: `frontend/` (프로젝트 루트가 아님)

## 사전 준비

### 1. 의존성 설치

#### 백엔드
```bash
cd backend
npm install
# Playwright/cheerio 등 랭킹 수집용 optionalDependencies 까지 설치하려면:
npm install --include=optional
```

> `playwright`, `cheerio`, `playwright-extra`, `puppeteer-extra-plugin-stealth`, `node-notifier`는 `optionalDependencies`입니다. 올리브영 랭킹 수집을 로컬에서 테스트하지 않으면 굳이 설치하지 않아도 API 서버는 동작합니다.

#### 프론트엔드
```bash
cd frontend
npm install
```

## 데이터베이스 설정

### 1. PostgreSQL 연결 설정
`backend/.env.example`을 참고하여 `backend/.env` 파일을 생성하세요. 최소 항목:
```env
NODE_ENV=development
PORT=5000

DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password

JWT_SECRET=your_jwt_secret_key_at_least_32_characters_long
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

FRONTEND_URL=http://localhost:3000
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,image/gif,image/webp
```

> S3 업로드를 로컬에서 실제로 테스트하려면 `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`도 채워야 합니다.

### 2. 마이그레이션 실행
```bash
cd backend
npm run db:migrate
```

### 3. 시더 실행 (계정/목 데이터)

`backend/.sequelizerc`의 `seeders-path`는 `backend/seeders/`로 설정되어 있고, 이 경로에는 `20241204000001-create-admin-user.js`(admin 계정)만 있습니다. 따라서 기본 시더는 admin만 생성합니다.

```bash
# admin 계정 (CLI 기본 seeders 경로)
npx sequelize-cli db:seed:all
# (= npm run db:seed)
```

마스터 계정과 목 데이터 시더는 `backend/src/seeders/`에 있어서 CLI 기본 경로 밖입니다. 필요 시 직접 실행하세요.

```bash
# 마스터 계정 시더 (backend/ 에서 실행)
node -e "
const seeder = require('./src/seeders/20251206000000-create-master-users.js');
const db = require('./src/models');
seeder.up(db.sequelize.getQueryInterface(), db.Sequelize).then(() => { console.log('Done'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
"

# 목 테스트 데이터 시더
node -e "
const seeder = require('./src/seeders/20240601000002-mock-test-data.js');
const db = require('./src/models');
seeder.up(db.sequelize.getQueryInterface(), db.Sequelize).then(() => { console.log('Done'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
"
```

## 서버 실행

### 1. 백엔드 서버 시작
```bash
cd backend
npm start
# 또는 개발 모드 (nodemon 자동 재시작)
npm run dev
```

백엔드 서버는 `http://localhost:5000`에서 실행됩니다.

### 2. 프론트엔드 서버 시작
```bash
cd frontend
npm start
```

프론트엔드는 `http://localhost:3000`에서 실행됩니다 (CRA / react-scripts).

## 테스트 계정

테스트 계정은 시더(seeder)를 통해 생성됩니다.
- `backend/seeders/20241204000001-create-admin-user.js` — admin 계정
- `backend/src/seeders/20251206000000-create-master-users.js` — 마스터 계정 (직접 실행)

기본적으로 각 역할(admin, sales, operator, brand)별 테스트 계정이 시더로 만들어집니다.

## Mock 데이터 구조

### 캠페인
1. **여름 신상품 리뷰 캠페인**
   - 품목 1: 무선 이어폰 A100
   - 품목 2: 스마트워치 W200

2. **가을 시즌 프로모션**
   - 품목 3: 가을 신상 자켓

### 구매자
- 품목 1 (무선 이어폰): 2명의 구매자
- 품목 2 (스마트워치): 1명의 구매자
- 품목 3 (가을 자켓): 1명의 구매자

## API 테스트

> 대부분의 API는 JWT 보호 라우트입니다. 먼저 로그인으로 토큰을 받고 `Authorization: Bearer <token>` 헤더를 붙여야 합니다. (`/health`, 업로드 토큰 라우트 등 일부만 무인증)

### Health Check (무인증)
```bash
curl http://localhost:5000/health
```

### 로그인 (토큰 발급)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
# 응답의 token 값을 아래 TOKEN 으로 사용
```

### 캠페인 목록 조회 (JWT 필요)
```bash
curl http://localhost:5000/api/campaigns \
  -H "Authorization: Bearer $TOKEN"
```

### 품목 목록 조회
```bash
curl http://localhost:5000/api/items/campaign/1 \
  -H "Authorization: Bearer $TOKEN"
```

### 구매자 목록 조회
```bash
curl http://localhost:5000/api/buyers/item/1 \
  -H "Authorization: Bearer $TOKEN"
```

### 구매자 추가 (슬래시 파싱)
```bash
curl -X POST http://localhost:5000/api/buyers/item/1/parse \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": "20240603-001/홍길동/홍길동/hong@test.com/010-9999-8888/서울시 종로구/국민은행 123-456-789/59000"
  }'
```

## 프론트엔드 테스트 시나리오

### 1. 진행자 워크플로우
1. `/operator` - 캠페인 목록 확인
2. 캠페인 선택 → 품목 목록 확인
3. 품목 선택 → 구매자 리스트 확인
4. "구매자 추가" 버튼 클릭
5. 슬래시로 구분된 데이터 붙여넣기
6. 데이터 확인 후 저장

### 2. 슬래시 파싱 테스트
구매자 추가 다이얼로그에서 다음 형식으로 붙여넣기:
```
20240604-001/김영수/김영수/kimys@naver.com/010-7777-6666/경기도 수원시 팔달구/신한은행 999-888-777666/59000
```

### 3. 다중 구매자 일괄 추가 테스트
구매자 추가 다이얼로그에서 여러 줄 입력:
```
20240604-001/김영수/김영수/kimys@naver.com/010-7777-6666/경기도 수원시 팔달구/신한은행 999-888-777666/59000
20240604-002/박철수/박철수/parkcs@naver.com/010-8888-9999/서울시 강남구/국민은행 123-456-789012/45000
```
- 파싱된 데이터 미리보기 테이블 확인
- "N명 일괄 추가" 버튼 클릭

### 4. 이미지 업로드 테스트 (이름 검색 후 선택)
현재 업로드 흐름은 **계좌번호 매칭이 아니라 이름 검색 후 주문 선택** 방식입니다.

1. 품목/슬롯 상세에서 "업로드 링크" 복사 → 공개 경로는 `/upload-slot/:token` (로그인 불필요)
2. 새 탭에서 업로드 링크 열기
3. **이름 입력 후 검색** → 백엔드 `GET /api/images/search-buyers/:token`이 같은 슬롯 그룹(`item_id + day_group`) 안에서 `buyer_name` 또는 `recipient_name`에 검색어가 포함된 구매자를 반환
4. 검색 결과 테이블에서 업로드할 주문을 체크박스로 선택 (복수 선택 가능)
5. 선택한 주문별로 이미지 추가 (파일 선택 / Ctrl+V 붙여넣기 / 드래그앤드롭, 이미지당 최대 10MB)
6. "업로드" 버튼 → `POST /api/images/upload/:token` (선택한 주문의 `buyer_ids`로 직접 매칭, AWS S3 저장)
7. 이미 업로드된 주문은 "업로드 완료"로 비활성화 표시되는지 확인

### 5. 선 업로드 테스트 (Pre-upload)
1. 구매자 등록 **전에** 업로드 링크에서 먼저 이미지 업로드 → 임시(is_temporary) Buyer 생성
2. 노란색 배경 + "선 업로드" 표시 확인
3. 진행자 페이지에서 동일 슬롯 그룹에 구매자 등록
4. 선 업로드된 이미지가 등록한 구매자에 자동으로 병합되는지 확인

### 6. 데이터 수정 테스트
1. 구매자 리스트에서 "수정" 버튼 클릭
2. 정보 수정
3. 저장

### 7. 데이터 삭제 테스트
1. 구매자 리스트에서 "삭제" 버튼 클릭
2. 확인 후 삭제

### 8. Admin 기능 테스트
1. `/admin` - 컨트롤 타워 / 진행자 배정 확인
2. **캠페인 추가**: "캠페인 추가" 버튼 클릭 → 캠페인 정보 입력 → 저장
3. 캠페인 선택 → 품목 목록 확인
4. **품목 추가**: "품목 추가" 버튼 클릭 → 품목 정보 입력 → 저장
5. 품목 선택 → 구매자 리스트 확인
6. **구매자 추가**: "구매자 추가" 버튼 클릭 → 슬래시 데이터 입력 → 저장
7. **구매자 수정/삭제**: 관리 컬럼 아이콘으로 수정/삭제
8. **업로드 링크 복사**: 슬롯별 토큰 링크 복사 → `/upload-slot/:token` 확인
9. **입금 완료 토글**: Switch 토글 → 스크롤 위치 유지 확인
10. **택배대행 송장관리**: 날짜별 택배 송장 관리 화면 확인

### 9. 이미지별 행 분리 확인
1. 구매자가 N개 이미지 업로드 후 구매자 테이블 확인
2. 1명의 구매자가 N개 행으로 표시되는지 확인
3. 첫 번째 행에만 구매자 정보(주문번호, 구매자명 등) 표시 확인
4. 각 행에 개별 이미지 썸네일 표시 확인
5. 이미지 클릭 시 확대 팝업 확인

### 10. 신규 화면 테스트 surface
- 브랜드 현황 대시보드(`/brand`), 영업사 현황 대시보드, 제품별 현황 테이블 (recharts 차트 포함)
- 구매자 분석 대시보드 (계좌 단위 집계)
- 리뷰샷 검색 (브랜드사 + 제품명/기간)
- Admin AI 챗 패널 (아래 "AI 챗 로컬 테스트" 참고)
- 올리브영 BEST 랭킹 화면 (아래 "랭킹 수집 로컬 테스트" 참고)

## 선택 기능 로컬 테스트

기본적으로 AI 챗 / 랭킹 / 추출은 환경 변수로 켜야 동작합니다. 로컬에서 켜는 방법은 아래와 같습니다.

### AI 챗 로컬 테스트 (text-to-SQL)
1. `backend/.env`에 다음 추가:
   ```env
   AI_CHAT_ENABLED=true
   ANTHROPIC_API_KEY=sk-ant-your-key
   ANTHROPIC_MODEL=claude-opus-4-8
   AI_CHAT_ALLOWED_USERS=
   DB_READONLY_USER=ai_readonly
   DB_READONLY_PASSWORD=your_readonly_password
   ```
   > `AI_CHAT_ALLOWED_USERS`를 **빈값**으로 두면 모든 admin이 AI 챗을 쓸 수 있습니다(테스트 편의). 운영에서는 `masterkangwoo`로 제한합니다.
2. 로컬 PostgreSQL에 읽기전용 역할 생성:
   ```sql
   CREATE ROLE ai_readonly WITH LOGIN PASSWORD 'your_readonly_password';
   GRANT CONNECT ON DATABASE your_database_name TO ai_readonly;
   GRANT USAGE ON SCHEMA public TO ai_readonly;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO ai_readonly;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ai_readonly;
   ```
   > AI가 생성한 SQL은 이 SELECT 전용 역할로만 실행되며(`config/readonlyDb.js`, `statement_timeout=10000ms`), `sqlValidator.js`가 SELECT 전용 2차 방어선입니다. 다른 DB를 읽게 하려면 `DB_READONLY_NAME/HOST/PORT`로 override합니다.
3. admin으로 로그인 후 AI 챗 패널에서 질문 → SQL 생성/실행/답변 확인.

### 랭킹 수집 로컬 테스트 (올리브영 BEST)
1. `backend/.env`에 다음 추가:
   ```env
   RANKING_AUTO_ENABLED=true
   PROXY_MODE=none
   ```
   > 로컬에서는 `PROXY_MODE=none`(프록시 없음)으로 충분합니다. residential/site_unblocker 모드는 Decodo 자격증명(`PROXY_*` / `SITE_UNBLOCKER_*`)이 필요합니다.
2. Playwright/Chromium이 있어야 합니다(`optionalDependencies`):
   ```bash
   cd backend
   npm install --include=optional
   npx playwright install chromium
   ```
3. 백엔드 시작 시 `rankingScheduler`가 in-process로 뜹니다. `server.js`의 `startEnvWatcher()`가 `.env`의 `PROXY_*` 변경을 재시작 없이 반영합니다.
4. 별도 PC 워커 / Electron 수집기 경로도 있으나, 단순 화면 확인은 백엔드 in-process 수집으로 충분합니다.

### 리뷰 텍스트 추출 로컬 테스트 (GPT-4o Vision)
추출은 **기본 OFF**(안전)입니다. 켜려면 `backend/.env`에:
```env
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o
OPENAI_VISION_DETAIL=high
EXTRACTION_ENABLED=true
EXTRACTION_ALLOWED_BRAND_IDS=all
```
> `EXTRACTION_ENABLED=true` 라도 `EXTRACTION_ALLOWED_BRAND_IDS`가 비어 있으면 전체 차단입니다. 특정 브랜드만 테스트하려면 `1,5,10`처럼 ID를 나열하세요. (`all`=전체 허용)

## 문제 해결

### 백엔드 서버가 시작되지 않는 경우
```bash
# 포트 사용 확인
netstat -ano | findstr :5000

# 프로세스 종료 (Windows)
taskkill /PID <PID> /F
```

### 데이터베이스 연결 실패
1. `backend/.env`의 `DB_*` 값 확인
2. RDS 사용 시 보안 그룹/VPC 설정 확인 (로컬 IP 허용 또는 SSH 터널 필요)
3. 로컬 Postgres 사용 시 서비스 기동 여부 확인

### CORS 에러
프론트엔드 `frontend/.env` 파일 확인:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

백엔드 `backend/.env` 파일 확인:
```env
FRONTEND_URL=http://localhost:3000
```

## Mock 데이터 초기화

### 데이터 재설정
```bash
cd backend

# 기본 시드(admin) 취소
npx sequelize-cli db:seed:undo:all

# 다시 시드 실행
npx sequelize-cli db:seed:all
# 마스터/목 데이터는 위 "시더 실행" 절의 node -e 방식으로 다시 실행
```

### 전체 데이터베이스 재설정
```bash
cd backend

# undo:all → migrate → seed:all 을 한 번에 (npm 스크립트)
npm run db:reset
```

> `npm run db:reset` = `sequelize-cli db:migrate:undo:all && db:migrate && db:seed:all`. 마스터/목 데이터 시더는 기본 경로 밖이므로, 필요하면 reset 후 위 `node -e` 방식으로 별도 실행하세요.

## 현재 기능 요약

초기(2026년 초)의 EC2 배포 / JWT / S3 / 다중 업로드 / 선 업로드 등 기반 기능 위에 다음이 추가되었습니다.

- 브랜드/영업사 현황 대시보드 (recharts)
- 구매자 분석 대시보드 (계좌 단위)
- 리뷰샷 검색, 재제출 이미지 승인 워크플로우(pending/approved)
- 택배대행 송장관리 화면
- GPT-4o Vision 리뷰 텍스트 추출 (브랜드 ID 게이팅, 기본 OFF)
- 올리브영 BEST 랭킹 수집 (in-process Playwright 워커 + 3-way PROXY_MODE)
- Admin AI 챗 text-to-SQL (ai_readonly 역할)
- 모바일 로그인(리프레시 토큰) + heartbeat
- 약 36회에 걸친 Handsontable 시트 성능 최적화 (`docs/SHEET_OPTIMIZATION_TODO.md`)

> 참고: 마진/정산/견적(margin/settlement/quote) 기능은 제거되었습니다(commit 9317faa). 관련 정산 테이블이 DB에 남아 있을 수는 있습니다.

## 참고 문서
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

**최종 업데이트**: 2026-06-29
