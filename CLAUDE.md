# CLAUDE.md - CampManager 프로젝트 종합 가이드

## 프로젝트 개요

**CampManager**는 리뷰 캠페인 관리 시스템입니다. 영업사, 진행자, 브랜드사가 캠페인과 구매자(리뷰어)를 효율적으로 관리하는 웹 애플리케이션입니다.

### 핵심 목적
- 영업사가 연월브랜드와 캠페인, 품목을 생성
- 진행자가 구매자(리뷰어) 정보를 관리
- 브랜드사가 리뷰 현황을 모니터링
- 총관리자가 전체 시스템을 관리 (진행자 배정/재배정, 입금확인, 사용자 대시보드 보기, 캠페인 영업사 변경, 마진 관리)

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
│   │   ├── utils/         # 유틸리티 함수
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
    └── LOCAL_TESTING.md
```

---

## 핵심 개념

### 1. 역할 (Roles)

| 역할 | 영문 코드 | 권한 |
|------|----------|------|
| 총관리자 | `admin` | **모든 기능** (캠페인/품목/구매자 CRUD, 진행자 배정/재배정, 입금 확인, 사용자 등록/관리, 업로드 링크 복사, 캠페인 영업사 변경, 마진 관리, **컨트롤 타워에서 모든 사용자 대시보드 조회**) |
| 영업사 | `sales` | 연월브랜드/캠페인/품목 생성 (자신의 것만), 브랜드 등록, 구매자 조회 (수정/삭제 불가), 마진 조회 (자신의 캠페인만) |
| 진행자 | `operator` | 배정된 품목의 구매자 CRUD, 이미지 업로드 링크 공유, 메모장 기능, 입금명 수정 가능 |
| 브랜드사 | `brand` | 연결된 캠페인의 리뷰 현황 조회 (제한된 컬럼: 주문번호/구매자/수취인/아이디/주소/금액/송장번호/리뷰샷 - 연락처, 계좌 제외) |

**중요**: 각 역할은 자신의 페이지만 접근 가능 (admin은 /admin에서 모든 역할의 기능 API 접근 가능)

### 2. 핵심 엔티티

```
User (사용자)
  ↓
MonthlyBrand (연월브랜드) ← Sales가 생성, Brand 연결
  ↓
Campaign (캠페인) ← created_by (영업사가 생성), monthly_brand_id 연결
  ↓
Item (품목) ← upload_link_token 자동 생성, revenue/expense 필드 (마진 계산용)
  ↓
ItemSlot (품목 슬롯) ← 일 구매건수별 그룹화, day_group, upload_link_token, **day_group별 독립 제품 정보**
  ↓
Buyer (구매자/리뷰어) ← 슬래시(/) 구분 데이터로 추가, is_temporary (선 업로드용)
  ↓
Image (리뷰 이미지) ← AWS S3 저장, buyer_id로 연결

