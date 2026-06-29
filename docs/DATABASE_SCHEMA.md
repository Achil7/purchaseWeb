# 데이터베이스 스키마 설계

## 개요
CampManager 리뷰 캠페인 관리 시스템의 데이터베이스 스키마 문서입니다. 본 문서는 `backend/src/models/`에 등록된 Sequelize 모델과 `backend/migrations/`의 실제 마이그레이션을 기준으로 작성되었습니다.

- **모델로 정의된 테이블: 18개** (`backend/src/models/index.js`에 등록)
- **마이그레이션만 있고 모델이 없는 테이블: 4개** (`estimates`, `settlements`, `settlement_products`, `margin_settings`)
- **합계: 22개 테이블**

### 공통 규칙
- 모든 timestamps는 snake_case 컬럼 (`created_at` / `updated_at`)을 사용합니다 (별도 표기한 경우 제외).
- 소프트 삭제(paranoid)가 적용된 모델은 `deleted_at` 컬럼으로 논리 삭제를 처리합니다.
- 엑셀 데이터 유연성을 위해 `items` / `item_slots` / `buyers`의 대부분 데이터 필드는 `TEXT` 타입입니다 (길이/형식 제한 없음, 마진 계산 시에만 `parseNumber()`로 숫자 추출).
- 일부 ENUM은 Postgres ENUM 타입으로 생성되며, 값이 추가될 때는 마이그레이션으로 ENUM 라벨을 추가합니다.

---

## ERD 개념도

```
users (사용자)
  ├─ assigned_sales_id (self-ref, 레거시: 브랜드→담당 영업사)
  └─ brand_sales (N:M, 현재 브랜드↔영업사 연결의 source of truth)

monthly_brands (연월브랜드)
  ├─ brand_id     → users (브랜드 사용자)
  └─ created_by   → users (생성 영업사)   ※ sales_id / operator_id 컬럼 없음
        ↓
campaigns (캠페인) ← created_by (영업사), brand_id, monthly_brand_id
        ↓
items (품목)
        ↓
item_slots (품목 슬롯) ← 일 구매건수별 day_group, buyer_id 로 buyers 역참조
        ↓
buyers (구매자/리뷰어)   ※ buyers.slot_id 없음 (역방향은 item_slots.buyer_id)
        ↓
images (리뷰 이미지) ← buyer_id, item_id, 재제출 체인(previous_image_id)

campaign_operators (품목-진행자 매핑) ← 총관리자가 day_group 단위로 배정
review_extracted_texts (리뷰샷 GPT-4o Vision OCR 결과, 구매자 1:1)

부가 시스템
  refresh_tokens          (모바일 JWT 리프레시 토큰)
  notifications           (알림)
  settings                (로그인/배너 설정)
  user_activities         (login/logout/heartbeat 로그)
  user_memos              (개인 메모장)
  sheet_memos             (시트 셀 메모)
  platform_rankings       (올리브영 BEST100 시계열)
  ranking_collection_jobs (랭킹 수집 작업 로그)

마이그레이션 전용 (모델 없음)
  estimates / settlements / settlement_products / margin_settings (견적/정산)
```

---

## 테이블 상세 (모델 기반 18개)

### 1. users (사용자 테이블)
사용자 계정 및 역할 관리. `role`은 Postgres ENUM 입니다. `deleted_at` 컬럼은 소프트 삭제 마이그레이션(20260114)으로 추가되었으나, User 모델 자체에는 `paranoid` 옵션이 선언되어 있지 않습니다 (컬럼은 물리적으로 존재).

```sql
CREATE TYPE enum_users_role AS ENUM ('admin', 'sales', 'operator', 'brand');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,        -- bcrypt (beforeCreate/beforeUpdate 훅)
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,                   -- isEmail 검증
  role enum_users_role NOT NULL,              -- admin / sales / operator / brand
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  assigned_sales_id INTEGER REFERENCES users(id),  -- 레거시: 브랜드의 담당 영업사 (self-ref)
  initial_password VARCHAR(255),              -- 초기 비밀번호 (Admin 확인용)
  last_activity TIMESTAMP,                     -- 마지막 활동 시간 (Heartbeat 기준)
  serial VARCHAR(10) UNIQUE,                   -- 브랜드 일련번호 (BR0001, 브랜드 전용 견적 매칭키)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP                         -- 20260114 마이그레이션으로 추가
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_assigned_sales ON users(assigned_sales_id);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
```

**훅 및 메서드:**
- `beforeCreate`: 비밀번호 해싱 + 브랜드 계정(role='brand')이면 `serial`(BR0001...) 자동 부여
- `beforeUpdate`: `password_hash` 변경 시 재해싱
- `prototype.comparePassword(password)`: 비밀번호 검증
- `prototype.toJSON()`: 응답에서 `password_hash` 제거

