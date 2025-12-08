# 구현 진행 상황

**최종 업데이트**: 2025-12-08 (Session 4)
**프로젝트**: CampManager (purchaseWeb)
**배포 URL**: https://kwad.co.kr

---

## 2025-12-08 (Session 5) 업데이트 내역 🆕

### 이미지 업로드 링크 기능 구현 (S3 연동)

#### 1. 백엔드 API 추가
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/items/token/:token` | 토큰으로 품목 조회 | Public |
| POST | `/api/images/upload/:token` | 이미지 업로드 (S3) | Public |
| GET | `/api/images/item/:itemId` | 품목 이미지 목록 | Private |
| DELETE | `/api/images/:id` | 이미지 삭제 | Private |

#### 2. 신규 파일 생성
- `backend/src/config/s3.js` - S3 클라이언트 설정
- `backend/src/controllers/imageController.js` - 이미지 업로드/조회/삭제 API
- `frontend/src/components/upload/UploadPage.js` - 이미지 업로드 페이지 (Public)
- `frontend/src/services/imageService.js` - 이미지 API 서비스

#### 3. 마이그레이션 추가
- `20251208000001-alter-items-shipping-deadline.js` - shipping_deadline 타입 변경 (DATE → STRING)
- `20251208000002-add-order-number-to-images.js` - images 테이블에 order_number 컬럼 추가

#### 4. 기능 설명
- **업로드 페이지** (`/upload/:token`): 로그인 불필요, 캠페인명/품목명 표시, 주문번호 입력, 이미지 선택/붙여넣기(Ctrl+V)
- **이미지 저장**: AWS S3 (`kwad-image` 버킷) → DB에 URL 저장
- **썸네일 표시**: 품목 상세에서 업로드된 이미지를 썸네일로 표시 (클릭 시 확대)

#### 5. 수정된 파일
- `frontend/src/components/sales/SalesItemTable.js` - "업로드 링크" → "이미지 업로드 링크"
- `frontend/src/components/sales/SalesItemDetail.js` - 이미지 썸네일 섹션 추가
- `frontend/src/components/operator/OperatorBuyerTable.js` - 이미지 썸네일 섹션 추가
- `frontend/src/components/brand/BrandBuyerTable.js` - 이미지 썸네일 섹션 추가
- `frontend/src/App.js` - `/upload/:token` 라우트 추가
- `frontend/src/services/index.js` - imageService export 추가
- `backend/src/models/Image.js` - order_number 필드 추가
- `backend/src/routes/items.js` - 토큰 조회 API 라우트 추가
- `backend/src/routes/images.js` - 이미지 API 라우트 구현
- `backend/src/controllers/itemController.js` - getItemByToken 함수 추가

---

## 2025-12-08 (Session 4) 업데이트 내역

### Sales 품목/캠페인 CRUD 기능 구현

#### 1. 품목 생성 버그 수정
**문제**: 품목 추가 시 필드명 불일치로 생성 실패
| 프론트엔드 (기존) | 백엔드 (필요) |
|------------------|---------------|
| `name` | `product_name` |
| `target_keyword` | `keyword` |
| `delivery_service` | `courier_service_yn` |

**해결**: `SalesAddItemDialog.js` 필드명 수정

#### 2. 품목 다이얼로그 개선
- `SalesAddItemDialog.js` → `SalesItemDialog.js` (create/edit 모드 지원)
- Box + flex 레이아웃으로 변경 (AdminUserCreate 스타일)
- 수정 모드에서 기존 데이터 로드

#### 3. 품목 테이블 CRUD 추가
- 수정/삭제 버튼 (IconButton) 추가
- 삭제 확인 Dialog 추가
- 상세보기 버튼 추가

#### 4. 품목 상세보기 페이지 생성
- **신규 파일**: `SalesItemDetail.js`
- 품목 기본 정보 표시
- 구매자(Buyer) 목록 테이블
- **라우트**: `/sales/campaign/:campaignId/item/:itemId`

#### 5. 캠페인 테이블 개선
- 브랜드명 컬럼 추가 (첫 번째 컬럼)
- 수정/삭제 버튼 추가
- 삭제 확인 Dialog 추가

#### 6. 캠페인 다이얼로그 개선
- `SalesAddCampaignDialog.js` → `SalesCampaignDialog.js`
- create/edit 모드 지원

#### 수정된 파일
- `frontend/src/components/sales/SalesAddItemDialog.js` (리네임 + 수정)
- `frontend/src/components/sales/SalesItemTable.js`
- `frontend/src/components/sales/SalesItemDetail.js` (신규)
- `frontend/src/components/sales/SalesAddCampaignDialog.js` (수정)
- `frontend/src/components/sales/SalesCampaignTable.js`
- `frontend/src/App.js` (라우트 추가)

---

## 2025-12-06 (Session 3) 업데이트 내역

### MUI v7 Grid 호환성 수정

#### 문제
- MUI v7에서 기존 Grid의 `item`, `xs`, `sm` props가 더 이상 작동하지 않음
- 드롭다운 필드(역할, 브랜드사 등)가 매우 좁게 표시되는 문제 발생

#### 해결
- Grid 컴포넌트를 Box + flexbox 레이아웃으로 변경
- TextField의 `select` 대신 FormControl + Select 컴포넌트 사용

#### 수정된 파일
- `frontend/src/components/admin/AdminUserCreate.js`
- `frontend/src/components/sales/SalesAddCampaignDialog.js`

---

## 2025-12-06 (Session 2) 업데이트 내역

### 1. 사용자 관리 시스템 (Admin 전용)

#### 백엔드 API (`backend/src/routes/users.js`)
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/users` | 전체 사용자 목록 조회 | Admin |
| GET | `/api/users?role=brand` | 브랜드사 목록 조회 | Admin, Sales |
| POST | `/api/users` | 사용자 생성 | Admin |
| GET | `/api/users/:id` | 사용자 상세 조회 | Admin |
| PUT | `/api/users/:id` | 사용자 수정 | Admin |
| DELETE | `/api/users/:id` | 사용자 비활성화 | Admin |

