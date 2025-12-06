# 데이터베이스 스키마 설계

## 개요
리뷰 캠페인 관리 시스템의 데이터베이스 스키마 설계 문서입니다.

## ERD 개념도

```
users (사용자)
  ↓
campaigns (캠페인) ← created_by (영업사)
  ↓
items (품목)
  ↓
buyers (구매자/리뷰어)
  ↓
images (리뷰 이미지)

campaign_operators (캠페인-진행자 매핑) ← 총관리자가 배정
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_username ON users(username);
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
- `created_at`: 생성일시
- `updated_at`: 수정일시
- `last_login`: 마지막 로그인 시각

---

### 2. campaigns (캠페인 테이블)
영업사가 생성하는 캠페인 정보

```sql
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  brand_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX idx_campaigns_brand_id ON campaigns(brand_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
```

**컬럼 설명:**
- `id`: 캠페인 고유 ID
- `name`: 캠페인 이름
- `description`: 캠페인 설명
- `created_by`: 생성한 영업사 ID (users 테이블 FK)
- `brand_id`: 브랜드사 ID (users 테이블 FK, 해당 캠페인을 조회할 수 있는 브랜드사)
- `status`: 캠페인 상태 (active: 진행중, completed: 완료, cancelled: 취소)
- `start_date`: 시작일
- `end_date`: 종료일

---

### 3. items (품목 테이블)
캠페인 내의 개별 상품/품목 정보

```sql
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- 품목 기본 정보
  product_name VARCHAR(200) NOT NULL,
  shipping_type VARCHAR(20) CHECK (shipping_type IN ('실출고', '미출고')),
  keyword VARCHAR(200),

  -- 구매 목표
  total_purchase_count INTEGER,
  daily_purchase_count INTEGER,

  -- 상품 정보
  product_url TEXT,
  purchase_option VARCHAR(100),
  product_price DECIMAL(10, 2),

  -- 일정
  shipping_deadline TIMESTAMP,

  -- 리뷰 가이드
  review_guide TEXT,
  courier_service_yn BOOLEAN DEFAULT false,

  -- 기타
  notes TEXT,

  -- 이미지 업로드 링크 (자동 생성)
  upload_link_token VARCHAR(100) UNIQUE,

  -- 메타 정보
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_items_campaign_id ON items(campaign_id);
CREATE INDEX idx_items_upload_link_token ON items(upload_link_token);
CREATE INDEX idx_items_status ON items(status);
```

**컬럼 설명:**
- `id`: 품목 고유 ID
- `campaign_id`: 소속 캠페인 ID (campaigns 테이블 FK)
- `product_name`: 제품명
- `shipping_type`: 제품 미출고/실출고
- `keyword`: 희망 유입 키워드
- `total_purchase_count`: 총 구매 건수
- `daily_purchase_count`: 일 구매 건수
- `product_url`: 상품 확인 URL
- `purchase_option`: 구매 옵션
- `product_price`: 제품 구매 가격
- `shipping_deadline`: 출고 마감 시간
- `review_guide`: 리뷰가이드 및 소구점
- `courier_service_yn`: 택배대행 Y/N
- `notes`: 비고
- `upload_link_token`: 이미지 업로드 링크용 고유 토큰 (UUID)
- `status`: 품목 상태

---

### 4. campaign_operators (캠페인-진행자 매핑 테이블)
총관리자가 캠페인/품목에 진행자를 배정하는 테이블

```sql
CREATE TABLE campaign_operators (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  operator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- 캠페인 전체 또는 특정 품목에만 배정 가능
  -- item_id가 NULL이면 캠페인 전체, 값이 있으면 특정 품목에만 배정
  CONSTRAINT unique_campaign_operator UNIQUE(campaign_id, item_id, operator_id)
);

CREATE INDEX idx_campaign_operators_campaign ON campaign_operators(campaign_id);
CREATE INDEX idx_campaign_operators_item ON campaign_operators(item_id);
CREATE INDEX idx_campaign_operators_operator ON campaign_operators(operator_id);
```

**컬럼 설명:**
- `id`: 매핑 고유 ID
- `campaign_id`: 캠페인 ID
- `item_id`: 품목 ID (NULL이면 캠페인 전체, 값이 있으면 특정 품목)
- `operator_id`: 진행자 ID (users 테이블 FK)
- `assigned_by`: 배정한 관리자 ID
- `assigned_at`: 배정 일시

---

### 5. buyers (구매자/리뷰어 테이블)
진행자가 추가하는 구매자(리뷰어) 정보

```sql
CREATE TABLE buyers (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,

  -- 구매자 정보 (슬래시로 구분된 데이터)
  order_number VARCHAR(50) NOT NULL,
  buyer_name VARCHAR(100) NOT NULL,
  recipient_name VARCHAR(100) NOT NULL,
  user_id VARCHAR(100),
  contact VARCHAR(50),
  address TEXT,
  account_info VARCHAR(200),
  amount DECIMAL(10, 2),

  -- 입금 확인
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed')),
  payment_confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payment_confirmed_at TIMESTAMP,

  -- 리뷰 이미지 (별도 images 테이블과 1:N 관계)

  -- 비고
  notes TEXT,

  -- 메타 정보
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_buyers_item_id ON buyers(item_id);
CREATE INDEX idx_buyers_order_number ON buyers(order_number);
CREATE INDEX idx_buyers_payment_status ON buyers(payment_status);
```

**컬럼 설명:**
- `id`: 구매자 고유 ID
- `item_id`: 품목 ID (items 테이블 FK)
- `order_number`: 주문번호
- `buyer_name`: 구매자 이름
- `recipient_name`: 수취인 이름
- `user_id`: 아이디 (쇼핑몰 아이디 등)
- `contact`: 연락처
- `address`: 주소
- `account_info`: 계좌정보
- `amount`: 금액
- `payment_status`: 입금확인 상태 (pending: 미완료, completed: 완료)
- `payment_confirmed_by`: 입금 확인한 관리자 ID
- `payment_confirmed_at`: 입금 확인 일시
- `notes`: 비고
- `created_by`: 생성한 진행자 ID
- `created_at`: 생성일시
- `updated_at`: 수정일시

---

### 6. images (이미지 테이블)
구매자가 업로드한 리뷰 이미지

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

  -- 업로드 정보
  upload_token VARCHAR(100),
  uploaded_by_ip VARCHAR(50),

  -- 메타 정보
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_images_buyer_id ON images(buyer_id);
CREATE INDEX idx_images_item_id ON images(item_id);
CREATE INDEX idx_images_upload_token ON images(upload_token);
```

**컬럼 설명:**
- `id`: 이미지 고유 ID
- `buyer_id`: 구매자 ID (buyers 테이블 FK, 구매자와 연결되면 값 있음)
- `item_id`: 품목 ID (items 테이블 FK)
- `title`: 이미지 제목
- `file_name`: 원본 파일명
- `file_path`: 파일 경로
- `s3_key`: S3 객체 키
- `s3_url`: S3 접근 URL
- `file_size`: 파일 크기 (bytes)
- `mime_type`: MIME 타입 (image/jpeg, image/png 등)
- `upload_token`: 업로드 링크 토큰 (items.upload_link_token과 매칭)
- `uploaded_by_ip`: 업로드한 IP 주소
- `created_at`: 업로드 일시

---

## 권한별 접근 제어 규칙

### 총관리자 (admin)
- 모든 테이블에 대한 CRUD 권한
- `campaign_operators` 테이블을 통해 진행자 배정
- `buyers.payment_status` 체크 권한

### 영업사 (sales)
- `campaigns`: 자신이 생성한 캠페인만 CRUD
- `items`: 자신이 생성한 캠페인의 품목만 CRUD
- `buyers`: 자신의 캠페인/품목의 구매자 READ만
- `images`: 자신의 캠페인/품목의 이미지 READ만

### 진행자 (operator)
- `campaigns`: 자신에게 배정된 캠페인만 READ
- `items`: 자신에게 배정된 품목만 READ
- `buyers`: 자신에게 배정된 품목의 구매자만 CRUD
- `images`: 자신에게 배정된 품목의 이미지만 READ
- `payment_status`: 표시만 가능 (pending/completed), 체크 불가

### 브랜드사 (brand)
- `campaigns`: 자신이 연결된 캠페인만 READ
- `items`: 자신의 캠페인의 품목만 READ
- `buyers`: 제한된 컬럼만 READ (주문번호, 구매자, 수취인, 아이디, 금액)
- `images`: READ만

---

## 초기 데이터 (Seed Data)

### 기본 관리자 계정
```sql
-- 시더: 20241204000001-create-admin-user.js
INSERT INTO users (username, password_hash, name, role)
VALUES ('admin', '$2b$10$...', '시스템 관리자', 'admin');
-- Password: admin123!@#
```

### 마스터 계정 (역할별)
```sql
-- 시더: 20251206000000-create-master-users.js
-- 모든 계정의 비밀번호: rkddntkfkd94!

INSERT INTO users (username, password_hash, name, email, role, phone, is_active)
VALUES
  ('achiladmin', '$2b$10$...', '마스터 관리자', 'admin@kwad.co.kr', 'admin', '010-0000-0000', true),
  ('achilsales', '$2b$10$...', '마스터 영업사', 'sales@kwad.co.kr', 'sales', '010-0000-0001', true),
  ('achiloperator', '$2b$10$...', '마스터 진행자', 'operator@kwad.co.kr', 'operator', '010-0000-0002', true),
  ('achilbrand', '$2b$10$...', '마스터 브랜드사', 'brand@kwad.co.kr', 'brand', '010-0000-0003', true);
```

### 계정 정보 요약
| 역할 | Username | Password | 용도 |
|------|----------|----------|------|
| 총관리자 | `achiladmin` | `rkddntkfkd94!` | 마스터 관리자 |
| 영업사 | `achilsales` | `rkddntkfkd94!` | 마스터 영업사 |
| 진행자 | `achiloperator` | `rkddntkfkd94!` | 마스터 진행자 |
| 브랜드사 | `achilbrand` | `rkddntkfkd94!` | 마스터 브랜드사 |
| 기본 관리자 | `admin` | `admin123!@#` | 시스템 관리자 |

---

## 마이그레이션 순서

1. `users` 테이블 생성
2. `campaigns` 테이블 생성
3. `items` 테이블 생성
4. `campaign_operators` 테이블 생성
5. `buyers` 테이블 생성
6. `images` 테이블 생성

---

## 추가 고려사항

### 1. 소프트 삭제 (Soft Delete)
중요 데이터의 경우 물리적 삭제 대신 `deleted_at` 컬럼 추가 고려

### 2. 감사 로그 (Audit Log)
중요 작업에 대한 로그 테이블 추가 가능

### 3. 파일 저장소
- S3 버킷 구조: `purchaseweb-images/campaigns/{campaign_id}/items/{item_id}/{timestamp}_{filename}`

### 4. 인덱스 최적화
실제 쿼리 패턴에 따라 복합 인덱스 추가 가능

---

## MySQL 사용 시 변경사항

PostgreSQL 대신 MySQL을 사용하는 경우:

```sql
-- SERIAL → AUTO_INCREMENT
id INT AUTO_INCREMENT PRIMARY KEY,

-- TIMESTAMP DEFAULT CURRENT_TIMESTAMP는 동일

-- CHECK 제약조건은 MySQL 8.0.16 이상에서 지원
-- 이하 버전은 애플리케이션 레벨에서 검증
```