CampaignOperator (품목-진행자 매핑) ← 총관리자가 배정/재배정, unique(campaign_id, item_id, day_group, operator_id)
```

### 3. day_group별 독립 제품 정보

**일마감(splitDayGroup) 시 제품 정보 독립 저장:**
- 각 day_group은 자체 제품 정보를 ItemSlot에 저장
- 일마감 시 현재 day_group의 제품 정보가 새 day_group 슬롯에 복사됨
- day_group별 제품 정보 수정 시 다른 day_group에 영향 없음 (완전 독립)

**ItemSlot에 저장되는 제품 정보 필드:**
- `product_name` - 제품명
- `purchase_option` - 구매 옵션
- `keyword` - 키워드
- `product_price` - 가격
- `notes` - 특이사항
- `platform` - 플랫폼
- `shipping_type` - 출고 유형
- `total_purchase_count` - 총 구매건수
- `daily_purchase_count` - 일 구매건수
- `courier_service_yn` - 택배대행 여부
- `product_url` - 상품 URL

**데이터 우선순위:**
1. 슬롯에 값이 있으면 → 슬롯 값 사용
2. 슬롯에 값이 없으면 → Item 테이블 값 사용 (하위 호환성)

---

## 주요 워크플로우

### 1. 로그인 및 인증
- JWT 기반 인증 (7일 유효)
- 역할 기반 라우트 보호 (ProtectedRoute)
- 로그아웃 시 세션 완전 정리
- **로그인 후 항상 역할별 기본 페이지로 리다이렉트**:
  - admin → `/admin` (컨트롤 타워)
  - sales → `/sales`
  - operator → `/operator`
  - brand → `/brand`

### 2. 연월브랜드/캠페인/품목 생성 (영업사)

**연월브랜드 생성:**
- 이름 (예: "2026-01 브랜드명")
- 브랜드사 선택 (User role='brand')
- 연월 (year_month), 설명, 상태

**캠페인 생성:**
- 캠페인명
- 연월브랜드 선택
- 등록일 (registered_at)
- 상태 (신규/진행/완료/취소/보류)
- 브랜드사 자동 연결 (연월브랜드의 brand_id 상속)

**품목 추가:**
```
- 제품명 (product_name)
- 플랫폼 (platform) - 쿠팡, 네이버, 11번가, 지마켓, 옥션, 티몬, 위메프 등
- 미출고/실출고 (shipping_type)
- 희망 유입 키워드 (keyword)
- 총 구매 건수 (total_purchase_count)
- 일 구매 건수 (daily_purchase_count) - TEXT 타입으로 슬래시 구분 가능 (예: "6/6" 또는 "2/2/2/2")
- 구매 옵션 (purchase_option)
- 상품 가격 (product_price)
- 상품 URL (product_url)
- 출고 마감 시간 (shipping_deadline)
- 리뷰가이드 (review_guide)
- 소구점 (appeal_point)
- 택배대행 Y/N (courier_service_yn)
- 비고 (notes)
- 판매단가 (sale_unit_price) - 마진 계산용
- 택배단가 (delivery_unit_price) - 마진 계산용
```

**품목 생성 시 자동 처리:**
- `upload_link_token` (UUID) 자동 생성
- ItemSlot 자동 생성 (일 구매건수 기준으로 day_group 분할)
- 각 슬롯에 고유한 `upload_link_token` 할당
- 이미지 업로드 링크: `/upload-slot/{upload_link_token}`

### 3. 진행자 배정 (총관리자)

**Admin 컨트롤 타워 → 진행자 배정:**
- 연월브랜드 목록 → 캠페인 목록 → "배정하기" 버튼 클릭
- `/admin/campaigns/:campaignId/assignment` 페이지로 이동
- 품목별/일차별(day_group) 진행자 드롭다운 선택
- **같은 진행자를 다른 일차에 중복 배정 가능** (unique 제약: campaign_id, item_id, day_group, operator_id)
- **배정 상태 표시**:
  - `배정 완료` (초록): 현재 배정됨
  - `변경 중` (주황): 다른 진행자로 변경 대기
  - `취소 예정` (빨강): 배정 취소 대기
  - `미배정` (회색): 아직 배정 안 됨
- 저장 버튼 클릭 시 API 호출 (신규: POST `/api/items/:id/operator`, 재배정: PUT, 취소: DELETE)

### 4. Admin 컨트롤 타워 구조

**사용자 대시보드 보기 기능:**
1. **컨트롤 타워 메인** (`/admin` 또는 `/admin/control-tower`):
   - 좌측: 사용자 목록 (진행자/영업사/브랜드사 탭)
   - 우측: 선택된 사용자의 embedded 대시보드 표시
   - **embedded 모드**: `isEmbedded=true` prop 전달, 캠페인 클릭 시 즉시 시트 표시 (네비게이션 없음)
   - 사이드바 접기/펼치기 가능

2. **별도 페이지 보기**:
   - `/admin/view-operator?userId=xxx` - 특정 진행자 대시보드 전체 화면
   - `/admin/view-sales?userId=xxx` - 특정 영업사 대시보드 전체 화면
   - `/admin/view-brand?userId=xxx` - 특정 브랜드사 대시보드 전체 화면
   - URL 쿼리 파라미터 `viewAsUserId`로 해당 사용자의 데이터 조회

3. **진행자 배정 탭**:
   - 연월브랜드 → 캠페인 목록 (테이블 형식)
   - 캠페인 행의 "배정하기" 버튼 → 배정 페이지로 이동
   - 캠페인 행의 영업사명 옆에 "영업사 변경" 버튼 (SwapHorizIcon)
   - 연월브랜드/캠페인 삭제 버튼 (cascading delete)

### 5. 이미지 업로드 (구매자)

**업로드 링크**: `/upload-slot/:token` (로그인 불필요)

**업로드 흐름 (이름 검색 방식):**
1. **이름 입력** → 검색 버튼 클릭
2. **검색 결과** 테이블에서 업로드할 주문 선택 (체크박스, 복수 선택 가능)
3. **주문별 이미지 업로드** 영역에서 각 주문에 이미지 추가
   - 파일 선택 버튼 클릭
   - Ctrl+V 붙여넣기 (포커스된 영역에 적용)
   - 드래그 앤 드롭
4. **업로드** 버튼 클릭 → AWS S3 저장

**기능:**
- 캠페인명, 품목명, 날짜 표시
- 이미지당 최대 10MB
- 업로드 완료된 주문은 비활성화 표시 ("업로드 완료")
- buyer_id 직접 매칭 (선택한 주문의 ID 사용)

**검색 범위:**
- 동일 슬롯 그룹 (item_id + day_group) 내 구매자만 검색
- buyer_name 또는 recipient_name에 검색어 포함된 경우 매칭

### 6. 구매자(리뷰어) 추가 (진행자)

**Handsontable 엑셀 시트 방식:**
- 드래그 복사, Ctrl+C/V 지원
- 여러 행 동시 편집 가능
- 저장 버튼 또는 Ctrl+S로 일괄 저장
- **슬래시(/) 파싱 붙여넣기**: 주문번호 컬럼에 슬래시 구분 데이터 붙여넣기 시 자동으로 8개 컬럼에 분배

**메시지 형식 (슬래시 구분):**
```
주문번호/구매자/수취인/아이디/연락처/주소/계좌정보/금액

