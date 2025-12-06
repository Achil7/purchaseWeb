# CLAUDE.md - CampManager 프로젝트 종합 가이드

## 프로젝트 개요

**CampManager**는 리뷰 캠페인 관리 시스템입니다. 영업사, 진행자, 브랜드사가 캠페인과 구매자(리뷰어)를 효율적으로 관리하는 웹 애플리케이션입니다.

### 핵심 목적
- 영업사가 캠페인과 품목을 생성
- 진행자가 구매자(리뷰어) 정보를 관리
- 브랜드사가 리뷰 현황을 모니터링
- 총관리자가 전체 시스템을 관리

---

## 프로젝트 구조

```
purchaseweb/
├── README.md               # 프로젝트 종합 문서
│
├── frontend/               # React 프론트엔드
│   ├── src/
│   │   ├── components/    # 역할별 대시보드
│   │   │   ├── admin/     # 총관리자 대시보드
│   │   │   ├── sales/     # 영업사 대시보드
│   │   │   ├── operator/  # 진행자 대시보드
│   │   │   └── brand/     # 브랜드사 대시보드
│   │   ├── services/      # API 서비스 레이어
│   │   │   ├── api.js           # Axios 인스턴스 (JWT 인터셉터)
│   │   │   ├── authService.js   # 로그인/로그아웃 서비스
│   │   │   ├── campaignService.js
│   │   │   ├── itemService.js   # 품목 + 진행자 배정 API
│   │   │   ├── buyerService.js
│   │   │   └── userService.js   # 사용자 조회/등록 API
│   │   ├── context/       # React Context
│   │   │   └── AuthContext.js   # 인증 상태 관리
│   │   └── App.js         # 라우팅
│   ├── public/
│   └── package.json
│
├── backend/                # Node.js + Express API
│   ├── src/
│   │   ├── models/        # Sequelize 모델 (6개)
│   │   │   ├── User.js
│   │   │   ├── Campaign.js
│   │   │   ├── Item.js
│   │   │   ├── CampaignOperator.js
│   │   │   ├── Buyer.js
│   │   │   └── Image.js
│   │   ├── controllers/   # API 컨트롤러
│   │   │   ├── campaignController.js
│   │   │   ├── itemController.js
│   │   │   └── buyerController.js
│   │   ├── routes/        # API 라우트
│   │   │   ├── campaigns.js
│   │   │   ├── items.js
│   │   │   └── buyers.js
│   │   └── config/        # DB 설정
│   ├── migrations/        # DB 마이그레이션 파일
│   ├── seeders/           # 초기 데이터
│   └── server.js          # 서버 진입점
│
├── deploy/                 # 배포 관련 파일
│   ├── Dockerfile         # 멀티스테이지 빌드
│   ├── docker-compose.yml
│   ├── deploy.sh          # EC2 배포 스크립트
│   ├── .env.example
│   └── README.md          # 배포 가이드
│
└── docs/                   # 프로젝트 문서
    ├── CLAUDE.md          # 이 파일
    ├── DATABASE_SCHEMA.md # DB 스키마 상세
    ├── BACKEND_STRUCTURE.md
    ├── DEPLOYMENT.md
    └── 기타...
```

---

## 핵심 개념

### 1. 역할 (Roles)

| 역할 | 영문 코드 | 권한 |
|------|----------|------|
| 총관리자 | `admin` | 모든 페이지 접근 및 수정, 진행자 배정, 입금 확인 |
| 영업사 | `sales` | 캠페인/품목 생성, 리뷰어 조회 (자신의 캠페인만) |
| 진행자 | `operator` | 리뷰어 관리 (배정된 캠페인/품목만) |
| 브랜드사 | `brand` | 리뷰어 정보 조회 (제한된 컬럼, 주최 캠페인만) |

**사용자 규모**: 약 100명

### 2. 핵심 엔티티

