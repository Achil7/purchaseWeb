# 로컬 테스트 가이드

## 개요
DB 연결 없이 로컬에서 프론트엔드와 백엔드를 테스트하는 방법입니다.

## 사전 준비

### 1. 의존성 설치

#### 백엔드
```bash
cd backend
npm install
```

#### 프론트엔드
```bash
cd ..
npm install
```

## 데이터베이스 설정

### 1. PostgreSQL 연결 확인
`.env` 파일이 올바르게 설정되어 있는지 확인:
```env
DB_HOST=serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com
DB_PORT=5432
DB_NAME=serverdb
DB_USER=kwad
DB_PASSWORD=rkddntkfkd94!
```

### 2. 마이그레이션 실행
```bash
cd backend
npm run db:migrate
```

### 3. Mock 데이터 시딩
```bash
# 관리자 계정 생성
npm run db:seed

# Mock 테스트 데이터 추가
npx sequelize-cli db:seed --seed 20240601000002-mock-test-data.js
```

## 서버 실행

### 1. 백엔드 서버 시작
```bash
cd backend
npm start
# 또는 개발 모드
npm run dev
```

백엔드 서버는 `http://localhost:5000`에서 실행됩니다.

### 2. 프론트엔드 서버 시작
```bash
cd ..
npm start
```

프론트엔드는 `http://localhost:3000`에서 실행됩니다.

## 테스트 계정

### 관리자
- Username: `admin`
- Password: `admin123!@#`

### 영업사
- Username: `sales1`
- Password: `sales123!`

### 진행자
- Username: `operator1`
- Password: `operator123!`

### 브랜드사
- Username: `brand1`
- Password: `brand123!`

## Mock 데이터 구조

### 캠페인
1. **여름 신상품 리뷰 캠페인**
   - 품목 1: 무선 이어폰 A100
   - 품목 2: 스마트워치 W200

2. **가을 시즌 프로모션**
   - 품목 3: 가을 신상 자켓

### 구매자
- 품목 1 (무선 이어폰): 2명의 구매자
- 품목 2 (스마트워치): 1명의 구매자
- 품목 3 (가을 자켓): 1명의 구매자

## API 테스트

### Health Check
```bash
curl http://localhost:5000/health
```

### 캠페인 목록 조회 (진행자)
```bash
curl "http://localhost:5000/api/campaigns?userRole=operator&userId=3"
```

### 품목 목록 조회
```bash
curl http://localhost:5000/api/items/campaign/1
```

### 구매자 목록 조회
```bash
curl http://localhost:5000/api/buyers/item/1
```

### 구매자 추가 (슬래시 파싱)
```bash
curl -X POST http://localhost:5000/api/buyers/item/1/parse \
  -H "Content-Type: application/json" \
  -d '{
    "data": "20240603-001/홍길동/홍길동/hong@test.com/010-9999-8888/서울시 종로구/국민은행 123-456-789/59000"
  }'
```

## 프론트엔드 테스트 시나리오

### 1. 진행자 워크플로우
1. `/operator` - 캠페인 목록 확인
2. 캠페인 선택 → 품목 목록 확인
3. 품목 선택 → 구매자 리스트 확인
4. "구매자 추가" 버튼 클릭
5. 슬래시로 구분된 데이터 붙여넣기
6. 데이터 확인 후 저장

### 2. 슬래시 파싱 테스트
구매자 추가 다이얼로그에서 다음 형식으로 붙여넣기:
```
20240604-001/김영수/김영수/kimys@naver.com/010-7777-6666/경기도 수원시 팔달구/신한은행 999-888-777666/59000
```

### 3. 데이터 수정 테스트
1. 구매자 리스트에서 "수정" 버튼 클릭
2. 정보 수정
3. 저장

### 4. 데이터 삭제 테스트
1. 구매자 리스트에서 "삭제" 버튼 클릭
2. 확인 후 삭제

## 문제 해결

### 백엔드 서버가 시작되지 않는 경우
```bash
# 포트 사용 확인
netstat -ano | findstr :5000

# 프로세스 종료 (Windows)
taskkill /PID <PID> /F
```

### 데이터베이스 연결 실패
1. RDS 보안 그룹 확인
2. VPC 설정 확인
3. 로컬에서는 EC2를 통한 연결이 필요할 수 있음

### CORS 에러
프론트엔드 `.env` 파일 확인:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

백엔드 `.env` 파일 확인:
```env
FRONTEND_URL=http://localhost:3000
```

## Mock 데이터 초기화

### 데이터 재설정
```bash
cd backend

# 모든 시드 취소
npx sequelize-cli db:seed:undo:all

# 다시 시드 실행
npm run db:seed
npx sequelize-cli db:seed --seed 20240601000002-mock-test-data.js
```

### 전체 데이터베이스 재설정
```bash
# 모든 마이그레이션 취소
npx sequelize-cli db:migrate:undo:all

# 다시 마이그레이션
npm run db:migrate

# 시드 데이터 추가
npm run db:seed
npx sequelize-cli db:seed --seed 20240601000002-mock-test-data.js
```

## 다음 단계

로컬 테스트가 완료되면:
1. EC2 서버에 배포
2. JWT 인증 시스템 구현
3. AWS S3 이미지 업로드 기능 추가
4. 역할 기반 권한 미들웨어 추가

## 참고 문서
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
