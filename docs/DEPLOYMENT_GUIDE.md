# EC2 서버 배포 가이드

## 개요
CampManager 애플리케이션을 AWS EC2 서버에 Docker로 배포하는 가이드입니다.

**배포 URL**: https://kwad.co.kr

## 현재 인프라 구성

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Cloud                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐ │
│  │   Route53   │──────│   EC2       │──────│   RDS       │ │
│  │  kwad.co.kr │      │  (Docker)   │      │ PostgreSQL  │ │
│  └─────────────┘      └─────────────┘      └─────────────┘ │
│                              │                              │
│                       ┌──────┴──────┐                       │
│                       │   Nginx     │                       │
│                       │  (SSL/443)  │                       │
│                       └──────┬──────┘                       │
│                              │                              │
│                       ┌──────┴──────┐                       │
│                       │   Docker    │                       │
│                       │  (5000번)   │                       │
│                       └─────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## 사전 준비

### 1. EC2 서버 접속
```bash
ssh -i "server_rsa_key.pem" ubuntu@15.165.220.230
```

### 2. Docker 설치 (이미 설치됨)
```bash
# Docker 설치 확인
docker --version
docker compose version
```

## Docker 배포 (현재 방식)

### 1. 로컬에서 이미지 빌드 및 푸시

```bash
# 프로젝트 루트에서 실행
cd c:\Users\achil\Desktop\purchaseweb

# Docker 이미지 빌드 및 Docker Hub 푸시
make deploy
```

### 2. EC2에서 docker-compose.yml 설정

```bash
# EC2 서버 접속 후
cd ~

# docker-compose.yml 생성
cat > docker-compose.yml << 'EOF'
services:
  app:
    image: achil7/campmanager:latest
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - DB_HOST=serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com
      - DB_PORT=5432
      - DB_NAME=serverdb
      - DB_USER=kwad
      - DB_PASSWORD=rkddntkfkd94!
      - JWT_SECRET=campmanager_super_secret_jwt_key_2025
    restart: unless-stopped
EOF
```

### 3. Docker 컨테이너 실행

```bash
# 이미지 풀
docker compose pull

# 컨테이너 시작
docker compose up -d

# 로그 확인
docker compose logs -f app
```

### 4. 데이터베이스 마이그레이션 및 시더

```bash
# 마이그레이션 실행 (테이블 생성)
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:migrate"

# 기본 시더 실행
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:seed:all"

# 마스터 계정 시더 실행 (별도)
docker compose exec app sh -c "cd /app/backend && node -e \"
const seeder = require('./src/seeders/20251206000000-create-master-users.js');
const db = require('./src/models');
seeder.up(db.sequelize.getQueryInterface(), db.Sequelize).then(() => {
  console.log('Done');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
\""
```

## 계정 정보

### 마스터 계정 (역할별)
| 역할 | Username | Password | 리다이렉트 |
|------|----------|----------|------------|
| 총관리자 | `achiladmin` | `rkddntkfkd94!` | `/admin` |
| 영업사 | `achilsales` | `rkddntkfkd94!` | `/sales` |
| 진행자 | `achiloperator` | `rkddntkfkd94!` | `/operator` |
| 브랜드사 | `achilbrand` | `rkddntkfkd94!` | `/brand` |

### 기본 관리자 계정
| Username | Password |
|----------|----------|
| `admin` | `admin123!@#` |

## Nginx 설정 (현재 구성)

### Nginx 설정 파일
파일 위치: `/etc/nginx/sites-available/campmanager`

```nginx
server {
    listen 80;
    server_name kwad.co.kr;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name kwad.co.kr;

    ssl_certificate /etc/letsencrypt/live/kwad.co.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kwad.co.kr/privkey.pem;

    # 모든 요청을 Docker 컨테이너로 프록시
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
}
```

### 2. Nginx 활성화

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/campmanager /etc/nginx/sites-enabled/

# 기본 사이트 비활성화
sudo rm /etc/nginx/sites-enabled/default

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx

# Nginx 부팅 시 자동 시작
sudo systemctl enable nginx
```

## 방화벽 설정

### EC2 보안 그룹 (Security Group)
인바운드 규칙에 다음 포트 추가:
- HTTP: 80 (모든 IP: 0.0.0.0/0)
- HTTPS: 443 (모든 IP: 0.0.0.0/0) - SSL 사용 시
- Custom TCP: 5000 (임시 테스트용, 나중에 제거)

### Ubuntu 방화벽 (UFW)
```bash
# UFW 활성화
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS (SSL 사용 시)
sudo ufw enable
sudo ufw status
```

## 테스트

### 1. 백엔드 API 테스트
```bash
# Health check
curl http://localhost:5000/health

# 캠페인 목록 (외부에서)
curl http://your-ec2-ip/api/campaigns?userRole=admin
```

### 2. 프론트엔드 접속
브라우저에서 `http://your-ec2-ip` 또는 `http://your-domain.com` 접속

## 유지보수

### PM2 명령어
```bash
# 서버 재시작
pm2 restart campmanager-api

# 서버 중지
pm2 stop campmanager-api

# 서버 삭제
pm2 delete campmanager-api

# 로그 보기
pm2 logs campmanager-api

# 실시간 모니터링
pm2 monit
```

### 백엔드 업데이트
```bash
cd ~/purchaseweb/backend
git pull
npm install
npm run db:migrate  # 새 마이그레이션이 있는 경우
pm2 restart campmanager-api
```

### 프론트엔드 업데이트
```bash
cd ~/purchaseweb
git pull
npm install
npm run build
# Nginx는 자동으로 새 빌드 파일 서빙
```

## 문제 해결

### 백엔드가 시작되지 않는 경우
```bash
# PM2 로그 확인
pm2 logs campmanager-api --lines 100

# 데이터베이스 연결 확인
cd ~/purchaseweb/backend
node -e "const { sequelize } = require('./src/models'); sequelize.authenticate().then(() => console.log('DB OK')).catch(err => console.log('DB Error:', err));"
```

### Nginx 에러
```bash
# Nginx 에러 로그
sudo tail -f /var/log/nginx/error.log

# Nginx 설정 테스트
sudo nginx -t
```

### 데이터베이스 연결 실패
- RDS 보안 그룹에 EC2의 프라이빗 IP 추가
- 또는 RDS 보안 그룹에 EC2의 보안 그룹 추가

## SSL 인증서 설정 (선택사항)

### Let's Encrypt 사용
```bash
# Certbot 설치
sudo apt-get install certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d your-domain.com

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

## 백업

### 데이터베이스 백업
```bash
# PostgreSQL 백업
pg_dump -h serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com \
  -U kwad -d serverdb > backup_$(date +%Y%m%d).sql

# 복원
psql -h serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com \
  -U kwad -d serverdb < backup_20241204.sql
```

## 모니터링

### PM2 모니터링
```bash
pm2 monit  # 실시간 모니터링
pm2 status # 상태 확인
```

### 서버 리소스
```bash
htop       # CPU/메모리 사용률
df -h      # 디스크 사용량
free -h    # 메모리 사용량
```

## 완료된 작업

1. ✅ EC2 배포 완료
2. ✅ Docker 컨테이너 배포
3. ✅ JWT 인증 시스템 구현 (2025-12-06)
4. ✅ 역할 기반 권한 체크
5. ✅ SSL 인증서 설정 (Let's Encrypt)
6. ✅ 도메인 연결 (kwad.co.kr)
7. ⏳ AWS S3 이미지 업로드
8. ⏳ 자동 백업 설정

## 업데이트 배포 방법

### 로컬에서 (Windows)
```bash
# 1. 코드 수정 후
cd c:\Users\achil\Desktop\purchaseweb

# 2. Docker 이미지 빌드 및 푸시
make deploy
```

### EC2에서
```bash
# 1. 새 이미지 풀
docker compose pull

# 2. 컨테이너 재시작
docker compose up -d

# 3. (필요시) 마이그레이션 실행
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:migrate"
```
