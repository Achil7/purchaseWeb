# CLAUDE.md - CampManager 프로젝트 종합 가이드

## 프로젝트 개요

**CampManager**는 리뷰 캠페인 관리 시스템입니다. 영업사, 진행자, 브랜드사가 캠페인과 구매자(리뷰어)를 효율적으로 관리하는 웹 애플리케이션입니다.

### 핵심 목적
- 영업사가 캠페인과 품목을 생성
- 진행자가 구매자(리뷰어) 정보를 관리
- 브랜드사가 리뷰 현황을 모니터링
- 총관리자가 전체 시스템을 관리 (진행자 배정, 입금확인, 사용자 대시보드 보기)

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
│   │   ├── models/        # Sequelize 모델
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
    ├── DATABASE_SCHEMA.md
    ├── BACKEND_STRUCTURE.md
    ├── DEPLOYMENT_GUIDE.md
    ├── LOCAL_TESTING.md
    └── IMPLEMENTATION_PROGRESS.md
```

---

## 핵심 개념

### 1. 역할 (Roles)

| 역할 | 영문 코드 | 권한 |
|------|----------|------|
| 총관리자 | `admin` | **모든 기능** (캠페인/품목/구매자 CRUD, 진행자 배정/재배정, 입금 확인, 사용자 등록, 업로드 링크 복사, **컨트롤 타워에서 모든 사용자 대시보드 조회**) |
| 영업사 | `sales` | 캠페인/품목 생성 (자신의 캠페인만), 브랜드 등록 |
| 진행자 | `operator` | 구매자 관리, 이미지 업로드 링크 공유 (배정된 품목만) |
| 브랜드사 | `brand` | 리뷰 현황 조회 (연결된 캠페인만, 5개 컬럼만: 주문번호/구매자/수취인/아이디/리뷰샷) |

**중요**: 각 역할은 자신의 페이지만 접근 가능 (admin은 /admin에서 모든 기능 사용)

### 2. 핵심 엔티티

```
User (사용자)
  ↓
MonthlyBrand (연월브랜드) ← Sales/Operator가 그룹핑에 사용
  ↓
Campaign (캠페인) ← created_by (영업사가 생성)
  ↓
Item (품목) ← upload_link_token 자동 생성
  ↓
ItemSlot (품목 슬롯) ← 일 구매건수별 그룹화
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
- **로그인 후 항상 역할별 기본 페이지로 리다이렉트** (이전 페이지로 돌아가지 않음)

### 2. 캠페인/품목 생성 (영업사)

**캠페인 생성:**
- 캠페인명 (`yymmdd_브랜드명` 형식 자동 생성)
- 설명, 시작일, 종료일, 브랜드사 연결

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
- ItemSlot 자동 생성 (일 구매건수 기준)
- 이미지 업로드 링크: `/upload-slot/{upload_link_token}`

### 3. 진행자 배정 (총관리자)

- Admin 컨트롤 타워에서 품목별로 진행자 드롭다운 선택
- **드롭다운에서 현재 배정된 진행자가 선택된 상태로 표시** + "현재 배정" 칩
- **배정 취소**: 드롭다운에서 "선택 안 함" 선택 시 배정 취소
- **재배정**: 다른 진행자 선택 시 자동 재배정
- **상태 표시 칩**:
  - `배정 완료` (초록): 현재 배정됨
  - `변경 중` (주황): 다른 진행자로 변경 대기
  - `취소 예정` (빨강): 배정 취소 대기
  - `미배정` (회색): 아직 배정 안 됨
- 저장 버튼 클릭 시 API 호출 (신규: POST, 재배정: PUT, 취소: DELETE)

### 4. Admin 컨트롤 타워

**사용자 대시보드 보기 기능:**
- 진행자/영업사/브랜드사 탭에서 사용자 선택
- 오른쪽 패널에 해당 사용자의 실제 대시보드 표시 (embedded 모드)
- **"전체 화면 보기" 버튼** 클릭 시 `/admin/view-operator?userId=xxx` 형식으로 이동
- URL 쿼리 파라미터로 `viewAsUserId` 전달하여 해당 사용자의 데이터 조회

### 5. 이미지 업로드 (구매자)

**업로드 링크**: `/upload-slot/:token` (로그인 불필요)