예시:
8100156654664/김민형/김민형/p4che@naver.com/010-8221-1864/경남 거제시.../부산112-2323-738601 김민지/22800
```

**컬럼:**
1. 빈칸 (접기/펼치기 토글)
2. 주문번호 (order_number) - 중복 시 빨간색 배경
3. 구매자 (buyer_name)
4. 수취인 (recipient_name)
5. 아이디 (user_id)
6. 연락처 (phone_number)
7. 주소 (address)
8. 계좌번호 (bank_account)
9. 금액 (amount)
10. 송장번호 (tracking_number)
11. 리뷰샷 (review_image) - 클릭 시 확대 팝업

### 7. 입금 확인 (총관리자)

- Admin 대시보드 → 일별 입금 관리 (`/admin/daily-payments`)
- 구매자별 Switch 토글로 입금완료/대기 변경
- **로컬 상태 업데이트** (전체 새로고침 없이 해당 행만 변경, 스크롤 위치 유지)
- API: `PATCH /api/buyers/:id/payment`

### 8. 이미지-구매자 1:1 매칭

- **1 구매자 = 1 이미지**: 같은 계좌번호로 5명 등록 후 6개 이미지 업로드 시 → 5개는 각 구매자에 매칭, 1개는 선 업로드(임시 Buyer)
- **선 업로드 표시**: 노란색 배경 + "선 업로드" 칩으로 구분
- **브랜드사에서는 선 업로드 숨김** (is_temporary=false인 구매자만 표시)
- 클릭 시 이미지 확대 팝업 (Dialog)

### 9. 파일 업로드 제한

- **이미지당 최대 10MB**
- **프론트엔드 검증**: 업로드 전 파일 크기 체크, 초과 시 파일별 상세 에러 메시지
- **백엔드 제한**: multer fileSize 10MB, express body-parser 20MB

### 10. 마진 계산 및 관리

**마진 계산 공식:**
```
총매출(공급가) = total_purchase_count × sale_unit_price
총매출(VAT포함) = 총매출(공급가) × 1.1

총지출 = product_cost + delivery_cost + review_cost + other_cost