**주요 연관:**
- `hasMany Campaign(created_by)`, `belongsToMany Campaign via CampaignOperator`(assignedCampaigns)
- `hasMany Buyer(created_by)`
- self-ref `belongsTo User(assigned_sales_id as assignedSales)` / `hasMany User(as assignedBrands)` (레거시)
- N:M self `belongsToMany User via BrandSales` (managedBrands / assignedSalesUsers)

---

### 2. monthly_brands (연월브랜드 테이블)
영업사가 생성하는 월별 브랜드 그룹핑. **`sales_id` / `operator_id` 컬럼은 존재하지 않습니다.** 영업사 연결은 `created_by`, 진행자 연결은 `campaign_operators`를 통해서만 이뤄집니다. paranoid 적용.

```sql
CREATE TABLE monthly_brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,                  -- 예: "2512어댑트"
  brand_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- 브랜드 사용자
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- 생성 영업사
  year_month VARCHAR(4),                       -- 'YYMM' 형식 (예: '2512')
  description TEXT,
  status enum_monthly_brands_status DEFAULT 'active',  -- active / completed / cancelled
  is_hidden BOOLEAN DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,       -- 정렬 순서 (낮을수록 위)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP                         -- paranoid
);

CREATE INDEX idx_monthly_brands_brand_id ON monthly_brands(brand_id);
CREATE INDEX idx_monthly_brands_created_by ON monthly_brands(created_by);
CREATE INDEX idx_monthly_brands_year_month ON monthly_brands(year_month);
CREATE INDEX idx_monthly_brands_status ON monthly_brands(status);
CREATE INDEX idx_monthly_brands_deleted_at ON monthly_brands(deleted_at);
CREATE INDEX idx_monthly_brands_created_by_sort_order ON monthly_brands(created_by, sort_order);
```

**연관:** `belongsTo User(brand_id as brand)`, `belongsTo User(created_by as creator)`, `hasMany Campaign`

---

### 3. campaigns (캠페인 테이블)
영업사가 생성하는 캠페인 정보. `status`는 ENUM이며 모델은 `active / completed / cancelled` 3개 값만 정의합니다. paranoid 적용.

```sql
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),                           -- 예: "251213_삼성" (nullable)
  registered_at DATE,                          -- DATEONLY, 캠페인 등록 날짜 (정렬용)
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  brand_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  monthly_brand_id INTEGER REFERENCES monthly_brands(id) ON DELETE SET NULL,
  status enum_campaigns_status DEFAULT 'active',  -- active / completed / cancelled
  start_date DATE,                             -- DATEONLY
  end_date DATE,                               -- DATEONLY
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP                         -- paranoid
);

CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX idx_campaigns_brand_id ON campaigns(brand_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_registered_at ON campaigns(registered_at);
CREATE INDEX idx_campaigns_deleted_at ON campaigns(deleted_at);
```

> 참고: 마이그레이션 `20251224000002-add-campaign-status-values.js`가 과거 Postgres ENUM 라벨을 조정했을 수 있으나, 현재 모델이 정의하는 유효 값은 `active / completed / cancelled` 3개입니다.

**연관:** `belongsTo User(creator)`, `belongsTo User(brand)`, `belongsTo MonthlyBrand`, `hasMany Item`, `belongsToMany User via CampaignOperator(operators)`, `hasMany CampaignOperator(operatorAssignments)`

---

### 4. items (품목 테이블)
캠페인 내의 개별 상품/품목 정보. paranoid 적용.

> **Note**: 대부분의 데이터 필드가 TEXT 타입으로, 파이프(`|`) 구분 값을 저장할 수 있습니다. `shipping_deadline`은 과거 TIMESTAMP였으나 현재 **TEXT** 입니다.

