/**
 * collectionService
 *  - 수집 전역 lock (동시 1개 라운드만 실행)
 *  - 진행 상태 메모리 캐시 (프론트 폴링용)
 *  - 캐시 정책: 최근 collected_at 기준
 *  - rate limit: 사용자별 일 N회
 *  - 실제 Playwright 수집 호출 + DB INSERT
 *
 * 호출자: rankingScheduler (자동), rankingController (트리거 API)
 */

const { Op } = require('sequelize');
const { PlatformRanking, RankingCollectionJob } = require('../../models');
const { scrapeAllCategories } = require('./playwrightScraper');
const { CATEGORIES } = require('./categories');
const { isAnyProxyEnabled } = require('./proxyConfig');

const CACHE_TTL_MS = 30 * 60 * 1000;          // 30분 - 마지막 수집 기준 캐시 (전체 공통)
const HOURLY_LIMIT_PER_USER = 20;             // 사용자 본인 기준 시간당 최대 20회
const BUTTON_COOLDOWN_MS = 10 * 1000;         // 같은 사용자 연타 방지 10초
const IP_HOURLY_LIMIT = 30;                   // 같은 IP에서 시간당 최대 30회 (여러 사용자 합산)
const IP_BLOCK_DURATION_MS = 60 * 60 * 1000;  // IP 한도 초과 시 1시간 차단

/**
 * 전역 lock 상태
 * - running: 현재 라운드 실행 중인 라운드의 ranking_collection_jobs.id
 * - jobMeta: 진행 상황 (프론트 폴링용)
 */
let state = {
  running: false,
  jobId: null,
  jobMeta: null
};

let lastCollectedAtCache = null;        // 메모리 캐시 (DB 조회 절감)
let lastCollectedAtCheckedAt = 0;

// 연타 방지: userId → 마지막 클릭 시각
const lastClickByUser = new Map();

// IP 차단: ip → 차단 해제 시각 (timestamp)
const blockedIps = new Map();

// IP 시간당 호출 횟수: ip → [timestamps]
const ipCallTimestamps = new Map();

function getRunningJobState() {
  return state.running ? { ...state.jobMeta, jobId: state.jobId, running: true } : { running: false };
}

/**
 * 가장 최근 수집 시각 조회 (메모리 캐시 30초)
 */
async function getLastCollectedAt() {
  if (lastCollectedAtCache && Date.now() - lastCollectedAtCheckedAt < 30 * 1000) {
    return lastCollectedAtCache;
  }
  const latest = await PlatformRanking.findOne({
    attributes: ['collected_at'],
    order: [['collected_at', 'DESC']]
  });
  lastCollectedAtCache = latest ? latest.collected_at : null;
  lastCollectedAtCheckedAt = Date.now();
  return lastCollectedAtCache;
}

/**
 * 캐시 적중 여부
 */
async function isCacheFresh(ttlMs = CACHE_TTL_MS) {
  const t = await getLastCollectedAt();
  if (!t) return false;
  return Date.now() - new Date(t).getTime() < ttlMs;
}

/**
 * 사용자 일일 호출 횟수 (참고용 통계, 한도 체크는 더 이상 안 함)
 */
async function getUserDailyCount(userId) {
  if (!userId) return 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const count = await RankingCollectionJob.count({
    where: {
      triggered_user_id: userId,
      created_at: { [Op.gte]: start }
    }
  });
  return count;
}

/**
 * 사용자 시간당 호출 횟수 (실제 수집 트리거된 횟수)
 */
async function getUserHourlyCount(userId) {
  if (!userId) return 0;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return RankingCollectionJob.count({
    where: {
      triggered_user_id: userId,
      created_at: { [Op.gte]: oneHourAgo }
    }
  });
}

/**
 * IP 시간당 호출 횟수 갱신 + 차단 체크
 * @returns {object} { blocked, count }
 */
function trackIpAndCheck(ip) {
  if (!ip) return { blocked: false, count: 0 };

  // 차단 상태 체크
  const blockedUntil = blockedIps.get(ip);
  if (blockedUntil) {
    if (Date.now() < blockedUntil) {
      return { blocked: true, until: blockedUntil };
    }
    blockedIps.delete(ip);
  }

  // 시간당 카운트 갱신
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const timestamps = (ipCallTimestamps.get(ip) || []).filter((t) => t > oneHourAgo);
  timestamps.push(Date.now());
  ipCallTimestamps.set(ip, timestamps);

  // 한도 초과 시 차단
  if (timestamps.length > IP_HOURLY_LIMIT) {
    blockedIps.set(ip, Date.now() + IP_BLOCK_DURATION_MS);
    return { blocked: true, until: Date.now() + IP_BLOCK_DURATION_MS, reason: 'ip_hourly_exceeded' };
  }

  return { blocked: false, count: timestamps.length };
}

/**
 * 수집 라운드 트리거
 *
 * 반환:
 *  - { status: 'started', jobId } : 새 라운드 시작됨
 *  - { status: 'cached', collectedAt } : 캐시 적중, 새 수집 안 함
 *  - { status: 'busy', jobId, jobMeta } : 다른 사용자가 수집 중
 *  - { status: 'rate_limited', used, limit } : 사용자 한도 초과
 */
