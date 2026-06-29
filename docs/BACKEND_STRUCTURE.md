# 백엔드 구조 설계

## 개요
Node.js + Express 기반의 RESTful API 서버

본 문서는 `backend/src/routes/`의 실제 라우트 파일과 `backend/src/app.js`의 마운트 설정을 그대로 반영한 백엔드 API 레퍼런스입니다. 아래 모든 엔드포인트는 실제 코드에 존재합니다.

## 기술 스택 결정

### 백엔드 프레임워크
- **Node.js 18+** + **Express.js**
  - 이유: 빠른 개발, 가벼운 구조, React와 동일한 언어(JavaScript)

### 데이터베이스
- **PostgreSQL** (AWS RDS)
- **ORM**: Sequelize
  - 이유: 마이그레이션 관리 용이, 모델 기반 관계 정의

### 인증 (구현 완료)
- **JWT (JSON Web Token)** - 7일 만료 (웹 세션)
- **Refresh Token** - 모바일 로그인용 (별도 `refresh_tokens` 테이블)
- **bcrypt** - 비밀번호 해싱
- **jsonwebtoken** - JWT 생성 및 검증

### 파일 업로드
- **AWS SDK v3** - S3 업로드
- **multer** - 파일 업로드 처리 (리뷰 이미지 최대 10MB/파일, 로그인 배너 5MB)
- **uuid** - 고유 토큰/파일명 생성

### 기타
- **dotenv** - 환경 변수 관리
- **cors** - CORS 설정
- **helmet** - 보안 헤더 (CSP 포함)
- **morgan** - HTTP 로깅

## 프로젝트 구조

```
purchaseweb/
├── backend/                      # 백엔드 루트
│   ├── src/
│   │   ├── config/              # 설정 파일 (database.js, s3.js 등)
│   │   │
│   │   ├── models/              # Sequelize 모델 (index.js에서 통합 등록)
│   │   │
│   │   ├── middleware/          # 미들웨어
│   │   │   ├── auth.js          # JWT 인증 (generateToken, authenticate, authorize)
│   │   │   ├── errorHandler.js  # 에러 핸들러
│   │   │   └── upload.js        # 파일 업로드 (multer)
│   │   │
│   │   ├── controllers/         # 컨트롤러
│   │   │   ├── aiChatController.js
│   │   │   ├── authController.js
│   │   │   ├── brandDashboardController.js
│   │   │   ├── brandSettlementController.js
│   │   │   ├── buyerAnalyticsController.js
│   │   │   ├── buyerController.js
│   │   │   ├── campaignController.js
│   │   │   ├── imageController.js
│   │   │   ├── itemController.js
│   │   │   ├── itemSlotController.js
│   │   │   ├── memoController.js
│   │   │   ├── notificationController.js
│   │   │   ├── rankingController.js
│   │   │   └── salesDashboardController.js
│   │   │   └── settingController.js
│   │   │
│   │   ├── routes/              # 라우트 (app.js에서 마운트)
│   │   │   ├── aiChat.js
│   │   │   ├── auth.js
│   │   │   ├── brandDashboard.js
│   │   │   ├── brandSettlements.js
│   │   │   ├── buyerAnalytics.js
│   │   │   ├── buyers.js
│   │   │   ├── campaigns.js
│   │   │   ├── images.js
│   │   │   ├── itemSlots.js
│   │   │   ├── items.js
│   │   │   ├── memos.js
│   │   │   ├── monthlyBrands.js   # 핸들러 인라인 구현 (전용 컨트롤러 없음)
│   │   │   ├── notifications.js
│   │   │   ├── rankings.js
│   │   │   ├── salesDashboard.js
│   │   │   ├── settings.js
│   │   │   ├── sheetMemos.js      # 핸들러 인라인 구현 (전용 컨트롤러 없음)
│   │   │   ├── trash.js           # 핸들러 인라인 구현 (전용 컨트롤러 없음)
│   │   │   └── users.js           # 핸들러 인라인 구현 (전용 컨트롤러 없음)
│   │   │
│   │   └── app.js               # Express 앱 설정 + 라우트 마운트 + /health
│   │
│   ├── migrations/              # DB 마이그레이션
│   ├── seeders/                 # 시드 데이터
│   ├── .env.example             # 환경 변수 예시
│   ├── package.json
│   └── server.js                # 서버 진입점
│
├── frontend/                    # 프론트엔드 (React)
├── deploy/                      # 배포 설정
└── docs/                        # 문서
```