```
User (사용자)
  ↓
Campaign (캠페인) ← created_by (영업사가 생성)
  ↓
Item (품목) ← upload_link_token 자동 생성
  ↓
Buyer (구매자/리뷰어) ← 슬래시(/) 구분 데이터로 추가
  ↓
Image (리뷰 이미지) ← AWS S3 저장

CampaignOperator (캠페인-진행자 매핑) ← 총관리자가 배정
```

**주요 용어:**
- **캠페인**: 하나의 캠페인에 여러 품목이 존재
- **품목**: 캠페인 내의 개별 상품
- **리뷰어 = 구매자**: 제품을 구매하고 리뷰를 작성하는 사용자 (용어 혼용)
- **채팅방**: 각 캠페인/품목마다 진행자가 운영 (한 진행자가 여러 채팅방 운영 가능)

---

## 주요 워크플로우

### 1. 로그인 (✅ 완료)
- 4가지 역할: 총관리자, 영업사, 진행자, 브랜드사
- JWT 기반 인증 (7일 유효)
- 역할 기반 라우트 보호 (ProtectedRoute)
- 로그아웃 시 세션 완전 정리 (localStorage, sessionStorage, 브라우저 캐시)

### 2. 캠페인/품목 생성 (영업사)

**캠페인 생성:**
- 캠페인명, 설명, 시작일, 종료일, 브랜드사 연결

**품목 추가:**
영업사가 캠페인 내에 품목을 생성하며, 다음 정보를 입력:

```
- 제품 미출고/실출고: [미출고/실출고]
- 희망 유입 키워드: [자유입력]
- 총 구매 건수: [숫자]
- 일 구매 건수: [숫자]
- 상품 확인 URL: [URL]
- 구매 옵션: [옵션]
- 제품 구매 가격: [금액]
- 출고 마감 시간: [시간]
- 리뷰가이드 및 소구점: [텍스트]
- 택배대행 Y/N: [Y/N]
- 비고: [텍스트]
```

**품목 생성 시 자동 처리:**
- `upload_link_token` (UUID) 자동 생성
- 이미지 업로드 링크: `/upload/{upload_link_token}`

### 3. 진행자 배정 (총관리자)

총관리자가 `campaign_operators` 테이블을 통해 진행자를 배정:
- 캠페인 전체에 배정 (`item_id` = NULL)
- 특정 품목에만 배정 (`item_id` 지정)

### 4. 이미지 업로드 링크 공유 (진행자)

품목 생성 시 자동 생성된 업로드 링크를 채팅방에 공유:
- 예: `https://kwad.co.kr/upload/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**이미지 업로드 페이지 기능:**
- Ctrl+V로 캡처 이미지 붙여넣기
- 갤러리에서 이미지 선택 업로드
- 이미지 제목 입력
- AWS S3에 자동 저장
- `images` 테이블에 S3 URL 기록

### 5. 구매자(리뷰어) 추가 (진행자)

**프로세스:**
1. 리뷰어가 채팅방에서 진행자에게 메시지 전송 (슬래시 구분)
2. 진행자가 메시지를 Ctrl+C로 복사
3. 대시보드의 "구매자 추가" 버튼으로 붙여넣기
4. 자동 파싱 후 DB 저장

**메시지 형식:**
```
주문번호/구매자/수취인/아이디/연락처/주소/계좌정보/금액

