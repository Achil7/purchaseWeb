#!/bin/bash

# CampManager 배포 스크립트 (EC2에서 실행)

echo "🚀 Starting CampManager deployment..."

# 1. 기존 컨테이너 중지 및 제거
echo "📦 Stopping existing container..."
docker stop campmanager-app 2>/dev/null || true
docker rm campmanager-app 2>/dev/null || true

# 2. 최신 이미지 pull
echo "⬇️  Pulling latest image..."
docker pull achil7/campmanager:latest

# 3. 컨테이너 실행
echo "🏃 Starting container..."
docker run -d \
  --name campmanager-app \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e DB_HOST=serverdb.c96wgym80zj9.ap-northeast-2.rds.amazonaws.com \
  -e DB_PORT=5432 \
  -e DB_NAME=serverdb \
  -e DB_USER=kwad \
  -e DB_PASSWORD='rkddntkfkd94!' \
  -e JWT_SECRET=campmanager_super_secret_jwt_key_2024_change_in_production_32chars_min \
  -e JWT_EXPIRE=7d \
  -e JWT_REFRESH_EXPIRE=30d \
  -e AWS_REGION=ap-northeast-2 \
  -e S3_BUCKET_NAME=kwad-image \
  -e FRONTEND_URL=https://kwad.co.kr \
  -e MAX_FILE_SIZE=10485760 \
  -e ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,image/gif,image/webp \
  --restart unless-stopped \
  achil7/campmanager:latest

# 4. 컨테이너 상태 확인
echo "⏳ Waiting for container to start..."
sleep 5

if docker ps | grep -q campmanager-app; then
  echo "✅ Container is running!"
  docker logs campmanager-app --tail 20
else
  echo "❌ Container failed to start!"
  docker logs campmanager-app
  exit 1
fi

# 5. DB 마이그레이션 (첫 배포시 또는 필요시 실행)
read -p "🗄️  Run database migrations? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🔄 Running migrations..."
  docker exec campmanager-app sh -c "cd backend && npx sequelize-cli db:migrate"

  read -p "📊 Seed initial data? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 Seeding database..."
    docker exec campmanager-app sh -c "cd backend && npx sequelize-cli db:seed --seed 20240601000001-admin-user.js"
    docker exec campmanager-app sh -c "cd backend && npx sequelize-cli db:seed --seed 20240601000002-mock-test-data.js"
  fi
fi

echo "🎉 Deployment complete!"
echo "📍 API: http://ec2-16-184-33-207.ap-northeast-2.compute.amazonaws.com:5000"
echo "📍 Frontend: https://kwad.co.kr"