> **참고**: `users.js`, `monthlyBrands.js`, `sheetMemos.js`, `trash.js`는 별도 컨트롤러 파일 없이 라우트 파일 안에 핸들러를 인라인으로 구현합니다. (`userController.js`, `monthlyBrandController.js`, `sheetMemoController.js`, `trashController.js`는 존재하지 않음.)

## 라우트 마운트 (`backend/src/app.js`)

| 마운트 경로 | 라우트 파일 |
|---|---|
| `/api/auth` | `routes/auth.js` |
| `/api/users` | `routes/users.js` |
| `/api/campaigns` | `routes/campaigns.js` |
| `/api/items` | `routes/items.js` |
| `/api/buyers` | `routes/buyers.js` |
| `/api/images` | `routes/images.js` |
| `/api/notifications` | `routes/notifications.js` |
| `/api/settings` | `routes/settings.js` |
| `/api/memos` | `routes/memos.js` |
| `/api/monthly-brands` | `routes/monthlyBrands.js` |
| `/api/item-slots` | `routes/itemSlots.js` |
| `/api/sheet-memos` | `routes/sheetMemos.js` |
| `/api/trash` | `routes/trash.js` |
| `/api/brand-settlements` | `routes/brandSettlements.js` |
| `/api/brand-dashboard` | `routes/brandDashboard.js` |
| `/api/sales-dashboard` | `routes/salesDashboard.js` |
| `/api/rankings` | `routes/rankings.js` |
| `/api/buyer-analytics` | `routes/buyerAnalytics.js` |
| `/api/ai-chat` | `routes/aiChat.js` |

이외에 헬스 체크용 `GET /health` (인증 불필요)가 `app.js`에 직접 정의되어 있습니다.

## 공통 사항

- **인증 미들웨어**: `authenticate` = 로그인 필수(JWT 검증), `authorize([...])` = 지정 역할만 허용, "Public" = 인증 불필요. 일부 라우트는 컨트롤러 내부에서 레코드 단위 소유권을 추가로 검사합니다 (예: 캠페인/품목 수정·삭제).
- **viewAsUserId**: Admin이 다른 사용자(영업사/진행자/브랜드사)의 입장에서 데이터를 조회·생성할 수 있게 하는 쿼리/바디 파라미터입니다. 지원 엔드포인트 목록은 문서 하단의 "viewAsUserId 지원" 섹션을 참고하세요.
- **모바일 인증**: 웹 JWT(7일)와 별개로 모바일은 Access + Refresh Token 흐름을 사용합니다 (`mobile-login` / `refresh` / `mobile-logout` + `heartbeat`).

---

## API 엔드포인트

### Auth (`/api/auth`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| POST | `/api/auth/login` | Public | 로그인 (JWT 발급) |
| POST | `/api/auth/logout` | Private | 로그아웃 |
| GET | `/api/auth/me` | Private | 현재 사용자 정보 |
| POST | `/api/auth/verify-password` | Private | 비밀번호 재확인 (2차 검증) |
| PUT | `/api/auth/profile` | Private | 프로필 수정 (name, password) |
| POST | `/api/auth/mobile-login` | Public | 모바일 로그인 (Access + Refresh Token 발급) |
| POST | `/api/auth/refresh` | Public | Refresh Token으로 Access Token 갱신 |
| POST | `/api/auth/mobile-logout` | Public | 모바일 로그아웃 (Refresh Token 폐기) |
| POST | `/api/auth/heartbeat` | Private | 사용자 활동 상태 갱신 (last_activity) |