마진 = 총매출(VAT포함) - 총지출
마진율 = (마진 / 총매출(VAT포함)) × 100
```

**권한:**
- Admin: 지출 입력/수정 + 모든 마진 조회 (`/admin/margin`)
- Sales: 자신의 캠페인 마진만 조회 (`/sales/margin`, 지출 입력 불가)

---

## 권한별 접근 제어

### 총관리자 (admin)
- `/admin` 대시보드만 접근 (하위 라우트: control-tower, campaigns, daily-items, daily-payments, tracking-management, margin)
- **컨트롤 타워**: 모든 사용자의 embedded 대시보드 조회 + 별도 페이지 보기
- **캠페인 영업사 변경**: 캠페인을 다른 영업사에게 이전 가능
- **진행자 배정/재배정**: 품목별/일차별로 진행자 배정
- **입금확인 토글**: 구매자별 입금 상태 변경
- **사용자 등록/관리**: 모든 역할의 사용자 CRUD
- **마진 관리**: 품목별 지출 입력 + 모든 마진 조회
- **업로드 링크 복사**: 진행자 기능 사용 가능
- **구매자 CRUD**: 진행자 기능 사용 가능
- **연월브랜드/캠페인/품목 CRUD**: 영업사 기능 사용 가능 (viewAsUserId로 대리 생성 가능)

### 영업사 (sales)
- `/sales` 대시보드만 접근 (하위 라우트: campaign, daily-items, margin)
- 연월브랜드/캠페인/품목 CRUD (자신의 것만)
- 브랜드 등록 가능 (자동으로 해당 영업사에 할당)
- 구매자 조회 (읽기 전용, 수정/삭제 불가)
- 입금명 수정 가능
- 마진 조회 (자신의 캠페인만, 지출 입력 불가)
- **Handsontable 시트**: 연월브랜드별 캠페인 목록 → 캠페인 클릭 시 품목 시트 표시

### 진행자 (operator)
- `/operator` 대시보드만 접근 (하위 라우트: campaign, daily-items)
- 배정된 연월브랜드의 캠페인/품목만 조회
- 배정된 품목의 구매자 CRUD
- 이미지 업로드 링크 공유 (슬롯별 토큰 링크 복사)
- 입금명 수정 가능
- 메모장 기능 (OperatorMemoDialog)
- **선 업로드 알림**: 헤더 알림 아이콘에 선 업로드된 이미지 개수 표시 (30초마다 갱신)
- **Handsontable 시트**: 연월브랜드별 캠페인 목록 → 캠페인 클릭 시 품목 시트 표시
- **배정상태 표시**: 당일 배정=신규(주황 'NEW' 칩), 다음날=진행 + 구매자 없으면 경고 아이콘(빨강)

### 브랜드사 (brand)
- `/brand` 대시보드만 접근
- 연결된 연월브랜드의 캠페인/품목/구매자 조회 (읽기 전용)
- **제한된 컬럼만 표시**:
  - 제품 테이블: 접기, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배대행, URL, 빈칸, 특이사항
  - 구매자 테이블: 빈칸, 주문번호, 구매자, 수취인, 아이디, 주소, 금액, 송장번호, 리뷰샷
  - **제외**: 연락처, 계좌번호
- **선 업로드 숨김**: is_temporary=false인 구매자만 표시
- **진행률 표시**: 전체 구매자 수 대비 리뷰 완료 퍼센트

---

## 기술 스택

### Frontend
- **React 19.2.0**
- **Material-UI 7.3.5**
- **React Router DOM 7.9.6**
- **Handsontable 14.7.0** - 엑셀 형식 테이블 (필터, 정렬, 컬럼 너비 조절, 컬럼 숨기기)
- **Axios** - HTTP 클라이언트

### Backend
- **Node.js 18+**
- **Express.js** - REST API
- **Sequelize** - PostgreSQL ORM
- **bcrypt** - 비밀번호 해싱
- **JWT** - 인증 (7일 유효)
- **AWS SDK v3** - S3 업로드 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- **multer** - 파일 업로드 처리 (최대 10MB/파일)
- **helmet** - 보안 헤더 (CSP 포함)

### Database
- **PostgreSQL** (AWS RDS)
- 주요 테이블:
  - `users` - 사용자 (role: admin/sales/operator/brand)
  - `monthly_brands` - 연월브랜드 (brand_id, created_by, is_hidden)
  - `campaigns` - 캠페인 (monthly_brand_id, created_by, is_hidden)
  - `items` - 품목 (campaign_id, upload_link_token, revenue/expense 필드)
  - `item_slots` - 품목 슬롯 (item_id, day_group, upload_link_token, **day_group별 독립 제품 정보 필드**)
  - `campaign_operators` - 품목-진행자 매핑 (unique: campaign_id, item_id, day_group, operator_id)
  - `buyers` - 구매자 (item_id, is_temporary, payment_confirmed)
  - `images` - 리뷰 이미지 (buyer_id, s3_key, s3_url)

### Infrastructure
- **AWS EC2** - 애플리케이션 서버
- **AWS S3** - 이미지 저장
- **Docker** - 컨테이너화
- **Nginx** - 리버스 프록시 + SSL

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
GET    /api/users                      # 사용자 목록
GET    /api/users?role=operator        # 역할별 조회
GET    /api/users/control-tower        # 컨트롤 타워용 사용자 목록
POST   /api/users                      # 사용자 생성
PUT    /api/users/:id                  # 사용자 수정
DELETE /api/users/:id                  # 사용자 비활성화
POST   /api/users/:id/reset-password  # 비밀번호 초기화
```

### Monthly Brands
```
GET    /api/monthly-brands                # 연월브랜드 목록 (Sales, Admin) - viewAsUserId 지원
GET    /api/monthly-brands/all            # 모든 연월브랜드 (Admin 전용)
GET    /api/monthly-brands/my-brand       # 브랜드사용 연월브랜드 (Brand, Admin) - viewAsUserId 지원
GET    /api/monthly-brands/:id            # 연월브랜드 상세
POST   /api/monthly-brands                # 연월브랜드 생성 - viewAsUserId 지원
PUT    /api/monthly-brands/:id            # 연월브랜드 수정
DELETE /api/monthly-brands/:id            # 연월브랜드 삭제
DELETE /api/monthly-brands/:id/cascade    # 연월브랜드 강제 삭제 (Admin, cascading)
PATCH  /api/monthly-brands/:id/hide       # 연월브랜드 숨기기
PATCH  /api/monthly-brands/:id/restore    # 연월브랜드 복구
```

