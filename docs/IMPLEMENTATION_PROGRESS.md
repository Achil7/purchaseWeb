# 구현 진행 상황

**최종 업데이트**: 2025-12-09
**프로젝트**: CampManager (purchaseWeb)
**배포 URL**: https://kwad.co.kr

---

## 2025-12-09 업데이트 내역

### 1. 역할별 페이지 격리
- Admin도 다른 역할 페이지 접근 불가하도록 변경
- `/sales`, `/operator`, `/brand` 라우트에서 `admin` 역할 제거
- 각 역할은 자신의 대시보드만 접근 가능

### 2. Admin 입금관리 기능 개선
- 기존: 헤더에 별도 "입금관리" 버튼
- 변경: 품목 테이블에 "입금관리" 컬럼 추가 (배정 완료 품목만 버튼 표시)
- 드릴다운: Admin 대시보드 → 품목 입금관리 → 구매자별 입금 토글

### 3. 진행자 재배정 기능
- 배정 완료된 품목에서 "변경" 버튼 클릭 → 경고 다이얼로그 → 새 진행자 선택
- 신규 배정: `POST /api/items/:id/operator`
- 재배정: `PUT /api/items/:id/operator` (기존 배정 삭제 후 새로 생성)
- 최종 저장 시 재배정 건수 별도 안내

### 4. BrandBuyerTable API 연동
- 더미 데이터 제거
- 실제 `buyerService.getBuyersByItem(itemId)` API 호출
- 브랜드사는 조회만 가능 (수정/삭제 버튼 없음)

### 5. CSP (Content Security Policy) 수정
- helmet 설정에 S3 도메인 추가
- `imgSrc`: `https://kwad-image.s3.ap-northeast-2.amazonaws.com` 허용

### 6. BrandItemTable API 연동
- 더미 데이터 제거
- 실제 `itemService.getItemsByCampaign(campaignId)` API 호출
- `campaignService.getCampaign(campaignId)`로 캠페인 정보 조회

### 7. 브랜드사 구매자 컬럼 제한
- BrandBuyerTable에서 5개 컬럼만 표시
- 표시 컬럼: 주문번호, 구매자, 수취인, 아이디, 리뷰샷
- 제외 컬럼: 연락처, 주소, 계좌정보, 금액, 입금확인

### 8. buyerController 버그 수정
- `Campaign` 모델 import 누락 수정
- `getBuyer` 함수에서 Campaign 포함 조회 정상 동작

---

## 2025-12-08 업데이트 내역

### 이미지 업로드 링크 기능 구현 (S3 연동)