### Users (`/api/users`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/users` | Private (admin; role=brand도 sales 허용) | 사용자 목록 (role 필터) |
| GET | `/api/users/my-brands` | sales, admin | 로그인 영업사 담당 브랜드 목록 (BrandSales 기준) |
| GET | `/api/users/sales/:salesId/brands` | admin | 특정 영업사 담당 브랜드 목록 |
| POST | `/api/users/brand` | sales, admin | 브랜드 사용자 생성 + 영업사 자동 할당 |
| GET | `/api/users/control-tower/users` | admin | 컨트롤 타워용 사용자 목록 (초기비번/온라인/로그인횟수 포함) |
| POST | `/api/users/brands/:brandId/assign-me` | sales, admin | 영업사가 기존 브랜드에 자신을 할당 (멱등) |
| GET | `/api/users/brands/:brandId/sales` | admin | 특정 브랜드 담당 영업사 목록 |
| POST | `/api/users/brands/:brandId/sales` | admin | 브랜드에 영업사 추가 할당 |
| DELETE | `/api/users/brands/:brandId/sales/:salesId` | admin | 브랜드-영업사 할당 해제 |
| GET | `/api/users/sales/:fromSalesId/transfer-preview` | admin | 영업사 전체 인수인계 미리보기 (DB 변경 없음) |
| POST | `/api/users/sales/:fromSalesId/transfer-all/:toSalesId` | admin | 영업사 A에서 B로 전체 권한 일괄 이전 |
| GET | `/api/users/brands/:brandId/transfer-preview` | admin | 특정 브랜드 한정 영업사 이전 미리보기 (query fromSalesId) |
| POST | `/api/users/brands/:brandId/transfer` | admin | 특정 브랜드 한정 영업사 A에서 B로 이전 (body fromSalesId/toSalesId) |
| POST | `/api/users` | admin | 사용자 생성 |
| GET | `/api/users/brands-for-review-search` | admin, operator | 리뷰샷 검색/구매자 분석용 브랜드사 드롭다운 옵션 |
| GET | `/api/users/:id` | admin | 사용자 상세 |
| PUT | `/api/users/:id` | admin | 사용자 수정 |
| PATCH | `/api/users/:id/deactivate` | admin | 사용자 비활성화 (리프레시 토큰 폐기) |
| PATCH | `/api/users/:id/activate` | admin | 사용자 재활성화 |
| DELETE | `/api/users/:id` | admin | 사용자 삭제 (force/delegateTo 쿼리로 연관데이터 위임/cascade) |
| POST | `/api/users/:id/reset-password` | admin | 비밀번호 초기화 (임시 8자리 발급) |
| GET | `/api/users/:id/activities` | admin | 사용자 활동 로그 (limit/offset/date) |
| GET | `/api/users/:id/stats` | admin | 사용자 활동 통계 (일별 로그인, days) |
| GET | `/api/users/:id/campaigns` | admin | 사용자 역할별 캠페인 목록 |
| GET | `/api/users/:id/items` | admin | 사용자 역할별 품목 목록 (campaign_id 필터) |
| GET | `/api/users/:id/buyers` | admin | 사용자 역할별 구매자 목록 (item_id 필터) |

> 브랜드-영업사 N:M 매핑은 `brand_sales` 테이블 기반입니다. `DELETE /api/users/:id`는 단순 비활성화가 아니라 실제 삭제이며, 활성/비활성 전환은 별도의 `deactivate`/`activate` 엔드포인트입니다.

### Campaigns (`/api/campaigns`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/campaigns` | Private (역할별 필터) | 캠페인 목록 |
| POST | `/api/campaigns` | sales, admin | 캠페인 생성 |
| GET | `/api/campaigns/:id` | Private | 캠페인 상세 |
| PUT | `/api/campaigns/:id` | Private (owner/admin, 컨트롤러 체크) | 캠페인 수정 |
| DELETE | `/api/campaigns/:id` | Private (owner/admin, 컨트롤러 체크) | 캠페인 삭제 |
| DELETE | `/api/campaigns/:id/cascade` | admin, sales, operator | 캠페인 강제 삭제 (하위 cascade) |
| PATCH | `/api/campaigns/:id/hide` | Private (전 역할) | 캠페인 숨기기 |
| PATCH | `/api/campaigns/:id/restore` | Private (전 역할) | 캠페인 복구 |
| POST | `/api/campaigns/:id/operators` | admin | 진행자 배정 |
| DELETE | `/api/campaigns/:campaignId/operators/:operatorId` | admin | 진행자 배정 해제 |
| GET | `/api/campaigns/:id/operators` | Private | 배정된 진행자 목록 |
| PATCH | `/api/campaigns/:id/change-sales` | admin | 캠페인 영업사 변경 |