### Campaigns
```
GET    /api/campaigns                     # 캠페인 목록 (역할별 필터링)
GET    /api/campaigns/:id                 # 캠페인 상세
POST   /api/campaigns                     # 캠페인 생성 (Sales, Admin)
PUT    /api/campaigns/:id                 # 캠페인 수정
DELETE /api/campaigns/:id                 # 캠페인 삭제
DELETE /api/campaigns/:id/cascade         # 캠페인 강제 삭제 (Admin, cascading)
PATCH  /api/campaigns/:id/hide            # 캠페인 숨기기
PATCH  /api/campaigns/:id/restore         # 캠페인 복구
PATCH  /api/campaigns/:id/change-sales    # 캠페인 영업사 변경 (Admin 전용)
POST   /api/campaigns/:id/operators       # 진행자 배정 (Admin)
DELETE /api/campaigns/:campaignId/operators/:operatorId  # 진행자 배정 해제 (Admin)
GET    /api/campaigns/:id/operators       # 배정된 진행자 목록
```

### Items
```
GET    /api/items                          # 전체 품목 (Admin - 진행자 배정용)
GET    /api/items/my-assigned              # 내게 배정된 품목 (Operator)
GET    /api/items/my-monthly-brands        # 내게 배정된 연월브랜드 (Operator) - viewAsUserId 지원
GET    /api/items/my-preuploads            # 선 업로드가 있는 품목 (Operator 알림용)
GET    /api/items/by-brand                 # 브랜드별 품목 (Brand, Admin)
GET    /api/items/by-sales                 # 영업사별 품목 (Sales, Admin)
GET    /api/items/by-operator              # 진행자별 품목 (Operator, Admin)
GET    /api/items/margin-summary           # 마진 대시보드 데이터 (Admin, Sales)
GET    /api/items/campaign/:campaignId     # 캠페인별 품목
GET    /api/items/token/:token             # 토큰으로 품목 조회 (Public)
GET    /api/items/:id                      # 품목 상세
GET    /api/items/:id/margin               # 단일 품목 마진 조회 (Admin, Sales)
POST   /api/items/campaign/:campaignId     # 품목 생성 (Sales, Admin)
POST   /api/items/campaign/:campaignId/bulk  # 품목 일괄 생성 (Sales, Admin)
PUT    /api/items/:id                      # 품목 수정
PUT    /api/items/:id/expense              # 품목 지출 입력/수정 (Admin 전용)
DELETE /api/items/:id                      # 품목 삭제
POST   /api/items/:id/operator             # 진행자 배정 (Admin)
PUT    /api/items/:id/operator             # 진행자 재배정 (Admin)
DELETE /api/items/:id/operator/:operatorId  # 진행자 배정 해제 (Admin)
PATCH  /api/items/:id/deposit-name         # 입금명 수정 (Operator, Admin, Sales)
```

### Item Slots
```
GET    /api/item-slots/item/:itemId                        # 품목별 슬롯 조회
GET    /api/item-slots/campaign/:campaignId                # 캠페인별 슬롯 조회 (Sales, Admin, Brand)
GET    /api/item-slots/operator/campaign/:campaignId       # Operator용 캠페인별 슬롯 - viewAsUserId 지원
GET    /api/item-slots/operator/my-assigned                # Operator용 전체 배정된 슬롯
GET    /api/item-slots/by-date                             # 날짜별 슬롯 조회 (날짜별 작업용)
GET    /api/item-slots/token/:token                        # 슬롯 토큰으로 조회 (Public)
POST   /api/item-slots                                     # 슬롯 추가
PUT    /api/item-slots/:id                                 # 슬롯 수정
PUT    /api/item-slots/bulk/update                         # 다중 슬롯 수정
DELETE /api/item-slots/:id                                 # 슬롯 삭제
DELETE /api/item-slots/bulk/delete                         # 다중 슬롯 삭제
DELETE /api/item-slots/group/:itemId/:dayGroup             # 그룹별 슬롯 삭제
DELETE /api/item-slots/item/:itemId                        # 품목의 모든 슬롯 삭제
POST   /api/item-slots/:slotId/split-day-group             # 일 마감 (day_group 분할 + 진행자 자동 배정 + 제품 정보 복사)
```

