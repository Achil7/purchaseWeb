# EC2 서버 배포 가이드

## 개요
CampManager 애플리케이션을 AWS EC2 서버에 Docker로 배포하는 가이드입니다.

> 중요: 빌드는 **루트 `Makefile` + `deploy/Dockerfile`** 조합이 정식 방식이고, 서버 배포는 **`docker compose`** 워크플로우가 정식입니다. `deploy/deploy.sh`는 placeholder 이미지명(`your-dockerhub-username/campmanager`)과 raw `docker run`을 쓰는 **레거시/구버전 스크립트이므로 사용하지 마세요** (자세한 내용은 아래 "deploy.sh는 레거시" 참고).

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
│                       ┌──────┴───────────────────────────┐ │
│                       │   Docker (Backend, PM2 단일 컨테이너) │ │
│                       │   - Express API                   │ │
│                       │   - 올리브영 랭킹 수집 워커 (in-process) │ │
│                       │     Playwright + Chromium         │ │
│                       │   - GPT-4o Vision 리뷰 추출        │ │
│                       │   - Admin AI 챗 (text-to-SQL)     │ │
│                       └───────────────────────────────────┘ │
│                              │                              │
│                       ┌──────┴──────┐                       │
│                       │   AWS S3    │  (리뷰 이미지 저장)      │
│                       └─────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

> 단일 백엔드 컨테이너 안에서 API 서버와 함께 **올리브영 랭킹 수집 워커가 같은 프로세스(in-process 스케줄러)로** 돌아갑니다. 별도 워커 컨테이너/엔트리포인트가 없습니다. 이 워커가 Playwright + Chromium을 사용하기 때문에 Docker 베이스 이미지가 일반 node 이미지가 아니라 **Playwright 공식 이미지**(`mcr.microsoft.com/playwright:v1.50.0-jammy`)이고, 이미지 용량이 크며(약 2GB 이상) 메모리도 그만큼 잡아야 합니다.

## Docker 이미지 구조 (deploy/Dockerfile)

`deploy/Dockerfile`은 멀티 스테이지 빌드입니다.

1. **frontend-build** (`node:18-alpine`) — `frontend/`의 React 앱을 `npm run build`로 빌드
2. **backend-build** (`mcr.microsoft.com/playwright:v1.50.0-jammy`) — `backend/`의 의존성 설치 (`npm install --production --include=optional`로 `playwright`, `cheerio`, `playwright-extra` 등 optionalDependencies까지 설치)
3. **final** (`mcr.microsoft.com/playwright:v1.50.0-jammy`) — PM2 전역 설치, 백엔드 복사, 프론트 빌드 결과를 `backend/public`으로 복사, 5000 포트 노출

컨테이너는 bare `node`가 아니라 **PM2(`pm2-runtime`)** 로 시작됩니다.

```dockerfile
CMD ["pm2-runtime", "start", "backend/server.js", "--name", "campmanager-api"]
```

> Chromium이 사전 설치된 Playwright 이미지라서 랭킹 수집 워커가 추가 다운로드 없이 동작합니다. 일반 node 이미지로 교체하면 랭킹 수집이 깨집니다.

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

### 1. 로컬에서 이미지 빌드 및 푸시 (루트 Makefile)

빌드/태그/푸시는 루트 `Makefile`로 일원화되어 있습니다. (`DOCKER_USER=achil7`)

```bash
# 프로젝트 루트에서 실행
cd /path/to/your/project

# 운영 서버용 (kwad.co.kr) — :latest 태그
make deploy        # = make build + make tag + make push

# 테스트 서버용 (test.kwad.co.kr) — :test 태그
make test-deploy   # = make test-build + make test-tag + make test-push
```

| 명령 | 동작 |
|------|------|
| `make build` | `docker build -f deploy/Dockerfile -t campmanager:latest .` |
| `make tag` / `make push` | Docker Hub용 태그 / 푸시 |
| `make deploy` | build + tag + push (운영 `:latest`) |
| `make test-build` / `make test-deploy` | 테스트 서버용(`:test` 태그) |
| `make clean` | `docker image prune -a -f` (오래된 이미지 정리) |