```sql
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- 품목 기본 정보 (TEXT)
  product_name TEXT NOT NULL,
  shipping_type TEXT,                -- 출고 유형 (예: "실출고 | 미출고")
  keyword TEXT,                      -- 키워드 (파이프 구분 가능)

  -- 구매 목표
  total_purchase_count TEXT,         -- 총 구매 건수
  daily_purchase_count TEXT,         -- 일 구매 건수 (슬래시 구분, 예: "6/6", "1/3/4/2")

  -- 상품 정보
  product_url TEXT,
  purchase_option TEXT,
  product_price TEXT,                -- 가격 (예: "27600 | 30000")
  shipping_deadline TEXT,            -- 출고 마감 시간 (TEXT, 파이프 구분 가능)

  -- 리뷰 가이드
  review_guide TEXT,
  courier_service_yn TEXT,           -- 택배대행 Y/N
  courier_name TEXT,                 -- 택배사명

  -- 기타
  deposit_name TEXT,                 -- 입금명 (카톡방명)
  platform TEXT,                     -- 판매 플랫폼 (예: "쿠팡 | 네이버")
  date TEXT,                         -- 품목 날짜
  display_order INTEGER,             -- 품목 순번
  notes TEXT,
  registered_at TIMESTAMP DEFAULT NOW(),  -- 등록시간 (DATE, default NOW)

  -- 이미지 업로드 링크 (UUID 자동 생성: defaultValue + beforeCreate 훅)
  upload_link_token TEXT UNIQUE,

  -- 상태
  status TEXT DEFAULT 'active',

  -- 마진/단가 관련 (모델 선언 = TEXT)
  unit_price TEXT,                   -- 단가 (영업사 입력)
  sale_price_per_unit TEXT,          -- 판매 단가 (원/개)
  courier_price_per_unit TEXT,       -- 택배대행 단가 (원/개)

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP               -- paranoid
);

CREATE INDEX idx_items_campaign_id ON items(campaign_id);
CREATE INDEX idx_items_upload_link_token ON items(upload_link_token);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_deleted_at ON items(deleted_at);
```

**DB 전용(모델 미선언) 컬럼:**
다음 지출 컬럼들은 마이그레이션 `20260106000001`로 **`items` 테이블에 INTEGER로 추가**되어 DB에는 존재하지만, **Item 모델 정의에는 포함되어 있지 않습니다** (마진 입력은 별도 로직에서 처리). `sale_price_per_unit` / `courier_price_per_unit`은 동일 마이그레이션에서 INTEGER로 추가되었으나 이후 모델에서 TEXT로 선언되었습니다.
- `expense_product` INTEGER — 지출: 제품비
- `expense_courier` INTEGER — 지출: 택배비
- `expense_review` INTEGER — 지출: 리뷰비용
- `expense_other` INTEGER — 지출: 기타비용
- `expense_note` TEXT — 지출 메모

**연관:** `belongsTo Campaign`, `hasMany Buyer`, `hasMany Image`, `hasMany CampaignOperator(operatorAssignments)`, `hasMany ItemSlot(slots)`

---

### 5. item_slots (품목 슬롯 테이블)
일 구매건수별로 그룹화된 슬롯. **day_group별 독립 제품 정보를 저장**하며 일마감(splitDayGroup) 시 현재 day_group의 제품 정보가 새 day_group 슬롯으로 복사됩니다. paranoid 적용.

> **중요 (관계 방향)**: 구매자 연결은 **`item_slots.buyer_id` → `buyers.id`** 입니다 (Buyer `hasOne` ItemSlot as `slot`). **`buyers.slot_id` 컬럼은 존재하지 않습니다.**

```sql
CREATE TABLE item_slots (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,       -- 해당 일차 내 슬롯 번호
  day_group INTEGER DEFAULT 1,        -- 일차 그룹 (1, 2, 3...)

  -- 슬롯 입력 정보
  date TEXT,                          -- 날짜 (사용자 입력)
  expected_buyer TEXT,                -- 예상 구매자 (진행자 입력)
  buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
  review_cost TEXT,                   -- 리뷰비용 (진행자 입력, TEXT)
  buyer_notes TEXT,                   -- 구매자 테이블 비고 (제품 notes와 별개)

  -- day_group별 독립 제품 정보 (일마감 시 복사됨, 모두 TEXT)
  product_name TEXT,
  purchase_option TEXT,
  keyword TEXT,
  product_price TEXT,
  notes TEXT,
  platform TEXT,
  shipping_type TEXT,
  total_purchase_count TEXT,
  daily_purchase_count TEXT,
  courier_service_yn TEXT,
  courier_name TEXT,                  -- 택배사명
  product_url TEXT,
  unit_price TEXT,                    -- 단가 (영업사 입력, day_group별 독립)

  -- 업로드/상태
  upload_link_token TEXT,            -- 그룹별 이미지 업로드 토큰
  status TEXT DEFAULT 'active',
  is_suspended BOOLEAN NOT NULL DEFAULT false,  -- Admin이 중단 처리한 day_group

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP               -- paranoid
);

CREATE INDEX idx_item_slots_item_id ON item_slots(item_id);
CREATE INDEX idx_item_slots_buyer_id ON item_slots(buyer_id);
CREATE INDEX idx_item_slots_status ON item_slots(status);
CREATE INDEX idx_item_slots_day_group ON item_slots(day_group);
CREATE INDEX idx_item_slots_upload_token ON item_slots(upload_link_token);
CREATE INDEX idx_item_slots_deleted_at ON item_slots(deleted_at);
CREATE INDEX idx_item_slots_is_suspended ON item_slots(is_suspended);
-- 유니크 제약: (item_id, day_group, slot_number)
CREATE UNIQUE INDEX idx_item_slots_unique ON item_slots(item_id, day_group, slot_number);
```