### Items (`/api/items`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/items/token/:token` | Public | 토큰으로 품목 조회 (업로드 페이지용) |
| GET | `/api/items` | admin | 전체 품목 목록 (진행자 배정용) |
| GET | `/api/items/my-assigned` | operator, admin | 내게 배정된 품목 |
| GET | `/api/items/my-monthly-brands` | operator, admin | 내게 배정된 연월브랜드 (viewAsUserId 지원) |
| GET | `/api/items/by-brand` | brand, admin | 브랜드별 품목 |
| GET | `/api/items/by-sales` | sales, admin | 영업사 캠페인 품목 (일별 조회) |
| GET | `/api/items/by-operator` | operator, admin | 진행자 배정 품목 플랫 리스트 (일별 조회) |
| GET | `/api/items/campaign/:campaignId` | Private | 캠페인별 품목 |
| POST | `/api/items/campaign/:campaignId` | sales, admin | 품목 생성 |
| POST | `/api/items/campaign/:campaignId/bulk` | sales, admin | 품목 일괄 생성 |
| GET | `/api/items/:id` | Private | 품목 상세 |
| PUT | `/api/items/:id` | Private (owner/admin) | 품목 수정 |
| POST | `/api/items/:id/operator` | admin | 품목에 진행자 배정 (day_group 지원) |
| PUT | `/api/items/:id/operator` | admin | 품목 진행자 재배정 |
| DELETE | `/api/items/:id/operator/:operatorId` | admin | 품목 진행자 배정 해제 |
| PATCH | `/api/items/:id/deposit-name` | operator, admin, sales | 입금명 수정 |
| DELETE | `/api/items/:id` | Private (owner/admin) | 품목 삭제 |

**진행자 배정 API Body 예시:**
```json
{
  "operatorId": 21,
  "day_group": 1
}
```
`day_group`이 null이면 전체 품목, 숫자면 해당 일차만 배정합니다.

### Item Slots (`/api/item-slots`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/item-slots/item/:itemId` | sales, admin, operator | 품목별 슬롯 목록 |
| GET | `/api/item-slots/campaign/:campaignId` | sales, admin, brand | 캠페인별 전체 슬롯 |
| GET | `/api/item-slots/by-product-name` | brand, admin | 제품명으로 브랜드 전체 캠페인 슬롯 통합 검색 (viewAsUserId 지원) |
| GET | `/api/item-slots/operator/campaign/:campaignId` | operator, admin | Operator용 캠페인별 배정 슬롯 (viewAsUserId 지원) |
| GET | `/api/item-slots/operator/my-assigned` | operator, admin | Operator용 전체 배정 슬롯 |
| GET | `/api/item-slots/by-date` | operator, sales, admin | 날짜별 슬롯 (날짜별 작업 페이지) |
| GET | `/api/item-slots/operator/overdue` | operator, admin | 14일 경과 + 리뷰샷 미제출 슬롯 |
| GET | `/api/item-slots/operator/monthly-counts` | operator, admin | 월별 일자별 카운트 (전체/작성/리뷰샷) |
| POST | `/api/item-slots/adjust-daily-count` | sales, admin | 일건수 조정 (day_group별 슬롯 수 변경) |
| POST | `/api/item-slots` | sales, admin, operator | 슬롯 추가 |
| PUT | `/api/item-slots/:id` | sales, admin, operator | 슬롯 개별 수정 |
| PUT | `/api/item-slots/bulk/update` | sales, admin, operator | 다중 슬롯 일괄 수정 |
| GET | `/api/item-slots/token/:token` | Public | 슬롯 토큰 조회 (업로드 페이지) |
| DELETE | `/api/item-slots/bulk/delete` | sales, admin, operator | 다중 슬롯 삭제 |
| DELETE | `/api/item-slots/group/:itemId/:dayGroup` | sales, admin, operator | 그룹별(day_group) 슬롯 삭제 |
| DELETE | `/api/item-slots/item/:itemId` | sales, admin | 품목 전체 슬롯 삭제 |
| DELETE | `/api/item-slots/:id` | sales, admin, operator | 개별 슬롯 삭제 |
| POST | `/api/item-slots/:slotId/split-day-group` | sales, admin, operator | 일 마감 (day_group 분할 + 진행자/제품정보 복사) |
| POST | `/api/item-slots/suspend` | admin | day_group 중단 (배정 해제 + 중단 상태) |
| POST | `/api/item-slots/resume` | admin | day_group 재개 |

