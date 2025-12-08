# CLAUDE.md - CampManager 프로젝트 종합 가이드

## 프로젝트 개요

**CampManager**는 리뷰 캠페인 관리 시스템입니다. 영업사, 진행자, 브랜드사가 캠페인과 구매자(리뷰어)를 효율적으로 관리하는 웹 애플리케이션입니다.

### 핵심 목적
- 영업사가 캠페인과 품목을 생성
- 진행자가 구매자(리뷰어) 정보를 관리
- 브랜드사가 리뷰 현황을 모니터링
- 총관리자가 전체 시스템을 관리 (진행자 배정, 입금확인)

---

## 프로젝트 구조

```
purchaseweb/
├── frontend/               # React 프론트엔드
│   ├── src/
│   │   ├── components/    # 역할별 대시보드
│   │   │   ├── admin/     # 총관리자 대시보드
│   │   │   ├── sales/     # 영업사 대시보드
│   │   │   ├── operator/  # 진행자 대시보드
│   │   │   ├── brand/     # 브랜드사 대시보드
│   │   │   ├── upload/    # 이미지 업로드 페이지 (Public)
│   │   │   └── common/    # 공통 컴포넌트
│   │   ├── services/      # API 서비스 레이어
│   │   ├── context/       # React Context (AuthContext)
│   │   └── App.js         # 라우팅
│   └── package.json
│
├── backend/                # Node.js + Express API
│   ├── src/
│   │   ├── models/        # Sequelize 모델 (6개)
│   │   ├── controllers/   # API 컨트롤러
│   │   ├── routes/        # API 라우트
│   │   ├── middleware/    # 인증/권한 미들웨어
│   │   ├── config/        # DB, S3 설정
│   │   └── app.js
│   ├── migrations/        # DB 마이그레이션 파일
│   ├── seeders/           # 초기 데이터
│   └── server.js          # 서버 진입점
│
├── deploy/                 # 배포 관련 파일
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── deploy.sh
│
└── docs/                   # 프로젝트 문서
    ├── CLAUDE.md          # 이 파일
    ├── DATABASE_SCHEMA.md
    ├── BACKEND_STRUCTURE.md
    ├── DEPLOYMENT_GUIDE.md
    └── IMPLEMENTATION_PROGRESS.md
```

---

## 핵심 개념

### 1. 역할 (Roles)

| 역할 | 영문 코드 | 권한 |
|------|----------|------|
| 총관리자 | `admin` | 진행자 배정/재배정, 입금 확인 토글, 사용자 등록 |
| 영업사 | `sales` | 캠페인/품목 생성 (자신의 캠페인만) |
| 진행자 | `operator` | 구매자 관리, 이미지 업로드 링크 공유 (배정된 품목만) |
| 브랜드사 | `brand` | 리뷰 현황 조회 (연결된 캠페인만, 5개 컬럼만: 주문번호/구매자/수취인/아이디/리뷰샷) |

**중요**: 각 역할은 자신의 페이지만 접근 가능 (admin도 /sales, /operator, /brand 접근 불가)

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
Image (리뷰 이미지) ← AWS S3 저장, buyer_id로 연결