### 2. EC2에서 docker-compose.yml 설정

> 아래 예시는 **모든 환경 변수**를 포함합니다. S3, AI 챗, 리뷰 추출, 랭킹 수집 중 어느 하나라도 빠지면 해당 기능이 꺼지거나(OFF) 동작하지 않습니다. 실제 비밀값은 EC2 서버의 `.env` 또는 compose `environment`에서 채워 넣으세요.

```bash
# EC2 서버 접속 후
cd ~

# docker-compose.yml 생성
cat > docker-compose.yml << 'EOF'
services:
  app:
    image: achil7/campmanager:latest   # 테스트 서버는 achil7/campmanager:test
    ports:
      - "5000:5000"
    environment:
      # === Server ===
      - NODE_ENV=production
      - PORT=5000
      # === Database (AWS RDS PostgreSQL) ===
      - DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
      - DB_PORT=5432
      - DB_NAME=your_database_name
      - DB_USER=your_db_username
      - DB_PASSWORD=your_db_password
      # === JWT ===
      - JWT_SECRET=your_jwt_secret_key_at_least_32_characters_long
      - JWT_EXPIRE=7d
      - JWT_REFRESH_EXPIRE=30d
      # === AWS / S3 (리뷰 이미지 업로드) ===
      - AWS_REGION=ap-northeast-2
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - S3_BUCKET_NAME=your-s3-bucket-name
      # === Frontend / CORS + 업로드 ===
      - FRONTEND_URL=https://your-domain.com
      - MAX_FILE_SIZE=10485760
      - ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,image/gif,image/webp
      # === Admin AI 챗 (text-to-SQL) ===
      - AI_CHAT_ENABLED=true
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - ANTHROPIC_MODEL=claude-opus-4-8
      - AI_CHAT_ALLOWED_USERS=masterkangwoo   # 운영: 해당 계정만 / 빈값: 모든 admin
      - DB_READONLY_USER=ai_readonly
      - DB_READONLY_PASSWORD=${DB_READONLY_PASSWORD}
      # (선택) AI 챗만 다른 DB를 읽게 할 때 override
      # - DB_READONLY_NAME=
      # - DB_READONLY_HOST=
      # - DB_READONLY_PORT=
      # === 리뷰 텍스트 추출 (GPT-4o Vision) ===
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_MODEL=gpt-4o
      - OPENAI_VISION_DETAIL=high
      - EXTRACTION_ENABLED=true
      - EXTRACTION_ALLOWED_BRAND_IDS=   # 빈값=전체차단 / all=전체 / 1,5,10=해당 브랜드만
      # === 올리브영 랭킹 수집 워커 + 프록시 ===
      - RANKING_AUTO_ENABLED=true
      - PROXY_MODE=site_unblocker        # none / residential / site_unblocker
      # residential 모드용
      - PROXY_SERVER=http://kr.decodo.com:10000
      - PROXY_USERNAME=${PROXY_USERNAME}
      - PROXY_PASSWORD=${PROXY_PASSWORD}
      # site_unblocker 모드용
      - SITE_UNBLOCKER_HOST=unblock.decodo.com:60000
      - SITE_UNBLOCKER_USER=${SITE_UNBLOCKER_USER}
      - SITE_UNBLOCKER_PASS=${SITE_UNBLOCKER_PASS}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
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
# 마이그레이션 실행 (테이블 생성/변경)
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:migrate"

# 시더 실행 (CLI 기본 seeders 경로: backend/seeders/)
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:seed:all"
```

> 마이그레이션은 80개 이상이며, 최신은 `20260626000000-add-serial-to-users.js`(브랜드 일련번호)입니다. 정산(settlement), 리뷰 추출(review_extracted_texts), 올리브영 랭킹(platform_rankings + 가격 필드), 랭킹 수집 작업(ranking_collection_jobs + 통계), 단가(unit-price), info_entered_at, 브랜드 serial 등 신규 테이블/컬럼이 모두 `db:migrate` 한 번으로 반영되므로 **업데이트 배포 시 마이그레이션을 잊지 마세요**.

#### 시더 경로 주의 (마스터 계정)