#### 프론트엔드 컴포넌트
- `frontend/src/components/admin/AdminUserCreate.js` - 사용자 등록 다이얼로그
- `frontend/src/services/userService.js` - 사용자 API 서비스

#### 등록 가능 필드
- username (필수) - 로그인 ID
- password (필수)
- name (필수) - 표시 이름
- email (필수)
- role (필수) - admin / sales / operator / brand
- phone (선택)
- is_active (선택, 기본값: true)

### 2. 프로필 수정 기능 (모든 역할)

#### 백엔드 API (`backend/src/routes/auth.js`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/verify-password` | 비밀번호 2차 검증 |
| PUT | `/api/auth/profile` | 프로필 수정 (name, password) |

#### 프론트엔드 컴포넌트
- `frontend/src/components/common/ProfileEditDialog.js` - 프로필 수정 다이얼로그

#### 수정 프로세스
1. **1단계**: 현재 비밀번호 입력 → 본인 확인 (2차 검증)
2. **2단계**: 이름 수정 / 새 비밀번호 변경
3. 저장 시 DB 반영 (비밀번호는 bcrypt 해시 저장)

### 3. 캠페인 추가 시 브랜드사 드롭다운

#### 변경 파일
- `frontend/src/components/sales/SalesAddCampaignDialog.js`

#### 변경 내용
- 기존: 브랜드사 ID 직접 입력 (숫자)
- 변경: `/api/users?role=brand` API 호출 → 드롭다운 선택
- 드롭다운에 브랜드사 `name` 표시, 선택 시 `id` 값 전송

### 4. 헤더 UI 개선

#### 변경 사항
1. **username → name 표시**: 모든 Layout 헤더에서 `user.name` 표시
2. **프로필 수정 버튼**: 이름 박스 클릭 시 프로필 수정 다이얼로그 열림
3. **hover 효과**: 클릭 가능함을 시각적으로 표시

#### 적용 파일
- `frontend/src/components/admin/AdminDashboard.js`
- `frontend/src/components/sales/SalesLayout.js`
- `frontend/src/components/operator/OperatorLayout.js`
- `frontend/src/components/brand/BrandLayout.js`

---

## 완료된 작업 ✅

### 1. 데이터베이스 설계
- [x] PostgreSQL 스키마 설계 완료 ([DATABASE_SCHEMA.md](DATABASE_SCHEMA.md))
- [x] 6개 테이블 설계
  - users (사용자)
  - campaigns (캠페인)
  - items (품목)
  - campaign_operators (진행자 배정)
  - buyers (구매자/리뷰어)
  - images (리뷰 이미지)

### 2. 백엔드 구조 설계
- [x] Node.js + Express 기반 RESTful API 설계
- [x] API 엔드포인트 설계 ([BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md))
- [x] 권한별 접근 제어 정책 수립

### 3. 백엔드 프로젝트 초기화
- [x] package.json 및 의존성 설정
- [x] 프로젝트 디렉토리 구조 생성
- [x] Express 서버 설정 (server.js, app.js)
- [x] 환경 변수 설정 (.env, .env.example)
- [x] 백엔드 의존성 설치 완료 (642 packages)

