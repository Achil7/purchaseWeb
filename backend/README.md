# CampManager Backend API

리뷰 캠페인 관리 시스템의 백엔드 API 서버

## 시작하기

### 1. 의존성 설치
```bash
cd backend
npm install
```

### 2. 환경 변수 설정
`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 값을 설정합니다:

```bash
cp .env.example .env
```

필수 환경 변수:
- `DB_USER`: PostgreSQL 사용자명
- `DB_PASSWORD`: PostgreSQL 비밀번호
- `DB_NAME`: 데이터베이스 이름
- `JWT_SECRET`: JWT 서명용 시크릿 키 (최소 32자)
- `AWS_ACCESS_KEY_ID`: AWS 액세스 키
- `AWS_SECRET_ACCESS_KEY`: AWS 시크릿 키

### 3. 데이터베이스 설정

#### 데이터베이스 생성 (PostgreSQL)
```bash
# psql에 접속
psql -h serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com -U your_username -d postgres

# 데이터베이스 생성
CREATE DATABASE campmanager;
```

#### 마이그레이션 실행
```bash
npm run db:migrate
```

#### 시드 데이터 입력 (선택사항)
```bash
npm run db:seed
```

### 4. 서버 실행

#### 개발 모드 (nodemon)
```bash
npm run dev
```

#### 프로덕션 모드
```bash
npm start
```

서버가 시작되면 `http://localhost:5000`에서 접근 가능합니다.

## API 엔드포인트

### Health Check
```
GET /health
```

### 인증 (Auth)
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `GET /api/auth/me` - 현재 사용자 정보

### 사용자 (Users)
- `GET /api/users` - 사용자 목록
- `POST /api/users` - 사용자 생성
- `GET /api/users/:id` - 사용자 조회
- `PUT /api/users/:id` - 사용자 수정
- `DELETE /api/users/:id` - 사용자 삭제

### 캠페인 (Campaigns)
- `GET /api/campaigns` - 캠페인 목록
- `POST /api/campaigns` - 캠페인 생성
- `GET /api/campaigns/:id` - 캠페인 조회
- `PUT /api/campaigns/:id` - 캠페인 수정
- `DELETE /api/campaigns/:id` - 캠페인 삭제
- `POST /api/campaigns/:id/operators` - 진행자 배정
- `DELETE /api/campaigns/:campaignId/operators/:operatorId` - 배정 해제
- `GET /api/campaigns/:id/operators` - 배정된 진행자 목록

### 품목 (Items)
- `GET /api/items/campaign/:campaignId` - 품목 목록
- `POST /api/items/campaign/:campaignId` - 품목 생성
- `GET /api/items/:id` - 품목 조회
- `PUT /api/items/:id` - 품목 수정
- `DELETE /api/items/:id` - 품목 삭제

### 구매자 (Buyers)
- `GET /api/buyers/item/:itemId` - 구매자 목록
- `POST /api/buyers/item/:itemId` - 구매자 추가
- `POST /api/buyers/item/:itemId/parse` - 슬래시 구분 데이터 파싱 후 추가
- `GET /api/buyers/:id` - 구매자 조회
- `PUT /api/buyers/:id` - 구매자 수정
- `DELETE /api/buyers/:id` - 구매자 삭제
- `PATCH /api/buyers/:id/payment` - 입금 확인

### 이미지 (Images)
- `POST /api/images/upload/:token` - 이미지 업로드
- `GET /api/images/item/:itemId` - 이미지 목록
- `DELETE /api/images/:id` - 이미지 삭제

## 프로젝트 구조

```
backend/
├── src/
│   ├── config/          # 설정 파일
│   ├── models/          # Sequelize 모델
│   ├── controllers/     # 컨트롤러
│   ├── routes/          # 라우트
│   ├── middleware/      # 미들웨어
│   ├── services/        # 비즈니스 로직
│   ├── utils/           # 유틸리티
│   └── app.js           # Express 앱
├── migrations/          # DB 마이그레이션
├── seeders/             # 시드 데이터
├── tests/               # 테스트
├── .env                 # 환경 변수
├── .env.example         # 환경 변수 예시
├── server.js            # 서버 진입점
└── package.json
```

## 데이터베이스 명령어

```bash
# 마이그레이션 실행
npm run db:migrate

# 마이그레이션 되돌리기
npm run db:migrate:undo

# 시드 데이터 입력
npm run db:seed

# 데이터베이스 리셋
npm run db:reset
```

## 다음 단계

1. AWS RDS 데이터베이스 연결 테스트
2. Sequelize 모델 생성
3. JWT 인증 시스템 구현
4. API 컨트롤러 구현
5. 프론트엔드와 연동

## 문서

자세한 내용은 다음 문서를 참조하세요:
- [데이터베이스 스키마](../docs/DATABASE_SCHEMA.md)
- [백엔드 구조](../docs/BACKEND_STRUCTURE.md)
- [CLAUDE.md](../CLAUDE.md) - 프로젝트 가이드