**기능:**
- 캠페인명, 품목명 표시
- **주문번호 또는 계좌번호 입력** (둘 중 하나 필수)
- **다중 이미지 선택** (최대 10개) 또는 Ctrl+V 붙여넣기
- AWS S3에 저장
- buyer_id와 자동 연결 (**주문번호 우선 매칭, 없으면 계좌번호 매칭**)

**계좌번호 정규화:**
```
"국민 111-1234-123456 홍길동" → "1111234123456"
"신한은행 110-123-456789" → "110123456789"
```

**선 업로드 (Pre-upload) 지원:**
- 구매자가 진행자 등록 전에 이미지 업로드 시 → 임시 Buyer 자동 생성
- 진행자가 같은 계좌번호로 구매자 등록 시 → 기존 이미지 자동 연결, 임시 Buyer 삭제

### 6. 구매자(리뷰어) 추가 (진행자)

**Handsontable 엑셀 시트 방식:**
- 드래그 복사, Ctrl+C/V 지원
- 여러 행 동시 편집 가능
- 저장 버튼 또는 Ctrl+S로 일괄 저장

**메시지 형식 (슬래시 구분):**
```
주문번호/구매자/수취인/아이디/연락처/주소/계좌정보/금액

예시:
8100156654664/김민형/김민형/p4che@naver.com/010-8221-1864/경남 거제시.../부산112-2323-738601 김민지/22800
```

### 7. 입금 확인 (총관리자)

- Admin 대시보드 → 품목 선택 → 입금관리 버튼
- 구매자별 Switch 토글로 입금완료/대기 변경
- **로컬 상태 업데이트** (전체 새로고침 없이 해당 행만 변경, 스크롤 위치 유지)

### 8. 이미지-구매자 1:1 매칭

- **1 구매자 = 1 이미지**: 같은 계좌번호로 5명 등록 후 6개 이미지 업로드 시 → 5개는 각 구매자에 매칭, 1개는 선 업로드(임시 Buyer)
- **선 업로드 표시**: 노란색 배경 + "선 업로드" 칩으로 구분
- **브랜드사에서는 선 업로드 숨김** (정상 구매자만 표시)
- 클릭 시 이미지 확대 팝업

### 9. 파일 업로드 제한

- **이미지당 최대 10MB**
- **프론트엔드 검증**: 업로드 전 파일 크기 체크, 초과 시 파일별 상세 에러 메시지
- **백엔드 제한**: multer fileSize 10MB, express body-parser 20MB

---

## 권한별 접근 제어

### 총관리자 (admin)
- `/admin` 대시보드만 접근
- **컨트롤 타워**: 모든 사용자의 대시보드 조회 가능
- **캠페인 추가** (영업사 기능)
- **품목 추가** (영업사 기능)
- **구매자 추가/수정/삭제** (진행자 기능)
- **업로드 링크 복사** (진행자 기능)
- 전체 품목 조회 및 진행자 배정/재배정
- 입금확인 토글
- 사용자 등록

### 영업사 (sales)
- `/sales` 대시보드만 접근
- 캠페인/품목 CRUD (자신의 것만)
- 브랜드 등록 가능
- 구매자 조회 (수정/삭제 불가)
- 입금명 수정 가능

### 진행자 (operator)
- `/operator` 대시보드만 접근
- 배정된 캠페인/품목만 조회
- 구매자 CRUD (배정된 품목만)
- 이미지 업로드 링크 공유
- 입금명 수정 가능

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
- **Handsontable** - 엑셀 형식 테이블
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
- Host: `your-rds-endpoint.region.rds.amazonaws.com`
- 주요 테이블: users, campaigns, items, item_slots, campaign_operators, buyers, images, monthly_brands, notifications, settings, user_activities, user_memos

### Infrastructure
- **AWS EC2** - 애플리케이션 서버
- **AWS S3** - 이미지 저장 (your-s3-bucket-name 버킷)
- **Docker** - 컨테이너화
- **Nginx** - 리버스 프록시 + SSL