예시:
8100156654664/김민형/김민형/p4che@naver.com/010-8221-1864/경남 거제시 사등면 두동로 54-40 영진자이온 201동 18층 5호/부산112-2323-738601 김민지/22800
```

**자동 파싱 결과:**
| 순서 | 컬럼명 | 값 |
|------|--------|-----|
| 1 | order_number | 8100156654664 |
| 2 | buyer_name | 김민형 |
| 3 | recipient_name | 김민형 |
| 4 | user_id | p4che@naver.com |
| 5 | contact | 010-8221-1864 |
| 6 | address | 경남 거제시... |
| 7 | bank_account | 부산112-2323-738601 김민지 |
| 8 | amount | 22800 |

### 6. 구매자 데이터 관리

**구매자 리스트 페이지 컬럼:**
1. 주문번호 (`order_number`)
2. 구매자 (`buyer_name`)
3. 수취인 (`recipient_name`)
4. 아이디 (`user_id`)
5. 연락처 (`contact`)
6. 주소 (`address`)
7. 계좌정보 (`bank_account`)
8. 금액 (`amount`)
9. 입금확인 (`payment_status`) - 진행자: 표시만, 총관리자: 체크 가능
10. 리뷰샷 (`review_image_url`) - 썸네일 표시, 클릭 시 원본
11. 비고 (`notes`)
12. 관리 (수정/삭제 버튼)

**추가 기능:**
- 금액 컬럼 상단에 총합 표시

### 7. 입금 확인 (총관리자)

- 진행자: `payment_status`를 "pending" 또는 "completed"로 표시만 가능
- 총관리자: 실제 입금 확인 후 `payment_confirmed_by`, `payment_confirmed_at` 업데이트

---

## 권한별 접근 제어

### 총관리자 (admin)
- ✅ 모든 페이지 접근
- ✅ 모든 데이터 CRUD
- ✅ 진행자 배정 (`campaign_operators`)
- ✅ 입금 확인 체크

### 영업사 (sales)
- ✅ 캠페인/품목 생성 (자신의 것만)
- ✅ 리뷰어 조회 (자신의 캠페인/품목만)
- ❌ 진행자 배정 불가
- ❌ 입금 확인 불가

### 진행자 (operator)
- ✅ 배정된 캠페인/품목에만 접근
- ✅ 리뷰어 CRUD (배정된 것만)
- ✅ 입금 상태 표시만 가능 (체크 불가)
- ❌ 캠페인/품목 생성 불가

### 브랜드사 (brand)
- ✅ 자신이 주최하는 캠페인/품목 조회
- ✅ 리뷰어 정보 조회 (제한된 컬럼만)
  - 주문번호, 구매자, 수취인, 아이디, 리뷰이미지, 금액, 총합
- ❌ 주소, 연락처, 계좌정보 조회 불가
- ❌ 수정/삭제 불가

---

## 기술 스택

### Frontend
- **React 19.2.0**
- **Material-UI 7.3.5**
- **React Router DOM 7.1.1**
- **Axios** - HTTP 클라이언트

### Backend
- **Node.js 18+**
- **Express.js** - REST API
- **Sequelize** - PostgreSQL ORM
- **bcrypt** - 비밀번호 해싱
- **JWT** - 인증 (✅ 구현 완료)

### Database
- **PostgreSQL** (AWS RDS)
- Host: `serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com`
- Database: `serverdb`
- 6개 테이블: users, campaigns, items, campaign_operators, buyers, images

### Infrastructure
- **AWS EC2** - 애플리케이션 서버
- **AWS S3** - 이미지 저장 (kwad-image 버킷)
- **Docker** - 컨테이너화
- **PM2** - 프로세스 관리
- **Nginx** - 리버스 프록시 + SSL (✅ 구현 완료)

### Deployment
- Docker Hub: `achil7/campmanager:latest`
- 도메인: `kwad.co.kr`

---

## 데이터베이스 스키마

### 1. users (사용자)
```sql
id, username, password_hash, name, email, role, phone,
is_active, created_at, updated_at, last_login
```

### 2. campaigns (캠페인)
```sql
id, name, description, created_by (FK: users),
brand_id (FK: users), status, start_date, end_date,
created_at, updated_at
```

### 3. items (품목)
```sql
id, campaign_id (FK: campaigns), product_name, shipping_type,
keyword, total_purchase_count, daily_purchase_count,
product_url, purchase_option, product_price, shipping_deadline,
review_guide, courier_service_yn, notes,
upload_link_token (UUID), status, created_at, updated_at
```

### 4. campaign_operators (진행자 배정)
```sql
id, campaign_id (FK: campaigns), item_id (FK: items, nullable),
operator_id (FK: users), assigned_by (FK: users), assigned_at
```

### 5. buyers (구매자/리뷰어)
```sql
id, item_id (FK: items), order_number, buyer_name, recipient_name,
user_id, contact, address, bank_account, amount,
payment_status, payment_confirmed_by (FK: users),
payment_confirmed_at, notes, created_by (FK: users),
created_at, updated_at
```

### 6. images (리뷰 이미지)
```sql
id, buyer_id (FK: buyers, nullable), item_id (FK: items),
title, file_name, file_path, s3_key, s3_url, file_size, mime_type,
upload_token, uploaded_by_ip, created_at
```

**상세 스키마**: [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)

---

## API 엔드포인트

### Campaigns
- `GET /api/campaigns` - 캠페인 목록 (역할별 필터링)
- `POST /api/campaigns` - 캠페인 생성 (영업사)
- `GET /api/campaigns/:id` - 캠페인 상세
- `PUT /api/campaigns/:id` - 캠페인 수정
- `DELETE /api/campaigns/:id` - 캠페인 삭제
- `POST /api/campaigns/:id/operators` - 진행자 배정 (총관리자)

### Items
- `GET /api/items` - 전체 품목 목록 (Admin용 - 진행자 배정)
- `GET /api/items/my-assigned` - 내게 배정된 품목 (Operator용)
- `GET /api/items/campaign/:campaignId` - 캠페인별 품목 목록
- `POST /api/items/campaign/:campaignId` - 품목 생성 (Sales, Admin)
- `GET /api/items/:id` - 품목 상세
- `PUT /api/items/:id` - 품목 수정
- `POST /api/items/:id/operator` - 품목에 진행자 배정 (Admin)
- `DELETE /api/items/:id/operator/:operatorId` - 진행자 배정 해제 (Admin)
- `DELETE /api/items/:id` - 품목 삭제

### Buyers
- `GET /api/buyers/item/:itemId` - 구매자 목록
- `POST /api/buyers/item/:itemId` - 구매자 생성
- `POST /api/buyers/item/:itemId/parse` - 슬래시 파싱 후 생성
- `GET /api/buyers/:id` - 구매자 상세
- `PUT /api/buyers/:id` - 구매자 수정
- `DELETE /api/buyers/:id` - 구매자 삭제
- `PATCH /api/buyers/:id/payment` - 입금 확인 (총관리자)

### Images
- `POST /api/upload/:token` - 토큰 기반 이미지 업로드
- `GET /api/items/:itemId/images` - 이미지 목록
- `DELETE /api/images/:id` - 이미지 삭제

**상세 API 문서**: [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md)

---

## 환경 변수

### Backend (.env)
```env
# Server
NODE_ENV=production
PORT=5000