**데이터 우선순위:** 슬롯에 값이 있으면 슬롯 값 사용, 없으면 Item 값 사용 (하위 호환성).

**일마감(splitDayGroup) 동작:**
1. 선택된 슬롯들의 day_group을 새 값으로 변경
2. 새 upload_link_token 할당
3. 현재 day_group의 제품 정보를 새 day_group 슬롯에 복사
4. CampaignOperator에 새 day_group 배정 레코드 자동 생성

**연관:** `belongsTo Item`, `belongsTo Buyer(buyer)`

---

### 6. campaign_operators (캠페인-진행자 매핑 테이블)
총관리자가 캠페인/품목에 진행자를 배정하는 테이블. **일차별(day_group) 배정을 지원**합니다. **`timestamps: false`** 이므로 `created_at` / `updated_at`이 없고, 대신 `assigned_at` 컬럼만 존재합니다.

```sql
CREATE TABLE campaign_operators (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  operator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  day_group INTEGER,  -- null=전체 품목 배정, 숫자=해당 일차만 배정

  CONSTRAINT unique_campaign_operator_daygroup
    UNIQUE(campaign_id, item_id, day_group, operator_id)
);

CREATE INDEX idx_campaign_operators_campaign ON campaign_operators(campaign_id);
CREATE INDEX idx_campaign_operators_item ON campaign_operators(item_id);
CREATE INDEX idx_campaign_operators_operator ON campaign_operators(operator_id);
CREATE INDEX idx_campaign_operators_day_group ON campaign_operators(day_group);
```

**일차별 배정 예시:**
- 품목 A의 1일차 → 진행자 김철수
- 품목 A의 2일차 → 진행자 이영희
- 품목 A의 3일차 → 진행자 김철수 (같은 진행자도 다른 일차에 배정 가능)

**연관:** `belongsTo Campaign`, `belongsTo Item`, `belongsTo User(operator)`, `belongsTo User(assigner)`

---

### 7. buyers (구매자/리뷰어 테이블)
진행자가 추가하는 구매자(리뷰어) 정보. 데이터 필드는 TEXT, `payment_status`는 ENUM 입니다. paranoid 적용. **`slot_id` 컬럼은 없습니다** (역방향은 `item_slots.buyer_id`).

```sql
CREATE TABLE buyers (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,

  -- 구매자 정보 (TEXT)
  order_number TEXT,
  buyer_name TEXT,
  recipient_name TEXT,
  user_id TEXT,
  contact TEXT,
  address TEXT,
  account_info TEXT,
  account_normalized TEXT,           -- 정규화된 계좌번호 (숫자만 추출)
  is_temporary BOOLEAN DEFAULT false,-- 임시 구매자 (선 업로드 케이스)
  amount TEXT DEFAULT '0',
  unit_price TEXT,                   -- 단가 (영업사 입력)

  -- 입금 확인
  payment_status enum_buyers_payment_status DEFAULT 'pending',  -- pending / completed
  payment_confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payment_confirmed_at TIMESTAMP,

  -- 송장/배송
  tracking_number TEXT,
  courier_company TEXT,              -- 택배사
  shipping_delayed BOOLEAN DEFAULT false,

  -- 기타
  notes TEXT,
  deposit_name TEXT,                 -- 입금명 (구매자별)
  expected_payment_date DATE,        -- 입금 예정일 (DATEONLY)
  review_submitted_at TIMESTAMP,     -- 리뷰 이미지 제출 시간
  info_entered_at TIMESTAMP,         -- 주문번호 최초 입력 시점 (14일 미제출 추적)
  date TEXT,                         -- 구매자별 독립 날짜

  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP               -- paranoid
);

CREATE INDEX idx_buyers_item_id ON buyers(item_id);
CREATE INDEX idx_buyers_order_number ON buyers(order_number);
CREATE INDEX idx_buyers_payment_status ON buyers(payment_status);
CREATE INDEX idx_buyers_account_normalized ON buyers(account_normalized);
CREATE INDEX idx_buyers_is_temporary ON buyers(is_temporary);
CREATE INDEX idx_buyers_shipping_delayed ON buyers(shipping_delayed);
CREATE INDEX idx_buyers_deleted_at ON buyers(deleted_at);
CREATE INDEX idx_buyers_date ON buyers(date);
```

**계좌번호 정규화 규칙:**
```
입력: "국민 111-1234-123456 홍길동"
정규화: "1111234123456" (숫자만 추출, 최소 8자리 이상)
```

**연관:** `belongsTo Item`, `belongsTo User(creator)`, `belongsTo User(paymentConfirmer)`, `hasMany Image`, `hasOne ItemSlot(slot)`

---

