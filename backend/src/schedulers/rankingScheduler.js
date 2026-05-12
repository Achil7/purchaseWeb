/**
 * 랭킹 자동 수집 스케줄러
 *
 * 동작:
 *  - 1시간 인터벌, 매시 0~9분 + 0~59초 랜덤 시각에 1회 실행
 *  - 예: 14:03:27, 15:07:43, 16:01:12, 17:09:51 ...
 *  - 서버 부팅 시 자동 시작 (RANKING_AUTO_ENABLED=true 일 때)
 *  - 다음 정시 슬롯 계산 후 setTimeout 재귀
 *  - 수집 중일 때는 다음 정시 슬롯까지 건너뜀
 */

const { triggerCollectionRound } = require('../services/rankingTracker/collectionService');
const { isProxyEnabled } = require('../services/rankingTracker/proxyConfig');

let timer = null;
let running = false;
let nextRunAt = null;

function fmtTs(d) {
  if (!d) return '-';
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}

/**
 * 다음 정시 슬롯 (다음 시간의 0~9분 랜덤 + 0~59초 랜덤)
 */
function computeNextRunAt(after = new Date()) {
  const next = new Date(after);
  next.setHours(next.getHours() + 1);
  next.setMinutes(Math.floor(Math.random() * 10));
  next.setSeconds(Math.floor(Math.random() * 60));
  next.setMilliseconds(0);
  if (next <= after) {
    next.setHours(next.getHours() + 1);
  }
  return next;
}

function scheduleNext() {
  if (!running) return;
  nextRunAt = computeNextRunAt(new Date());
  const delay = Math.max(0, nextRunAt.getTime() - Date.now());
  console.log(`[rankingScheduler] next run: ${fmtTs(nextRunAt)} (in ${Math.round(delay / 1000)}s)`);
  timer = setTimeout(runOnce, delay);
}

async function runOnce() {
  if (!running) return;
  try {
    console.log('[rankingScheduler] triggering scheduled collection');
    const result = await triggerCollectionRound({ triggeredBy: 'scheduler' });
    console.log(`[rankingScheduler] result: ${result.status}`);
  } catch (err) {
    console.error('[rankingScheduler] error', err.message);
  } finally {
    scheduleNext();
  }
}

function start() {
  if (running) {
    console.log('[rankingScheduler] already running');
    return;
  }
  const enabled = String(process.env.RANKING_AUTO_ENABLED || '').toLowerCase() === 'true';
  if (!enabled) {
    console.log('[rankingScheduler] disabled (set RANKING_AUTO_ENABLED=true to enable)');
    return;
  }
  if (!isProxyEnabled()) {
    console.warn('[rankingScheduler] WARNING: PROXY_ENABLED is not true. Scheduler will run but olive young will likely block EC2 IP.');
  }
  running = true;
  console.log('[rankingScheduler] started');
  scheduleNext();
}

function stop() {
  running = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  nextRunAt = null;
  console.log('[rankingScheduler] stopped');
}

function getStatus() {
  return {
    running,
    nextRunAt,
    proxyEnabled: isProxyEnabled()
  };
}

module.exports = { start, stop, getStatus };
