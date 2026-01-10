# EC2 서버 배포 가이드

## 개요
CampManager 애플리케이션을 AWS EC2 서버에 Docker로 배포하는 가이드입니다.

## 현재 인프라 구성

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Cloud                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐ │
│  │   Route53   │──────│   EC2       │──────│   RDS       │ │
│  │  (Domain)   │      │  (Docker)   │      │ PostgreSQL  │ │
│  └─────────────┘      └─────────────┘      └─────────────┘ │
│                              │                              │
│                       ┌──────┴──────┐                       │
│                       │   Nginx     │                       │
│                       │  (SSL/443)  │                       │
│                       └──────┬──────┘                       │
│                              │                              │
│                       ┌──────┴──────┐                       │
│                       │   Docker    │                       │
│                       │  (Backend)  │                       │
│                       └─────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## 사전 준비

### 1. EC2 서버 접속
```bash
ssh -i "your-key.pem" ubuntu@your-ec2-ip
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
cd /path/to/your/project

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
    image: your-dockerhub-username/campmanager:latest
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - DB_HOST=your-rds-endpoint
      - DB_PORT=5432
      - DB_NAME=your-db-name
      - DB_USER=your-db-user
      - DB_PASSWORD=your-db-password
      - JWT_SECRET=your-jwt-secret
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

계정 정보는 시더(seeder)를 통해 생성됩니다.
자세한 내용은 `backend/seeders/` 디렉토리의 시더 파일을 참고하세요.

### 역할별 리다이렉트
| 역할 | 리다이렉트 경로 |
|------|----------------|
| 총관리자 (admin) | `/admin` |
| 영업사 (sales) | `/sales` |
| 진행자 (operator) | `/operator` |
| 브랜드사 (brand) | `/brand` |

## Nginx 설정 (현재 구성)

### 현재 서버 설정
파일 위치: `/etc/nginx/sites-available/default`

```nginx
server {
    server_name your-domain.com www.your-domain.com;

    # 파일 업로드 크기 제한 (50MB - 다중 이미지 업로드 지원)
    client_max_body_size 50M;

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

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = www.your-domain.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = your-domain.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 404; # managed by Certbot
}
```

### Nginx 설정 수정 방법

```bash
# 설정 파일 수정
sudo vi /etc/nginx/sites-available/default

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx

# Nginx 부팅 시 자동 시작
sudo systemctl enable nginx
```

### 중요 설정 항목

| 설정 | 값 | 설명 |
|------|-----|------|
| `client_max_body_size` | 50M | 파일 업로드 최대 크기 (Nginx 기본값 1MB) |
| `proxy_pass` | http://localhost:5000 | Docker 컨테이너로 프록시 |
| SSL | Let's Encrypt | Certbot으로 자동 관리 |

## 방화벽 설정

### EC2 보안 그룹 (Security Group)
인바운드 규칙에 다음 포트 추가:
- HTTP: 80 (모든 IP: 0.0.0.0/0)
- HTTPS: 443 (모든 IP: 0.0.0.0/0)
- SSH: 22 (관리자 IP만)

### Ubuntu 방화벽 (UFW)
```bash
# UFW 활성화
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
sudo ufw status
```

## 테스트

### 1. 백엔드 API 테스트
```bash
# Health check
curl http://localhost:5000/health

# 외부에서 테스트
curl https://your-domain.com/health
```

### 2. 프론트엔드 접속
브라우저에서 `https://your-domain.com` 접속

## 유지보수

### Docker 명령어
```bash
# 컨테이너 상태 확인
docker compose ps

# 로그 확인
docker compose logs -f app

# 컨테이너 재시작
docker compose restart app

# 컨테이너 중지
docker compose down

# 컨테이너 시작
docker compose up -d
```

### 업데이트 배포 방법

#### 로컬에서 (Windows)
```bash
# 1. 코드 수정 후
cd /path/to/your/project

# 2. Docker 이미지 빌드 및 푸시
make deploy
```

#### EC2에서
```bash
# 1. 새 이미지 풀
docker compose pull

# 2. 컨테이너 재시작
docker compose up -d --force-recreate

# 3. (필요시) 마이그레이션 실행
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:migrate"
```

## 문제 해결

### Docker 컨테이너 로그 확인
```bash
# 실시간 로그
docker compose logs -f app

# 최근 100줄
docker compose logs --tail 100 app
```

### Nginx 에러
```bash
# Nginx 에러 로그
sudo tail -f /var/log/nginx/error.log

# Nginx 설정 테스트
sudo nginx -t

# Nginx 상태 확인
sudo systemctl status nginx
```

### 413 Request Entity Too Large 에러
Nginx의 `client_max_body_size` 설정이 필요합니다:
```bash
sudo vi /etc/nginx/sites-available/default
# server 블록에 추가: client_max_body_size 50M;
sudo nginx -t
sudo systemctl restart nginx
```

### 데이터베이스 연결 실패
- RDS 보안 그룹에 EC2의 프라이빗 IP 추가
- 또는 RDS 보안 그룹에 EC2의 보안 그룹 추가

## SSL 인증서 설정

### Let's Encrypt (Certbot) - 이미 설정됨
```bash
# 인증서 상태 확인
sudo certbot certificates

# 인증서 수동 갱신
sudo certbot renew

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

인증서는 자동으로 갱신됩니다 (cron job으로 설정됨).

## 백업

### 데이터베이스 백업
```bash
# PostgreSQL 백업
pg_dump -h your-rds-endpoint -U your-db-user -d your-db-name > backup_$(date +%Y%m%d).sql

# 복원
psql -h your-rds-endpoint -U your-db-user -d your-db-name < backup_YYYYMMDD.sql
```

## 모니터링

### 서버 리소스
```bash
htop       # CPU/메모리 사용률
df -h      # 디스크 사용량
free -h    # 메모리 사용량
```

### Docker 리소스
```bash
docker stats  # 컨테이너별 리소스 사용량
```

## 파일 업로드 제한 설정

| 계층 | 설정 | 값 |
|------|------|-----|
| Nginx | `client_max_body_size` | 50MB |
| Express | `express.json({ limit })` | 20MB |
| Express | `express.urlencoded({ limit })` | 20MB |
| Multer | `limits.fileSize` | 10MB (이미지당) |

## 완료된 작업

1. ✅ EC2 배포 완료
2. ✅ Docker 컨테이너 배포
3. ✅ JWT 인증 시스템 구현
4. ✅ 역할 기반 권한 체크
5. ✅ SSL 인증서 설정 (Let's Encrypt)
6. ✅ 도메인 연결
7. ✅ AWS S3 이미지 업로드
8. ✅ Nginx 파일 업로드 크기 제한 설정 (50MB)
9. ⏳ 자동 백업 설정