### 8. images (이미지 테이블)
구매자가 업로드한 리뷰 이미지. **`updated_at`이 없고(`createdAt` only)**, paranoid 적용. 재제출/승인 워크플로우를 위한 컬럼이 포함됩니다. **`slot_id` 컬럼은 없습니다.**

```sql
CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER REFERENCES buyers(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,

  -- 이미지 정보
  title VARCHAR(200),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  s3_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(50),

  -- 업로드/매칭
  order_number VARCHAR(100),
  account_normalized VARCHAR(50),    -- 정규화된 계좌번호
  upload_token VARCHAR(100),
  uploaded_by_ip VARCHAR(50),

  -- 재제출/승인 워크플로우
  status TEXT NOT NULL DEFAULT 'approved',  -- pending / approved / rejected
  resubmitted_at TIMESTAMP,
  previous_image_id INTEGER REFERENCES images(id) ON DELETE SET NULL,  -- 재제출 시 이전 이미지 (self-FK)
  resubmission_group_id VARCHAR(36), -- 재제출 그룹 UUID (한 배치로 재제출된 이미지 그룹화)

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- updated_at 없음
  deleted_at TIMESTAMP               -- paranoid
);

CREATE INDEX idx_images_buyer_id ON images(buyer_id);
CREATE INDEX idx_images_item_id ON images(item_id);
CREATE INDEX idx_images_upload_token ON images(upload_token);
CREATE INDEX idx_images_account_normalized ON images(account_normalized);
CREATE INDEX idx_images_deleted_at ON images(deleted_at);
CREATE INDEX idx_images_status ON images(status);
CREATE INDEX idx_images_previous_image_id ON images(previous_image_id);
CREATE INDEX idx_images_resubmission_group_id ON images(resubmission_group_id);
```

> 통계/대시보드 집계는 일반적으로 `images.status = 'approved'` 행만 사용합니다.

**연관:** `belongsTo Buyer`, `belongsTo Item`, `belongsTo Image(previousImage)`, `hasMany Image(resubmissions)`

---

### 9. refresh_tokens (리프레시 토큰 테이블)
모바일 로그인용 JWT 리프레시 토큰 저장.

```sql
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  device_info VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

**메서드:** static `generateToken()` (crypto 64바이트 hex), `prototype.isExpired()`, `prototype.isValid()` (폐기되지 않고 만료 전).

---

### 10. notifications (알림 테이블)
시스템 알림. **`type`은 Postgres ENUM**, **`updated_at`이 없습니다(`createdAt` only)**. 참조 대상은 `reference_type` + `reference_id`로 표현합니다 (`related_item_id` / `related_campaign_id` 컬럼은 없음).

```sql
-- 모델 선언: ('campaign_created', 'target_reached')
-- 마이그레이션 20251216으로 ENUM에 추가: 'item_created', 'operator_assigned', 'item_completed'
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type enum_notifications_type NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  reference_type VARCHAR(50),        -- 참조 엔티티 타입 (campaign, item 등)
  reference_id INTEGER,              -- 참조 엔티티 ID
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  -- updated_at 없음
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

---

### 11. settings (시스템 설정 테이블)
로그인 페이지/배너 설정. **`timestamps: false`**, `description` / `created_at` 컬럼은 없습니다.

```sql
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  updated_by INTEGER,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**주요 설정 키:** `announcement`, `banner_title_admin`, `banner_title_sales`, `banner_title_operator`, `banner_title_brand`

---

### 12. user_activities (사용자 활동 로그 테이블)
로그인/로그아웃/하트비트 활동 추적. **`activity_type`은 ENUM**, **`updated_at` 없음**. (`action` / `entity_type` / `entity_id` / `details` 컬럼은 존재하지 않습니다.)

```sql
CREATE TABLE user_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  activity_type enum_user_activities_activity_type NOT NULL,  -- login / logout / heartbeat
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  -- updated_at 없음
);

CREATE INDEX idx_user_activities_user ON user_activities(user_id);
CREATE INDEX idx_user_activities_activity_type ON user_activities(activity_type);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at);
```

---

### 13. user_memos (사용자 메모 테이블)
사용자 본인의 개인 메모장. **`user_id`와 `content` 컬럼만** 존재합니다 (`target_user_id` / `created_by`는 없음).

```sql
CREATE TABLE user_memos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT DEFAULT '',           -- nullable
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**연관:** `belongsTo User(user)`

---

### 14. sheet_memos (시트 셀 메모 테이블)
진행자/영업사 시트의 셀 단위 메모. (행·열 좌표 + 캠페인 + 사용자 조합)