### Deployment
- Docker Hub: `your-dockerhub-username/campmanager:latest`
- 도메인: `your-domain.com`

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
GET    /api/users/control-tower     # 컨트롤 타워용 사용자 목록
POST   /api/users                   # 사용자 생성
PUT    /api/users/:id               # 사용자 수정
DELETE /api/users/:id               # 사용자 비활성화
POST   /api/users/:id/reset-password # 비밀번호 초기화
```

### Items
```
GET    /api/items                   # 전체 품목 (Admin - 진행자 배정용)
GET    /api/items/my-assigned       # 내게 배정된 품목 (Operator)
GET    /api/items/my-monthly-brands # 내게 배정된 연월브랜드 (Operator) - viewAsUserId 지원
GET    /api/items/margin-summary    # 마진 대시보드 데이터 (Admin, Sales)
GET    /api/items/campaign/:id      # 캠페인별 품목
GET    /api/items/token/:token      # 토큰으로 품목 조회 (Public)
POST   /api/items/campaign/:id      # 품목 생성
PUT    /api/items/:id               # 품목 수정
DELETE /api/items/:id               # 품목 삭제
POST   /api/items/:id/operator      # 진행자 배정 (Admin)
PUT    /api/items/:id/operator      # 진행자 재배정 (Admin)
DELETE /api/items/:id/operator/:opId # 배정 해제 (Admin)
PUT    /api/items/:id/expense       # 품목 지출 입력/수정 (Admin only)
GET    /api/items/:id/margin        # 단일 품목 마진 조회 (Admin, Sales)
```

### Item Slots
```
GET    /api/item-slots/item/:itemId           # 품목별 슬롯 조회
GET    /api/item-slots/campaign/:campaignId   # 캠페인별 슬롯 조회
GET    /api/item-slots/operator/campaign/:campaignId # Operator용 캠페인별 슬롯 - viewAsUserId 지원
PUT    /api/item-slots/:id                    # 슬롯 수정
PUT    /api/item-slots/bulk/update            # 다중 슬롯 수정
DELETE /api/item-slots/:id                    # 슬롯 삭제
```

### Monthly Brands
```
GET    /api/monthly-brands          # 연월브랜드 목록 - viewAsUserId 지원
POST   /api/monthly-brands          # 연월브랜드 생성
PUT    /api/monthly-brands/:id      # 연월브랜드 수정
DELETE /api/monthly-brands/:id      # 연월브랜드 삭제
```

### Buyers
```
GET    /api/buyers/item/:itemId       # 구매자 목록
POST   /api/buyers/item/:itemId       # 구매자 생성
POST   /api/buyers/item/:itemId/parse # 슬래시 파싱 후 생성
POST   /api/buyers/item/:itemId/bulk  # 다중 구매자 일괄 추가
PUT    /api/buyers/:id                # 구매자 수정
DELETE /api/buyers/:id                # 구매자 삭제
PATCH  /api/buyers/:id/payment        # 입금확인 토글
```

### Images
```
GET    /api/images/item/:itemId     # 품목 이미지 목록
POST   /api/images/upload/:token    # 다중 이미지 업로드 (Public, 최대 10개)
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
| 총관리자 | `admin` | `your_password` | `/admin` |
| 영업사 | `sales` | `your_password` | `/sales` |
| 진행자 | `operator` | `your_password` | `/operator` |
| 브랜드사 | `brand` | `your_password` | `/brand` |

> **Note**: 실제 배포 시 seeder 파일에서 계정 정보를 변경하세요.

---

## 현재 구현 상태 (2026-01-10)

