# CampManager - 리뷰 캠페인 관리 시스템

영업사, 진행자, 브랜드사가 캠페인과 구매자(리뷰어)를 효율적으로 관리하는 웹 애플리케이션

## 프로젝트 개요

CampManager는 리뷰 캠페인의 전체 라이프사이클을 관리하는 시스템입니다. 영업사가 캠페인을 생성하고, 진행자가 구매자를 관리하며, 브랜드사가 리뷰 현황을 확인할 수 있습니다.

### 주요 기능
- **역할 기반 접근 제어**: 총관리자, 영업사, 진행자, 브랜드사
- **캠페인 관리**: 캠페인 생성 및 품목 추가
- **구매자 관리**: 슬래시(/) 구분 데이터 자동 파싱
- **이미지 업로드**: AWS S3 연동 리뷰 이미지 업로드
- **입금 관리**: 입금 확인 및 금액 총합 계산

## 폴더 구조

```
purchaseweb/
├── frontend/              # React 프론트엔드
│   ├── src/
│   │   ├── components/   # 역할별 대시보드 컴포넌트
│   │   │   ├── admin/    # 총관리자
│   │   │   ├── sales/    # 영업사
│   │   │   ├── operator/ # 진행자
│   │   │   └── brand/    # 브랜드사
│   │   ├── services/     # API 서비스 레이어
│   │   └── App.js
│   ├── public/
│   └── package.json
│
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── models/      # Sequelize 모델
│   │   ├── controllers/ # API 컨트롤러
│   │   ├── routes/      # API 라우트
│   │   └── config/      # 데이터베이스 설정
│   ├── migrations/      # DB 마이그레이션
│   ├── seeders/         # 초기 데이터
│   └── server.js
│
├── deploy/               # 배포 관련 파일
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── deploy.sh
│   └── README.md
│
└── docs/                 # 프로젝트 문서
    ├── CLAUDE.md                # 프로젝트 상세 가이드
    ├── DATABASE_SCHEMA.md       # DB 스키마
    ├── BACKEND_STRUCTURE.md     # 백엔드 구조
    ├── DEPLOYMENT.md            # 배포 가이드
    └── LOCAL_TESTING.md         # 로컬 테스트 가이드
```

## 빠른 시작

### 프론트엔드 개발 서버

```bash
cd frontend
npm install
npm start
```

브라우저에서 http://localhost:3000 접속

### 백엔드 개발 서버

```bash
cd backend
npm install

# 데이터베이스 마이그레이션
npm run db:migrate
npm run db:seed

# 서버 시작
npm start
```

API 서버: http://localhost:5000

## 기술 스택

### Frontend
- React 19.2.0
- Material-UI 7.3.5
- React Router DOM 7.1.1
- Axios

### Backend
- Node.js 18+
- Express.js
- Sequelize ORM
- PostgreSQL (AWS RDS)

### Deployment
- Docker & Docker Compose
- PM2 (Process Manager)
- AWS EC2
- AWS S3 (이미지 저장)

## 주요 워크플로우

### 1. 캠페인 생성 (영업사)
영업사가 캠페인을 생성하고 품목을 추가합니다.

### 2. 진행자 배정 (총관리자)
총관리자가 각 캠페인/품목에 진행자를 배정합니다.

### 3. 구매자 추가 (진행자)
채팅방에서 받은 구매자 정보를 슬래시(/) 구분으로 복사-붙여넣기:
```
주문번호/구매자/수취인/아이디/연락처/주소/계좌정보/금액
```

### 4. 리뷰 이미지 업로드 (구매자)
자동 생성된 업로드 링크를 통해 Ctrl+V로 캡처 이미지 업로드

### 5. 입금 확인 (총관리자)
구매자별 입금 상태 확인 및 금액 총합 조회

## 역할별 권한