CampaignOperator (품목-진행자 매핑) ← 총관리자가 배정/재배정
```

---

## 주요 워크플로우

### 1. 로그인 및 인증
- JWT 기반 인증 (7일 유효)
- 역할 기반 라우트 보호 (ProtectedRoute)
- 로그아웃 시 세션 완전 정리

### 2. 캠페인/품목 생성 (영업사)

**캠페인 생성:**
- 캠페인명, 설명, 시작일, 종료일, 브랜드사 연결

**품목 추가:**
```
- 제품명
- 미출고/실출고
- 희망 유입 키워드
- 총 구매 건수 / 일 구매 건수
- 상품 URL, 구매 옵션, 가격
- 출고 마감 시간
- 리뷰가이드 및 소구점
- 택배대행 Y/N
- 비고
```

**품목 생성 시 자동 처리:**
- `upload_link_token` (UUID) 자동 생성
- 이미지 업로드 링크: `/upload/{upload_link_token}`

### 3. 진행자 배정 (총관리자)

- Admin 대시보드에서 품목별로 진행자 드롭다운 선택
- **재배정 기능**: "변경" 버튼 클릭 → 경고 다이얼로그 → 새 진행자 선택
- 저장 버튼 클릭 시 API 호출 (신규: POST, 재배정: PUT)

### 4. 이미지 업로드 (구매자)

**업로드 링크**: `/upload/:token` (로그인 불필요)

**기능:**
- 캠페인명, 품목명 표시
- 주문번호 입력 (필수)
- 이미지 선택 또는 Ctrl+V 붙여넣기
- AWS S3에 저장
- buyer_id와 자동 연결 (주문번호 매칭)

### 5. 구매자(리뷰어) 추가 (진행자)

**메시지 형식 (슬래시 구분):**
```
주문번호/구매자/수취인/아이디/연락처/주소/계좌정보/금액

예시:
8100156654664/김민형/김민형/p4che@naver.com/010-8221-1864/경남 거제시.../부산112-2323-738601 김민지/22800
```

### 6. 입금 확인 (총관리자)

- Admin 대시보드 → 품목 선택 → 입금관리 버튼
- 구매자별 Switch 토글로 입금완료/대기 변경
- 실시간 API 호출로 DB 반영

---

## 권한별 접근 제어

### 총관리자 (admin)
- `/admin` 대시보드만 접근
- 전체 품목 조회 및 진행자 배정/재배정
- 입금확인 토글
- 사용자 등록

### 영업사 (sales)
- `/sales` 대시보드만 접근
- 캠페인/품목 CRUD (자신의 것만)
- 구매자 조회 (수정/삭제 불가)

### 진행자 (operator)
- `/operator` 대시보드만 접근
- 배정된 캠페인/품목만 조회
- 구매자 CRUD (배정된 품목만)
- 이미지 업로드 링크 공유

### 브랜드사 (brand)
- `/brand` 대시보드만 접근
- 연결된 캠페인의 구매자 조회
- 제한된 컬럼만 표시 (주소, 연락처, 계좌정보 제외)

---

## 기술 스택

### Frontend
- **React 19.2.0**
- **Material-UI 7.3.5**
- **React Router DOM 7.9.6**
- **Axios** - HTTP 클라이언트

### Backend
- **Node.js 18+**
- **Express.js** - REST API
- **Sequelize** - PostgreSQL ORM
- **bcrypt** - 비밀번호 해싱
- **JWT** - 인증
- **AWS SDK v3** - S3 업로드
- **multer** - 파일 업로드 처리
- **helmet** - 보안 헤더 (CSP 포함)

### Database
- **PostgreSQL** (AWS RDS)
- Host: `serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com`
- 6개 테이블: users, campaigns, items, campaign_operators, buyers, images

### Infrastructure
- **AWS EC2** - 애플리케이션 서버
- **AWS S3** - 이미지 저장 (kwad-image 버킷)
- **Docker** - 컨테이너화
- **Nginx** - 리버스 프록시 + SSL

### Deployment
- Docker Hub: `achil7/campmanager:latest`
- 도메인: `kwad.co.kr`

---

## API 엔드포인트

### Auth
```
POST   /api/auth/login              # 로그인
POST   /api/auth/logout             # 로그아웃
GET    /api/auth/me                 # 현재 사용자 정보
POST   /api/auth/verify-password    # 비밀번호 검증
PUT    /api/auth/profile            # 프로필 수정
```

### Users (Admin)
```
GET    /api/users                   # 사용자 목록
GET    /api/users?role=operator     # 역할별 조회
POST   /api/users                   # 사용자 생성
PUT    /api/users/:id               # 사용자 수정
DELETE /api/users/:id               # 사용자 비활성화
```

### Campaigns
```
GET    /api/campaigns               # 캠페인 목록 (역할별 필터링)
POST   /api/campaigns               # 캠페인 생성
GET    /api/campaigns/:id           # 캠페인 상세
PUT    /api/campaigns/:id           # 캠페인 수정
DELETE /api/campaigns/:id           # 캠페인 삭제
```

### Items
```
GET    /api/items                   # 전체 품목 (Admin - 진행자 배정용)
GET    /api/items/my-assigned       # 내게 배정된 품목 (Operator)
GET    /api/items/campaign/:id      # 캠페인별 품목
GET    /api/items/token/:token      # 토큰으로 품목 조회 (Public)
POST   /api/items/campaign/:id      # 품목 생성
PUT    /api/items/:id               # 품목 수정
DELETE /api/items/:id               # 품목 삭제
POST   /api/items/:id/operator      # 진행자 배정 (Admin)
PUT    /api/items/:id/operator      # 진행자 재배정 (Admin)
DELETE /api/items/:id/operator/:opId # 배정 해제 (Admin)
```

### Buyers
```
GET    /api/buyers/item/:itemId     # 구매자 목록
POST   /api/buyers/item/:itemId     # 구매자 생성
POST   /api/buyers/item/:itemId/parse # 슬래시 파싱 후 생성
PUT    /api/buyers/:id              # 구매자 수정
DELETE /api/buyers/:id              # 구매자 삭제
PATCH  /api/buyers/:id/payment      # 입금확인 토글
```

### Images
```
GET    /api/images/item/:itemId     # 품목 이미지 목록
POST   /api/images/upload/:token    # 이미지 업로드 (Public)
DELETE /api/images/:id              # 이미지 삭제
```

---

## 배포

### Docker로 배포
```bash
# 1. 로컬에서 빌드 및 푸시
make deploy

