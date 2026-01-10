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
`backend/.env.example`을 참고하여 `backend/.env` 파일을 생성하세요:
```env
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
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

테스트 계정은 시더(seeder)를 통해 생성됩니다.
`backend/seeders/` 디렉토리의 시더 파일을 확인하세요.

기본적으로 각 역할(admin, sales, operator, brand)별 테스트 계정이 생성됩니다.

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

### 3. 다중 구매자 일괄 추가 테스트 (NEW)
구매자 추가 다이얼로그에서 여러 줄 입력:
```
20240604-001/김영수/김영수/kimys@naver.com/010-7777-6666/경기도 수원시 팔달구/신한은행 999-888-777666/59000
20240604-002/박철수/박철수/parkcs@naver.com/010-8888-9999/서울시 강남구/국민은행 123-456-789012/45000
```
- 파싱된 데이터 미리보기 테이블 확인
- "N명 일괄 추가" 버튼 클릭

### 4. 이미지 업로드 테스트 (계좌번호 매칭)
1. 품목 상세에서 "업로드 링크" 복사
2. 새 탭에서 업로드 링크 열기
3. **계좌번호 입력** (예: "국민 123-456-789012 홍길동")
4. 다중 이미지 선택 (최대 10개) 또는 Ctrl+V 붙여넣기
5. 업로드 완료 확인

### 5. 선 업로드 테스트 (Pre-upload)
1. 구매자 등록 **전에** 업로드 링크에서 이미지 업로드
2. 계좌번호 입력 후 업로드 → "아직 등록되지 않은 계좌번호" 메시지 확인
3. 진행자 페이지에서 같은 계좌번호로 구매자 등록
4. 기존 이미지가 자동으로 연결되었는지 확인

### 6. 데이터 수정 테스트
1. 구매자 리스트에서 "수정" 버튼 클릭
2. 정보 수정
3. 저장

### 7. 데이터 삭제 테스트
1. 구매자 리스트에서 "삭제" 버튼 클릭
2. 확인 후 삭제

### 8. Admin 기능 테스트 (NEW)
1. `/admin` - 캠페인 목록 확인
2. **캠페인 추가**: "캠페인 추가" 버튼 클릭 → 캠페인 정보 입력 → 저장
3. 캠페인 선택 → 품목 목록 확인
4. **품목 추가**: "품목 추가" 버튼 클릭 → 품목 정보 입력 → 저장
5. 품목 선택 → 구매자 리스트 확인
6. **구매자 추가**: "구매자 추가" 버튼 클릭 → 슬래시 데이터 입력 → 저장
7. **구매자 수정**: 관리 컬럼에서 연필 아이콘 클릭 → 정보 수정 → 저장
8. **구매자 삭제**: 관리 컬럼에서 휴지통 아이콘 클릭 → 확인
9. **업로드 링크 복사**: "이미지 업로드 링크 복사" 버튼 클릭 → 링크 확인
10. **입금 완료 토글**: Switch 토글 → 스크롤 위치 유지 확인

### 9. 이미지별 행 분리 확인 (NEW)
1. 구매자가 N개 이미지 업로드 후 구매자 테이블 확인
2. 1명의 구매자가 N개 행으로 표시되는지 확인
3. 첫 번째 행에만 구매자 정보(주문번호, 구매자명 등) 표시 확인
4. 각 행에 개별 이미지 썸네일 표시 확인
5. 이미지 클릭 시 확대 팝업 확인

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
1. ~~EC2 서버에 배포~~ ✅
2. ~~JWT 인증 시스템 구현~~ ✅
3. ~~AWS S3 이미지 업로드 기능 추가~~ ✅
4. ~~역할 기반 권한 미들웨어 추가~~ ✅
5. ~~계좌번호 매칭 시스템~~ ✅
6. ~~다중 이미지 업로드~~ ✅
7. ~~다중 구매자 일괄 추가~~ ✅
8. ~~선 업로드 지원~~ ✅
9. ~~Admin 기능 확장 (Sales/Operator 기능 통합)~~ ✅
10. ~~입금 토글 스크롤 유지~~ ✅
11. ~~이미지별 행 분리 표시~~ ✅

## 참고 문서
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