| 역할 | 캠페인 생성 | 품목 추가 | 구매자 관리 | 입금 확인 | 조회 범위 |
|------|------------|----------|------------|----------|----------|
| 총관리자 | ✅ | ✅ | ✅ | ✅ | 전체 |
| 영업사 | ✅ | ✅ | 조회만 | ❌ | 자신의 캠페인 |
| 진행자 | ❌ | ❌ | ✅ | 표시만 | 배정된 캠페인 |
| 브랜드사 | ❌ | ❌ | 조회만 (제한) | ❌ | 주최 캠페인 |

## 배포

### Docker로 배포

```bash
# 1. 로컬에서 빌드 및 푸시
make deploy

# 2. EC2 서버 접속
ssh -i "server_rsa_key.pem" ubuntu@ec2-16-184-33-207.ap-northeast-2.compute.amazonaws.com

# 3. 배포 스크립트 실행
./deploy.sh
```

자세한 내용은 [deploy/README.md](deploy/README.md)를 참조하세요.

## 환경 변수

### Backend (.env)
```env
NODE_ENV=production
PORT=5000
DB_HOST=serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com
DB_PORT=5432
DB_NAME=serverdb
DB_USER=kwad
DB_PASSWORD=***
JWT_SECRET=***
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=kwad-image
```

전체 환경 변수 예시: [deploy/.env.example](deploy/.env.example)

## 초기 계정

관리자 계정 (DB 시드 후 생성):
- Username: `admin` # kwad
- Password: `admin123!@#` # rkddntkfkd!
- ⚠️ 첫 로그인 후 반드시 변경

## 주요 문서

- [프로젝트 상세 가이드](docs/CLAUDE.md) - 전체 요구사항 및 워크플로우
- [데이터베이스 스키마](docs/DATABASE_SCHEMA.md) - DB 테이블 구조
- [백엔드 구조](docs/BACKEND_STRUCTURE.md) - API 엔드포인트 및 컨트롤러
- [배포 가이드](docs/DEPLOYMENT.md) - EC2 배포 상세 가이드
- [로컬 테스트](docs/LOCAL_TESTING.md) - DB 없이 로컬 테스트 방법

## API 엔드포인트

### Campaigns
- `GET /api/campaigns` - 캠페인 목록 (역할별 필터링)
- `POST /api/campaigns` - 캠페인 생성
- `GET /api/campaigns/:id` - 캠페인 상세
- `PUT /api/campaigns/:id` - 캠페인 수정
- `DELETE /api/campaigns/:id` - 캠페인 삭제

### Items
- `GET /api/items/campaign/:campaignId` - 품목 목록
- `POST /api/items/campaign/:campaignId` - 품목 생성
- `GET /api/items/:id` - 품목 상세
- `PUT /api/items/:id` - 품목 수정

### Buyers
- `GET /api/buyers/item/:itemId` - 구매자 목록
- `POST /api/buyers/item/:itemId` - 구매자 생성
- `POST /api/buyers/item/:itemId/parse` - 슬래시 파싱 후 생성
- `PATCH /api/buyers/:id/payment` - 입금 확인

전체 API 문서: [docs/BACKEND_STRUCTURE.md](docs/BACKEND_STRUCTURE.md)

## 개발 명령어

### Frontend
```bash
npm start          # 개발 서버 시작
npm run build      # 프로덕션 빌드
npm test           # 테스트 실행
```

### Backend
```bash
npm start              # 서버 시작
npm run db:migrate     # 마이그레이션 실행
npm run db:seed        # 시드 데이터 추가
npm run db:reset       # DB 초기화
```

### Docker
```bash
make build         # Docker 이미지 빌드
make deploy        # 빌드 + 태그 + 푸시
make docker-run    # 로컬에서 컨테이너 실행
make logs          # 컨테이너 로그 확인
make migrate       # 컨테이너 내 마이그레이션
```

## 라이선스

Private

## 연락처

프로젝트 관련 문의: kwad.co.kr
