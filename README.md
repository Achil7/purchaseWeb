# CampManager - 리뷰 캠페인 관리 시스템

영업사, 진행자, 브랜드사가 캠페인과 구매자(리뷰어)를 효율적으로 관리하는 웹 애플리케이션

**배포 URL**: https://your-domain.com

## 프로젝트 개요

CampManager는 리뷰 캠페인의 전체 라이프사이클을 관리하는 시스템입니다. 영업사가 캠페인을 생성하고, 진행자가 구매자를 관리하며, 브랜드사가 리뷰 현황을 확인할 수 있습니다.

### 주요 기능
- **역할 기반 접근 제어**: 총관리자, 영업사, 진행자, 브랜드사
- **캠페인 관리**: 캠페인 생성, 품목 추가, 연월브랜드 그룹핑
- **구매자 관리**: 슬래시(/) 구분 데이터 자동 파싱, Handsontable 엑셀 시트
- **일차별 진행자 배정**: 같은 품목을 일차별로 다른 진행자에게 배정 가능
- **이미지 업로드**: AWS S3 연동, 계좌번호 기반 구매자 매칭
- **입금 관리**: 입금 확인 토글, 금액 총합 계산

## 폴더 구조

```
purchaseweb/
├── frontend/              # React 프론트엔드
│   ├── src/
│   │   ├── components/   # 역할별 대시보드 컴포넌트
│   │   │   ├── admin/    # 총관리자 (컨트롤타워, 사용자 관리)
│   │   │   ├── sales/    # 영업사 (캠페인/품목 생성)
│   │   │   ├── operator/ # 진행자 (구매자 관리, 엑셀 시트)
│   │   │   ├── brand/    # 브랜드사 (리뷰 현황 조회)
│   │   │   ├── upload/   # 이미지 업로드 (Public)
│   │   │   └── common/   # 공통 컴포넌트
│   │   ├── services/     # API 서비스 레이어
│   │   ├── context/      # React Context (AuthContext)
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
├── docs/                  # 프로젝트 문서
│   ├── DATABASE_SCHEMA.md       # DB 스키마
│   ├── BACKEND_STRUCTURE.md     # 백엔드 구조
│   ├── DEPLOYMENT_GUIDE.md      # 배포 가이드
│   ├── LOCAL_TESTING.md         # 로컬 테스트 가이드
│   └── IMPLEMENTATION_PROGRESS.md # 구현 진행 상황
│
├── CLAUDE.md              # 프로젝트 종합 가이드 (Claude AI용)
└── Makefile               # Docker 빌드/배포 명령어
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
- React Router DOM 7.9.6
- Handsontable (엑셀 형식 테이블)
- Axios

### Backend
- Node.js 18+
- Express.js
- Sequelize ORM
- PostgreSQL (AWS RDS)
- JWT 인증
- AWS SDK v3 (S3 업로드)

### Infrastructure
- Docker & Docker Compose
- AWS EC2 (애플리케이션 서버)
- AWS RDS (PostgreSQL)
- AWS S3 (이미지 저장)
- Nginx + Let's Encrypt SSL

## 주요 워크플로우

### 1. 캠페인 생성 (영업사)
영업사가 캠페인을 생성하고 품목을 추가합니다. 연월브랜드로 월별 그룹핑이 가능합니다.

### 2. 진행자 배정 (총관리자)
총관리자가 각 품목에 진행자를 배정합니다. **일차별(day_group) 배정**이 가능하여 같은 품목의 1일차, 2일차를 다른 진행자에게 배정할 수 있습니다.

### 3. 구매자 추가 (진행자)
Handsontable 엑셀 시트에서 구매자 정보를 관리합니다. **주문번호 컬럼에서 슬래시(/) 구분 데이터를 붙여넣으면 자동 파싱**됩니다:
```
주문번호/구매자/수취인/아이디/연락처/주소/계좌정보/금액
```

### 4. 리뷰 이미지 업로드 (구매자)
자동 생성된 업로드 링크(`/upload-slot/:token`)를 통해 이미지 업로드. **주문번호 또는 계좌번호**로 구매자와 자동 매칭됩니다 (주문번호 우선).

### 5. 입금 확인 (총관리자)
구매자별 입금 상태 토글 및 금액 총합 조회

## 역할별 권한

| 역할 | 캠페인 생성 | 품목 추가 | 구매자 관리 | 입금 확인 | 조회 범위 |
|------|------------|----------|------------|----------|----------|
| 총관리자 | ✅ | ✅ | ✅ | ✅ | 전체 (컨트롤타워에서 모든 사용자 대시보드 조회 가능) |
| 영업사 | ✅ | ✅ | 조회만 | ❌ | 자신의 캠페인 |
| 진행자 | ❌ | ❌ | ✅ | 표시만 | 배정된 캠페인/품목 |
| 브랜드사 | ❌ | ❌ | 조회만 (5개 컬럼) | ❌ | 연결된 캠페인 |

## 배포

### Docker로 배포

```bash
# 1. 로컬에서 빌드 및 푸시
make deploy