`backend/.sequelizerc`의 `seeders-path`는 `backend/seeders/`로 설정되어 있고, 이 디렉토리에는 `20241204000001-create-admin-user.js`만 있습니다. 따라서 `db:seed:all`은 admin 계정만 생성합니다.

마스터/목 데이터 시더(`20251206000000-create-master-users.js`, `20240601000002-mock-test-data.js`, `mock-data.js`)는 `backend/src/seeders/`에 있어서 CLI 기본 경로 밖입니다. 마스터 계정이 필요하면 해당 시더를 직접 실행하세요.

```bash
docker compose exec app sh -c "cd /app/backend && node -e \"
const seeder = require('./src/seeders/20251206000000-create-master-users.js');
const db = require('./src/models');
seeder.up(db.sequelize.getQueryInterface(), db.Sequelize).then(() => {
  console.log('Done');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
\""
```

## 환경 변수 전체 목록

기준 파일: `backend/.env.example`, `deploy/docker-compose.yml`, 그리고 `backend/src`의 실제 `process.env.*` 사용처.

### Server
| 변수 | 예시/기본 | 설명 |
|------|----------|------|
| `NODE_ENV` | `production` | 실행 환경 (development/production) |
| `PORT` | `5000` | API 포트 |

### Database (AWS RDS PostgreSQL)
| 변수 | 설명 |
|------|------|
| `DB_HOST` | RDS 엔드포인트 |
| `DB_PORT` | `5432` |
| `DB_NAME` | 데이터베이스명 |
| `DB_USER` | DB 사용자 |
| `DB_PASSWORD` | DB 비밀번호 |

### JWT
| 변수 | 예시/기본 | 설명 |
|------|----------|------|
| `JWT_SECRET` | 32자 이상 | 토큰 서명 키 |
| `JWT_EXPIRE` | `7d` | 액세스 토큰 만료 |
| `JWT_REFRESH_EXPIRE` | `30d` | 모바일 리프레시 토큰 만료 |

### AWS / S3
| 변수 | 예시/기본 | 설명 |
|------|----------|------|
| `AWS_REGION` | `ap-northeast-2` | S3 리전 |
| `AWS_ACCESS_KEY_ID` | | S3 액세스 키 |
| `AWS_SECRET_ACCESS_KEY` | | S3 시크릿 키 |
| `S3_BUCKET_NAME` | | 리뷰 이미지 버킷 |

### Frontend / CORS + Upload
| 변수 | 예시/기본 | 설명 |
|------|----------|------|
| `FRONTEND_URL` | `https://your-domain.com` | CORS 허용 오리진 |
| `MAX_FILE_SIZE` | `10485760` (10MB) | 이미지당 최대 크기 |
| `ALLOWED_FILE_TYPES` | `image/jpeg,...` | 허용 MIME 타입 |

### Admin AI 챗 (text-to-SQL)
| 변수 | 예시/기본 | 설명 |
|------|----------|------|
| `AI_CHAT_ENABLED` | `true` | 문자열 `"true"`일 때만 활성 (`config/anthropic.js`) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | 활성화 시 필수 |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | 모델 override. 코드 기본값은 `claude-sonnet-4-6`이며 .env.example은 `claude-opus-4-8`. 질문 난이도별 모델 선택 지원 |
| `AI_CHAT_ALLOWED_USERS` | 빈값 또는 `masterkangwoo` | 빈값=모든 admin(테스트), `masterkangwoo`=해당 계정만(운영) |
| `DB_READONLY_USER` | `ai_readonly` | AI 생성 SQL 실행용 SELECT 전용 Postgres 역할 |
| `DB_READONLY_PASSWORD` | | 위 역할 비밀번호 |
| `DB_READONLY_NAME` (선택) | | AI 챗만 다른 DB를 읽게 할 때 override (예: test 앱이 prod DB 조회) |
| `DB_READONLY_HOST` (선택) | | 위와 동일 (host override) |
| `DB_READONLY_PORT` (선택) | | 위와 동일 (port override) |

> readonly 풀은 `statement_timeout=10000ms`로 폭주 쿼리를 차단하며, 앱 레벨 `sqlValidator.js`가 2차 방어선(SELECT 전용)입니다.