# Database (AWS RDS PostgreSQL)
DB_HOST=serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com
DB_PORT=5432
DB_NAME=serverdb
DB_USER=kwad
DB_PASSWORD=***

# JWT
JWT_SECRET=***
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# AWS S3
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=***
AWS_SECRET_ACCESS_KEY=***
S3_BUCKET_NAME=kwad-image

# Frontend URL (CORS)
FRONTEND_URL=https://kwad.co.kr

# Upload
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,image/gif,image/webp
```

**전체 예시**: [deploy/.env.example](../deploy/.env.example)

---

## 개발 환경 설정

### Frontend 개발 서버
```bash
cd frontend
npm install
npm start
# http://localhost:3000
```

### Backend 개발 서버
```bash
cd backend
npm install

# DB 마이그레이션
npm run db:migrate
npm run db:seed

# 서버 시작
npm start
# http://localhost:5000
```

---

## 배포

### Docker로 배포
```bash
# 1. 로컬에서 빌드 및 푸시
make deploy

# 2. EC2 서버 접속
ssh -i "server_rsa_key.pem" ubuntu@ec2-16-184-33-207.ap-northeast-2.compute.amazonaws.com

# 3. 배포 스크립트 실행
wget https://raw.githubusercontent.com/YOUR-REPO/purchaseweb/main/deploy/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