# 2. EC2 서버에서 실행
docker compose pull
docker compose up -d --force-recreate

# 3. (필요시) 마이그레이션 실행
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:migrate"
```

---

## 계정 정보

### 마스터 계정 (역할별)
| 역할 | Username | Password | 리다이렉트 |
|------|----------|----------|------------|
| 총관리자 | `achiladmin` | `rkddntkfkd94!` | `/admin` |
| 영업사 | `achilsales` | `rkddntkfkd94!` | `/sales` |
| 진행자 | `achiloperator` | `rkddntkfkd94!` | `/operator` |
| 브랜드사 | `achilbrand` | `rkddntkfkd94!` | `/brand` |

---

## 현재 구현 상태 (2025-12-09)

### 완료된 기능
- [x] JWT 인증 시스템
- [x] 역할 기반 라우트 보호
- [x] 캠페인/품목/구매자 CRUD
- [x] 슬래시 파싱 구매자 추가
- [x] 진행자 배정 및 재배정 (경고 다이얼로그 포함)
- [x] 입금확인 토글 (Admin)
- [x] AWS S3 이미지 업로드
- [x] 이미지-구매자 연결 (주문번호 매칭)
- [x] 사용자 등록 (Admin)
- [x] 프로필 수정
- [x] Docker 배포
- [x] SSL 인증서 (Let's Encrypt)
- [x] CSP 설정 (S3 이미지 허용)

### 역할별 페이지 격리
- admin은 /admin만 접근 가능
- sales는 /sales만 접근 가능
- operator는 /operator만 접근 가능
- brand는 /brand만 접근 가능

---

## 관련 문서

- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - DB 스키마 상세
- [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md) - API 엔드포인트 및 구조
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - EC2 배포 가이드
- [LOCAL_TESTING.md](LOCAL_TESTING.md) - 로컬 테스트 방법
- [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md) - 구현 진행 상황

---

**최종 업데이트**: 2025-12-09
