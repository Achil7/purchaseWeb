const { app } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * rankingTracker (categories.js + playwrightScraper.js) 경로 resolution
 * - 개발: ../../../backend/src/services/rankingTracker
 * - 빌드: extraResources에 들어간 위치 (process.resourcesPath/rankingTracker)
 */
function resolveRankingTrackerPath() {
  // 개발 모드: backend 폴더 직접 참조
  const devPath = path.resolve(__dirname, '../../../backend/src/services/rankingTracker');
  if (fs.existsSync(devPath)) return devPath;

  // 빌드 모드: extraResources
  const prodPath = path.join(process.resourcesPath, 'rankingTracker');
  if (fs.existsSync(prodPath)) return prodPath;

  throw new Error(`rankingTracker 폴더를 찾을 수 없습니다. dev=${devPath}, prod=${prodPath}`);
}

module.exports = { resolveRankingTrackerPath };