### Buyers (`/api/buyers`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/buyers/by-month` | operator, sales, admin | 월별 구매자 (이미지 업로드일 기준, KST) |
| GET | `/api/buyers/by-date` | operator, sales, admin | 일별 구매자 (KST) |
| GET | `/api/buyers/item/:itemId` | Private | 품목 구매자 목록 |
| POST | `/api/buyers/item/:itemId` | operator, admin | 구매자 추가 |
| POST | `/api/buyers/item/:itemId/parse` | operator, admin | 슬래시 구분 파싱 후 구매자 추가 |
| POST | `/api/buyers/item/:itemId/bulk` | operator, admin | 다중 구매자 일괄 추가 |
| POST | `/api/buyers/item/:itemId/tracking-bulk` | admin | 송장번호 일괄 입력 (등록 순서 매칭) |
| GET | `/api/buyers/courier-tracking` | admin | 택배대행(Y) 구매자 조회 (날짜별 송장관리) |
| GET | `/api/buyers/:id` | Private | 구매자 상세 |
| PUT | `/api/buyers/:id` | operator, admin | 구매자 수정 |
| DELETE | `/api/buyers/:id` | operator, admin | 구매자 삭제 |
| PATCH | `/api/buyers/:id/payment` | admin | 입금 확인 토글 |
| PATCH | `/api/buyers/:id/tracking` | sales, admin | 송장번호 수정 |
| PATCH | `/api/buyers/:id/tracking-info` | admin | 송장정보(번호+택배사) 수정 |
| PATCH | `/api/buyers/:id/shipping-delayed` | admin, operator | 배송지연 상태 토글 |
| PATCH | `/api/buyers/:id/courier` | admin | 택배사 수정 |

### Images (`/api/images`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/images/search-buyers/:token` | Public (토큰) | 이름으로 구매자 검색 (업로드 선택용) |
| POST | `/api/images/upload/:token` | Public (토큰) | 다중 이미지 업로드 (buyer_ids 직접 매칭, multer) |
| GET | `/api/images/item/:itemId` | Private | 품목 이미지 목록 |
| DELETE | `/api/images/:id` | operator, admin | 리뷰샷 삭제 (Buyer 리뷰 필드 초기화) |
| GET | `/api/images/pending` | admin | 대기 중(status=pending) 재제출 이미지 목록 |
| GET | `/api/images/pending/count` | admin | 대기 중 재제출 이미지 개수 (알림 배지) |
| GET | `/api/images/search` | admin, operator | 리뷰샷 검색 (브랜드사 필수, 제품명/기간 선택) |
| POST | `/api/images/:id/approve` | admin | 재제출 이미지 승인 |
| POST | `/api/images/:id/reject` | admin | 재제출 이미지 거절 (reason) |
| GET | `/api/images/proxy` | Private | 이미지 프록시 (CORS 우회, ZIP 다운로드용, query url) |

**구매자 검색 API:**
```
GET /api/images/search-buyers/:token?name=홍길동
```
이미지 업로드 전, 이름으로 동일 슬롯 그룹 내 구매자를 검색하여 업로드 대상 주문을 선택합니다.

**이미지 업로드 API:**
```
POST /api/images/upload/:token
Body: {
  buyer_ids: [234, 235],  // 선택된 구매자 ID 배열
  images: File[]          // 선택한 주문에 직접 매칭
}
```

> **이미지 승인 워크플로우**: 이미지는 `status`(pending/approved/rejected)를 가집니다. 통계/대시보드 집계는 `images.status='approved'`만 포함합니다. 재제출 이미지는 `pending` 상태로 등록되어 Admin이 승인/거절합니다.

### Notifications (`/api/notifications`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/notifications` | Private | 내 알림 목록 |
| PATCH | `/api/notifications/:id/read` | Private | 알림 읽음 처리 |
| PATCH | `/api/notifications/read-all` | Private | 모든 알림 읽음 처리 |
| DELETE | `/api/notifications/:id` | Private | 알림 삭제 |

### Settings (`/api/settings`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/settings/login` | Public | 로그인 페이지 설정 조회 |
| PUT | `/api/settings/login` | admin | 로그인 페이지 설정 수정 |
| POST | `/api/settings/login/banner` | admin | 로그인 배너 이미지 업로드 (multer, 5MB) |
| DELETE | `/api/settings/login/banner` | admin | 로그인 배너 이미지 삭제 |

