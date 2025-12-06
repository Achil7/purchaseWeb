# 프로젝트 진행 상황 요약

## 완료된 작업 ✅

### 1. 데이터베이스 설계
- ✅ PostgreSQL 스키마 설계 (6개 테이블)
  - users (사용자)
  - campaigns (캠페인)
  - items (품목)
  - campaign_operators (진행자 배정)
  - buyers (구매자)
  - images (이미지)
- ✅ 문서: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)

### 2. 백엔드 구현
- ✅ Express.js + Sequelize 프로젝트 구조
- ✅ Sequelize 모델 생성 (6개)
- ✅ 마이그레이션 파일 생성
- ✅ API 컨트롤러 구현
  - campaignController.js - CRUD + 진행자 배정
  - itemController.js - CRUD
  - buyerController.js - CRUD + 슬래시 파싱
- ✅ API 라우팅 설정
- ✅ Seeder 파일 (관리자 + Mock 데이터)
- ✅ 문서: [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md)

### 3. 프론트엔드 API 연동
- ✅ Axios 클라이언트 설정 ([src/services/api.js](../src/services/api.js))
- ✅ Campaign 서비스 ([src/services/campaignService.js](../src/services/campaignService.js))
- ✅ Item 서비스 ([src/services/itemService.js](../src/services/itemService.js))
- ✅ Buyer 서비스 ([src/services/buyerService.js](../src/services/buyerService.js))

### 4. 진행자(Operator) 화면 구현
- ✅ OperatorCampaignTable.js - API 연동 완료
  - 캠페인 목록 조회
  - 로딩/에러 상태 처리
  - 역할 기반 필터링
- ✅ OperatorItemTable.js - API 연동 완료
  - 품목 목록 조회
  - 상태 표시 (진행 중/완료/취소)
  - 로딩/에러 상태 처리
- ✅ OperatorBuyerTable.js - API 연동 완료
  - 구매자 목록 조회
  - 입금 상태 표시
  - 금액 총합 계산
  - 수정/삭제 기능
  - 로딩/에러 상태 처리

### 5. 구매자 추가 다이얼로그
- ✅ OperatorAddBuyerDialog.js - 슬래시 파싱 구현
  - 슬래시(/) 구분 데이터 자동 파싱
  - 추가/수정 모드 지원
  - 백엔드 필드명과 일치하도록 업데이트
  - 이미지 업로드 준비 (S3 연동 대기)

### 6. Mock 데이터 및 테스트 환경
- ✅ Mock 데이터 파일 생성
  - 4명의 사용자 (admin, sales1, operator1, brand1)
  - 2개의 캠페인
  - 3개의 품목
  - 4명의 구매자
- ✅ Mock 데이터 Seeder
- ✅ 로컬 테스트 가이드 문서: [LOCAL_TESTING.md](./LOCAL_TESTING.md)

### 7. 프로젝트 문서화
- ✅ CLAUDE.md - AI 작업 가이드
- ✅ DATABASE_SCHEMA.md - DB 스키마 문서
- ✅ BACKEND_STRUCTURE.md - 백엔드 구조 문서
- ✅ DEPLOYMENT_GUIDE.md - EC2 배포 가이드
- ✅ LOCAL_TESTING.md - 로컬 테스트 가이드
- ✅ PROGRESS_SUMMARY.md (현재 문서)

## 진행 중인 작업 🚧

현재 진행 중인 작업 없음. 다음 단계로 이동 준비 완료.

## 대기 중인 작업 ⏳

### 1. 캠페인/품목 생성 폼 구현
- 영업사가 캠페인과 품목을 추가할 수 있는 UI
- 필요한 모든 필드 입력 폼
- 품목 생성 시 UUID 토큰 자동 생성 확인

### 2. EC2 서버 배포 및 DB 마이그레이션
- 백엔드를 EC2 서버에 배포
- RDS 데이터베이스 마이그레이션 실행
- Mock 데이터 시딩
- PM2로 프로세스 관리
- Nginx 리버스 프록시 설정
- 참고: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

### 3. JWT 인증 시스템 구현
- 로그인 API 엔드포인트
- JWT 토큰 생성 및 검증
- 보호된 라우트에 미들웨어 적용
- 프론트엔드 로그인 페이지
- 토큰 저장 및 자동 헤더 추가

