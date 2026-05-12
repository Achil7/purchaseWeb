# Multi-stage build for React + Node.js

# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source
COPY frontend/src ./src
COPY frontend/public ./public

# Build frontend
RUN npm run build

# Stage 2: Build Node.js backend
# - 올리브영 랭킹 수집(Playwright + Chromium) 포함을 위해 Playwright 공식 이미지 사용
FROM mcr.microsoft.com/playwright:v1.50.0-jammy AS backend-build
WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./
# optionalDependencies(playwright, cheerio, playwright-extra, puppeteer-extra-plugin-stealth, node-notifier) 포함 설치
RUN npm install --production --include=optional

# Copy backend source
COPY backend ./

# Stage 3: Final production image (Playwright 이미지 = Ubuntu jammy + Chromium 사전 설치)
FROM mcr.microsoft.com/playwright:v1.50.0-jammy
WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Copy backend from build stage (node_modules 포함)
COPY --from=backend-build /app/backend ./backend

# Copy frontend build from build stage
COPY --from=frontend-build /app/frontend/build ./backend/public

# Expose port
EXPOSE 5000

# Start backend with PM2
CMD ["pm2-runtime", "start", "backend/server.js", "--name", "campmanager-api"]