> 설정 라우트는 로그인 페이지 설정과 배너 전용입니다. 범용 key 기반 CRUD 엔드포인트는 존재하지 않습니다.

### Memos (`/api/memos`) — 개인 메모장
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/memos/me` | Private | 내 메모 조회 |
| PUT | `/api/memos/me` | Private | 내 메모 저장 |

> 메모는 로그인한 본인의 개인 메모(1인 1메모)이며, 다른 사용자의 메모에 접근하는 엔드포인트는 없습니다.

### Sheet Memos (`/api/sheet-memos`) — 시트 셀 메모
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/sheet-memos/campaign/:campaignId` | operator, sales, admin | 캠페인별 시트 메모 조회 (query sheetType, viewAsUserId) |
| POST | `/api/sheet-memos/campaign/:campaignId/bulk` | operator, sales, admin | 시트 메모 일괄 upsert (빈 값은 삭제) |
| DELETE | `/api/sheet-memos/campaign/:campaignId` | operator, sales, admin | 캠페인 메모 삭제 (query sheetType 선택) |

### Monthly Brands (`/api/monthly-brands`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/monthly-brands/my-brand` | brand, admin | 브랜드사용 연월브랜드 목록 (viewAsUserId, 통계 포함) |
| GET | `/api/monthly-brands/all` | admin | 모든 연월브랜드 (진행자 배정 상태 포함) |
| GET | `/api/monthly-brands` | sales, admin | 영업사 연월브랜드 목록 (viewAsUserId, 슬롯/통계 포함) |
| GET | `/api/monthly-brands/:id` | sales, admin | 연월브랜드 상세 |
| POST | `/api/monthly-brands` | sales, admin | 연월브랜드 생성 (viewAsUserId 지원) |
| PATCH | `/api/monthly-brands/:id/change-brand` | admin | 브랜드사 변경 (하위 캠페인 brand_id 동기화) |
| PUT | `/api/monthly-brands/:id` | sales, admin | 연월브랜드 수정 |
| PATCH | `/api/monthly-brands/:id/hide` | sales, admin, operator, brand | 연월브랜드 숨기기 |
| PATCH | `/api/monthly-brands/:id/restore` | sales, admin, operator, brand | 연월브랜드 복구 |
| DELETE | `/api/monthly-brands/:id` | sales, admin | 연월브랜드 삭제 (캠페인 있으면 거부) |
| DELETE | `/api/monthly-brands/:id/cascade` | admin, sales, operator | 강제 삭제 (하위 cascade, 휴지통 이동) |
| PATCH | `/api/monthly-brands/reorder` | sales, admin | 순서 변경 (created_by 기준) |
| PATCH | `/api/monthly-brands/reorder-operator` | operator, admin | 순서 변경 (배정 기준) |
| PATCH | `/api/monthly-brands/reorder-brand` | brand, admin | 순서 변경 (brand_id 기준) |

### Trash (`/api/trash`) — 휴지통 (soft delete)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/trash` | admin, sales, operator | 휴지통 목록 (연월브랜드/캠페인/품목, 30일 만료일 포함) |
| POST | `/api/trash/restore/:type/:id` | admin, sales, operator | 휴지통 복원 (type: monthlyBrand/campaign/item, 하위 cascade 복원) |
| DELETE | `/api/trash/permanent/:type/:id` | admin | 영구 삭제 |
| DELETE | `/api/trash/empty` | admin | 휴지통 비우기 (30일 경과분 영구 삭제) |

### Brand Settlements (`/api/brand-settlements`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/brand-settlements/summary` | admin | 브랜드사 > 연월브랜드 > 캠페인 3단 정산 요약 |
| GET | `/api/brand-settlements/sales-products` | admin, sales | 영업사 본인 캠페인 제품 단위 정산 요약 (admin은 viewAsUserId) |

### Brand Dashboard (`/api/brand-dashboard`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/brand-dashboard/overview` | brand, admin | 브랜드 현황 대시보드 요약 (카드/추이/이슈) |
| GET | `/api/brand-dashboard/product-list` | brand, admin | 제품별 현황 리스트 |

> 현재 라우트 파일에는 `overview`, `product-list` 2개만 등록되어 있습니다. `product-rollup` 라우트는 존재하지 않습니다.

