# 백엔드 구조 설계

## 개요
Node.js + Express 기반의 RESTful API 서버

## 기술 스택 결정

### 백엔드 프레임워크
- **Node.js 18+** + **Express.js 4.x**
  - 이유: 빠른 개발, 가벼운 구조, React와 동일한 언어(JavaScript)

### 데이터베이스
- **PostgreSQL** (AWS RDS)
- **ORM**: Sequelize
  - 이유: TypeScript 타입 지원 좋음, 마이그레이션 관리 용이

### 인증 (✅ 구현 완료)
- **JWT (JSON Web Token)** - 7일 만료
- **bcrypt** - 비밀번호 해싱 (salt rounds: 10)
- **jsonwebtoken** - JWT 생성 및 검증

### 파일 업로드
- **AWS SDK v3** - S3 업로드
- **multer** - 파일 업로드 처리 (최대 10MB/파일)
- **uuid** - 고유 파일명 생성

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
│   │   ├── config/              # 설정 파일
│   │   │   ├── database.js      # DB 연결 설정
│   │   │   ├── s3.js            # S3 설정
│   │   │   └── jwt.js           # JWT 설정
│   │   │
│   │   ├── models/              # Sequelize 모델
│   │   │   ├── index.js         # 모델 통합
│   │   │   ├── User.js
│   │   │   ├── Campaign.js
│   │   │   ├── Item.js
│   │   │   ├── ItemSlot.js      # NEW
│   │   │   ├── CampaignOperator.js
│   │   │   ├── Buyer.js
│   │   │   ├── Image.js
│   │   │   ├── MonthlyBrand.js  # NEW
│   │   │   ├── Notification.js  # NEW
│   │   │   ├── Setting.js       # NEW
│   │   │   ├── UserActivity.js  # NEW
│   │   │   └── UserMemo.js      # NEW
│   │   │
│   │   ├── middleware/          # 미들웨어
│   │   │   ├── auth.js          # JWT 인증 (generateToken, authenticate, authorize)
│   │   │   ├── errorHandler.js  # 에러 핸들러
│   │   │   └── upload.js        # 파일 업로드
│   │   │
│   │   ├── controllers/         # 컨트롤러
│   │   │   ├── authController.js
│   │   │   ├── userController.js
│   │   │   ├── campaignController.js
│   │   │   ├── itemController.js
│   │   │   ├── itemSlotController.js    # NEW
│   │   │   ├── buyerController.js
│   │   │   ├── imageController.js
│   │   │   ├── monthlyBrandController.js # NEW
│   │   │   ├── notificationController.js # NEW
│   │   │   ├── settingController.js      # NEW
│   │   │   └── memoController.js         # NEW
│   │   │
│   │   ├── routes/              # 라우트
│   │   │   ├── index.js         # 라우트 통합
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   ├── campaigns.js
│   │   │   ├── items.js
│   │   │   ├── itemSlots.js     # NEW
│   │   │   ├── buyers.js
│   │   │   ├── images.js
│   │   │   ├── monthlyBrands.js # NEW
│   │   │   ├── notifications.js # NEW
│   │   │   ├── settings.js      # NEW
│   │   │   └── memos.js         # NEW
│   │   │
│   │   ├── services/            # 비즈니스 로직
│   │   │   ├── authService.js
│   │   │   ├── campaignService.js
│   │   │   ├── s3Service.js
│   │   │   └── permissionService.js
│   │   │
│   │   ├── utils/               # 유틸리티
│   │   │   ├── logger.js
│   │   │   ├── validator.js
│   │   │   └── accountNormalizer.js  # NEW - 계좌번호 정규화
│   │   │
│   │   └── app.js               # Express 앱 설정
│   │
│   ├── migrations/              # DB 마이그레이션
│   ├── seeders/                 # 시드 데이터
│   ├── tests/                   # 테스트 파일
│   ├── .env.example             # 환경 변수 예시
│   ├── .env                     # 환경 변수 (gitignore)
│   ├── .gitignore
│   ├── package.json
│   └── server.js                # 서버 진입점
│
├── frontend/                    # 프론트엔드 (React)
├── deploy/                      # 배포 설정
└── docs/                        # 문서
```

## API 엔드포인트 설계

### 인증 (Auth) ✅ 구현 완료
```
POST   /api/auth/login           # 로그인 (JWT 발급)
POST   /api/auth/logout          # 로그아웃
GET    /api/auth/me              # 현재 사용자 정보 (인증 필요)
POST   /api/auth/verify-password # 비밀번호 검증
PUT    /api/auth/profile         # 프로필 수정
```

### 사용자 (Users) - 총관리자만
```
GET    /api/users                # 사용자 목록
GET    /api/users?role=operator  # 역할별 조회
GET    /api/users/control-tower  # 컨트롤 타워용 사용자 목록 (역할별 그룹핑)
POST   /api/users                # 사용자 생성
GET    /api/users/:id            # 사용자 조회
PUT    /api/users/:id            # 사용자 수정
DELETE /api/users/:id            # 사용자 비활성화
POST   /api/users/:id/reset-password # 비밀번호 초기화
```

### 캠페인 (Campaigns)
```
GET    /api/campaigns            # 캠페인 목록 (역할별 필터)
POST   /api/campaigns            # 캠페인 생성 (영업사)
GET    /api/campaigns/:id        # 캠페인 조회
PUT    /api/campaigns/:id        # 캠페인 수정
DELETE /api/campaigns/:id        # 캠페인 삭제
```

### 연월브랜드 (Monthly Brands) - NEW
```
GET    /api/monthly-brands                    # 연월브랜드 목록
GET    /api/monthly-brands?viewAsUserId=xxx   # Admin이 특정 사용자 데이터 조회
POST   /api/monthly-brands                    # 연월브랜드 생성
PUT    /api/monthly-brands/:id                # 연월브랜드 수정
DELETE /api/monthly-brands/:id                # 연월브랜드 삭제
```

### 품목 (Items)
```
GET    /api/items                           # 전체 품목 (Admin - 진행자 배정용)
GET    /api/items/my-assigned               # 내게 배정된 품목 (Operator)
GET    /api/items/my-preuploads             # 선 업로드 있는 품목 (Operator)
GET    /api/items/my-monthly-brands         # 내게 배정된 연월브랜드 (Operator)
GET    /api/items/my-monthly-brands?viewAsUserId=xxx  # Admin이 특정 진행자 데이터 조회
GET    /api/items/campaign/:campaignId      # 캠페인별 품목
GET    /api/items/token/:token              # 토큰으로 품목 조회 (Public)
POST   /api/items/campaign/:campaignId      # 품목 생성 (Sales, Admin)
GET    /api/items/:id                       # 품목 조회
PUT    /api/items/:id                       # 품목 수정
DELETE /api/items/:id                       # 품목 삭제
POST   /api/items/:id/operator              # 진행자 배정 (Admin) - day_group 지원
PUT    /api/items/:id/operator              # 진행자 재배정 (Admin) - day_group 지원
DELETE /api/items/:id/operator/:operatorId  # 배정 해제 (Admin)
PATCH  /api/items/:id/deposit-name          # 입금명 수정 (Admin, Operator, Sales)
```

**진행자 배정 API Body 예시:**
```json
{
  "operatorId": 21,
  "day_group": 1    // null이면 전체 품목, 숫자면 해당 일차만
}
```

### 품목 슬롯 (Item Slots) - NEW
```
GET    /api/item-slots/item/:itemId                    # 품목별 슬롯 조회
GET    /api/item-slots/campaign/:campaignId            # 캠페인별 슬롯 조회 (Sales, Admin, Brand)
GET    /api/item-slots/campaign/:campaignId?viewAsRole=brand  # Brand 뷰 (이미지 포함)
GET    /api/item-slots/operator/campaign/:campaignId   # Operator용 캠페인별 슬롯
GET    /api/item-slots/operator/campaign/:campaignId?viewAsUserId=xxx  # Admin이 특정 진행자 데이터 조회
GET    /api/item-slots/operator/my-assigned            # 내게 배정된 슬롯 (Operator)
PUT    /api/item-slots/:id                             # 슬롯 수정
PUT    /api/item-slots/bulk/update                     # 다중 슬롯 일괄 수정
DELETE /api/item-slots/:id                             # 슬롯 삭제
DELETE /api/item-slots/bulk/delete                     # 다중 슬롯 삭제
DELETE /api/item-slots/group/:itemId/:dayGroup         # 그룹별 슬롯 삭제
DELETE /api/item-slots/item/:itemId                    # 품목의 모든 슬롯 삭제
```

### 구매자/리뷰어 (Buyers)
```
GET    /api/buyers/item/:itemId            # 구매자 목록
POST   /api/buyers/item/:itemId            # 구매자 추가
POST   /api/buyers/item/:itemId/parse      # 슬래시 구분 데이터 파싱 후 추가
POST   /api/buyers/item/:itemId/bulk       # 다중 구매자 일괄 추가
GET    /api/buyers/:id                     # 구매자 조회
PUT    /api/buyers/:id                     # 구매자 수정
DELETE /api/buyers/:id                     # 구매자 삭제
PATCH  /api/buyers/:id/payment             # 입금 확인 (총관리자만)
```

### 이미지 (Images)
```
POST   /api/images/upload/:token           # 토큰 기반 이미지 업로드 (Public, 최대 10개)
POST   /api/images/upload-slot/:token      # 슬롯용 이미지 업로드 (Public)
GET    /api/images/item/:itemId            # 이미지 목록
DELETE /api/images/:id                     # 이미지 삭제
```

### 알림 (Notifications) - NEW
```
GET    /api/notifications                  # 내 알림 목록 (읽지 않은 것만)
GET    /api/notifications/all              # 내 알림 전체
PATCH  /api/notifications/:id/read         # 알림 읽음 처리
PATCH  /api/notifications/read-all         # 모든 알림 읽음 처리
DELETE /api/notifications/:id              # 알림 삭제
```

### 설정 (Settings) - NEW (Admin 전용)
```
GET    /api/settings                       # 전체 설정 조회
GET    /api/settings/:key                  # 특정 설정 조회
PUT    /api/settings/:key                  # 설정 수정
POST   /api/settings                       # 설정 생성
DELETE /api/settings/:key                  # 설정 삭제
```

### 사용자 메모 (Memos) - NEW (Admin 전용)
```
GET    /api/memos/user/:userId             # 사용자의 메모 목록
POST   /api/memos/user/:userId             # 메모 추가
PUT    /api/memos/:id                      # 메모 수정
DELETE /api/memos/:id                      # 메모 삭제
```

## 환경 변수 (.env)

환경 변수는 `backend/.env.example` 파일을 참고하여 `backend/.env` 파일을 생성하세요.

주요 환경 변수:
- `NODE_ENV`: 실행 환경 (development/production)
- `PORT`: 서버 포트 (기본: 5000)
- `DB_HOST`: 데이터베이스 호스트
- `DB_PORT`: 데이터베이스 포트 (기본: 5432)
- `DB_NAME`: 데이터베이스 이름
- `DB_USER`: 데이터베이스 사용자
- `DB_PASS`: 데이터베이스 비밀번호
- `JWT_SECRET`: JWT 서명 키
- `AWS_ACCESS_KEY_ID`: AWS 액세스 키
- `AWS_SECRET_ACCESS_KEY`: AWS 시크릿 키
- `AWS_REGION`: AWS 리전 (기본: ap-northeast-2)
- `S3_BUCKET_NAME`: S3 버킷 이름
- `FRONTEND_URL`: CORS 허용 URL

## 권한 체크 미들웨어 로직

### 역할별 권한
```javascript
const PERMISSIONS = {
  admin: {
    campaigns: ['read', 'create', 'update', 'delete'],
    items: ['read', 'create', 'update', 'delete'],
    buyers: ['read', 'create', 'update', 'delete'],
    users: ['read', 'create', 'update', 'delete'],
    operators: ['assign', 'unassign'],
    payment: ['confirm'],
    settings: ['read', 'update'],
    controlTower: ['viewAnyUser']  // NEW - 다른 사용자 대시보드 조회
  },
  sales: {
    campaigns: ['read', 'create', 'update'], // 자신의 것만
    items: ['read', 'create', 'update'],     // 자신의 것만
    buyers: ['read'],                        // 자신의 것만
    depositName: ['update'],                 // NEW - 입금명 수정
    users: [],
    operators: [],
    payment: []
  },
  operator: {
    campaigns: ['read'],                     // 배정된 것만
    items: ['read'],                         // 배정된 것만
    itemSlots: ['read', 'update'],           // NEW - 슬롯 편집
    buyers: ['read', 'create', 'update', 'delete'], // 배정된 것만
    depositName: ['update'],                 // NEW - 입금명 수정
    users: [],
    operators: [],
    payment: []  // 표시만 가능, 확인 불가
  },
  brand: {
    campaigns: ['read'],                     // 연결된 것만
    items: ['read'],                         // 연결된 것만
    buyers: ['read'],                        // 제한된 컬럼만
    users: [],
    operators: [],
    payment: []
  }
};
```

### viewAsUserId 지원 API

Admin이 다른 사용자의 데이터를 조회할 때 사용하는 쿼리 파라미터:

```javascript
// 예시: Admin이 특정 진행자의 연월브랜드 목록 조회
GET /api/items/my-monthly-brands?viewAsUserId=123