```sql
CREATE TABLE sheet_memos (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sheet_type enum_sheet_memos_sheet_type NOT NULL,  -- operator / sales
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  col_index INTEGER NOT NULL,
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(campaign_id, sheet_type, user_id, row_index, col_index)
);

CREATE INDEX idx_sheet_memos_campaign_id ON sheet_memos(campaign_id);
CREATE INDEX idx_sheet_memos_user_id ON sheet_memos(user_id);
CREATE INDEX idx_sheet_memos_sheet_type ON sheet_memos(sheet_type);
```

**연관:** `belongsTo Campaign`, `belongsTo User`

---

### 15. brand_sales (브랜드-영업사 N:M 매핑 테이블)
브랜드와 영업사의 N:M 연결. **현재 브랜드↔영업사 연결의 source of truth** 입니다 (레거시 `users.assigned_sales_id`를 대체). **`updated_at` 없음(`createdAt` only)**.

```sql
CREATE TABLE brand_sales (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sales_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- 할당한 사용자 (Admin/영업사 본인)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_brand_sales UNIQUE(brand_id, sales_id)
);

CREATE INDEX idx_brand_sales_brand ON brand_sales(brand_id);
CREATE INDEX idx_brand_sales_sales ON brand_sales(sales_id);
```

**연관:** `belongsTo User(brand)`, `belongsTo User(salesUser)`, `belongsTo User(creator)`

---

### 16. review_extracted_texts (리뷰샷 OCR 텍스트 테이블)
구매자 리뷰샷 이미지를 GPT-4o Vision으로 OCR 추출한 결과. **구매자 1명당 1행**(여러 이미지 합산).

```sql
CREATE TABLE review_extracted_texts (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL UNIQUE REFERENCES buyers(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  monthly_brand_id INTEGER REFERENCES monthly_brands(id) ON DELETE SET NULL,

  extracted_text TEXT,
  image_count INTEGER DEFAULT 0,
  image_ids JSONB,
  extraction_status TEXT NOT NULL DEFAULT 'pending',  -- pending / completed / not_review / failed / skipped

  -- 토큰/비용
  tokens_used_input INTEGER DEFAULT 0,
  tokens_used_output INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,6) DEFAULT 0,
  model_used TEXT,
  detail_used TEXT,
  extraction_error TEXT,
  last_image_updated_at TIMESTAMP,
  extracted_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_review_extracted_texts_buyer ON review_extracted_texts(buyer_id);
CREATE INDEX idx_review_extracted_texts_item ON review_extracted_texts(item_id);
CREATE INDEX idx_review_extracted_texts_campaign ON review_extracted_texts(campaign_id);
CREATE INDEX idx_review_extracted_texts_monthly_brand ON review_extracted_texts(monthly_brand_id);
CREATE INDEX idx_review_extracted_texts_status ON review_extracted_texts(extraction_status);
```

**연관:** `belongsTo Buyer`, `belongsTo Item`, `belongsTo Campaign`, `belongsTo MonthlyBrand`

---

### 17. platform_rankings (플랫폼 랭킹 시계열 테이블)
올리브영 카테고리 BEST 100 순위 시계열. PC 로컬 워커가 INSERT, 백엔드는 읽기 전용. **`timestamps: false`**.

```sql
CREATE TABLE platform_rankings (
  id SERIAL PRIMARY KEY,
  category_id VARCHAR(50) NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  rank INTEGER NOT NULL,
  product_name TEXT,
  brand_name VARCHAR(255),
  goods_no VARCHAR(100),
  product_url TEXT,
  image_url TEXT,
  price VARCHAR(255),
  original_price VARCHAR(50),
  sale_price VARCHAR(50),
  discount_rate INTEGER,             -- 가격 필드 (20260508 마이그레이션 추가)
  collected_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_rankings_cat_collected ON platform_rankings(category_id, collected_at);
CREATE INDEX idx_platform_rankings_goods_no ON platform_rankings(goods_no);
CREATE INDEX idx_platform_rankings_collected_at ON platform_rankings(collected_at);
-- 추가 복합 인덱스: 마이그레이션 20260506
```

---

### 18. ranking_collection_jobs (랭킹 수집 작업 로그 테이블)
랭킹 수집 작업 로그 + 진행 상태 + rate limit 카운트. **`updated_at` 없음(`createdAt` only)**.

```sql
CREATE TABLE ranking_collection_jobs (
  id SERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending / running / completed / failed
  triggered_by VARCHAR(20) NOT NULL,              -- scheduler / admin / brand
  triggered_user_id INTEGER,
  total_categories INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  inserted_rows INTEGER DEFAULT 0,
  current_idx INTEGER DEFAULT 0,
  current_category VARCHAR(100),
  error_text TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  retry_attempts INTEGER DEFAULT 0,  -- 20260512 마이그레이션 추가
  total_attempts INTEGER DEFAULT 0,  -- 20260512 마이그레이션 추가
  duration_ms INTEGER,               -- 20260512 마이그레이션 추가
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  -- updated_at 없음
);
```

