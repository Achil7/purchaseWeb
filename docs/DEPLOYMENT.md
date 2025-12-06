# 배포 가이드

모든 배포 관련 파일과 문서는 [`deploy/`](./deploy) 폴더에 있습니다.

## 빠른 배포

```bash
# 1. 로컬에서 Docker 이미지 빌드 및 푸시
make deploy

# 2. EC2 서버 접속
ssh -i "server_rsa_key.pem" ubuntu@ec2-16-184-33-207.ap-northeast-2.compute.amazonaws.com

# 3. 배포 스크립트 실행
wget https://raw.githubusercontent.com/YOUR-REPO/purchaseweb/main/deploy/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

## 상세 문서

자세한 배포 가이드는 [`deploy/README.md`](./deploy/README.md)를 참조하세요.

## 주요 명령어

```bash
make help         # 사용 가능한 모든 명령어 보기
make deploy       # 빌드 + 태그 + 푸시 (한 번에)
make build        # Docker 이미지 빌드
make docker-run   # 로컬에서 컨테이너 실행
make logs         # 컨테이너 로그 확인
```

## 파일 위치

- **Dockerfile**: `deploy/Dockerfile`
- **배포 스크립트**: `deploy/deploy.sh`
- **환경 변수 예제**: `deploy/.env.example`
- **Docker Compose**: `deploy/docker-compose.yml`