### Buyers
```
GET    /api/buyers/by-month                       # 월별 구매자 조회 (Operator, Sales, Admin)
GET    /api/buyers/by-date                        # 일별 구매자 조회 (Operator, Sales, Admin)
GET    /api/buyers/item/:itemId                   # 구매자 목록
GET    /api/buyers/:id                            # 구매자 상세
POST   /api/buyers/item/:itemId                   # 구매자 생성 (Operator, Admin)
POST   /api/buyers/item/:itemId/parse             # 슬래시 파싱 후 생성 (Operator, Admin)
POST   /api/buyers/item/:itemId/bulk              # 다중 구매자 일괄 추가 (Operator, Admin)
POST   /api/buyers/item/:itemId/tracking-bulk     # 송장번호 일괄 입력 (Admin)
PUT    /api/buyers/:id                            # 구매자 수정 (Operator, Admin)
DELETE /api/buyers/:id                            # 구매자 삭제 (Operator, Admin)
PATCH  /api/buyers/:id/payment                    # 입금확인 토글 (Admin)
PATCH  /api/buyers/:id/tracking                   # 송장번호 수정 (Sales, Admin)
PATCH  /api/buyers/:id/tracking-info              # 송장정보 수정 (Admin)
PATCH  /api/buyers/:id/shipping-delayed           # 배송지연 상태 토글 (Admin, Operator)
PATCH  /api/buyers/:id/courier                    # 택배사 수정 (Admin)
```