---

## 마이그레이션 전용 테이블 (모델 없음, 4개)

다음 테이블들은 마이그레이션으로 생성되어 DB에 존재하지만 Sequelize 모델이 없어 `models/index.js`에 등록되지 않습니다 (견적/정산 관련 raw 쿼리로 접근).

### 19. estimates (견적서 테이블)
견적서 파일 업로드/파싱 결과. (마이그레이션 `20260121000000`)

```sql
CREATE TABLE estimates (
  id SERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  company_name TEXT, company_contact TEXT, company_tel TEXT, company_email TEXT,
  agency_name TEXT, agency_representative TEXT, agency_tel TEXT, agency_email TEXT,
  category_review DECIMAL(15,2) DEFAULT 0,
  category_product DECIMAL(15,2) DEFAULT 0,
  category_delivery DECIMAL(15,2) DEFAULT 0,
  category_other DECIMAL(15,2) DEFAULT 0,
  supply_amount DECIMAL(15,2) DEFAULT 0,
  vat_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  items_json TEXT,
  estimate_date DATE,                -- DATEONLY
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  memo TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ON estimates(uploaded_by);
CREATE INDEX ON estimates(estimate_date);
CREATE INDEX ON estimates(company_name);
```

### 20. settlements (정산 테이블)
정산 헤더 (매출/지출 단가·수량). (마이그레이션 `20260221000001`)

```sql
CREATE TABLE settlements (
  id SERIAL PRIMARY KEY,
  settlement_id TEXT NOT NULL,       -- 정산ID (예: 260106조이쿠팡)
  company_name TEXT,
  month TEXT,                        -- 예: 2026-01
  rev_processing_fee DECIMAL(15,2),  -- 매출 진행비 단가
  rev_processing_qty INTEGER,        -- 매출 진행 수량
  rev_delivery_fee DECIMAL(15,2),    -- 매출 택배대행 단가
  rev_delivery_qty INTEGER,          -- 매출 택배 수량
  exp_processing_fee DECIMAL(15,2),  -- 지출 진행비(실비) 단가
  memo TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX ON settlements(settlement_id);
CREATE INDEX ON settlements(month);
CREATE INDEX ON settlements(company_name);
```

### 21. settlement_products (정산 제품 테이블)
정산에 포함된 제품별 명세. (마이그레이션 `20260221000001`)

```sql
CREATE TABLE settlement_products (
  id SERIAL PRIMARY KEY,
  settlement_id INTEGER NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  product_name TEXT,
  product_qty INTEGER,
  product_unit_price DECIMAL(15,2),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX ON settlement_products(settlement_id);
```

### 22. margin_settings (마진 설정 테이블)
마진 계산용 전역 설정. (마이그레이션 `20260221000001`, `delivery_cost_with_vat='2750'` 시드)

```sql
CREATE TABLE margin_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 소프트 삭제 (Soft Delete)

마이그레이션 `20260114-add-soft-delete-columns.js`로 다음 7개 테이블에 `deleted_at` 컬럼과 인덱스가 추가되었습니다:
`users`, `monthly_brands`, `campaigns`, `items`, `item_slots`, `buyers`, `images`.

- `monthly_brands` / `campaigns` / `items` / `item_slots` / `buyers` / `images` 모델은 `paranoid: true`가 선언되어 Sequelize가 자동으로 삭제 행을 필터링하고, 삭제 시 `deleted_at`에 시각을 기록합니다.
- `users`는 `deleted_at` 컬럼은 존재하지만 User 모델에 `paranoid` 옵션이 선언되어 있지 않습니다 (사용자 비활성화는 별도 `is_active` 플래그/엔드포인트로 처리).
- 휴지통(`/api/trash`)은 소프트 삭제된 연월브랜드/캠페인/품목을 30일 보관 후 영구 삭제하는 정책으로 동작합니다.

---

## 권한별 접근 제어 규칙

### 총관리자 (admin)
- 모든 테이블에 대한 CRUD 권한
- `campaign_operators`를 통해 진행자 배정 (day_group 단위)
- `buyers.payment_status` 토글 권한
- 컨트롤 타워에서 모든 사용자 대시보드 조회 가능
- 마진/지출, 정산/견적, 랭킹 수집, 이미지 재제출 승인/거절

### 영업사 (sales)
- `monthly_brands` / `campaigns` / `items`: 자신이 생성한 것만 CRUD (`created_by` 기준)
- `buyers` / `images`: 자신의 캠페인/품목 READ
- `deposit_name`, 송장번호 수정 가능
- `brand_sales`를 통해 자신을 브랜드에 할당, 마진 조회(자신 캠페인만)

### 진행자 (operator)
- `campaigns` / `items`: 자신에게 배정된 것만 READ (`campaign_operators` 기준)
- `item_slots` / `buyers`: 배정된 품목/슬롯 CRUD
- `images`: 배정 품목 READ + 재제출 대기 검색
- `deposit_name` 수정 가능, `payment_status`는 표시만(체크 불가)

### 브랜드사 (brand)
- 자신이 연결된 `monthly_brands` / `campaigns` / `items` READ (`brand_id` 기준)
- `buyers`: 제한된 컬럼만 READ (연락처/계좌 제외), 선 업로드(is_temporary) 숨김
- 자사 제품 랭킹(`platform_rankings`) 조회

---

## 초기 데이터 (Seed Data)

### 마스터 계정 (역할별)
```sql
-- 실제 배포 시 seeder 파일에서 비밀번호를 변경하세요
INSERT INTO users (username, password_hash, name, email, role, phone, is_active)
VALUES
  ('admin', '$2b$10$...', '마스터 관리자', 'admin@example.com', 'admin', '010-0000-0000', true),
  ('sales', '$2b$10$...', '마스터 영업사', 'sales@example.com', 'sales', '010-0000-0001', true),
  ('operator', '$2b$10$...', '마스터 진행자', 'operator@example.com', 'operator', '010-0000-0002', true),
  ('brand', '$2b$10$...', '마스터 브랜드사', 'brand@example.com', 'brand', '010-0000-0003', true);