### 리뷰 텍스트 추출 (GPT-4o Vision)
| 변수 | 예시/기본 | 설명 |
|------|----------|------|
| `OPENAI_API_KEY` | | 추출 활성화 시 필수 (`config/openai.js`) |
| `OPENAI_MODEL` | `gpt-4o` | Vision 모델 |
| `OPENAI_VISION_DETAIL` | `high` | 이미지 해상도 디테일 |
| `EXTRACTION_ENABLED` | `true` | 문자열 `"true"`일 때만 추출 동작 |
| `EXTRACTION_ALLOWED_BRAND_IDS` | 빈값 / `all` / `1,5,10` | 안전 게이트: 빈값=전체차단, `all`=전체허용, 콤마 목록=해당 브랜드만 |

> `EXTRACTION_ENABLED=true` 라도 `EXTRACTION_ALLOWED_BRAND_IDS`가 비어 있으면 전체 차단(OFF)입니다. 이 변수들은 `deploy/docker-compose.yml`에는 있으나 `backend/.env.example`에는 없으므로 서버 `.env`에서 직접 설정하세요.

### 올리브영 랭킹 수집 워커 + 프록시
| 변수 | 예시/기본 | 설명 |
|------|----------|------|
| `RANKING_AUTO_ENABLED` | `true` | 문자열 `"true"`이면 `server.js`에서 `rankingScheduler` 시작 |
| `PROXY_MODE` | `none` / `residential` / `site_unblocker` | 3가지 프록시 모드 스위치 (`services/rankingTracker/proxyConfig.js`) |
| `PROXY_SERVER` | `http://kr.decodo.com:10000` | residential 모드 프록시 서버 |
| `PROXY_USERNAME` / `PROXY_PASSWORD` | | residential 모드 인증 |
| `SITE_UNBLOCKER_HOST` | `unblock.decodo.com:60000` | site_unblocker(Decodo Site Unblocker HTTP) 호스트 |
| `SITE_UNBLOCKER_USER` / `SITE_UNBLOCKER_PASS` | | site_unblocker 인증 |

> `server.js`의 `startEnvWatcher()`가 `.env`의 `PROXY_*` 변경을 감시하여 **재시작 없이** 프록시 ON/OFF를 토글합니다. 랭킹 워커는 별도 컨테이너가 아니라 메인 백엔드 컨테이너 안의 in-process 스케줄러로 돌고, Playwright + Chromium을 쓰므로 Playwright 베이스 이미지가 필요합니다.

## ai_readonly Postgres 역할 설정 (AI 챗 필수)

Admin AI 챗이 생성한 SQL은 **SELECT 전용 Postgres 역할(`ai_readonly`)** 로만 실행됩니다. RDS에서 다음을 1회 실행해 역할과 권한을 만드세요.

```sql
-- 1) 읽기전용 로그인 역할 생성
CREATE ROLE ai_readonly WITH LOGIN PASSWORD 'your_readonly_password';

-- 2) DB / 스키마 접근 권한
GRANT CONNECT ON DATABASE your_database_name TO ai_readonly;
GRANT USAGE ON SCHEMA public TO ai_readonly;

-- 3) 현재 존재하는 모든 테이블 SELECT 권한
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ai_readonly;

-- 4) 앞으로 생성될 테이블에도 자동 SELECT 권한 (default privileges)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ai_readonly;
```

그런 다음 `.env` / compose에 `DB_READONLY_USER=ai_readonly`, `DB_READONLY_PASSWORD=...`를 설정합니다. (선택적으로 `DB_READONLY_NAME/HOST/PORT`로 다른 DB를 가리킬 수 있음.)

## deploy.sh는 레거시 (사용 금지)

`deploy/deploy.sh`는 다음 이유로 **현재 워크플로우와 어긋나는 구버전 스크립트**입니다. 참고용으로만 두고 실제 배포에는 쓰지 마세요.

- 이미지명이 placeholder `your-dockerhub-username/campmanager` (실제는 `achil7/campmanager`)
- `docker compose`가 아니라 raw `docker run`으로 컨테이너를 띄움
- S3/AI 챗/추출/랭킹 관련 환경 변수가 전부 빠져 있음
- 존재하지 않는 시더(`20240601000001-admin-user.js`)를 호출