async function triggerCollectionRound({
  triggeredBy,     // 'scheduler' | 'admin' | 'brand'
  userId = null,
  ip = null,
  forceFresh = false,
  ttlMs = CACHE_TTL_MS
} = {}) {
  // 0-A) PROXY OFF면 모든 경로 차단 (자동+수동)
  if (!isAnyProxyEnabled()) {
    return { status: 'proxy_disabled' };
  }

  // 0) 사용자 트리거(브랜드/Admin) 한정 추가 제한
  if (triggeredBy === 'brand' || triggeredBy === 'admin') {
    // 0-1) IP 차단 체크
    if (ip) {
      const ipState = trackIpAndCheck(ip);
      if (ipState.blocked) {
        return {
          status: 'ip_blocked',
          until: ipState.until,
          reason: ipState.reason || 'ip_currently_blocked'
        };
      }
    }
    // 0-2) 같은 사용자 연타 방지 (10초)
    if (userId) {
      const lastClick = lastClickByUser.get(userId);
      if (lastClick && Date.now() - lastClick < BUTTON_COOLDOWN_MS) {
        const remainSec = Math.ceil((BUTTON_COOLDOWN_MS - (Date.now() - lastClick)) / 1000);
        return { status: 'cooldown', remainSec };
      }
      lastClickByUser.set(userId, Date.now());
    }
    // 0-3) 사용자 본인 시간당 한도 (3회)
    if (userId) {
      const hourly = await getUserHourlyCount(userId);
      if (hourly >= HOURLY_LIMIT_PER_USER) {
        return {
          status: 'hourly_limit',
          used: hourly,
          limit: HOURLY_LIMIT_PER_USER
        };
      }
    }
  }

  // 1) 진행 중인 작업이 있으면 그 정보 반환 (익명화: 트리거 주체 제거)
  if (state.running) {
    const { triggeredBy: _b, triggeredUserId: _u, ...safeJobMeta } = state.jobMeta || {};
    const startedAt = safeJobMeta.startedAt ? new Date(safeJobMeta.startedAt) : null;
    return {
      status: 'busy',
      jobId: state.jobId,
      jobMeta: {
        ...safeJobMeta,
        elapsedMs: startedAt ? Date.now() - startedAt.getTime() : null
      }
    };
  }

  // 2) 캐시 체크 (forceFresh가 아닐 때만)
  if (!forceFresh && triggeredBy !== 'scheduler') {
    const fresh = await isCacheFresh(ttlMs);
    if (fresh) {
      const t = await getLastCollectedAt();
      return { status: 'cached', collectedAt: t };
    }
  }

  // 3) Job 레코드 생성 + lock 획득
  const job = await RankingCollectionJob.create({
    status: 'running',
    triggered_by: triggeredBy,
    triggered_user_id: userId,
    total_categories: CATEGORIES.length,
    started_at: new Date()
  });

  state.running = true;
  state.jobId = job.id;
  state.jobMeta = {
    triggeredBy,
    triggeredUserId: userId,
    total: CATEGORIES.length,
    completed: 0,
    success: 0,
    fail: 0,
    currentCategory: null,
    failedCategories: [],     // 실패한 카테고리명 (마지막 시도 기준)
    proxyEnabled: isAnyProxyEnabled(),
    startedAt: job.started_at
  };

  // 5) 백그라운드로 실행 (await 안 함, 호출자에게는 곧장 응답)
  (async () => {
    const collectedAt = new Date();
    try {
      // 카테고리별 최종 상태 추적: success → 제거, fail → 추가
      // attempt가 진행되면서 재시도 성공한 카테고리는 자연스럽게 제거됨
      const failedCategoryMap = new Map();    // categoryName → { error, attempts }
      const succeededCategoryIds = new Set();

      const result = await scrapeAllCategories({
        maxRetries: 2,    // 최대 3회 시도 (1차 + 재시도 2회) - 봇 차단 강해진 5/26부터 5회→3회로 단축
        onProgress: async (idx, total, category, res, attempt) => {
          state.jobMeta.completed = idx;
          state.jobMeta.currentCategory = category.name;

          if (res.success) {
            // 이전에 실패로 기록됐었다면 제거 (재시도 성공)
            failedCategoryMap.delete(category.name);
            if (!succeededCategoryIds.has(category.id)) {
              succeededCategoryIds.add(category.id);
              state.jobMeta.success = (state.jobMeta.success || 0) + 1;
            }
          } else {
            failedCategoryMap.set(category.name, {
              error: res.error || 'unknown',
              attempts: (attempt || 0) + 1
            });
          }
          state.jobMeta.fail = failedCategoryMap.size;
          state.jobMeta.failedCategories = Array.from(failedCategoryMap.keys());

          try {
            await job.update({
              current_idx: idx,
              current_category: category.name,
              success_count: state.jobMeta.success,
              fail_count: state.jobMeta.fail
            });
          } catch (_) { /* ignore */ }
        }
      });

      // DB INSERT
      // 정책 (5/26 완화): 15/21 (약 70%) 이상 성공하면 INSERT.
      // 이유: 봇 차단 강화로 100% 성공이 어려워짐. 너무 엄격하면 시계열 데이터 비어버림.
      //       성공한 카테고리만 INSERT되고, 실패한 카테고리는 다음 라운드에서 채워짐.
      const minSuccessRatio = 0.70;
      const isAcceptable = result.successCount >= CATEGORIES.length * minSuccessRatio;
      if (result.items.length > 0 && isAcceptable) {
        const rows = result.items.map((it) => ({
          category_id: it.category_id,
          category_name: it.category_name,
          rank: it.rank,
          product_name: it.product_name,
          brand_name: it.brand_name,
          goods_no: it.goods_no,
          product_url: it.product_url,
          price: it.price,
          original_price: it.original_price,
          sale_price: it.sale_price,
          discount_rate: it.discount_rate,
          collected_at: collectedAt
        }));
        try {
          await PlatformRanking.bulkCreate(rows);
        } catch (err) {
          await job.update({ error_text: `INSERT failed: ${err.message}` });
        }
      } else if (result.items.length > 0) {
        // 부분 성공 → 버림, 사유 + 실패 카테고리 이름 함께 기록 (디버깅용)
        const failedNow = Array.from(failedCategoryMap.keys());
        const failedDesc = failedNow.length > 0 ? ` | Failed: ${failedNow.join(', ')}` : '';
        await job.update({
          error_text: `Partial success discarded: ${result.successCount}/${CATEGORIES.length} categories${failedDesc}`
        });
      }

      // 캐시 무효화 (다음 호출에서 새로 조회)
      lastCollectedAtCache = collectedAt;
      lastCollectedAtCheckedAt = Date.now();

      // 컨트롤러의 in-memory query cache 도 강제 비우기 (getLatest/getChanges)
      try {
        const ctrl = require('../../controllers/rankingController');
        if (ctrl.invalidateQueryCache) ctrl.invalidateQueryCache();
      } catch (e) {
        // ignore
      }

      const completedAt = new Date();
      const startedAt = job.started_at || job.created_at;
      const durationMs = startedAt ? completedAt.getTime() - new Date(startedAt).getTime() : null;

      // 실패 카테고리 요약 (DB 저장용 — 디버깅에 도움)
      // 이름만 나열 + 카테고리별 에러 메시지/시도 횟수 함께 기록 (추적용)
      const failedCategoriesArr = Array.from(failedCategoryMap.keys());
      let failedSummary = null;
      if (failedCategoriesArr.length > 0) {
        const namesOnly = `Failed: ${failedCategoriesArr.join(', ')}`;
        // 카테고리별 에러 디테일
        const details = Array.from(failedCategoryMap.entries())
          .map(([name, info]) => {
            // 600자까지 보존: title/html 디버깅 정보 포함되도록 (이전 100자는 너무 짧아서 잘림)
            const errShort = (info.error || 'unknown').slice(0, 600).replace(/\n/g, ' ');
            return `${name} [tries:${info.attempts}] ${errShort}`;
          })
          .join(' || ');
        failedSummary = `${namesOnly} | Details: ${details}`;
      }
      // 기존 error_text(예: Partial success discarded) 보존하면서 실패 카테고리 합치기
      await job.reload();
      const prevErrText = job.error_text || '';
      let newErrText = prevErrText;
      if (failedSummary) {
        newErrText = prevErrText ? `${prevErrText} | ${failedSummary}` : failedSummary;
      }

      await job.update({
        status: result.failCount >= CATEGORIES.length ? 'failed' : 'completed',
        success_count: result.successCount,
        fail_count: result.failCount,
        inserted_rows: result.items.length,
        retry_attempts: result.retryAttempts || 0,
        total_attempts: result.totalAttempts || 0,
        duration_ms: durationMs,
        error_text: newErrText || null,
        completed_at: completedAt
      });
    } catch (err) {
      console.error('[collectionService] round failed:', err && err.stack ? err.stack : err);
      try {
        await job.update({
          status: 'failed',
          error_text: err && err.message ? err.message : String(err),
          completed_at: new Date()
        });
      } catch (e2) {
        console.error('[collectionService] failed to update job error:', e2.message);
      }
    } finally {
      state.running = false;
      state.jobId = null;
      state.jobMeta = null;
    }
  })().catch((err) => {
    console.error('[collectionService] unhandled async error:', err && err.stack ? err.stack : err);
  });

  return { status: 'started', jobId: job.id };
}

module.exports = {
  triggerCollectionRound,
  getRunningJobState,
  getLastCollectedAt,
  isCacheFresh,
  getUserDailyCount,
  getUserHourlyCount,
  CACHE_TTL_MS,
  HOURLY_LIMIT_PER_USER,
  BUTTON_COOLDOWN_MS,
  IP_HOURLY_LIMIT
};