```

### 계정 정보 요약
| 역할 | Username | Password | 용도 |
|------|----------|----------|------|
| 총관리자 | `admin` | `your_password` | 마스터 관리자 |
| 영업사 | `sales` | `your_password` | 마스터 영업사 |
| 진행자 | `operator` | `your_password` | 마스터 진행자 |
| 브랜드사 | `brand` | `your_password` | 마스터 브랜드사 |

> **Note**: 실제 배포 시 `backend/src/seeders/` 파일에서 계정 정보를 변경하세요.

---

## 마이그레이션 파일 참고

`backend/migrations/`에는 초기 테이블 생성부터 다수의 컬럼 추가/타입 변경/인덱스 마이그레이션이 누적되어 있습니다. 주요 변경 흐름은 다음과 같습니다 (전체 파일명은 디렉터리에서 확인).

- 초기 생성: users / campaigns / items / campaign_operators / buyers / images (`20241204*`)
- 연월브랜드/슬롯 도입: monthly_brands, item_slots, day_group/upload_token (`202512*`)
- 알림/설정/활동/메모: notifications, settings, user_activities, user_memos (`202512*`)
- 매출/지출 컬럼: items에 sale_price_per_unit / courier_price_per_unit / expense_* 추가 (`20260106000001`, INTEGER)
- 브랜드-영업사 N:M: brand_sales 생성 (`20260110000001-create-brand-sales.js`)
- TEXT 전환: items/buyers/item_slots 데이터 필드 TEXT화 (`20260113175514`, `20260115195338`)
- day_group 독립 제품 정보: item_slots에 제품 필드 추가 (`20260115200001`)
- 소프트 삭제: 7개 테이블 deleted_at 추가 (`20260114-add-soft-delete-columns.js`)
- 견적/정산: estimates (`20260121000000`), settlements / settlement_products / margin_settings (`20260221000001`)
- 리뷰 OCR: review_extracted_texts (`20260418000001`)
- 랭킹 시스템: platform_rankings (`20260507000001`) + 가격/인덱스 (`20260506`, `20260508`), ranking_collection_jobs (`20260511000001`) + 통계 (`20260512000001`)
- 브랜드 일련번호: users.serial (`20260626000000-add-serial-to-users.js`)
- 성능 인덱스(trgm/복합): `20260202`, `20260412`, `20260413`, `20260425`, `20260502`, `20260506` 등

---

## 추가 고려사항

### 1. 파일 저장소 (S3)
- 버킷 구조 예시: `your-bucket-name/campaigns/{campaign_id}/items/{item_id}/{timestamp}_{filename}`

### 2. 인덱스 최적화
실제 쿼리 패턴에 따라 trgm / 복합 인덱스가 후속 마이그레이션으로 추가되었습니다. 위 표에 모두 열거되지 않은 인덱스가 있을 수 있습니다.

### 3. 관계 방향 요약 (자주 혼동되는 부분)
- 구매자↔슬롯: `item_slots.buyer_id → buyers.id` (Buyer `hasOne` ItemSlot). **buyers.slot_id / images.slot_id 컬럼은 없습니다.**
- 브랜드↔영업사: 현재는 `brand_sales`(N:M)가 source of truth. `users.assigned_sales_id`는 레거시 1:N.
- 이미지 재제출 체인: `images.previous_image_id → images.id` (self-FK), 같은 배치는 `resubmission_group_id`로 묶음.

---

**최종 업데이트**: 2026-06-29