### 완료된 기능
- [x] JWT 인증 시스템
- [x] 역할 기반 라우트 보호
- [x] 캠페인/품목/구매자 CRUD
- [x] 슬래시 파싱 구매자 추가
- [x] 진행자 배정 및 재배정 (경고 다이얼로그 포함)
- [x] 입금확인 토글 (Admin)
- [x] AWS S3 이미지 업로드
- [x] 사용자 등록 (Admin)
- [x] 프로필 수정
- [x] Docker 배포
- [x] SSL 인증서 (Let's Encrypt)
- [x] CSP 설정 (S3 이미지 허용)
- [x] **구매자 매칭** (주문번호 우선 매칭, 계좌번호 보조 매칭)
- [x] **다중 이미지 업로드** (최대 10개)
- [x] **다중 구매자 일괄 추가** (여러 줄 입력)
- [x] **선 업로드 지원** (임시 Buyer → 진행자 등록 시 자동 병합)
- [x] **총관리자 권한 확장** (영업사/진행자/브랜드사 모든 기능 접근)

### 2025-12-20 추가 수정 (Phase 4)
- [x] **영업사 캠페인 상태 옵션** - 신규/보류 추가, 기본값을 '신규'로 변경
- [x] **영업사 브랜드 등록 기능** - 영업사가 직접 브랜드 추가 가능 (자동으로 해당 영업사에 할당)
- [x] **Admin 진행자 재배정** - 이미 배정된 품목의 진행자를 드롭다운으로 변경 가능
- [x] **Admin 통합 수정 레이아웃** - 그리드 비율 5:7로 조정, 구분선 제거하여 빈공간 감소
- [x] **Operator 테이블 정렬** - 캠페인/품목 테이블에 컬럼별 정렬 기능 추가
- [x] **Operator 배정상태 표시** - 당일 배정=신규, 다음날=진행 + 구매자 없으면 경고 아이콘

### 2025-12-29 추가 수정 (Phase 5)
- [x] **Admin 컨트롤 타워 개선**
  - 사용자 선택 시 embedded 대시보드 표시
  - "전체 화면 보기" 버튼으로 별도 페이지에서 해당 사용자 대시보드 조회
  - URL 쿼리 파라미터 `?userId=xxx`로 viewAsUserId 전달
- [x] **Admin View 라우트 개선**
  - `/admin/view-operator?userId=xxx` - 특정 진행자 대시보드 조회
  - `/admin/view-sales?userId=xxx` - 특정 영업사 대시보드 조회
  - `/admin/view-brand?userId=xxx` - 특정 브랜드사 대시보드 조회
- [x] **Handsontable 시트 버그 수정**
  - useEffect 의존성 `tableData` → `slots`로 변경하여 렌더링 에러 방지
- [x] **Sales/Operator 시트 스크롤 개선**
  - 페이지 전체 스크롤 제거 → 시트에만 고정 종횡 스크롤
  - Layout: `overflow: 'hidden'` + flex 레이아웃
  - ItemSheet: `height: "100%"` + flex 컨테이너

### 2025-12-31 추가 수정 (Phase 6)
- [x] **Admin viewAsUserId 완전 지원**
  - SalesLayout에서 SalesBrandCreateDialog, SalesMonthlyBrandDialog에 viewAsUserId 전달
  - Admin이 영업사 대신 브랜드/연월브랜드 생성 시 해당 영업사 소유로 생성
- [x] **Handsontable 필터 버튼 UI 개선**
  - 필터 버튼이 텍스트와 겹치지 않도록 오른쪽 끝에 배치
  - CSS: `position: absolute; right: 2px` 적용
  - OperatorItemSheet, SalesItemSheet 동일 적용
- [x] **Operator 컬럼 너비 조정**
  - 구매옵션: 80 → 100
  - 희망유입키워드: 100 → 130
  - 예상구매자: 80 → 100
  - 구매자: 70 → 90
  - 리뷰작성: 60 → 80
- [x] **Shift+스크롤 횡스크롤 전용**
  - 기존: Shift+휠 시 종횡 동시 이동
  - 변경: Shift+휠 시 횡스크롤만 이동
  - capture phase 이벤트 처리로 정확한 제어
- [x] **사용자별 컬럼 너비 localStorage 저장**
  - 역할별 키: `operator_itemsheet_column_widths`, `sales_itemsheet_column_widths`
  - 사용자가 컬럼 너비 조정 시 자동 저장, 재접속 시 복원

### 2026-01-03~04 추가 수정 (Phase 7)
- [x] **SalesItemSheet 컬럼 추가**
  - 품목 추가 시 입력한 데이터가 시트에 표시되도록 3개 컬럼 추가
  - 총구매건수 (`total_purchase_count`) - Item에서 가져옴
  - 일구매건수 (`daily_purchase_count`) - Item에서 가져옴
  - 상품URL (`product_url`) - Item에서 가져옴
  - 특이사항에 통합되는 3개 필드(리뷰가이드, 상품가격, 출고마감시간)는 제외
- [x] **Handsontable 필터 기능 개선**
  - `beforeFilter` → `afterFilter` 변경으로 필터 체크박스 상태 유지
  - `hiddenRows` 플러그인으로 실제 행 숨김 처리
  - 그룹 삭제 시 필터 상태 및 hiddenRows 초기화
- [x] **일차별(day_group) 진행자 배정 버그 수정**
  - **문제**: 같은 진행자를 다른 일차(1일차, 2일차 등)에 배정할 수 없었음
  - **원인**: DB의 `unique_campaign_operator` 제약조건이 `day_group`을 포함하지 않음
  - **해결**: 마이그레이션 `20260103000001-fix-campaign-operator-unique-index.js`로 제약조건 수정
    - 기존 `unique_campaign_operator(campaign_id, item_id, operator_id)` 제거
    - 신규 `unique_campaign_operator_daygroup(campaign_id, item_id, day_group, operator_id)` 추가
  - `itemController.js`에서 null day_group 비교 시 `{ [Op.is]: null }` 사용
- [x] **그룹 삭제 404 에러 수정**
  - `deleteSlotsByGroup`에서 삭제할 항목이 없어도 200 success 반환
- [x] **슬래시(/) 파싱 붙여넣기 기능** (계획됨)
  - 진행자가 주문번호 컬럼에 슬래시 구분 데이터 붙여넣기 시 자동 파싱
  - Handsontable `beforePaste` 훅 사용
  - 8개 컬럼에 자동 분배: 주문번호/구매자/수취인/아이디/연락처/주소/계좌번호/금액

### 2026-01-05 추가 수정 (Phase 8)
- [x] **Admin 컨트롤 타워 제품 상세 다이얼로그**
  - 진행자 배정 탭에서 제품명 클릭 시 상세 정보 팝업
  - 기본 정보, 키워드/구매 정보, 출고 정보, 상품 URL, 리뷰가이드, 비고 표시
  - 수정 파일: `AdminControlTower.js`
- [x] **Brand 시트 뷰 403 에러 수정**
  - `/api/item-slots/campaign/:campaignId` 라우트에 `brand` 권한 추가
  - 브랜드사가 캠페인 클릭 시 Handsontable 시트 정상 표시
  - 수정 파일: `backend/src/routes/itemSlots.js`
- [x] **미사용 파일 정리**
  - 삭제: `AdminDashboard.js`, `SharedCampaignTable.js`, `OperatorHome.js`, `SalesDashboard.js`, `BrandDashboard.js`

### 2026-01-08 추가 수정 (Phase 10)
- [x] **일 구매건수 슬래시 구분 지원**
  - `daily_purchase_count` 컬럼 타입: `INTEGER` → `TEXT` (길이 제한 없음)
  - "6/6", "2/2/2/.../2" 같은 슬래시 구분 값 저장 가능 (100건을 2건씩 50일로 나눠도 OK)
  - 마이그레이션: `20260108000001-change-daily-purchase-count-to-string.js`
- [x] **업로드 페이지 주문번호 입력 필드 추가**
  - 주문번호 또는 계좌번호 둘 중 하나 필수
  - 구매자 매칭 우선순위: 주문번호 > 계좌번호
  - 수정 파일: `UploadPage.js`, `imageService.js`, `imageController.js`

### 2026-01-06 추가 수정 (Phase 9)
- [x] **품목별 매출/지출/마진 계산 기능**
  - 영업사 품목 등록 시 판매단가, 택배단가 입력 → 매출 자동 계산
  - Admin이 항목별 지출 입력 (제품비, 택배비, 리뷰비용, 기타비용)
  - 마진 = 총매출(VAT포함) - 총지출, 마진율 자동 계산
  - 공급가 + 부가세포함가(×1.1) 둘 다 표시
  - 별도 마진 대시보드에서 조회 (`/admin/margin`, `/sales/margin`)
  - Admin: 지출 입력 + 마진 조회 가능
  - Sales: 자신의 캠페인 마진만 조회 가능 (지출 입력 불가)
  - 신규 API: `GET /api/items/margin-summary`, `PUT /api/items/:id/expense`, `GET /api/items/:id/margin`
  - 신규 컴포넌트: `AdminMarginDashboard.js`, `AdminItemExpenseDialog.js`, `SalesMarginDashboard.js`
  - DB 마이그레이션: `20260106000001-add-revenue-expense-to-items.js` (7개 필드 추가)
- [x] **브랜드사 송장번호 컬럼 추가**
  - 테이블 뷰 및 갤러리 뷰 이미지 상세에 송장번호 표시
  - 수정 파일: `BrandBuyerTable.js`

### 2026-01-09 추가 수정 (Phase 11)
- [x] **Operator 시트 UI 개선**
  - 필터링 버튼 호버 시에만 표시 (엑셀처럼)
  - 접기 컬럼 너비 축소 (30px → 20px)
  - 제품 컬럼 순서 변경: 접기, 날짜, 순번, 제품명, 옵션, 플랫폼, 출고, 키워드, 가격, 총건수, 일건수, 택배, URL, 특이사항
- [x] **Operator 시트 건수/금액 계산 버그 수정**
  - 접기/펼치기 시에도 전체 건수 및 금액 합계가 변하지 않도록 수정
  - `tableData` 대신 원본 `slots` 데이터 기준으로 계산
- [x] **Brand 퍼센트 계산 수정**
  - 기존: `total_purchase_count` (목표 건수) 대비 리뷰 완료
  - 변경: **전체 구매자 수** (실제 등록된 구매자) 대비 리뷰 완료
  - 수정 파일: `BrandLayout.js`
- [x] **Admin 상단바 간소화**
  - "전체 제품 조회" 버튼 삭제
  - 수정 파일: `AdminLayout.js`
- [x] **Admin 컨트롤 타워 구조 변경 - 연월브랜드 > 캠페인 > 배정**
  - 기존: 모든 제품을 한 페이지에 나열 → 제품별 진행자 배정
  - 변경: 연월브랜드 → 캠페인 목록 → 캠페인 클릭 시 상세 배정 페이지
  - 신규 컴포넌트: `AdminCampaignAssignment.js` (캠페인별 진행자 배정)
  - 신규 라우트: `/admin/campaigns/:campaignId/assignment`
  - 신규 API: `GET /api/monthly-brands/all` (Admin 전용 - 모든 연월브랜드 조회)
  - 수정 파일: `AdminControlTower.js`, `App.js`, `monthlyBrandService.js`, `backend/src/routes/monthlyBrands.js`
- [x] **중복 주문번호 빨간색 하이라이팅 버그 수정**
  - 원인: CSS `!important`가 inline 스타일보다 우선순위가 높아서 무시됨
  - 해결: `td.classList.add('duplicate-order')` 클래스 방식으로 변경
  - `.duplicate-order { backgroundColor: '#ffcdd2 !important' }` CSS 추가
  - 수정 파일: `SalesItemSheet.js`, `OperatorItemSheet.js`

### 2026-01-10 추가 수정 (Phase 12)
- [x] **URL/플랫폼 하이퍼링크 버그 수정**
  - 문제: 하이퍼링크가 URL(col11)이 아닌 플랫폼(col12)에 적용됨
  - 해결: `col12` → `col11`로 수정
  - 수정 파일: `SalesItemSheet.js`, `OperatorItemSheet.js`
- [x] **Brand 시트 제품 테이블 확장**
  - 기존 8개 컬럼 → 14개 컬럼 (영업사/진행자와 동일한 구조)
  - 제품 테이블: 접기, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배대행, URL, (빈칸), 특이사항
  - 구매자 테이블: 빈칸, 주문번호, 구매자, 수취인, 아이디, 금액, 송장번호, 리뷰샷
  - 플랫폼 컬럼에 파란색 볼드 스타일 적용
  - 수정 파일: `BrandItemSheet.js`
- [x] **Brand 페이지 스크롤 개선**
  - 페이지 전체 스크롤 제거 → 시트 내부에서만 스크롤
  - `height: '100vh'`, `overflow: 'hidden'` 설정
  - 수정 파일: `BrandLayout.js`, `BrandItemSheet.js`
- [x] **품목 추가 다이얼로그 플랫폼 예시 추가**
  - samplePlaceholder에 `플랫폼 : 쿠팡` 예시 추가
  - 안내 문구: `※ 플랫폼: 쿠팡, 네이버, 11번가, 지마켓, 옥션, 티몬, 위메프 등`
  - 수정 파일: `SalesAddItemDialog.js`
- [x] **API Item attributes 필드 추가**
  - `getSlotsByCampaign`, `getSlotsByCampaignForOperator`에 `date`, `display_order` 필드 추가
  - 수정 파일: `backend/src/controllers/itemSlotController.js`

### 역할별 페이지 격리
- admin은 /admin만 접근 가능 (단, API는 모든 역할의 기능 접근 가능)
- sales는 /sales만 접근 가능
- operator는 /operator만 접근 가능
- brand는 /brand만 접근 가능

---

## 관련 문서

- [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) - DB 스키마 상세
- [BACKEND_STRUCTURE.md](docs/BACKEND_STRUCTURE.md) - API 엔드포인트 및 구조
- [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) - EC2 배포 가이드
- [LOCAL_TESTING.md](docs/LOCAL_TESTING.md) - 로컬 테스트 방법
- [IMPLEMENTATION_PROGRESS.md](docs/IMPLEMENTATION_PROGRESS.md) - 구현 진행 상황

---

**최종 업데이트**: 2026-01-10
