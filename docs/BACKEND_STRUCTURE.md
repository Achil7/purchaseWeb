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
- **multer** - 파일 업로드 처리
- **uuid** - 고유 파일명 생성

### 기타
- **dotenv** - 환경 변수 관리
- **cors** - CORS 설정
- **helmet** - 보안 헤더
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
│   │   │   ├── CampaignOperator.js
│   │   │   ├── Buyer.js
│   │   │   └── Image.js
│   │   │
│   │   ├── middleware/          # 미들웨어
│   │   │   ├── auth.js          # ✅ JWT 인증 (generateToken, authenticate, authorize)
│   │   │   ├── errorHandler.js  # 에러 핸들러
│   │   │   └── upload.js        # 파일 업로드
│   │   │
│   │   ├── controllers/         # 컨트롤러
│   │   │   ├── authController.js
│   │   │   ├── userController.js
│   │   │   ├── campaignController.js
│   │   │   ├── itemController.js
│   │   │   ├── buyerController.js
│   │   │   └── imageController.js
│   │   │
│   │   ├── routes/              # 라우트
│   │   │   ├── index.js         # 라우트 통합
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   ├── campaigns.js
│   │   │   ├── items.js
│   │   │   ├── buyers.js
│   │   │   └── images.js
│   │   │
│   │   ├── services/            # 비즈니스 로직
│   │   │   ├── authService.js
│   │   │   ├── campaignService.js
│   │   │   ├── s3Service.js
│   │   │   └── permissionService.js
│   │   │
│   │   ├── utils/               # 유틸리티
│   │   │   ├── logger.js
│   │   │   └── validator.js
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
├── src/                         # 프론트엔드 (기존)
├── public/
├── package.json                 # 프론트엔드 의존성
└── ...
```

## API 엔드포인트 설계

### 인증 (Auth) ✅ 구현 완료
```
POST   /api/auth/login           # ✅ 로그인 (JWT 발급)
POST   /api/auth/logout          # ✅ 로그아웃
GET    /api/auth/me              # ✅ 현재 사용자 정보 (인증 필요)
```

### 사용자 (Users) - 총관리자만
```
GET    /api/users                # 사용자 목록
POST   /api/users                # 사용자 생성
GET    /api/users/:id            # 사용자 조회
PUT    /api/users/:id            # 사용자 수정
DELETE /api/users/:id            # 사용자 삭제
```

### 캠페인 (Campaigns)
```
GET    /api/campaigns            # 캠페인 목록 (역할별 필터)
POST   /api/campaigns            # 캠페인 생성 (영업사)
GET    /api/campaigns/:id        # 캠페인 조회
PUT    /api/campaigns/:id        # 캠페인 수정
DELETE /api/campaigns/:id        # 캠페인 삭제
```

### 품목 (Items)
```
GET    /api/campaigns/:campaignId/items     # 품목 목록
POST   /api/campaigns/:campaignId/items     # 품목 생성
GET    /api/items/:id                       # 품목 조회
PUT    /api/items/:id                       # 품목 수정
DELETE /api/items/:id                       # 품목 삭제
```

### 진행자 배정 (Campaign Operators) - 총관리자만
```
POST   /api/campaigns/:campaignId/operators # 진행자 배정
DELETE /api/campaigns/:campaignId/operators/:operatorId # 배정 해제
GET    /api/campaigns/:campaignId/operators # 배정된 진행자 목록
```

### 구매자/리뷰어 (Buyers)
```
GET    /api/items/:itemId/buyers            # 구매자 목록
POST   /api/items/:itemId/buyers            # 구매자 추가
POST   /api/items/:itemId/buyers/parse      # 슬래시 구분 데이터 파싱 후 추가
GET    /api/buyers/:id                      # 구매자 조회
PUT    /api/buyers/:id                      # 구매자 수정
DELETE /api/buyers/:id                      # 구매자 삭제
PATCH  /api/buyers/:id/payment              # 입금 확인 (총관리자만)
```

### 이미지 (Images)
```
POST   /api/upload/:token                   # 토큰 기반 이미지 업로드
GET    /api/items/:itemId/images            # 이미지 목록
DELETE /api/images/:id                      # 이미지 삭제
```

## 환경 변수 (.env)

```env
# Server
NODE_ENV=development
PORT=5000

# Database (AWS RDS)
DB_HOST=serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com
DB_PORT=5432
DB_NAME=campmanager
DB_USER=your_db_username
DB_PASSWORD=your_db_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# AWS S3
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=kwad-image

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:3000

# Upload
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,image/gif
```

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
    payment: ['confirm']
  },
  sales: {
    campaigns: ['read', 'create', 'update'], // 자신의 것만
    items: ['read', 'create', 'update'],     // 자신의 것만
    buyers: ['read'],                        // 자신의 것만
    users: [],
    operators: [],
    payment: []
  },
  operator: {
    campaigns: ['read'],                     // 배정된 것만
    items: ['read'],                         // 배정된 것만
    buyers: ['read', 'create', 'update', 'delete'], // 배정된 것만
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

## 구현 완료 현황

1. ✅ 데이터베이스 스키마 설계 완료
2. ✅ 백엔드 구조 설계 완료
3. ✅ 백엔드 프로젝트 초기화
4. ✅ 데이터베이스 연결 및 모델 생성
5. ✅ **JWT 인증 시스템 구현** (2025-12-06)
6. ✅ API 엔드포인트 구현
7. ✅ Docker 컨테이너 배포

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

## 개발 워크플로우

### 로컬 개발
```bash
# 백엔드 서버 실행
cd backend
npm run dev  # nodemon으로 자동 재시작

# 프론트엔드 서버 실행 (별도 터미널)
cd ..
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
docker compose up -d

# 마이그레이션 및 시더
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:migrate"
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:seed:all"
```

### Nginx + SSL (현재 구성)
- 도메인: `kwad.co.kr`
- SSL: Let's Encrypt
- Nginx → Docker 컨테이너 (5000번 포트)