**상세 배포 가이드**: [DEPLOYMENT.md](DEPLOYMENT.md), [deploy/README.md](../deploy/README.md)

---

## UI/UX 요구사항

### 구매자 리뷰 리스트 페이지
- ✅ 금액 컬럼 상단에 총합 표시
- ✅ 입금확인 상태 표시 (역할별 권한 다름)
- ✅ 리뷰샷: 썸네일 표시, 클릭 시 원본 크기
- ✅ 비고 칸
- ✅ 관리 버튼 (수정/삭제)
- ✅ 이미지 업로드 링크 URL 표시

### 이미지 업로드 페이지
- ⏳ Ctrl+V로 캡처 이미지 붙여넣기
- ⏳ 갤러리에서 이미지 선택
- ⏳ 이미지 제목 입력
- ⏳ AWS S3 자동 업로드

---

## 데이터 파싱 규칙

### 구매자 메시지 파싱
- **구분자**: `/` (슬래시)
- **순서**: 주문번호/구매자/수취인/아이디/연락처/주소/계좌정보/금액
- **처리**: `OperatorAddBuyerDialog.js`의 `handleSmartPaste()` 함수

```javascript
const parts = text.split('/');
{
  order_number: parts[0]?.trim() || '',
  buyer_name: parts[1]?.trim() || '',
  recipient_name: parts[2]?.trim() || '',
  user_id: parts[3]?.trim() || '',
  contact: parts[4]?.trim() || '',
  address: parts[5]?.trim() || '',
  bank_account: parts[6]?.trim() || '',
  amount: parts[7]?.trim() || ''
}
```

---

## 현재 구현 상태