### 4. 역할 기반 권한 제어
- 미들웨어로 역할 체크
- 각 역할별 접근 권한 제어
  - 총관리자: 모든 접근
  - 영업사: 캠페인/품목 추가, 리뷰어 조회
  - 진행자: 자신의 캠페인만 접근, 리뷰어 작성/수정
  - 브랜드사: 자신의 캠페인 리뷰어 조회만

### 5. AWS S3 이미지 업로드
- AWS SDK 설정
- S3 버킷 연동
- 이미지 업로드 API
- 프론트엔드 이미지 업로드 페이지
- 이미지 URL을 DB에 저장

### 6. 이미지 업로드 페이지 구현
- 캠페인/품목별 고유 링크
- Ctrl+V로 캡처 이미지 붙여넣기
- 갤러리에서 이미지 선택
- 이미지 제목 입력
- S3 업로드 후 DB 기록

### 7. 추가 기능
- 브랜드사 대시보드 (조회 전용)
- 영업사 대시보드 (캠페인/품목 생성)
- 검색 및 필터링 기능
- 엑셀 내보내기
- 통계 및 리포트

## 기술 스택

### Backend
- Node.js 18.x
- Express.js
- Sequelize ORM
- PostgreSQL (AWS RDS)
- JWT for authentication
- Bcrypt for password hashing
- AWS SDK (S3)

### Frontend
- React 19.2.0
- Material-UI 7.3.5
- React Router DOM
- Axios

### Infrastructure
- AWS EC2 (Ubuntu)
- AWS RDS (PostgreSQL)
- AWS S3 (이미지 저장소)
- Nginx (리버스 프록시)
- PM2 (프로세스 관리)

## 프로젝트 구조

```
purchaseweb/
├── backend/
│   ├── src/
│   │   ├── config/         # DB 설정
│   │   ├── controllers/    # API 컨트롤러
│   │   ├── middleware/     # 미들웨어
│   │   ├── models/         # Sequelize 모델
│   │   ├── routes/         # API 라우트
│   │   ├── seeders/        # Seed 데이터
│   │   └── migrations/     # DB 마이그레이션
│   ├── .env               # 환경 변수
│   ├── server.js          # 서버 엔트리
│   └── package.json
├── src/
│   ├── components/
│   │   ├── operator/      # 진행자 화면
│   │   ├── sales/         # 영업사 화면 (TODO)
│   │   └── brand/         # 브랜드사 화면 (TODO)
│   ├── services/          # API 서비스
│   └── App.js
├── docs/                  # 프로젝트 문서
└── package.json
```

## 다음 우선순위

1. **로컬 환경 테스트** (현재 가능)
   - Mock 데이터로 모든 기능 테스트
   - 슬래시 파싱 기능 확인
   - CRUD 작동 확인

2. **캠페인/품목 생성 폼** (프론트엔드 작업)
   - 영업사 화면 구현
   - 필수 필드 검증

3. **EC2 배포** (인프라 작업)
   - 실제 서버 환경에서 테스트
   - DB 마이그레이션 실행

4. **JWT 인증** (보안 작업)
   - 로그인 시스템
   - 토큰 기반 인증

5. **S3 이미지 업로드** (기능 확장)
   - 리뷰 이미지 관리

## 참고 사항

### 테스트 계정
로컬 테스트 시 사용 가능한 계정:
- admin / admin123!@#
- sales1 / sales123!
- operator1 / operator123!
- brand1 / brand123!

### API 엔드포인트
- GET /api/campaigns - 캠페인 목록
- GET /api/items/campaign/:id - 품목 목록
- GET /api/buyers/item/:id - 구매자 목록
- POST /api/buyers/item/:id - 구매자 추가
- POST /api/buyers/item/:id/parse - 슬래시 파싱 추가
- PUT /api/buyers/:id - 구매자 수정
- DELETE /api/buyers/:id - 구매자 삭제

### 환경 변수
- `REACT_APP_API_URL`: 백엔드 API URL
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: RDS 정보
- `JWT_SECRET`, `JWT_EXPIRE`: JWT 설정
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`: AWS 설정

## 연락처 및 지원

문제가 발생하거나 질문이 있으면 프로젝트 관리자에게 문의하세요.

---

**마지막 업데이트**: 2025-12-06
**버전**: 0.1.0 (초기 개발 단계)
