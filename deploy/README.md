# CampManager Docker 배포 가이드

## 폴더 구조

```
deploy/
├── Dockerfile              # 프론트엔드 + 백엔드 통합 이미지
├── docker-compose.yml      # Docker Compose 설정
├── deploy.sh              # EC2 배포 자동화 스크립트
├── .env.example           # 환경 변수 예제
├── README.md              # 이 파일
└── image-build/
    └── dockerfile         # 기존 프론트엔드 전용 Dockerfile (참고용)
```

## 빠른 시작

### 사전 준비

#### 로컬 PC (Windows)
- Docker Desktop 설치 및 실행
- Docker Hub 로그인: `docker login`

#### EC2 서버 (Ubuntu)
```bash
# SSH 접속
ssh -i "your-key.pem" ubuntu@your-ec2-ip

# Docker 설치 (처음 한 번만)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
```

#### RDS 보안 그룹
- EC2 보안 그룹을 RDS 인바운드 규칙에 추가

## 배포 프로세스

### 1. 로컬에서 이미지 빌드 및 푸시

```bash
# 프로젝트 루트에서
make deploy
```

**또는 개별 명령어:**
```bash
make build    # deploy/Dockerfile로 이미지 빌드
make tag      # your-dockerhub-username/campmanager:latest로 태그
make push     # Docker Hub에 푸시
```

**사용 가능한 모든 명령어:**
```bash
make help     # 모든 명령어 보기
```

### 2. EC2 서버 접속

```bash
ssh -i "your-key.pem" ubuntu@your-ec2-ip
```

### 3. 배포 스크립트 실행

```bash
# 배포 스크립트 다운로드 (처음 한 번만)
wget https://raw.githubusercontent.com/YOUR-REPO/purchaseweb/main/deploy.sh
chmod +x deploy.sh

# 배포 실행
./deploy.sh
```

또는 수동으로:

```bash
# 1. 기존 컨테이너 중지
docker stop campmanager-app
docker rm campmanager-app

# 2. 최신 이미지 pull
docker pull your-dockerhub-username/campmanager:latest

# 3. 컨테이너 실행
docker run -d \
  --name campmanager-app \
  -p 5000:5000 \
  -e DB_HOST=your-rds-endpoint.region.rds.amazonaws.com \
  -e DB_PORT=5432 \
  -e DB_NAME=your_database_name \
  -e DB_USER=your_db_username \
  -e DB_PASSWORD=your_db_password \
  --restart unless-stopped \
  your-dockerhub-username/campmanager:latest

# 4. 로그 확인
docker logs -f campmanager-app

# 5. DB 마이그레이션 (첫 배포시)
docker exec campmanager-app sh -c "cd backend && npx sequelize-cli db:migrate"

# 6. 시드 데이터 추가 (선택사항)
docker exec campmanager-app sh -c "cd backend && npx sequelize-cli db:seed --seed 20240601000001-admin-user.js"
docker exec campmanager-app sh -c "cd backend && npx sequelize-cli db:seed --seed 20240601000002-mock-test-data.js"
```

## Nginx 설정

### Nginx 설정 파일 수정

```bash
sudo nano /etc/nginx/sites-available/your-domain
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # 프론트엔드 (백엔드가 서빙)
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API 엔드포인트
    location /api {
        proxy_pass http://localhost:5000/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:5000/health;
        access_log off;
    }
}
```

```bash
# Nginx 재시작
sudo nginx -t
sudo systemctl restart nginx
```

## Docker 명령어 참고

### 컨테이너 관리
```bash
# 컨테이너 상태 확인
docker ps

# 로그 확인
docker logs campmanager-app
docker logs -f campmanager-app  # 실시간

# 컨테이너 내부 접속
docker exec -it campmanager-app sh

# 컨테이너 재시작
docker restart campmanager-app

# 컨테이너 중지
docker stop campmanager-app

# 컨테이너 삭제
docker rm campmanager-app
```

### 이미지 관리
```bash
# 이미지 목록
docker images

# 이미지 삭제
docker rmi your-dockerhub-username/campmanager:latest

# 사용하지 않는 이미지 정리
docker image prune -a
```

### DB 마이그레이션
```bash
# 마이그레이션 실행
docker exec campmanager-app sh -c "cd backend && npx sequelize-cli db:migrate"

# 마이그레이션 취소
docker exec campmanager-app sh -c "cd backend && npx sequelize-cli db:migrate:undo"

# 시드 데이터 추가
docker exec campmanager-app sh -c "cd backend && npx sequelize-cli db:seed:all"

# 시드 데이터 삭제
docker exec campmanager-app sh -c "cd backend && npx sequelize-cli db:seed:undo:all"
```

## 프론트엔드 환경 변수

로컬에서 `.env` 파일 생성:

```env
REACT_APP_API_URL=https://your-domain.com/api
```

또는 EC2 IP 직접 사용:
```env
REACT_APP_API_URL=http://your-ec2-ip:5000/api
```

## 테스트

### Health Check
```bash
curl http://localhost:5000/health
curl https://your-domain.com/health
```

### API 테스트
```bash
# 캠페인 목록
curl https://your-domain.com/api/campaigns?userRole=admin

# 품목 목록
curl https://your-domain.com/api/items/campaign/1
```

### 프론트엔드 접속
- https://your-domain.com

## 문제 해결

### 컨테이너가 시작되지 않는 경우
```bash
# 로그 확인
docker logs campmanager-app

# 컨테이너 재시작
docker restart campmanager-app
```

### DB 연결 실패
```bash
# RDS 보안 그룹 확인
# EC2의 보안 그룹 또는 IP가 RDS 인바운드 규칙에 있는지 확인

# 컨테이너 내부에서 DB 연결 테스트
docker exec -it campmanager-app sh
nc -zv your-rds-endpoint.region.rds.amazonaws.com 5432
```

### Nginx 에러
```bash
# Nginx 설정 테스트
sudo nginx -t

# Nginx 로그
sudo tail -f /var/log/nginx/error.log

# Nginx 재시작
sudo systemctl restart nginx
```

## 배포 체크리스트

- [ ] 로컬에서 `make deploy` 실행
- [ ] EC2 접속
- [ ] 기존 컨테이너 중지
- [ ] 최신 이미지 pull
- [ ] 컨테이너 실행
- [ ] DB 마이그레이션 (첫 배포시)
- [ ] 시드 데이터 추가 (필요시)
- [ ] Health check 확인
- [ ] Nginx 설정 확인
- [ ] 프론트엔드 접속 테스트

## 다음 단계

- [ ] SSL 인증서 설정 (Let's Encrypt)
- [ ] 자동 배포 (GitHub Actions)
- [ ] 백업 스크립트
- [ ] 모니터링 (CloudWatch)
