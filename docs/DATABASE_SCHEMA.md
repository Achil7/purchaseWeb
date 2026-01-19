# 데이터베이스 스키마 설계

## 개요
리뷰 캠페인 관리 시스템의 데이터베이스 스키마 설계 문서입니다.

## ERD 개념도

```
users (사용자)
  ↓
monthly_brands (연월브랜드) ← 영업사/진행자 그룹핑
  ↓
campaigns (캠페인) ← created_by (영업사)
  ↓
items (품목)
  ↓
item_slots (품목 슬롯) ← 일 구매건수별 그룹화
  ↓
buyers (구매자/리뷰어)
  ↓
images (리뷰 이미지)

campaign_operators (품목-진행자 매핑) ← 총관리자가 배정
notifications (알림)
settings (시스템 설정)
user_activities (사용자 활동 로그)
user_memos (사용자 메모)
```

## 테이블 상세 설계

### 1. users (사용자 테이블)
사용자 계정 및 역할 관리

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'sales', 'operator', 'brand')),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  assigned_sales_id INTEGER REFERENCES users(id),  -- 브랜드사에 연결된 영업사
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_assigned_sales ON users(assigned_sales_id);
```

**컬럼 설명:**
- `id`: 사용자 고유 ID
- `username`: 로그인 아이디
- `password_hash`: 해시된 비밀번호 (bcrypt)
- `name`: 실명
- `email`: 이메일 (선택)
- `role`: 역할 (admin: 총관리자, sales: 영업사, operator: 진행자, brand: 브랜드사)
- `phone`: 연락처
- `is_active`: 계정 활성화 상태
- `assigned_sales_id`: 브랜드사에 연결된 영업사 ID
- `created_at`: 생성일시
- `updated_at`: 수정일시
- `last_login`: 마지막 로그인 시각

---

### 2. monthly_brands (연월브랜드 테이블)
영업사/진행자가 사용하는 월별 브랜드 그룹핑

```sql
CREATE TABLE monthly_brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  year_month VARCHAR(10) NOT NULL,  -- 'YYMM' 형식 (예: '2512')
  sales_id INTEGER REFERENCES users(id),
  operator_id INTEGER REFERENCES users(id),
  brand_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_monthly_brands_sales ON monthly_brands(sales_id);