### 4. Sequelize 모델 생성
- [x] User 모델
- [x] Campaign 모델
- [x] Item 모델 (이미지 업로드 토큰 자동 생성 포함)
- [x] CampaignOperator 모델
- [x] Buyer 모델
- [x] Image 모델
- [x] 모델 간 관계(Association) 설정

### 5. 데이터베이스 마이그레이션
- [x] 6개 마이그레이션 파일 생성
  - 20241204000001-create-users.js
  - 20241204000002-create-campaigns.js
  - 20241204000003-create-items.js
  - 20241204000004-create-campaign-operators.js
  - 20241204000005-create-buyers.js
  - 20241204000006-create-images.js

### 6. 시드 데이터
- [x] 관리자 계정 시드 파일 생성
  - Username: `admin`
  - Password: `admin123!@#` (첫 로그인 후 변경 필요)

### 7. API 라우트 기본 구조
- [x] auth.js - 인증 라우트
- [x] users.js - 사용자 관리
- [x] campaigns.js - 캠페인 CRUD
- [x] items.js - 품목 CRUD
- [x] buyers.js - 구매자 CRUD
- [x] images.js - 이미지 업로드

## 완료된 단계 ✅

### 단계 1: 인증 시스템 구현 (✅ 완료)
1. ✅ JWT 인증 미들웨어 구현
2. ✅ 역할 기반 권한 체크 미들웨어
3. ✅ 인증 API 컨트롤러 (로그인/로그아웃)
4. ✅ bcrypt를 사용한 비밀번호 해싱

### 단계 2: 핵심 API 구현 (✅ 완료)
1. ✅ 사용자 관리 API (총관리자용)
2. ✅ 캠페인 CRUD API
3. ✅ 품목 CRUD API
4. ✅ 구매자 CRUD API (슬래시 파싱 포함)
5. ✅ 진행자 배정 API

### 단계 4: 프론트엔드 연동 (✅ 완료)
1. ✅ 로그인 페이지 구현
2. ✅ axios를 통한 API 연동
3. ✅ JWT 토큰 저장 및 관리
4. ✅ 역할별 라우트 보호
5. ✅ 로그인/로그아웃 강화 (2025-12-06)
   - 모든 역할 로그아웃 버튼 추가
   - 세션 완전 정리 (localStorage, sessionStorage, 캐시)
   - 역할 전환 시 올바른 리다이렉트