#### 백엔드 API
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/items/token/:token` | 토큰으로 품목 조회 | Public |
| POST | `/api/images/upload/:token` | 이미지 업로드 (S3) | Public |
| GET | `/api/images/item/:itemId` | 품목 이미지 목록 | Private |
| DELETE | `/api/images/:id` | 이미지 삭제 | Private |

#### 신규 파일
- `backend/src/config/s3.js` - S3 클라이언트 설정
- `backend/src/controllers/imageController.js` - 이미지 업로드/조회/삭제 API
- `frontend/src/components/upload/UploadPage.js` - 이미지 업로드 페이지 (Public)
- `frontend/src/services/imageService.js` - 이미지 API 서비스

#### 기능 설명
- **업로드 페이지** (`/upload/:token`): 로그인 불필요, 캠페인명/품목명 표시, 주문번호 입력, 이미지 선택/붙여넣기(Ctrl+V)
- **이미지 저장**: AWS S3 (`kwad-image` 버킷) → DB에 URL 저장
- **이미지-구매자 연결**: 주문번호로 buyer_id 자동 매칭

---

## 2025-12-08 (Session 4) 업데이트 내역

### Sales 품목/캠페인 CRUD 기능 구현

#### 품목 생성 버그 수정
| 프론트엔드 (기존) | 백엔드 (필요) |
|------------------|---------------|
| `name` | `product_name` |
| `target_keyword` | `keyword` |
| `delivery_service` | `courier_service_yn` |

#### 품목 다이얼로그 개선
- create/edit 모드 지원
- Box + flex 레이아웃

#### 품목 상세보기 페이지
- **신규 파일**: `SalesItemDetail.js`
- **라우트**: `/sales/campaign/:campaignId/item/:itemId`

---

## 완료된 작업

### 1. 데이터베이스 설계
- [x] PostgreSQL 스키마 설계 완료
- [x] 6개 테이블: users, campaigns, items, campaign_operators, buyers, images

### 2. 백엔드 구현
- [x] Node.js + Express 기반 RESTful API
- [x] Sequelize ORM
- [x] JWT 인증 미들웨어
- [x] 역할 기반 권한 체크
- [x] AWS S3 연동

### 3. 프론트엔드 구현
- [x] React 19 + Material-UI 7
- [x] 역할별 대시보드 (Admin, Sales, Operator, Brand)
- [x] JWT 토큰 관리 (AuthContext)
- [x] 역할 기반 라우트 보호

### 4. 배포
- [x] Docker 컨테이너 배포
- [x] Nginx 리버스 프록시 + SSL (Let's Encrypt)
- [x] AWS EC2 + RDS + S3

---

## 파일 구조

```
purchaseweb/
├── backend/
│   ├── src/
│   │   ├── models/           # 6개 모델
│   │   ├── routes/
│   │   │   ├── auth.js       # 로그인/로그아웃/프로필수정
│   │   │   ├── users.js      # 사용자 CRUD (Admin)
│   │   │   ├── campaigns.js  # 캠페인 CRUD
│   │   │   ├── items.js      # 품목 CRUD + 진행자 배정/재배정
│   │   │   ├── buyers.js     # 구매자 CRUD + 입금확인
│   │   │   └── images.js     # 이미지 업로드
│   │   ├── controllers/
│   │   ├── middleware/       # JWT, 권한 체크
│   │   ├── config/           # DB, S3 설정
│   │   └── app.js
│   ├── migrations/
│   └── seeders/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   │   ├── AdminDashboard.js     # 진행자 배정/재배정
│   │   │   │   ├── AdminBuyerTable.js    # 입금확인 토글
│   │   │   │   ├── AdminUserCreate.js    # 사용자 등록
│   │   │   │   └── ...
│   │   │   ├── sales/
│   │   │   │   ├── SalesCampaignTable.js
│   │   │   │   ├── SalesItemTable.js
│   │   │   │   ├── SalesItemDetail.js
│   │   │   │   └── ...
│   │   │   ├── operator/
│   │   │   │   ├── OperatorBuyerTable.js # 구매자 CRUD
│   │   │   │   └── ...
│   │   │   ├── brand/
│   │   │   │   ├── BrandBuyerTable.js    # 조회 전용
│   │   │   │   └── ...
│   │   │   ├── upload/
│   │   │   │   └── UploadPage.js         # 이미지 업로드 (Public)
│   │   │   └── common/
│   │   │       └── ProfileEditDialog.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── authService.js
│   │   │   ├── campaignService.js
│   │   │   ├── itemService.js
│   │   │   ├── buyerService.js
│   │   │   ├── imageService.js
│   │   │   └── userService.js
│   │   ├── context/
│   │   │   └── AuthContext.js
│   │   └── App.js
│   └── package.json
│
├── deploy/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── deploy.sh
│
└── docs/
    ├── CLAUDE.md
    ├── DATABASE_SCHEMA.md
    ├── BACKEND_STRUCTURE.md
    ├── DEPLOYMENT_GUIDE.md
    ├── LOCAL_TESTING.md
    └── IMPLEMENTATION_PROGRESS.md (이 파일)
```

---

## 기술 스택

### 백엔드
- Node.js + Express.js
- PostgreSQL (AWS RDS)
- Sequelize ORM
- JWT 인증
- bcrypt (비밀번호 해싱)
- AWS SDK v3 (S3 업로드)
- multer (파일 업로드)
- helmet (보안 헤더)

### 프론트엔드
- React 19.2.0
- Material-UI 7.3.5
- React Router 7.9.6
- Axios

### 인프라
- AWS EC2 (서버 호스팅)
- AWS RDS (PostgreSQL)
- AWS S3 (이미지 저장)
- Docker + Docker Compose
- Nginx + Let's Encrypt SSL

---

## 환경 설정

### RDS 연결 정보
- Host: `serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com`
- Port: `5432`
- Database: `serverdb`
- User: `kwad`

### S3 설정
- Bucket: `kwad-image`
- Region: `ap-northeast-2` (서울)

### 로컬 개발
- 프론트엔드: `http://localhost:3000`
- 백엔드 API: `http://localhost:5000`

---

## 배포 방법

### 로컬에서 (Windows)
```bash
cd c:\Users\achil\Desktop\purchaseweb
make deploy
```

### EC2에서
```bash
docker compose pull
docker compose up -d --force-recreate

# (필요시) 마이그레이션
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:migrate"
```

---

## 참고 문서

- [CLAUDE.md](CLAUDE.md) - 프로젝트 전체 가이드
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - 데이터베이스 스키마 상세
- [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md) - 백엔드 구조 및 API 설계
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - EC2 배포 가이드
- [LOCAL_TESTING.md](LOCAL_TESTING.md) - 로컬 테스트 가이드