### Images
```
GET    /api/images/item/:itemId             # 품목 이미지 목록
GET    /api/images/search-buyers/:token     # 이름으로 구매자 검색 (Public)
POST   /api/images/upload/:token            # 이미지 업로드 (Public, buyer_ids 배열 지원)
DELETE /api/images/:id                      # 이미지 삭제 (Operator, Admin, Sales)
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

## 현재 구현 상태 (2026-01-13)

### 완료된 기능
- [x] JWT 인증 시스템 (7일 유효)
- [x] 역할 기반 라우트 보호 (ProtectedRoute)
- [x] 연월브랜드/캠페인/품목/구매자 CRUD
- [x] 슬래시 파싱 구매자 추가 (붙여넣기 시 자동 파싱)
- [x] 진행자 배정 및 재배정 (일차별 배정, unique 제약: campaign_id, item_id, day_group, operator_id)
- [x] 입금확인 토글 (Admin, 로컬 상태 업데이트)
- [x] AWS S3 이미지 업로드 (최대 10개, 각 10MB)
- [x] 사용자 등록/관리 (Admin)
- [x] 프로필 수정 (ProfileEditDialog)
- [x] Docker 배포
- [x] SSL 인증서 (Let's Encrypt)
- [x] CSP 설정 (S3 이미지 허용)
- [x] 구매자 매칭 (주문번호 우선 매칭, 계좌번호 보조 매칭)
- [x] 다중 이미지 업로드 (최대 10개)
- [x] 다중 구매자 일괄 추가 (여러 줄 입력)
- [x] 선 업로드 지원 (임시 Buyer → 진행자 등록 시 자동 병합)
- [x] Admin 권한 확장 (모든 역할의 기능 API 접근)
- [x] Admin 컨트롤 타워 embedded 대시보드 보기
- [x] Admin View 라우트 (별도 페이지로 사용자 대시보드 전체 화면)
- [x] viewAsUserId 지원 (Admin이 다른 사용자 대신 데이터 생성/조회)
- [x] 캠페인 영업사 변경 (Admin 전용)
- [x] 품목별 매출/지출/마진 계산 (Admin: 지출 입력, Sales: 마진 조회)
- [x] Handsontable 컬럼 정렬, 필터, 숨기기, 너비 조절, localStorage 저장
- [x] 중복 주문번호 빨간색 하이라이팅 (클래스 방식)
- [x] 일 구매건수 슬래시 구분 지원 (TEXT 타입, 예: "6/6" 또는 "2/2/2/2")
- [x] Brand 시트 제품 테이블 확장 (14개 컬럼, 영업사/진행자와 동일 구조)
- [x] Brand 진행률 계산 (전체 구매자 수 대비 리뷰 완료)
- [x] Admin 컨트롤 타워 구조 변경 (연월브랜드 → 캠페인 목록 → 배정 페이지)
- [x] 숨김 항목 관리 (연월브랜드/캠페인 숨기기/복구)
- [x] Shift+스크롤 횡스크롤 전용
- [x] Operator 메모장 기능 (OperatorMemoDialog)
- [x] Operator 선 업로드 알림 (30초 갱신)

### 최신 수정 (2026-01-15)
- [x] **일마감(splitDayGroup) 기능 강화**
  - 일마감 시 새 day_group에 진행자 자동 배정 (CampaignOperator 레코드 생성)
  - 일마감 시 제품 정보(product_name, platform, shipping_type 등)가 새 day_group 슬롯에 복사됨
  - day_group별 제품 정보 완전 독립 (수정 시 다른 day_group에 영향 없음)
- [x] **day_group별 독립 제품 정보 저장**
  - ItemSlot 테이블에 제품 정보 필드 추가 (platform, shipping_type, total_purchase_count, daily_purchase_count, courier_service_yn, product_url)
  - 제품 테이블 수정 시 해당 day_group의 모든 슬롯 업데이트
  - 데이터 우선순위: 슬롯 값 > Item 값 (하위 호환성)
- [x] **데이터 타입 유연화 (TEXT 전환)**
  - Item, Buyer, ItemSlot 모델의 모든 데이터 필드를 TEXT 타입으로 변경
  - 엑셀 데이터에 대한 제한 없음 (문자 길이, 숫자 형식 제한 제거)
  - 마진 계산 등 필요한 경우에만 `parseNumber()` 헬퍼로 숫자 추출
  - 택배대행 여부는 `isCourierService()` 헬퍼로 판단 (Y/YES/1/TRUE)
- [x] **빈 데이터 삭제 지원**
  - 저장된 데이터를 비워서 저장 가능 (null로 처리)
  - 빈 행은 구매자 수에서 제외 (`isEmptyBuyer()` 체크)
- [x] **제품 테이블 즉시 업데이트**
  - 제품 데이터 수정 시 새로고침 없이 즉시 반영
  - 저장 후에도 변경사항 유지 (다른 품목 이동 시에도 유지)
  - `changedItems` 상태로 즉시 UI 반영
- [x] **이미지 업로드 방식 변경**
  - 주문번호/계좌번호 직접 입력 → 이름 검색 후 선택 방식
  - 복수 주문 선택 시 각 주문별 개별 이미지 업로드
  - 업로드 완료된 주문은 비활성화 표시
- [x] **저장 안내 텍스트 추가**
  - 진행자/영업사 시트 상단에 빨간색 경고: "작업 내용 손실을 막기위해 저장(Ctrl+S)을 일상화 해주세요!"
- [x] **날짜별 작업 페이지**
  - 새 라우트: `/operator/daily-work`, `/sales/daily-work`
  - 특정 날짜의 모든 연월브랜드-캠페인 구매자 데이터를 한 화면에서 조회
  - 제품 테이블에 "연월브랜드-캠페인" 컬럼 추가

### 이전 수정 (2026-01-13)
- [x] **Admin 컨트롤 타워 정리**
  - "숨김 항목" 기능 완전 제거 (진행자 배정 탭에서)
  - "새로고침" 버튼 삭제 (F5로 대체)
  - 사용자 목록 접기 시 거꾸로 표시되던 텍스트 제거
- [x] **Embedded 모드 네비게이션 수정**
  - Admin 컨트롤 타워에서 사용자 선택 후 캠페인 클릭 시 즉시 시트 표시 (네비게이션 없음)
  - OperatorLayout, SalesLayout, BrandLayout에서 `isEmbedded` prop 처리
- [x] **Brand 시트 색상 통일**
  - Item separator: #2e7d32 → #1565c0 (파란색)
  - Product header: #e8f5e9 → #e0e0e0 (회색)
  - Product data: #cae6c1 → #fff8e1 (연노랑)
- [x] **Brand 제품 테이블 컬럼 정렬 기능 적용**

### 역할별 페이지 격리
- admin은 `/admin` 및 하위 라우트만 접근 (단, API는 모든 역할의 기능 접근 가능)
- sales는 `/sales` 및 하위 라우트만 접근
- operator는 `/operator` 및 하위 라우트만 접근
- brand는 `/brand` 및 하위 라우트만 접근

---

## 관련 문서

- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) - DB 스키마 상세
- [docs/BACKEND_STRUCTURE.md](docs/BACKEND_STRUCTURE.md) - API 엔드포인트 및 구조
- [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) - EC2 배포 가이드
- [docs/LOCAL_TESTING.md](docs/LOCAL_TESTING.md) - 로컬 테스트 방법

---

## 개발 시 체크리스트

### ⚠️ 로컬 환경에서 Bash 명령 실행 불가
**사용자가 DB 체크, 서버 명령, 로컬 테스트 등을 요청하면 Bash 도구를 사용하지 말고 SQL/코드를 직접 제공할 것!**

- 사용자의 로컬 환경에서는 Claude의 Bash 도구가 작동하지 않음
- **DB 조회 요청 시**: 순수 SQL 쿼리만 제공 (JavaScript 래퍼 코드 불필요)
- **기타 로컬 명령 요청 시**: 사용자가 직접 복사해서 실행할 수 있는 코드 제공

**DB 체크 요청 시 응답 예시:**
```sql
SELECT id, product_name, campaign_id FROM items WHERE id = 2430;
SELECT id, product_name FROM items WHERE campaign_id = 153;
```

**절대 하지 말 것:**
- Bash 도구로 명령 실행 시도
- JavaScript 래퍼 코드로 감싸서 제공 (사용자가 SQL만 원할 때)

---

### ⚠️ Handsontable HotTable height 절대 변경 금지
**절대로 HotTable의 height 속성을 `100%`로 변경하지 말 것!**

```jsx
// ❌ 절대 금지 - 시트가 사라짐
height="100%"

