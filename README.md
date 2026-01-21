# CampManager - 리뷰 캠페인 관리 시스템

영업사, 진행자, 브랜드사가 캠페인과 구매자(리뷰어)를 효율적으로 관리하는 웹 애플리케이션

## 빠른 시작

### 프론트엔드
```bash
cd frontend
npm install
npm start
```
http://localhost:3000

### 백엔드
```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
npm start
```
http://localhost:5000

## 기술 스택

- **Frontend**: React 19, Material-UI 7, Handsontable
- **Backend**: Node.js, Express, Sequelize, PostgreSQL
- **Infrastructure**: Docker, AWS (EC2, RDS, S3), Nginx

## 문서

- **[CLAUDE.md](CLAUDE.md)** - 프로젝트 종합 가이드 (필독)
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) - DB 스키마
- [docs/BACKEND_STRUCTURE.md](docs/BACKEND_STRUCTURE.md) - API 엔드포인트
- [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) - 배포 가이드
- [docs/LOCAL_TESTING.md](docs/LOCAL_TESTING.md) - 로컬 테스트

## 역할별 기능

| 역할 | 주요 기능 |
|------|----------|
| 총관리자 | 전체 관리, 진행자 배정, 입금확인, 마진관리 |
| 영업사 | 캠페인/품목 생성, 마진 조회 |
| 진행자 | 구매자 관리, 이미지 업로드 링크 공유 |
| 브랜드사 | 리뷰 현황 조회 |

---

**최종 업데이트**: 2026-01-20