### 단계 5: EC2 배포 (✅ 완료)
1. ✅ EC2 서버에 백엔드 배포
2. ✅ RDS 연결 설정
3. ✅ 데이터베이스 마이그레이션 실행
4. ✅ Nginx 리버스 프록시 설정
5. ✅ SSL 인증서 (Let's Encrypt)
6. ✅ 프론트엔드 빌드 및 배포

---

## 다음 단계 📋

### 단계 3: AWS S3 연동 (✅ 완료)
1. ✅ S3 설정 및 연결 (`backend/src/config/s3.js`)
2. ✅ 이미지 업로드 API (`POST /api/images/upload/:token`)
3. ✅ 토큰 기반 업로드 링크 생성

### 단계 6: API 레벨 권한 강화 (⏳ 예정)
1. 소유권 확인 (영업사는 자신의 캠페인만)
2. 진행자 배정 확인
3. 브랜드사 제한된 컬럼 조회

## 파일 구조

```
purchaseweb/
├── backend/                  ✅ 완료
│   ├── src/
│   │   ├── models/           ✅ 완료 (6개 모델)
│   │   ├── routes/           ✅ 완료
│   │   │   ├── auth.js       ✅ 로그인/로그아웃/프로필수정
│   │   │   ├── users.js      ✅ 사용자 CRUD (Admin)
│   │   │   ├── campaigns.js  ✅ 캠페인 CRUD
│   │   │   ├── items.js      ✅ 품목 CRUD
│   │   │   ├── buyers.js     ✅ 구매자 CRUD
│   │   │   └── images.js     ✅ 이미지 업로드
│   │   ├── controllers/      ✅ 완료
│   │   ├── middleware/       ✅ 완료 (JWT, 권한 체크)
│   │   ├── config/           ✅ 완료
│   │   └── app.js            ✅ 완료
│   ├── migrations/           ✅ 완료 (6개)
│   ├── seeders/              ✅ 완료 (관리자 + 마스터 계정)
│   └── server.js             ✅ 완료
│
├── frontend/                 ✅ React 프론트엔드
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   └── ProfileEditDialog.js  ✅ 프로필 수정
│   │   │   ├── admin/
│   │   │   │   ├── AdminDashboard.js     ✅ 사용자등록 버튼
│   │   │   │   └── AdminUserCreate.js    ✅ 사용자 등록
│   │   │   ├── sales/
│   │   │   │   ├── SalesLayout.js        ✅ 레이아웃
│   │   │   │   ├── SalesCampaignTable.js ✅ 캠페인 CRUD
│   │   │   │   ├── SalesCampaignDialog.js ✅ 캠페인 생성/수정
│   │   │   │   ├── SalesItemTable.js     ✅ 품목 CRUD
│   │   │   │   ├── SalesItemDialog.js    ✅ 품목 생성/수정
│   │   │   │   └── SalesItemDetail.js    ✅ 품목 상세/구매자 목록
│   │   │   ├── operator/
│   │   │   │   └── OperatorLayout.js     ✅ 레이아웃
│   │   │   └── brand/
│   │   │       └── BrandLayout.js        ✅ 레이아웃
│   │   ├── context/          ✅ AuthContext
│   │   ├── services/
│   │   │   ├── api.js        ✅ axios 클라이언트
│   │   │   ├── authService.js ✅ 인증 서비스
│   │   │   └── userService.js ✅ 사용자 API 서비스
│   │   └── App.js            ✅ 라우팅
│   └── package.json          ✅ 완료
│
├── deploy/                   ✅ Docker 배포
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── deploy.sh
│
└── docs/                     ✅ 문서화 완료
    ├── CLAUDE.md             - AI 작업 가이드
    ├── DATABASE_SCHEMA.md    - DB 스키마 문서
    ├── BACKEND_STRUCTURE.md  - 백엔드 구조 문서
    ├── DEPLOYMENT_GUIDE.md   - EC2 배포 가이드
    ├── LOCAL_TESTING.md      - 로컬 테스트 가이드
    └── IMPLEMENTATION_PROGRESS.md (이 파일)
```

## 주요 기술 스택

### 백엔드
- Node.js + Express.js
- PostgreSQL (AWS RDS)
- Sequelize ORM
- JWT 인증
- bcrypt (비밀번호 해싱)
- AWS SDK v3 (S3 업로드)
- multer (파일 업로드)

### 프론트엔드
- React 19.2.0
- Material-UI 7.3.5
- React Router 7.9.6

### 인프라
- AWS RDS (PostgreSQL)
- AWS S3 (이미지 저장)
- AWS EC2 (서버 호스팅)

## 환경 설정

### RDS 연결 정보
- Host: `serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com`
- Port: `5432`
- Database: `serverdb`
- User: `kwad`

### S3 설정
- Bucket: `kwad-image`
- Region: `ap-northeast-2` (서울)

### 로컬 개발
- 프론트엔드: `http://localhost:3000`
- 백엔드 API: `http://localhost:5000`

## EC2 서버 배포 시 필요 사항

### 1. 패키지 설치
```bash
# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 클라이언트 설치 (선택)
sudo apt-get install postgresql-client
```

### 2. 프로젝트 배포
```bash
# 코드 다운로드
git clone <repository-url>
cd purchaseweb

# 백엔드 의존성 설치
cd backend
npm install

# 환경 변수 설정
nano .env  # AWS 자격 증명 입력 필요

# 데이터베이스 마이그레이션
npm run db:migrate

# 시드 데이터 입력
npm run db:seed

# 서버 시작
npm start
```

### 3. Nginx 설정
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 프론트엔드 (React 빌드)
    location / {
        root /path/to/purchaseweb/build;
        try_files $uri /index.html;
    }

    # 백엔드 API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. PM2로 백엔드 실행 (프로덕션)
```bash
# PM2 설치
sudo npm install -g pm2

# 백엔드 실행
cd backend
pm2 start server.js --name campmanager-api

# 자동 재시작 설정
pm2 startup
pm2 save
```

## 다음 회의 시 논의할 사항

1. **AWS 자격 증명**: S3 업로드를 위한 Access Key 필요
2. ~~**도메인 설정**: 실제 도메인 연결 여부~~ ✅ 완료 (kwad.co.kr)
3. ~~**HTTPS 설정**: SSL 인증서 필요 여부~~ ✅ 완료 (Let's Encrypt)
4. **백업 정책**: 데이터베이스 백업 전략
5. **모니터링**: 에러 로깅 및 모니터링 도구

## 참고 문서

- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - 데이터베이스 스키마 상세
- [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md) - 백엔드 구조 및 API 설계
- [CLAUDE.md](CLAUDE.md) - 프로젝트 전체 가이드
- [backend/README.md](../backend/README.md) - 백엔드 사용 가이드
