#!/bin/bash

# CampManager 배포 스크립트 (EC2에서 실행)

echo "🚀 Starting CampManager deployment..."

# 1. 기존 컨테이너 중지 및 제거
echo "📦 Stopping existing container..."
docker stop campmanager-app 2>/dev/null || true
docker rm campmanager-app 2>/dev/null || true

# 2. 최신 이미지 pull
echo "⬇️  Pulling latest image..."
docker pull your-dockerhub-username/campmanager:latest

# 3. 컨테이너 실행
echo "🏃 Starting container..."
docker run -d \
  --name campmanager-app \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e DB_HOST=your-rds-endpoint.region.rds.amazonaws.com \
  -e DB_PORT=5432 \
  -e DB_NAME=your_database_name \
  -e DB_USER=your_db_username \
  -e DB_PASSWORD='your_db_password' \
  -e JWT_SECRET=your_jwt_secret_key_at_least_32_characters_long \
  -e JWT_EXPIRE=7d \
  -e JWT_REFRESH_EXPIRE=30d \
  -e AWS_REGION=ap-northeast-2 \
  -e S3_BUCKET_NAME=your-s3-bucket-name \
  -e FRONTEND_URL=https://your-domain.com \
  -e MAX_FILE_SIZE=10485760 \
  -e ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,image/gif,image/webp \
  --restart unless-stopped \
  your-dockerhub-username/campmanager:latest

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
echo "📍 API: http://your-ec2-instance.compute.amazonaws.com:5000"
echo "📍 Frontend: https://your-domain.com"