// ✅ 올바른 설정 - 반드시 calc() 사용
height="calc(100vh - 210px)"
```

**이유**: HotTable에 `height="100%"`를 설정하면 부모 요소(Paper)에 명시적 픽셀 높이가 없어서 Handsontable이 렌더링되지 않음. 시트 전체가 사라지는 치명적 버그 발생.

**적용 대상**: OperatorItemSheet, SalesItemSheet, BrandItemSheet, DailyWorkSheet, UnifiedItemSheet 등 모든 HotTable 사용 컴포넌트

---

### ⚠️ Handsontable 횡스크롤바 위치 문제 - 시도한 방법들

**문제**: Handsontable의 `colHeaders` 사용 시 `.wtHolder` 내부에 헤더와 데이터가 함께 있어서 횡스크롤바가 헤더 행 바로 아래에 붙음 (시트 맨 아래가 아님)

**시도한 방법들과 결과**:

| 방법 | 코드 | 결과 |
|------|------|------|
| 1. wtHolder overflowX hidden | `'& .wtHolder': { overflowX: 'hidden !important' }` | ❌ 시트 전체가 사라짐 |
| 2. wtHolder 스크롤바만 CSS로 숨기기 | `scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }` | ❌ 시트 전체가 사라짐 |
| 3. 커스텀 스크롤바 + useEffect 동기화 | `customScrollbarRef`, `scrollContentRef`, ResizeObserver | ❌ 시트가 사라짐 (height="100%"로 바꿔서 실패) |
| 4. Paper에 overflowX + wtHolder visible | `overflowX: 'auto', '& .wtHolder': { overflowX: 'visible' }` | ❌ 종스크롤이 2개 생김 |
| 5. Box wrapper + flex layout | HotTable을 Box로 감싸고 flex 사용 | ❌ height="100%"로 바꿔야 해서 실패 |
| 6. colHeaders={false} | 헤더 행 제거 | ❌ 컬럼 리사이즈 핸들이 사라짐 |

**결론**: Handsontable 구조상 `colHeaders`를 사용하면서 횡스크롤바를 시트 맨 아래로 이동시키는 것은 매우 어려움. `.wtHolder`의 overflow를 건드리면 Handsontable 렌더링이 깨짐.

**현재 상태**: 횡스크롤바가 헤더 행 아래에 위치 (Handsontable 기본 동작)

---

### 컬럼 수정 시 필수 체크 항목
시트 컬럼 순서나 구조를 변경할 때 **반드시** 아래 모든 항목을 한번에 확인하고 수정할 것:

1. **헤더 행** - PRODUCT_HEADER, BUYER_HEADER 등 컬럼명 정의
2. **데이터 행** - PRODUCT_DATA, BUYER_DATA 등 데이터 매핑
3. **필드 매핑 객체** - itemFieldMap, buyerFieldMap, fieldMap (API 필드명 매핑)
4. **클릭 핸들러** - `coords.col === N` 조건문 (상세보기, 링크 클릭 등)
5. **렌더러/포맷터** - 숫자 포맷, 하이퍼링크, 특수 셀 렌더링
6. **엑셀 다운로드** - excelExport.js의 헤더와 데이터 배열
7. **관련 주석** - 코드 내 컬럼 순서 설명 주석
8. **다른 시트 컴포넌트** - OperatorItemSheet, SalesItemSheet, BrandItemSheet, DailyWorkSheet, UnifiedItemSheet 등 모든 관련 시트
9. **백엔드 API** - 필드명 기반이므로 보통 영향 없지만 확인
10. **문서** - CLAUDE.md 정책 업데이트

---

**최종 업데이트**: 2026-01-20