### ✅ 완료
- [x] 데이터베이스 스키마 설계 (6개 테이블)
- [x] Sequelize 모델 및 마이그레이션
- [x] Backend API 구현 (Campaign, Item, Buyer CRUD)
- [x] Frontend 대시보드 구현 (Sales, Operator, Brand)
- [x] API 서비스 레이어 (Axios)
- [x] 슬래시 파싱 기능
- [x] Docker 배포 설정
- [x] 프로젝트 구조 재정리 (frontend/, backend/, docs/, deploy/)
- [x] 종합 문서 작성
- [x] **JWT 인증 시스템** (2025-12-06)
- [x] **역할 기반 라우트 보호** (ProtectedRoute)
- [x] **Nginx 리버스 프록시 + SSL** (Let's Encrypt)
- [x] **로그인/로그아웃 강화** (세션 완전 정리, 역할 전환 버그 수정)
- [x] **MUI v7 Grid 호환성 수정** - Grid item/xs/sm → Box + flexbox (2025-12-06)
- [x] **캠페인 생성 오류 수정** - created_by, JWT 인증, 빈 날짜 처리 (2025-12-06)
- [x] **가짜 데이터 제거 및 실제 API 연동** (2025-12-06)
  - Admin 대시보드: 더미 데이터 제거, 실제 품목/진행자 API 연동
  - 진행자 배정 API 추가 (`POST /api/items/:id/operator`)
  - 진행자용 배정 품목 조회 API 추가 (`GET /api/items/my-assigned`)
  - 모든 컴포넌트에서 hardcoded userId 제거 → JWT 토큰 기반 인증
- [x] **모든 API 라우트에 인증 미들웨어 추가** (2025-12-06)

### ⏳ 진행 예정
- [ ] AWS S3 이미지 업로드 기능
- [ ] 이미지 업로드 페이지 (Ctrl+V 붙여넣기)
- [ ] 입금 확인 기능 완성
- [ ] 브랜드사 제한된 컬럼 조회
- [ ] 자동 배포 (GitHub Actions)

---

## 계정 정보

### 마스터 계정 (역할별)
| 역할 | Username | Password | 리다이렉트 |
|------|----------|----------|------------|
| 총관리자 | `achiladmin` | `rkddntkfkd94!` | `/admin` |
| 영업사 | `achilsales` | `rkddntkfkd94!` | `/sales` |
| 진행자 | `achiloperator` | `rkddntkfkd94!` | `/operator` |
| 브랜드사 | `achilbrand` | `rkddntkfkd94!` | `/brand` |

### 기본 관리자 계정 (테스트용)
- Username: `admin`
- Password: `admin123!@#`
- ⚠️ 프로덕션에서는 비활성화 권장

---

## 주의사항

1. **용어 통일**: 구매자 = 리뷰어 (혼용 주의)
2. **진행자 채팅방**: 한 진행자가 여러 채팅방 운영 가능
3. **영업사 접근**: 각 영업사마다 자신의 캠페인/품목만 접근
4. **업로드 링크**: 캠페인/품목 생성 시 자동 생성 (`upload_link_token`)
5. **이미지 저장**: AWS S3 (`kwad-image` 버킷)
6. **DB 연결**: AWS RDS PostgreSQL (보안 그룹 설정 필요)

---

## 관련 문서

- [README.md](../README.md) - 프로젝트 종합 문서
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - DB 스키마 상세
- [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md) - API 엔드포인트 및 구조
- [DEPLOYMENT.md](DEPLOYMENT.md) - EC2 배포 가이드
- [LOCAL_TESTING.md](LOCAL_TESTING.md) - 로컬 테스트 방법
- [deploy/README.md](../deploy/README.md) - Docker 배포 가이드

---

## 문의

프로젝트 관련 문의: kwad.co.kr

---

## 최근 변경 이력 (2025-12-06)

### 백엔드 변경

1. **itemController.js** - 새 API 추가
   - `getAllItems()` - Admin용 전체 품목 목록 (진행자 배정용)
   - `getMyAssignedItems()` - Operator용 배정된 품목 목록
   - `assignOperatorToItem()` - 품목에 진행자 배정
   - `unassignOperatorFromItem()` - 진행자 배정 해제

2. **routes/items.js** - 모든 라우트에 `authenticate` 미들웨어 추가
   - `GET /api/items` - Admin 전용
   - `GET /api/items/my-assigned` - Operator 전용
   - `POST /api/items/:id/operator` - Admin 전용

3. **routes/campaigns.js** - 모든 라우트에 `authenticate` 미들웨어 추가

### 프론트엔드 변경

1. **AdminDashboard.js** - 완전히 재작성
   - 더미 데이터 (`initialItems`, `operatorList`) 제거
   - 실제 API에서 품목/진행자 목록 조회
   - 진행자 배정 저장 기능 구현

2. **SalesCampaignTable.js** - `userId: 2` hardcode 제거
3. **BrandCampaignTable.js** - `userId: 4` hardcode 제거
4. **OperatorHome.js** - 더미 데이터 제거, 실제 API 연동
5. **OperatorCampaignTable.js** - `userId: 1` hardcode 제거

6. **itemService.js** - 새 API 함수 추가
   - `getAllItems()`, `getMyAssignedItems()`
   - `assignOperator()`, `unassignOperator()`

### 다음 작업 시 참고

- 모든 컴포넌트가 JWT 토큰 기반 인증으로 변경됨
- Admin은 `GET /api/items`로 전체 품목 조회 후 진행자 배정
- Operator는 `GET /api/items/my-assigned`로 자신에게 배정된 품목만 조회
- 빌드 성공 확인됨 (경고만 존재, 에러 없음)

---

**최종 업데이트**: 2025-12-06