### Sales Dashboard (`/api/sales-dashboard`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/sales-dashboard/brands` | sales, admin | 영업사 대시보드 브랜드 필터 옵션 |
| GET | `/api/sales-dashboard/months` | sales, admin | 영업사 대시보드 월 필터 옵션 |
| GET | `/api/sales-dashboard/overview` | sales, admin | 영업사 현황 대시보드 요약 |
| GET | `/api/sales-dashboard/product-list` | sales, admin | 영업사 제품별 현황 리스트 |

### Rankings (`/api/rankings`) — BEST100 랭킹 수집/분석
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/rankings/categories` | Private | 랭킹 카테고리 목록 |
| GET | `/api/rankings/latest` | admin | 최신 랭킹 스냅샷 |
| GET | `/api/rankings/changes` | admin | 랭킹 시계열 변동 분석 (window/base) |
| GET | `/api/rankings/history` | admin, brand | 특정 상품 랭킹 추이 (추이 모달용) |
| GET | `/api/rankings/insights` | admin | 랭킹 인사이트 |
| GET | `/api/rankings/my-products` | brand, admin | 자사 제품 랭킹 |
| GET | `/api/rankings/my-changes` | brand, admin | 자사 제품 종합 변동/추이/이탈/요약/인사이트 |
| POST | `/api/rankings/trigger` | admin, brand | 랭킹 수집 트리거 (캐시/lock/rate-limit 자동) |
| GET | `/api/rankings/progress` | Private | 수집 진행 상태 폴링 |

### Buyer Analytics (`/api/buyer-analytics`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/api/buyer-analytics/accounts` | admin, operator | 계좌(account_normalized) 단위 구매자 통계 집계 |
| GET | `/api/buyer-analytics/accounts/:accountNormalized/buyers` | admin, operator | 특정 계좌에 묶인 구매자 상세 목록 |

### AI Chat (`/api/ai-chat`)
| Method | Path | Access | 설명 |
|---|---|---|---|
| POST | `/api/ai-chat` | admin (컨트롤러에서 masterkangwoo 계정 추가 검증) | AI 챗 질의 |

### Health
| Method | Path | Access | 설명 |
|---|---|---|---|
| GET | `/health` | Public | 헬스 체크 (app.js 직접 정의) |

---

## 환경 변수 (.env)

환경 변수는 `backend/.env.example` 파일을 참고하여 `backend/.env` 파일을 생성하세요.

주요 환경 변수:
- `NODE_ENV`: 실행 환경 (development/production)
- `PORT`: 서버 포트 (기본: 5000)
- `DB_HOST`: 데이터베이스 호스트
- `DB_PORT`: 데이터베이스 포트 (기본: 5432)
- `DB_NAME`: 데이터베이스 이름
- `DB_USER`: 데이터베이스 사용자
- `DB_PASSWORD`: 데이터베이스 비밀번호
- `JWT_SECRET`: JWT 서명 키
- `JWT_EXPIRE` / `JWT_REFRESH_EXPIRE`: 토큰 유효기간 (기본 7d / 30d)
- `AWS_ACCESS_KEY_ID`: AWS 액세스 키
- `AWS_SECRET_ACCESS_KEY`: AWS 시크릿 키
- `AWS_REGION`: AWS 리전 (기본: ap-northeast-2)
- `S3_BUCKET_NAME`: S3 버킷 이름
- `FRONTEND_URL`: CORS 허용 URL

AI 챗(`AI_CHAT_ENABLED`/`ANTHROPIC_API_KEY`/`AI_CHAT_ALLOWED_USERS`/`DB_READONLY_*`), 리뷰 추출(`OPENAI_*`/`EXTRACTION_*`), 올리브영 랭킹 워커(`RANKING_AUTO_ENABLED`/`PROXY_MODE`/프록시 자격증명) 관련 변수는 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) 참고.

## 권한 체크 미들웨어 로직

### 역할
JWT 기반 인증(`authenticate`)으로 사용자를 식별하고, `authorize([...])`로 역할별 접근을 제어합니다. 역할은 `admin`, `sales`, `operator`, `brand` 4종입니다.