정식 경로는 **루트 `Makefile`(빌드/푸시) + `docker compose`(서버 실행) + `db:migrate`** 입니다.

## 계정 정보

계정 정보는 시더(seeder)를 통해 생성됩니다.
- `backend/seeders/20241204000001-create-admin-user.js` — admin 계정 (`db:seed:all` 대상)
- `backend/src/seeders/20251206000000-create-master-users.js` — 마스터 계정 (직접 실행, 위 4-2 참고)
- `backend/src/seeders/20240601000002-mock-test-data.js`, `mock-data.js` — 목 데이터

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
# Health check (app.js에 직접 정의된 무인증 엔드포인트)
curl http://localhost:5000/health

# 외부에서 테스트
curl https://your-domain.com/health
```

> compose의 `healthcheck`도 `GET /health`를 호출합니다. 컨테이너가 healthy가 되지 않으면 이 엔드포인트와 DB 연결을 먼저 확인하세요.

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

# 2. Docker 이미지 빌드 및 푸시 (운영)
make deploy
# 테스트 서버는 make test-deploy
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

### AI 챗 / 추출 / 랭킹이 동작하지 않을 때
- **AI 챗 미동작**: `AI_CHAT_ENABLED=true` 여부, `ANTHROPIC_API_KEY` 설정, `ai_readonly` 역할/권한 생성, `DB_READONLY_USER/PASSWORD` 일치, 계정이 `AI_CHAT_ALLOWED_USERS` 정책에 부합하는지 확인
- **리뷰 추출 미동작**: `EXTRACTION_ENABLED=true` 와 `EXTRACTION_ALLOWED_BRAND_IDS`(빈값이면 전체 차단), `OPENAI_API_KEY` 확인
- **랭킹 수집 미동작**: `RANKING_AUTO_ENABLED=true`, `PROXY_MODE`와 해당 모드의 프록시 자격증명 확인. 이미지가 Playwright 베이스인지(Chromium 존재) 확인

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

> Playwright/Chromium 기반 랭킹 수집이 같은 컨테이너에서 돌기 때문에, 수집 시점에 메모리/CPU가 일시적으로 치솟을 수 있습니다. 인스턴스 사이징 시 이를 고려하세요.

## 파일 업로드 제한 설정

| 계층 | 설정 | 값 |
|------|------|-----|
| Nginx | `client_max_body_size` | 50MB |
| Express | `express.json({ limit })` | 20MB |
| Express | `express.urlencoded({ limit })` | 20MB |
| Multer | `limits.fileSize` | 10MB (이미지당) |

## 완료된 작업

1. ✅ EC2 배포 완료 (Makefile + docker compose 워크플로우)
2. ✅ Docker 컨테이너 배포 (Playwright 베이스 이미지, PM2 `pm2-runtime`)
3. ✅ JWT 인증 시스템 구현 (액세스 + 모바일 리프레시 토큰)
4. ✅ 역할 기반 권한 체크
5. ✅ SSL 인증서 설정 (Let's Encrypt)
6. ✅ 도메인 연결
7. ✅ AWS S3 이미지 업로드
8. ✅ Nginx 파일 업로드 크기 제한 설정 (50MB)
9. ✅ 올리브영 BEST 랭킹 수집 워커 (in-process, Playwright/Chromium, 3-way PROXY_MODE + hot-reload)
10. ✅ GPT-4o Vision 리뷰 텍스트 추출 (브랜드 ID 게이팅)
11. ✅ Admin AI 챗 text-to-SQL (ai_readonly 역할 + statement_timeout + SQL 검증)
12. ⏳ 자동 백업 설정

> 참고: 마진/정산/견적(margin/settlement/quote) 기능은 미사용으로 **제거되었습니다**(commit 9317faa, 마진 코드 제거). 다만 일부 정산 테이블(`settlements`, `settlement_products`, `estimates`, `margin_settings`)은 마이그레이션으로 생성되어 DB에 남아 있을 수 있습니다.

---

**최종 업데이트**: 2026-06-29