CREATE INDEX idx_monthly_brands_operator ON monthly_brands(operator_id);
CREATE INDEX idx_monthly_brands_year_month ON monthly_brands(year_month);
```

**컬럼 설명:**
- `id`: 연월브랜드 고유 ID
- `name`: 연월브랜드명 (예: "2512어댑트")
- `year_month`: 연월 (YYMM 형식)
- `sales_id`: 담당 영업사 ID
- `operator_id`: 담당 진행자 ID
- `brand_id`: 브랜드사 ID
- `status`: 상태 (active, completed, cancelled)

---

### 3. campaigns (캠페인 테이블)
영업사가 생성하는 캠페인 정보

```sql
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  brand_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  monthly_brand_id INTEGER REFERENCES monthly_brands(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'new', 'hold', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX idx_campaigns_brand_id ON campaigns(brand_id);
CREATE INDEX idx_campaigns_monthly_brand ON campaigns(monthly_brand_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_registered_at ON campaigns(registered_at);
```

**컬럼 설명:**
- `id`: 캠페인 고유 ID
- `name`: 캠페인 이름 (예: "251213_삼성")
- `description`: 캠페인 설명
- `created_by`: 생성한 영업사 ID
- `brand_id`: 브랜드사 ID
- `monthly_brand_id`: 연월브랜드 ID
- `status`: 캠페인 상태 (new: 신규, active: 진행중, hold: 보류, completed: 완료, cancelled: 취소)
- `registered_at`: 등록일 (정렬용)

---

### 4. items (품목 테이블)
캠페인 내의 개별 상품/품목 정보

> **Note (2026-01-15)**: 엑셀 데이터 유연성을 위해 대부분의 필드가 TEXT 타입으로 변경됨. 제한 없이 어떤 값이든 저장 가능.

```sql
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- 품목 기본 정보 (TEXT 타입 - 파이프 구분 지원)
  product_name TEXT NOT NULL,
  shipping_type TEXT,                -- 출고 유형 (예: "실출고 | 미출고")
  keyword TEXT,                      -- 키워드 (파이프 구분 가능)

  -- 구매 목표 (TEXT 타입)
  total_purchase_count TEXT,         -- 총 구매 건수 (숫자로 파싱 필요)
  daily_purchase_count TEXT,         -- 일 구매 건수 (슬래시 구분, 예: "6/6", "2/2/2/.../2")

  -- 상품 정보
  product_url TEXT,
  purchase_option TEXT,
  product_price TEXT,                -- 가격 (TEXT, 파이프 구분 가능)

  -- 일정
  shipping_deadline TIMESTAMP,

  -- 리뷰 가이드
  review_guide TEXT,
  courier_service_yn TEXT,           -- 택배대행 Y/N (TEXT, 파이프 구분 가능)

  -- 기타
  notes TEXT,
  deposit_name TEXT,                 -- 입금명
  platform TEXT,                     -- 판매 플랫폼 (파이프 구분 가능)
  date TEXT,                         -- 품목 날짜 (TEXT)
  display_order INTEGER,             -- 품목 순번

  -- 이미지 업로드 링크 (자동 생성)
  upload_link_token TEXT UNIQUE,

  -- 매출 정보 (영업사 입력) - TEXT 타입, parseNumber()로 숫자 추출
  sale_price_per_unit TEXT,          -- 판매 단가
  courier_price_per_unit TEXT,       -- 택배대행 단가

  -- 지출 정보 (Admin 입력) - TEXT 타입
  expense_product TEXT,              -- 지출 - 제품비
  expense_courier TEXT,              -- 지출 - 택배비
  expense_review TEXT,               -- 지출 - 리뷰비용
  expense_other TEXT,                -- 지출 - 기타비용
  expense_note TEXT,                 -- 지출 메모

  -- 메타 정보
  status TEXT DEFAULT 'active',      -- 상태 (제한 없음)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_items_campaign_id ON items(campaign_id);
CREATE INDEX idx_items_upload_link_token ON items(upload_link_token);
CREATE INDEX idx_items_status ON items(status);
```

**컬럼 설명:**
- `id`: 품목 고유 ID
- `campaign_id`: 소속 캠페인 ID
- `product_name`: 제품명
- `shipping_type`: 제품 미출고/실출고
- `keyword`: 희망 유입 키워드
- `total_purchase_count`: 총 구매 건수
- `daily_purchase_count`: 일 구매 건수 (슬래시 구분, 예: "6/6", "2/2/2/.../2" - TEXT 타입, 길이 제한 없음)
- `product_url`: 상품 확인 URL
- `purchase_option`: 구매 옵션
- `product_price`: 제품 구매 가격
- `shipping_deadline`: 출고 마감 시간
- `review_guide`: 리뷰가이드 및 소구점
- `courier_service_yn`: 택배대행 Y/N
- `notes`: 비고
- `deposit_name`: 입금명 (Admin/Operator/Sales가 수정 가능)
- `platform`: 판매 플랫폼 (쿠팡, 네이버, 11번가 등)
- `date`: 품목 날짜
- `display_order`: 품목 순번
- `upload_link_token`: 이미지 업로드 링크용 고유 토큰 (UUID)
- `sale_price_per_unit`: 견적서 판매 단가 (원/개)
- `courier_price_per_unit`: 견적서 택배대행 단가 (원/개)
- `expense_product`: 지출 - 제품비 (원)
- `expense_courier`: 지출 - 택배비 (원)
- `expense_review`: 지출 - 리뷰비용 (원)
- `expense_other`: 지출 - 기타비용 (원)
- `expense_note`: 지출 메모
- `status`: 품목 상태

---

### 5. item_slots (품목 슬롯 테이블)
일 구매건수별로 그룹화된 슬롯 정보. **day_group별 독립 제품 정보를 저장**하여 일마감(splitDayGroup) 시 제품 정보가 복사됩니다.

> **Note (2026-01-15)**: day_group별 독립 제품 정보 필드 추가. 일마감 시 현재 day_group의 제품 정보가 새 day_group 슬롯에 복사되어 완전히 독립적으로 관리됩니다.

```sql
CREATE TABLE item_slots (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  day_group INTEGER NOT NULL,  -- 일차 그룹 (1, 2, 3...)
  slot_number INTEGER NOT NULL,  -- 해당 일차 내 슬롯 번호

  -- 슬롯 정보
  date TEXT,                    -- 날짜 (진행자 입력)
  expected_buyer TEXT,          -- 예상 구매자 (진행자 입력)
  buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
  review_cost INTEGER,          -- 리뷰비용 (진행자 입력)

  -- day_group별 독립 제품 정보 (일마감 시 복사됨)
  product_name TEXT,            -- 제품명
  purchase_option TEXT,         -- 구매 옵션
  keyword TEXT,                 -- 키워드
  product_price TEXT,           -- 가격
  notes TEXT,                   -- 특이사항
  platform TEXT,                -- 플랫폼
  shipping_type TEXT,           -- 출고 유형
  total_purchase_count TEXT,    -- 총 구매건수
  daily_purchase_count TEXT,    -- 일 구매건수
  courier_service_yn TEXT,      -- 택배대행 여부
  product_url TEXT,             -- 상품 URL

  -- 이미지 업로드 토큰 (그룹별)
  upload_link_token VARCHAR(100),

  -- 상태
  status TEXT DEFAULT 'active',

  -- 메타 정보
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP          -- 소프트 삭제
);

CREATE INDEX idx_item_slots_item_id ON item_slots(item_id);
CREATE INDEX idx_item_slots_day_group ON item_slots(day_group);
CREATE INDEX idx_item_slots_buyer_id ON item_slots(buyer_id);
CREATE INDEX idx_item_slots_status ON item_slots(status);
CREATE INDEX idx_item_slots_upload_token ON item_slots(upload_link_token);
CREATE INDEX idx_item_slots_deleted_at ON item_slots(deleted_at);
CREATE UNIQUE INDEX idx_item_slots_item_slot_unique ON item_slots(item_id, slot_number);
```

**컬럼 설명:**
- `id`: 슬롯 고유 ID
- `item_id`: 품목 ID
- `day_group`: 일차 그룹 번호
- `slot_number`: 해당 일차 내 슬롯 순번
- `date`: 날짜 (진행자가 입력)
- `expected_buyer`: 예상 구매자명
- `buyer_id`: 연결된 구매자 ID
- `review_cost`: 리뷰비용
- `upload_link_token`: 그룹별 이미지 업로드 토큰

**day_group별 독립 제품 정보 필드:**
- `product_name`: 제품명 (슬롯에 값이 있으면 슬롯 값 사용, 없으면 Item 값 사용)
- `purchase_option`: 구매 옵션
- `keyword`: 키워드
- `product_price`: 가격
- `notes`: 특이사항
- `platform`: 플랫폼
- `shipping_type`: 출고 유형 (미출고/실출고)
- `total_purchase_count`: 총 구매건수
- `daily_purchase_count`: 일 구매건수
- `courier_service_yn`: 택배대행 여부
- `product_url`: 상품 URL

**일마감(splitDayGroup) 동작:**
1. 선택된 슬롯들의 day_group을 새 값으로 변경
2. 새 upload_link_token 할당
3. 현재 day_group의 제품 정보를 새 day_group 슬롯에 복사
4. CampaignOperator에 새 day_group 배정 레코드 자동 생성

---

### 6. campaign_operators (캠페인-진행자 매핑 테이블)
총관리자가 캠페인/품목에 진행자를 배정하는 테이블. **일차별(day_group) 배정을 지원**하여 같은 품목의 다른 일차를 다른 진행자에게 배정할 수 있습니다.

```sql
CREATE TABLE campaign_operators (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  operator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- 일차별 배정 지원 (day_group)
  day_group INTEGER,  -- null이면 전체 품목 배정, 숫자면 해당 일차만 배정

  -- day_group 포함 unique constraint
  CONSTRAINT unique_campaign_operator_daygroup UNIQUE(campaign_id, item_id, day_group, operator_id)
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

---

### 7. buyers (구매자/리뷰어 테이블)
진행자가 추가하는 구매자(리뷰어) 정보

> **Note (2026-01-15)**: 모든 데이터 필드가 TEXT 타입으로 변경됨. allowNull: true로 변경되어 데이터 삭제(빈 값 저장) 가능.

```sql
CREATE TABLE buyers (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  slot_id INTEGER REFERENCES item_slots(id) ON DELETE SET NULL,

  -- 구매자 정보 (TEXT 타입 - 제한 없음)
  order_number TEXT,               -- 주문번호
  buyer_name TEXT,                 -- 구매자명
  recipient_name TEXT,             -- 수취인명
  user_id TEXT,                    -- 아이디
  contact TEXT,                    -- 연락처
  address TEXT,                    -- 주소
  account_info TEXT,               -- 계좌정보
  amount TEXT DEFAULT '0',         -- 금액 (TEXT)
  tracking_number TEXT,            -- 송장번호
  courier_company TEXT,            -- 택배사

  -- 계좌번호 매칭용
  account_normalized TEXT,         -- 정규화된 계좌번호
  is_temporary BOOLEAN DEFAULT false,

  -- 배송 상태
  shipping_delayed BOOLEAN DEFAULT false,

  -- 입금 확인
  payment_status VARCHAR(20) DEFAULT 'pending',
  payment_confirmed_by INTEGER REFERENCES users(id),
  payment_confirmed_at TIMESTAMP,

  -- 비고
  notes TEXT,

  -- 메타 정보
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_buyers_item_id ON buyers(item_id);
CREATE INDEX idx_buyers_slot_id ON buyers(slot_id);
CREATE INDEX idx_buyers_order_number ON buyers(order_number);
CREATE INDEX idx_buyers_account_normalized ON buyers(account_normalized);
CREATE INDEX idx_buyers_is_temporary ON buyers(is_temporary);
```

**계좌번호 정규화 규칙:**
```
입력: "국민 111-1234-123456 홍길동"
정규화: "1111234123456" (숫자만 추출, 최소 8자리 이상)
```

---

### 8. images (이미지 테이블)
구매자가 업로드한 리뷰 이미지

```sql
CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER REFERENCES buyers(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  slot_id INTEGER REFERENCES item_slots(id) ON DELETE SET NULL,

  -- 이미지 정보
  title VARCHAR(200),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  s3_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(50),

  -- 계좌번호 매칭용
  account_normalized VARCHAR(50),

  -- 업로드 정보
  upload_token VARCHAR(100),
  uploaded_by_ip VARCHAR(50),

  -- 메타 정보
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_images_buyer_id ON images(buyer_id);
CREATE INDEX idx_images_item_id ON images(item_id);
CREATE INDEX idx_images_slot_id ON images(slot_id);
CREATE INDEX idx_images_upload_token ON images(upload_token);
CREATE INDEX idx_images_account_normalized ON images(account_normalized);
```

---

### 9. notifications (알림 테이블)
시스템 알림 정보

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,  -- 'pre_upload', 'assignment', 'payment', etc.
  title VARCHAR(200) NOT NULL,
  message TEXT,
  related_item_id INTEGER REFERENCES items(id),
  related_campaign_id INTEGER REFERENCES campaigns(id),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
```

---

### 10. settings (시스템 설정 테이블)
시스템 전역 설정

```sql
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  description VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_settings_key ON settings(key);
```

**주요 설정 키:**
- `announcement`: 로그인 페이지 공지사항
- `banner_title_admin`: Admin 배너 제목
- `banner_title_sales`: Sales 배너 제목
- `banner_title_operator`: Operator 배너 제목
- `banner_title_brand`: Brand 배너 제목

---

### 11. user_activities (사용자 활동 로그 테이블)
사용자 활동 추적

```sql
CREATE TABLE user_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,  -- 'login', 'logout', 'create', 'update', 'delete'
  entity_type VARCHAR(50),  -- 'campaign', 'item', 'buyer', etc.
  entity_id INTEGER,
  details JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_activities_user ON user_activities(user_id);
CREATE INDEX idx_user_activities_action ON user_activities(action);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at);
```

---

### 12. user_memos (사용자 메모 테이블)
Admin이 사용자에게 남기는 메모

```sql
CREATE TABLE user_memos (
  id SERIAL PRIMARY KEY,
  target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_memos_target ON user_memos(target_user_id);
CREATE INDEX idx_user_memos_created_by ON user_memos(created_by);
```

---

## 권한별 접근 제어 규칙

### 총관리자 (admin)
- 모든 테이블에 대한 CRUD 권한
- `campaign_operators` 테이블을 통해 진행자 배정
- `buyers.payment_status` 체크 권한
- **컨트롤 타워에서 모든 사용자 대시보드 조회 가능**

### 영업사 (sales)
- `campaigns`: 자신이 생성한 캠페인만 CRUD
- `items`: 자신이 생성한 캠페인의 품목만 CRUD
- `buyers`: 자신의 캠페인/품목의 구매자 READ만
- `images`: 자신의 캠페인/품목의 이미지 READ만
- `deposit_name`: 수정 가능

### 진행자 (operator)
- `campaigns`: 자신에게 배정된 캠페인만 READ
- `items`: 자신에게 배정된 품목만 READ
- `item_slots`: 자신에게 배정된 품목의 슬롯 CRUD
- `buyers`: 자신에게 배정된 품목의 구매자만 CRUD
- `images`: 자신에게 배정된 품목의 이미지만 READ
- `deposit_name`: 수정 가능
- `payment_status`: 표시만 가능 (pending/completed), 체크 불가

### 브랜드사 (brand)
- `campaigns`: 자신이 연결된 캠페인만 READ
- `items`: 자신의 캠페인의 품목만 READ
- `buyers`: 제한된 컬럼만 READ (주문번호, 구매자, 수취인, 아이디, 리뷰샷)
- `images`: READ만

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

## 마이그레이션 파일 목록

```
migrations/
├── 20241204000001-create-users.js
├── 20241204000002-create-campaigns.js
├── 20241204000003-create-items.js
├── 20241204000004-create-campaign-operators.js
├── 20241204000005-create-buyers.js
├── 20241204000006-create-images.js
├── 20251210000001-add-account-fields.js           # account_normalized, is_temporary
├── 20251211000001-alter-buyer-amount-integer.js
├── 20251211000002-add-tracking-number-to-buyers.js
├── 20251211000003-add-deposit-name-to-items.js
├── 20251211100001-add-assigned-sales-to-users.js
├── 20251211100002-add-registered-at-to-campaigns.js
├── 20251211100003-create-notifications.js
├── 20251216000001-add-notification-types.js
├── 20251217000001-create-settings.js
├── 20251217000002-add-announcement-setting.js
├── 20251217000003-add-banner-titles.js
├── 20251217000004-create-user-activities.js
├── 20251217000005-add-user-activity-fields.js
├── 20251221000001-create-user-memos.js
├── 20251223000001-create-monthly-brands.js
├── 20251224000001-add-is-hidden-fields.js
├── 20251224000001-create-item-slots.js
├── 20251224000002-add-campaign-status-values.js
├── 20251224000003-seed-existing-item-slots.js
├── 20251227000001-add-expected-buyer-to-item-slots.js
├── 20251228000001-add-day-group-and-upload-token-to-item-slots.js
├── 20251231000001-create-sheet-memos.js
├── 20251231000002-populate-upload-link-tokens.js
├── 20251231000003-add-day-group-to-campaign-operators.js
├── 20260103000001-fix-campaign-operator-unique-index.js
├── 20260105000001-add-platform-to-items.js
├── 20260106000001-add-revenue-expense-to-items.js
├── 20260108000001-change-daily-purchase-count-to-string.js
├── 20260109000001-add-courier-company-to-buyers.js
├── 20260110000001-create-brand-sales.js
├── 20260110000001-remove-enum-constraints.js
├── 20260110000002-add-date-and-display-order-to-items.js
├── 20260115195338-change-all-columns-to-text.js   # Item, Buyer 필드 TEXT 타입 변경
└── 20260115200001-add-product-fields-to-item-slots.js  # ItemSlot에 day_group별 독립 제품 정보 필드 추가
```

---

## 추가 고려사항

### 1. 소프트 삭제 (Soft Delete)
중요 데이터의 경우 물리적 삭제 대신 `deleted_at` 컬럼 추가 고려

### 2. 감사 로그 (Audit Log)
`user_activities` 테이블로 중요 작업 로깅

### 3. 파일 저장소
- S3 버킷 구조: `your-bucket-name/campaigns/{campaign_id}/items/{item_id}/{timestamp}_{filename}`

### 4. 인덱스 최적화
실제 쿼리 패턴에 따라 복합 인덱스 추가 가능

---

**최종 업데이트**: 2026-01-15