- **admin**: 모든 리소스 CRUD, 진행자 배정/재배정, 입금 확인, 사용자 등록/관리, 영업사 변경, 마진/정산 관리, 컨트롤 타워(다른 사용자 대시보드 조회)
- **sales**: 연월브랜드/캠페인/품목 생성 (자신의 것), 구매자 조회, 입금명 수정, 마진/정산 조회 (자신의 캠페인)
- **operator**: 배정된 품목의 구매자 CRUD, 슬롯 편집, 입금명 수정, 메모/시트 메모
- **brand**: 연결된 연월브랜드의 캠페인/품목/구매자 조회 (제한된 컬럼, 읽기 전용)

### viewAsUserId 지원

Admin이 다른 사용자(영업사/진행자/브랜드사)의 데이터를 조회·생성할 때 사용하는 쿼리/바디 파라미터입니다.

```
GET /api/monthly-brands?viewAsUserId=123
GET /api/item-slots/operator/campaign/456?viewAsUserId=123
```

**지원 엔드포인트:**
- Monthly Brands: `GET /`, `GET /my-brand`, `POST /`, `reorder`, `reorder-operator`, `reorder-brand`
- Items: `GET /my-monthly-brands`
- Item Slots: `GET /operator/campaign/:campaignId`, `GET /by-product-name`
- Sheet Memos: `GET /campaign/:campaignId`
- Brand Settlements: `GET /sales-products`
- Brand Dashboard: `overview`, `product-list`
- Sales Dashboard: 전 엔드포인트
- Rankings: `my-products`, `my-changes`
- Images: `GET /search`
- Users: `GET /brands-for-review-search`, `POST /brand`, `POST /brands/:brandId/assign-me`

## JWT 인증 시스템 상세

### 구현된 기능
- **JWT 토큰 발급**: 웹 로그인 시 7일 유효 토큰 발급
- **Refresh Token**: 모바일 로그인 시 Access + Refresh Token 발급, `refresh` 엔드포인트로 갱신 (`refresh_tokens` 테이블)
- **비밀번호 해싱**: bcrypt
- **역할 기반 접근 제어**: admin, sales, operator, brand
- **토큰 검증 미들웨어**: authenticate, authorize
- **활동 추적**: heartbeat로 last_activity 갱신, `user_activities` 테이블에 로그인/로그아웃/heartbeat 기록

### 관련 파일
```
backend/src/
├── middleware/auth.js            # JWT 미들웨어 (generateToken, authenticate, authorize)
├── controllers/authController.js # login, logout, getMe, verifyPassword, updateProfile,
│                                 #   mobileLogin, refresh, mobileLogout, heartbeat
├── routes/auth.js                # /api/auth/* 라우트
└── models/User.js                # comparePassword, toJSON 메서드
```

### 프론트엔드 인증
```
frontend/src/
├── context/AuthContext.js        # 인증 상태 관리 (React Context)
├── components/Login.js           # 로그인 페이지
├── components/ProtectedRoute.js  # 역할 기반 라우트 보호
└── services/
    ├── authService.js            # 로그인/로그아웃 API
    └── api.js                    # Axios 인터셉터 (토큰 자동 첨부, 401 처리)
```

## 개발 워크플로우

### 로컬 개발
```bash
# 백엔드 서버 실행
cd backend
npm run dev  # nodemon으로 자동 재시작

# 프론트엔드 서버 실행 (별도 터미널)
cd frontend
npm start
```

### 데이터베이스 마이그레이션
```bash
cd backend
npx sequelize-cli db:migrate        # 마이그레이션 실행
npx sequelize-cli db:seed:all       # 시드 데이터 입력
npx sequelize-cli db:migrate:undo   # 마지막 마이그레이션 되돌리기
```

### Docker 배포 (현재 사용 중)
```bash
# 로컬에서 빌드 및 푸시
make deploy

# EC2에서 실행
docker compose pull
docker compose up -d --force-recreate

# 마이그레이션 및 시더 (서비스명은 deploy/docker-compose.yml의 campmanager)
docker compose exec campmanager sh -c "cd backend && npx sequelize-cli db:migrate"
docker compose exec campmanager sh -c "cd backend && npx sequelize-cli db:seed:all"
```

> 상세 배포 절차(전체 env, Makefile, ai_readonly 역할, 랭킹 워커/프록시)는 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) 참고.

### Nginx + SSL (현재 구성)
- SSL: Let's Encrypt
- Nginx → Docker 컨테이너

---

**최종 업데이트**: 2026-06-29