# 2. EC2 서버 접속
ssh -i "your-key.pem" ubuntu@your-ec2-ip

# 3. 배포 스크립트 실행
./deploy.sh
```

자세한 내용은 [deploy/README.md](deploy/README.md)를 참조하세요.

## 환경 변수

### Backend (.env)
```env
NODE_ENV=***
PORT=***
DB_HOST=***
DB_PORT=***
DB_NAME=***
DB_USER=***
DB_PASSWORD=*** 
JWT_SECRET=***
AWS_REGION=***
S3_BUCKET_NAME=***
```

전체 환경 변수 예시: [deploy/.env.example](deploy/.env.example)

## 마스터 계정

| 역할 | Username | Password |
|------|----------|----------|
| 총관리자 | `admin` | `your_password` |
| 영업사 | `sales` | `your_password` |
| 진행자 | `operator` | `your_password` |
| 브랜드사 | `brand` | `your_password` |

> **Note**: 실제 배포 시 `backend/src/seeders/` 파일에서 계정 정보를 변경하세요.

## 주요 문서

- [프로젝트 종합 가이드](CLAUDE.md) - 전체 요구사항 및 워크플로우
- [데이터베이스 스키마](docs/DATABASE_SCHEMA.md) - DB 테이블 구조
- [백엔드 구조](docs/BACKEND_STRUCTURE.md) - API 엔드포인트 및 컨트롤러
- [배포 가이드](docs/DEPLOYMENT_GUIDE.md) - EC2 배포 상세 가이드
- [로컬 테스트](docs/LOCAL_TESTING.md) - 로컬 테스트 방법
- [구현 진행 상황](docs/IMPLEMENTATION_PROGRESS.md) - 개발 히스토리

## 주요 API 엔드포인트

### Campaigns
- `GET /api/campaigns` - 캠페인 목록 (역할별 필터링)
- `POST /api/campaigns` - 캠페인 생성
- `PUT /api/campaigns/:id` - 캠페인 수정

### Items
- `GET /api/items/campaign/:campaignId` - 품목 목록
- `POST /api/items/campaign/:campaignId` - 품목 생성
- `POST /api/items/:id/operator` - 진행자 배정 (day_group 지원)
- `PUT /api/items/:id/operator` - 진행자 재배정

### Item Slots
- `GET /api/item-slots/item/:itemId` - 품목별 슬롯 조회
- `PUT /api/item-slots/bulk/update` - 다중 슬롯 수정
- `DELETE /api/item-slots/group/:itemId/:dayGroup` - 그룹별 슬롯 삭제

### Images
- `POST /api/images/upload/:token` - 이미지 업로드 (Public)
- `GET /api/images/item/:itemId` - 품목 이미지 목록

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

---

**최종 업데이트**: 2026-01-10
