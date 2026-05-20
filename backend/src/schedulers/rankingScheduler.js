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
 * 다음 정시 슬롯 (다음 시간의 10~15분 랜덤 + 0~59초 랜덤)
 */
function computeNextRunAt(after = new Date()) {
  const next = new Date(after);
  next.setHours(next.getHours() + 1);
  next.setMinutes(10 + Math.floor(Math.random() * 6));   // 10, 11, 12, 13, 14, 15
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

/**
 * 좀비 job 정리 (서버 시작 시 1회).
 * 이전 프로세스에서 비정상 종료된 'running' 상태 job 을 'failed' 로 마감.
 * - Playwright 크래시, OOM, 강제 재시작 등으로 finally까지 도달 못한 경우 발생
 */
async function cleanupZombieJobs() {
  try {
    const { RankingCollectionJob } = require('../models');
    const [updated] = await RankingCollectionJob.update(
      {
        status: 'failed',
        error_text: 'Aborted: server restarted with job still in running state',
        completed_at: new Date()
      },
      { where: { status: 'running' } }
    );
    if (updated > 0) {
      console.log(`[rankingScheduler] cleaned up ${updated} zombie job(s)`);
    }
  } catch (err) {
    console.error('[rankingScheduler] zombie cleanup error:', err.message);
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
  // 좀비 정리 (비동기, 실패해도 스케줄러는 시작)
  cleanupZombieJobs();
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