// 예시: Admin이 특정 진행자의 캠페인별 슬롯 조회
GET /api/item-slots/operator/campaign/456?viewAsUserId=123
```

**지원 엔드포인트:**
- `GET /api/items/my-monthly-brands`
- `GET /api/item-slots/operator/campaign/:campaignId`
- `GET /api/monthly-brands`

## 구현 완료 현황

1. ✅ 데이터베이스 스키마 설계 완료
2. ✅ 백엔드 구조 설계 완료
3. ✅ 백엔드 프로젝트 초기화
4. ✅ 데이터베이스 연결 및 모델 생성
5. ✅ **JWT 인증 시스템 구현**
6. ✅ API 엔드포인트 구현
7. ✅ Docker 컨테이너 배포
8. ✅ **ItemSlot 시스템 구현** (2025-12)
9. ✅ **viewAsUserId 지원** (2025-12-29)
10. ✅ **일차별(day_group) 진행자 배정** (2026-01-03)
11. ✅ **Brand 시트 14컬럼 확장** (2026-01-10)
12. ✅ **순번→플랫폼 컬럼 변경** (2026-01-10)

## JWT 인증 시스템 상세

### 구현된 기능
- **JWT 토큰 발급**: 로그인 시 7일 유효 토큰 발급
- **비밀번호 해싱**: bcrypt (salt rounds: 10)
- **역할 기반 접근 제어**: admin, sales, operator, brand
- **토큰 검증 미들웨어**: authenticate, authorize

### 관련 파일
```
backend/src/
├── middleware/auth.js      # JWT 미들웨어 (generateToken, authenticate, authorize)
├── controllers/authController.js  # login, logout, getMe
├── routes/auth.js          # /api/auth/* 라우트
└── models/User.js          # comparePassword, toJSON 메서드
```

### 프론트엔드 인증
```
frontend/src/
├── context/AuthContext.js  # 인증 상태 관리 (React Context)
├── components/Login.js     # 로그인 페이지
├── components/ProtectedRoute.js  # 역할 기반 라우트 보호
└── services/
    ├── authService.js      # 로그인/로그아웃 API
    └── api.js              # Axios 인터셉터 (토큰 자동 첨부, 401 처리)
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

# 마이그레이션 및 시더
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:migrate"
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:seed:all"
```

### Nginx + SSL (현재 구성)
- SSL: Let's Encrypt
- Nginx → Docker 컨테이너

---

**최종 업데이트**: 2026-01-10
