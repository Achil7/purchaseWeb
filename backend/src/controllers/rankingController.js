const { PlatformRanking, User, RankingCollectionJob, sequelize } = require('../models');
const { Op } = require('sequelize');
const { CATEGORIES } = require('../services/rankingTracker/categories');
const {
  triggerCollectionRound,
  getRunningJobState,
  getLastCollectedAt,
  CACHE_TTL_MS
} = require('../services/rankingTracker/collectionService');
const { getStatus: getSchedulerStatus } = require('../schedulers/rankingScheduler');

// 33차: 조회 API in-memory 캐시 (TTL 30분 — 수집 주기와 동일)
// 자동 무효화: 캐시 저장 시 lastCollectedAt 시각을 함께 저장
// → 조회 시 현재 lastCollectedAt이 더 새로우면 캐시 미스 처리 (수집 로직 미접근)
const QUERY_CACHE_TTL_MS = 30 * 60 * 1000;
const queryCache = new Map();

async function getQueryCache(key) {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts >= QUERY_CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }
  // 새 수집이 발생했는지 확인 (lastCollectedAt 비교)
  try {
    const latest = await getLastCollectedAt();
    if (latest && new Date(latest).getTime() > entry.collectedAt) {
      queryCache.delete(key);
      return null;
    }
  } catch (e) {
    // getLastCollectedAt 실패 시 캐시 유지 (안전)
  }
  return entry.data;
}

async function setQueryCache(key, data) {
  let collectedAt = 0;
  try {
    const latest = await getLastCollectedAt();
    collectedAt = latest ? new Date(latest).getTime() : 0;
  } catch (e) {
    // 실패 시 0 (어떤 새 수집이든 캐시 무효화)
  }
  queryCache.set(key, { ts: Date.now(), collectedAt, data });
  if (queryCache.size > 500) {
    const first = queryCache.keys().next().value;
    queryCache.delete(first);
  }
}

// 외부 호출용 (수동 무효화 필요 시)
function invalidateQueryCache() {
  queryCache.clear();
}

/**
 * 카테고리 목록
 */
async function getCategories(req, res) {
  try {
    return res.json({
      success: true,
      data: CATEGORIES.map((c) => ({ id: c.id, name: c.name }))
    });
  } catch (err) {
    console.error('getCategories error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 카테고리별 최신 수집 100위 (Admin 전용)
 *
 * Query: category_id (필수)
 * 반환: { collected_at, rankings: [...] }
 */
async function getLatest(req, res) {
  try {
    const categoryId = req.query.category_id;
    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'category_id가 필요합니다' });
    }
    if (!CATEGORIES.find((c) => c.id === categoryId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 category_id' });
    }

    // 33차: 캐시 hit
    const cacheKey = `latest_${categoryId}`;
    const cached = await getQueryCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const latest = await PlatformRanking.findOne({
      where: { category_id: categoryId },
      attributes: ['collected_at'],
      order: [['collected_at', 'DESC']]
    });

    if (!latest) {
      const empty = { collected_at: null, rankings: [] };
      await setQueryCache(cacheKey, empty);
      return res.json({ success: true, data: empty });
    }

    const rankings = await PlatformRanking.findAll({
      where: { category_id: categoryId, collected_at: latest.collected_at },
      order: [['rank', 'ASC']]
    });

    const responseData = {
      collected_at: latest.collected_at,
      rankings
    };

    await setQueryCache(cacheKey, responseData);
    return res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('getLatest error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 시간 창 파싱: "6h" / "12h" / "24h" / "48h" / "72h" / "168h" → 시간(정수)
 */
function parseWindowHours(input) {
  const allowed = [6, 12, 24, 48, 72, 168];
  if (!input) return 24;
  const m = String(input).match(/^(\d+)h?$/);
  if (!m) return 24;
  const h = parseInt(m[1], 10);
  return allowed.includes(h) ? h : 24;
}

/**
 * baseTimestamp 파싱: ISO 문자열 또는 'YYYY-MM-DDTHH:MM' → Date | null
 * 유효하지 않거나 미래 시각이면 null (= 현재 모드).
 */
function parseBaseTimestamp(input) {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  // 미래 시각은 의미 없음 → null (현재 모드 fallback)
  if (d.getTime() > Date.now() + 60 * 1000) return null;
  return d;
}

/**
 * 카테고리별 순위 변동 (현재 + 직전 시점 대비 + N시간 통계)
 *
 * Query: category_id (필수), window (옵션, 6h/12h/24h/48h/72h/168h, 기본 24h)
 * 반환:
 *  - currentCollectedAt, previousCollectedAt
 *  - current: 현재 100위 + prevRank, delta, isNew, best/worst/avg
 *  - dropouts: 직전 시점엔 있었으나 현재 100위 밖
 */
async function getChanges(req, res) {
  try {
    const categoryId = req.query.category_id;
    const windowHours = parseWindowHours(req.query.window);
    const baseTimestamp = parseBaseTimestamp(req.query.base);   // 과거 시점 (옵션)
    const isPastMode = !!baseTimestamp;

    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'category_id가 필요합니다' });
    }
    if (!CATEGORIES.find((c) => c.id === categoryId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 category_id' });
    }

    // 33차: 캐시 hit (과거 모드는 baseTimestamp 포함 key)
    const cacheKey = isPastMode
      ? `changes_${categoryId}_${windowHours}_at_${baseTimestamp.toISOString()}`
      : `changes_${categoryId}_${windowHours}`;
    const cached = await getQueryCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    // 1) 최신 + 직전 collected_at 조회 (과거 모드면 base 이전만)
    const timeWhere = { category_id: categoryId };
    if (isPastMode) {
      timeWhere.collected_at = { [Op.lte]: baseTimestamp };
    }
    const distinctTimes = await PlatformRanking.findAll({
      where: timeWhere,
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('collected_at')), 'collected_at']],
      order: [['collected_at', 'DESC']],
      limit: 2,
      raw: true
    });

    if (distinctTimes.length === 0) {
      return res.json({
        success: true,
        data: {
          currentCollectedAt: null,
          previousCollectedAt: null,
          windowHours,
          current: [],
          dropouts: [],
          isPastMode,
          requestedBaseTimestamp: isPastMode ? baseTimestamp.toISOString() : null
        }
      });
    }

    const currentCollectedAt = distinctTimes[0].collected_at;
    const previousCollectedAt = distinctTimes[1] ? distinctTimes[1].collected_at : null;

    // 2) 현재 시점 100위 + 직전 시점 100위 동시 조회
    const [currentRows, prevRows] = await Promise.all([
      PlatformRanking.findAll({
        where: { category_id: categoryId, collected_at: currentCollectedAt },
        order: [['rank', 'ASC']]
      }),
      previousCollectedAt
        ? PlatformRanking.findAll({
            where: { category_id: categoryId, collected_at: previousCollectedAt },
            attributes: ['rank', 'goods_no', 'product_name', 'brand_name', 'product_url'],
            raw: true
          })
        : Promise.resolve([])
    ]);

    // 직전 시점 goods_no → row 매핑
    const prevByGoodsNo = new Map();
    for (const r of prevRows) {
      if (r.goods_no) prevByGoodsNo.set(r.goods_no, r);
    }

    // 3) N시간 통계 — 한 번에 조회 후 코드에서 집계
    //    현재 모드: 지금 시각 기준 N시간 뒤로
    //    과거 모드: currentCollectedAt 기준 N시간 뒤로 (그 시점의 추이 재현)
    const windowAnchor = isPastMode
      ? new Date(currentCollectedAt).getTime()
      : Date.now();
    const windowStart = new Date(windowAnchor - windowHours * 3600 * 1000);
    const windowWhere = {
      category_id: categoryId,
      collected_at: { [Op.gte]: windowStart }
    };
    if (isPastMode) {
      windowWhere.collected_at = { [Op.gte]: windowStart, [Op.lte]: new Date(windowAnchor) };
    }
    const windowRows = await PlatformRanking.findAll({
      where: windowWhere,
      attributes: ['goods_no', 'rank', 'collected_at'],
      raw: true
    });

    // goods_no → { ranks, firstSeenAt, points (시간순) }
    // 정렬 한 번 (오래된 → 최신) 후 그룹핑
    windowRows.sort((a, b) => new Date(a.collected_at) - new Date(b.collected_at));

    const statsByGoodsNo = new Map();
    for (const r of windowRows) {
      if (!r.goods_no) continue;
      if (!statsByGoodsNo.has(r.goods_no)) {
        statsByGoodsNo.set(r.goods_no, { ranks: [], points: [], firstSeenAt: r.collected_at });
      }
      const s = statsByGoodsNo.get(r.goods_no);
      s.ranks.push(r.rank);
      s.points.push({ t: r.collected_at, r: r.rank });
      if (new Date(r.collected_at) < new Date(s.firstSeenAt)) s.firstSeenAt = r.collected_at;
    }

    // 4) 현재 100위 + 변동 정보 합성
    const currentGoodsNoSet = new Set();
    const current = currentRows.map((row) => {
      const goodsNo = row.goods_no;
      if (goodsNo) currentGoodsNoSet.add(goodsNo);
      const prev = goodsNo ? prevByGoodsNo.get(goodsNo) : null;
      const prevRank = prev ? prev.rank : null;
      const delta = prevRank !== null ? prevRank - row.rank : null;

      const stats = goodsNo ? statsByGoodsNo.get(goodsNo) : null;
      let best24h = null, worst24h = null, avg24h = null, samples24h = 0;
      if (stats && stats.ranks.length > 0) {
        best24h = Math.min(...stats.ranks);
        worst24h = Math.max(...stats.ranks);
        avg24h = stats.ranks.reduce((a, b) => a + b, 0) / stats.ranks.length;
        samples24h = stats.ranks.length;
      }

      // isNew: 윈도우 시작 후에 첫 등장 + 직전 시점에 없었던 경우
      const isNew = !prevRank && stats && new Date(stats.firstSeenAt) > windowStart;

      return {
        id: row.id,
        rank: row.rank,
        goods_no: row.goods_no,
        product_name: row.product_name,
        brand_name: row.brand_name,
        product_url: row.product_url,
        price: row.price,
        original_price: row.original_price,
        sale_price: row.sale_price,
        discount_rate: row.discount_rate,
        prevRank,
        delta,
        isNew: !!isNew,
        best24h,
        worst24h,
        avg24h: avg24h !== null ? Math.round(avg24h * 10) / 10 : null,
        samples24h,
        trend: stats ? stats.points : []
      };
    });

    // 5) 이탈: 직전 시점에 있었으나 현재 없음
    const dropouts = [];
    for (const prev of prevRows) {
      if (!prev.goods_no) continue;
      if (currentGoodsNoSet.has(prev.goods_no)) continue;
      dropouts.push({
        goods_no: prev.goods_no,
        product_name: prev.product_name,
        brand_name: prev.brand_name,
        product_url: prev.product_url,
        prevRank: prev.rank,
        lastSeenAt: previousCollectedAt
      });
    }
    dropouts.sort((a, b) => a.prevRank - b.prevRank);

    // 평균 수집 간격(ms): 직전 두 collected_at 차이. 한쪽이 없으면 null
    const collectionIntervalMs = (currentCollectedAt && previousCollectedAt)
      ? new Date(currentCollectedAt).getTime() - new Date(previousCollectedAt).getTime()
      : null;

    const responseData = {
      currentCollectedAt,
      previousCollectedAt,
      windowHours,
      collectionIntervalMs,
      current,
      dropouts,
      isPastMode,
      requestedBaseTimestamp: isPastMode ? baseTimestamp.toISOString() : null
    };
    await setQueryCache(cacheKey, responseData);
    return res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('getChanges error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 특정 제품의 시간별 순위 추이
 *
 * Query: category_id (필수), goods_no (필수), hours (옵션, 기본 48)
 * 반환: [{ collected_at, rank }, ...]
 */
async function getHistory(req, res) {
  try {
    const categoryId = req.query.category_id;
    const goodsNo = req.query.goods_no;
    const hours = parseWindowHours(req.query.hours || '48');

    if (!categoryId || !goodsNo) {
      return res.status(400).json({ success: false, message: 'category_id, goods_no가 필요합니다' });
    }
    if (!CATEGORIES.find((c) => c.id === categoryId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 category_id' });
    }

    const windowStart = new Date(Date.now() - hours * 3600 * 1000);
    const rows = await PlatformRanking.findAll({
      where: {
        category_id: categoryId,
        goods_no: goodsNo,
        collected_at: { [Op.gte]: windowStart }
      },
      attributes: ['collected_at', 'rank'],
      order: [['collected_at', 'ASC']],
      raw: true
    });

    return res.json({
      success: true,
      data: {
        category_id: categoryId,
        goods_no: goodsNo,
        hours,
        points: rows
      }
    });
  } catch (err) {
    console.error('getHistory error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 카테고리 인사이트: 급상승/급하락/신규/꾸준
 *
 * Query: category_id (필수), window (옵션, 기본 24h)
 *
 * 정의:
 *  - biggestGainers: 윈도우 시작 시점 vs 현재의 rank 차이가 가장 큰 (긍정) 5개
 *  - biggestLosers: 가장 큰 (부정) 5개
 *  - newEntries: 윈도우 시작 후 처음 등장한 제품 중 현재 100위 안 (등장 시각 빠른 순) 5개
 *  - consistent: 윈도우 내 평균 순위 차이 < 5위인 안정적 상위 (avg rank 낮은 순) 5개
 */
async function getInsights(req, res) {
  try {
    const categoryId = req.query.category_id;
    const windowHours = parseWindowHours(req.query.window);

    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'category_id가 필요합니다' });
    }
    if (!CATEGORIES.find((c) => c.id === categoryId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 category_id' });
    }

    // 33차: 캐시 hit
    const cacheKey = `insights_${categoryId}_${windowHours}`;
    const cached = await getQueryCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const windowStart = new Date(Date.now() - windowHours * 3600 * 1000);

    // 1) 윈도우 내 모든 데이터
    const windowRows = await PlatformRanking.findAll({
      where: {
        category_id: categoryId,
        collected_at: { [Op.gte]: windowStart }
      },
      attributes: ['goods_no', 'rank', 'collected_at', 'product_name', 'brand_name', 'product_url'],
      raw: true
    });

    if (windowRows.length === 0) {
      return res.json({
        success: true,
        data: {
          windowHours,
          biggestGainers: [],
          biggestLosers: [],
          newEntries: [],
          consistent: []
        }
      });
    }

    // 2) 현재(가장 늦은 collected_at) 식별
    let latestAt = windowRows[0].collected_at;
    for (const r of windowRows) {
      if (new Date(r.collected_at) > new Date(latestAt)) latestAt = r.collected_at;
    }

    // 3) goods_no → { firstAppearance, firstRank, latestRank, ranks, productInfo }
    const byGoods = new Map();
    for (const r of windowRows) {
      if (!r.goods_no) continue;
      if (!byGoods.has(r.goods_no)) {
        byGoods.set(r.goods_no, {
          goods_no: r.goods_no,
          firstAt: r.collected_at,
          firstRank: r.rank,
          latestRank: null,
          ranks: [],
          product_name: r.product_name,
          brand_name: r.brand_name,
          product_url: r.product_url
        });
      }
      const g = byGoods.get(r.goods_no);
      g.ranks.push(r.rank);
      if (new Date(r.collected_at) < new Date(g.firstAt)) {
        g.firstAt = r.collected_at;
        g.firstRank = r.rank;
      }
      if (r.collected_at === latestAt || new Date(r.collected_at).getTime() === new Date(latestAt).getTime()) {
        g.latestRank = r.rank;
        // 최신 시점 product info로 업데이트 (가장 신선한 정보)
        g.product_name = r.product_name;
        g.brand_name = r.brand_name;
        g.product_url = r.product_url;
      }
    }

    // 4) 각 카테고리 계산
    const goodsList = Array.from(byGoods.values());

    // biggestGainers/Losers: 현재 100위 안에 있는 것 중에서, (firstRank - latestRank) 계산
    const inCurrent = goodsList.filter(g => g.latestRank !== null && g.firstRank !== g.latestRank);
    const withDelta = inCurrent.map(g => ({
      ...g,
      deltaFromStart: g.firstRank - g.latestRank // 양수 = 상승
    }));
    const biggestGainers = withDelta
      .filter(g => g.deltaFromStart > 0)
      .sort((a, b) => b.deltaFromStart - a.deltaFromStart)
      .slice(0, 5)
      .map(g => ({
        goods_no: g.goods_no,
        product_name: g.product_name,
        brand_name: g.brand_name,
        product_url: g.product_url,
        rankNow: g.latestRank,
        rankBefore: g.firstRank,
        deltaFromStart: g.deltaFromStart
      }));
    const biggestLosers = withDelta
      .filter(g => g.deltaFromStart < 0)
      .sort((a, b) => a.deltaFromStart - b.deltaFromStart)
      .slice(0, 5)
      .map(g => ({
        goods_no: g.goods_no,
        product_name: g.product_name,
        brand_name: g.brand_name,
        product_url: g.product_url,
        rankNow: g.latestRank,
        rankBefore: g.firstRank,
        deltaFromStart: g.deltaFromStart
      }));

    // newEntries: firstAt이 (windowStart + 30분) 이후 + 현재 100위 안
    const newEntryThreshold = new Date(windowStart.getTime() + 30 * 60 * 1000);
    const newEntries = goodsList
      .filter(g => g.latestRank !== null && new Date(g.firstAt) > newEntryThreshold)
      .sort((a, b) => new Date(b.firstAt) - new Date(a.firstAt))
      .slice(0, 5)
      .map(g => ({
        goods_no: g.goods_no,
        product_name: g.product_name,
        brand_name: g.brand_name,
        product_url: g.product_url,
        rankNow: g.latestRank,
        firstSeenAt: g.firstAt
      }));

    // consistent: 윈도우 내 max-min < 5 + 평균 순위 낮은 순 + 최소 3개 샘플
    const consistent = goodsList
      .filter(g => g.latestRank !== null && g.ranks.length >= 3)
      .map(g => {
        const max = Math.max(...g.ranks);
        const min = Math.min(...g.ranks);
        const avg = g.ranks.reduce((a, b) => a + b, 0) / g.ranks.length;
        return { ...g, range: max - min, avgRank: avg };
      })
      .filter(g => g.range < 5)
      .sort((a, b) => a.avgRank - b.avgRank)
      .slice(0, 5)
      .map(g => ({
        goods_no: g.goods_no,
        product_name: g.product_name,
        brand_name: g.brand_name,
        product_url: g.product_url,
        avgRank: Math.round(g.avgRank * 10) / 10,
        range: g.range,
        samples: g.ranks.length
      }));

    const responseData = {
      windowHours,
      biggestGainers,
      biggestLosers,
      newEntries,
      consistent
    };
    await setQueryCache(cacheKey, responseData);
    return res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('getInsights error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 자사 제품 BEST 노출 현황 (Brand / Admin)
 *
 * - 해당 brand_id 의 모든 monthly_brands → campaigns → items → product_url 에서 goodsNo 추출
 * - 가장 최근 collected_at 의 platform_rankings 와 매칭하여 노출된 항목만 반환
 *
 * 반환: { collected_at, products: [{ goods_no, product_name(보유), rankings: [{category_id, category_name, rank}] }] }
 */
/**
 * 브랜드 id 결정 (brand는 본인, admin은 viewAsUserId 필수)
 * @returns { brandId } 또는 { error: { status, message } }
 */
async function resolveBrandId(req) {
  if (req.user.role === 'brand') {
    return { brandId: req.user.id };
  }
  if (req.user.role === 'admin') {
    const viewAsUserId = req.query.viewAsUserId ? parseInt(req.query.viewAsUserId, 10) : null;
    if (!viewAsUserId) {
      return { error: { status: 400, message: 'admin은 viewAsUserId가 필요합니다' } };
    }
    const target = await User.findByPk(viewAsUserId, { attributes: ['id', 'role'] });
    if (!target || target.role !== 'brand') {
      return { error: { status: 400, message: '대상 사용자가 brand 역할이 아닙니다' } };
    }
    return { brandId: target.id };
  }
  return { error: { status: 403, message: '접근 권한이 없습니다' } };
}

/**
 * 자사 등록 제품의 goods_no + product_name 추출 (items + item_slots UNION)
 * @returns Array<{ goods_no, product_name }>
 */
async function fetchOwnedGoodsRows(brandId) {
  const [rows] = await sequelize.query(
    `
    SELECT DISTINCT goods_no, product_name FROM (
      SELECT
        (regexp_match(i.product_url, 'goodsNo=([A-Z0-9]+)', 'i'))[1] AS goods_no,
        i.product_name AS product_name
      FROM items i
      INNER JOIN campaigns c        ON i.campaign_id = c.id AND c.deleted_at IS NULL
      INNER JOIN monthly_brands mb  ON c.monthly_brand_id = mb.id
                                     AND mb.brand_id = :brandId
                                     AND mb.deleted_at IS NULL
      WHERE i.deleted_at IS NULL
        AND i.product_url IS NOT NULL
        AND i.product_url ~* 'goodsNo='
      UNION
      SELECT
        (regexp_match(s.product_url, 'goodsNo=([A-Z0-9]+)', 'i'))[1] AS goods_no,
        s.product_name AS product_name
      FROM item_slots s
      INNER JOIN items i            ON s.item_id = i.id AND i.deleted_at IS NULL
      INNER JOIN campaigns c        ON i.campaign_id = c.id AND c.deleted_at IS NULL
      INNER JOIN monthly_brands mb  ON c.monthly_brand_id = mb.id
                                     AND mb.brand_id = :brandId
                                     AND mb.deleted_at IS NULL
      WHERE s.deleted_at IS NULL
        AND s.product_url IS NOT NULL
        AND s.product_url ~* 'goodsNo='
    ) g
    WHERE g.goods_no IS NOT NULL
    `,
    { replacements: { brandId } }
  );
  return rows || [];
}

async function getMyProductsRankings(req, res) {
  try {
    const { brandId, error } = await resolveBrandId(req);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    // 33차: 캐시 hit
    const cacheKey = `myProducts_${brandId}`;
    const cached = await getQueryCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    // 자사 product_url 목록 (item_slots, items 모두에서)
    const rows = await fetchOwnedGoodsRows(brandId);

    if (!rows || rows.length === 0) {
      const empty = { collected_at: null, products: [] };
      await setQueryCache(cacheKey, empty);
      return res.json({ success: true, data: empty });
    }

    const goodsNos = [...new Set(rows.map((r) => r.goods_no).filter(Boolean))];

    // 가장 최근 수집 시각
    const latest = await PlatformRanking.findOne({
      attributes: ['collected_at'],
      order: [['collected_at', 'DESC']]
    });
    if (!latest) {
      return res.json({
        success: true,
        data: {
          collected_at: null,
          products: rows.map((r) => ({
            goods_no: r.goods_no,
            product_name: r.product_name,
            rankings: []
          }))
        }
      });
    }

    // 최신 수집 ± 30분 윈도우 (라운드 1회 동안의 모든 카테고리 수집을 포괄)
    const windowStart = new Date(latest.collected_at.getTime() - 30 * 60 * 1000);
    const windowEnd = new Date(latest.collected_at.getTime() + 30 * 60 * 1000);

    const matched = await PlatformRanking.findAll({
      where: {
        goods_no: { [Op.in]: goodsNos },
        collected_at: { [Op.between]: [windowStart, windowEnd] }
      },
      attributes: ['category_id', 'category_name', 'rank', 'goods_no', 'product_name', 'product_url', 'price', 'collected_at'],
      order: [['rank', 'ASC']]
    });

    // 자사 product_name 매핑 (DB 보유 이름 우선)
    const ownNameMap = new Map();
    for (const r of rows) {
      if (r.goods_no && !ownNameMap.has(r.goods_no)) {
        ownNameMap.set(r.goods_no, r.product_name);
      }
    }

    // goods_no 기준 그룹핑
    const productMap = new Map();
    for (const goodsNo of goodsNos) {
      productMap.set(goodsNo, {
        goods_no: goodsNo,
        product_name: ownNameMap.get(goodsNo) || null,
        rankings: []
      });
    }

    for (const m of matched) {
      const entry = productMap.get(m.goods_no);
      if (!entry) continue;
      if (!entry.product_name) entry.product_name = m.product_name;
      if (!entry.product_url) entry.product_url = m.product_url;
      entry.rankings.push({
        category_id: m.category_id,
        category_name: m.category_name,
        rank: m.rank
      });
    }

    const products = Array.from(productMap.values()).sort((a, b) => {
      const aHas = a.rankings.length > 0;
      const bHas = b.rankings.length > 0;
      if (aHas !== bHas) return aHas ? -1 : 1;
      const aMin = a.rankings.length ? Math.min(...a.rankings.map((r) => r.rank)) : 9999;
      const bMin = b.rankings.length ? Math.min(...b.rankings.map((r) => r.rank)) : 9999;
      return aMin - bMin;
    });

    const responseData = {
      collected_at: latest.collected_at,
      products
    };
    await setQueryCache(cacheKey, responseData);
    return res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('getMyProductsRankings error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 자사 제품 종합 변동/추이/이탈/요약/인사이트 (Brand/Admin)
 *
 * Query: window=24h (기본, 6h/12h/24h/48h/72h/168h), viewAsUserId (admin only)
 * 응답: { currentCollectedAt, previousCollectedAt, windowHours, products[], dropouts[], summary, insights }
 *  - products[i].rankings[j]: { category_id, category_name, rank, prevRank, delta, isNew, best24h, worst24h, avg24h, samples24h, trend: [{t,r}] }
 *  - dropouts: 직전 시점엔 노출됐지만 지금 빠진 자사 (category 단위)
 *  - summary: 등록 / BEST 노출 / 노출 인스턴스 / TOP10 노출 개수
 *  - insights: 자사 한정 4패널 (gainers, losers, newEntries, consistent)
 */
async function getMyChanges(req, res) {
  try {
    const { brandId, error } = await resolveBrandId(req);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const windowHours = parseWindowHours(req.query.window);

    // 33차: 캐시 hit
    const cacheKey = `myChanges_${brandId}_${windowHours}`;
    const cached = await getQueryCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    // 자사 등록 goods_no 추출
    const ownedRows = await fetchOwnedGoodsRows(brandId);
    const totalRegistered = new Set(ownedRows.map(r => r.goods_no).filter(Boolean)).size;

    if (totalRegistered === 0) {
      const empty = {
        currentCollectedAt: null,
        previousCollectedAt: null,
        windowHours,
        products: [],
        dropouts: [],
        summary: { totalRegistered: 0, exposedNow: 0, exposedRankings: 0, top10Count: 0 },
        insights: { biggestGainers: [], biggestLosers: [], newEntries: [], consistent: [] }
      };
      await setQueryCache(cacheKey, empty);
      return res.json({ success: true, data: empty });
    }

    const goodsNos = [...new Set(ownedRows.map(r => r.goods_no))];

    // 자사 등록 제품 이름 매핑 (자사 등록명 우선)
    const ownNameMap = new Map();
    for (const r of ownedRows) {
      if (r.goods_no && !ownNameMap.has(r.goods_no)) {
        ownNameMap.set(r.goods_no, r.product_name);
      }
    }

    // 최신/직전 collected_at (전 카테고리 공통)
    const distinctTimes = await PlatformRanking.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('collected_at')), 'collected_at']],
      order: [['collected_at', 'DESC']],
      limit: 2,
      raw: true
    });

    if (distinctTimes.length === 0) {
      return res.json({
        success: true,
        data: {
          currentCollectedAt: null,
          previousCollectedAt: null,
          windowHours,
          products: ownedRows.map(r => ({
            goods_no: r.goods_no,
            product_name: r.product_name,
            rankings: []
          })),
          dropouts: [],
          summary: { totalRegistered, exposedNow: 0, exposedRankings: 0, top10Count: 0 },
          insights: { biggestGainers: [], biggestLosers: [], newEntries: [], consistent: [] }
        }
      });
    }

    const currentCollectedAt = distinctTimes[0].collected_at;
    const previousCollectedAt = distinctTimes[1] ? distinctTimes[1].collected_at : null;

    // 라운드 윈도우 ±30분 (수집은 한 라운드에 약 5분 걸려 collected_at이 미세하게 다를 수 있음)
    const currentWindowStart = new Date(new Date(currentCollectedAt).getTime() - 30 * 60 * 1000);
    const currentWindowEnd = new Date(new Date(currentCollectedAt).getTime() + 30 * 60 * 1000);

    let prevWindowStart = null, prevWindowEnd = null;
    if (previousCollectedAt) {
      prevWindowStart = new Date(new Date(previousCollectedAt).getTime() - 30 * 60 * 1000);
      prevWindowEnd = new Date(new Date(previousCollectedAt).getTime() + 30 * 60 * 1000);
    }

    // 시계열 윈도우 (스파크라인 + 통계 + 인사이트 공용)
    const trendWindowStart = new Date(Date.now() - windowHours * 3600 * 1000);

    // 한 번의 쿼리로: 자사 goods_no × 윈도우 전체
    const allRows = await PlatformRanking.findAll({
      where: {
        goods_no: { [Op.in]: goodsNos },
        collected_at: { [Op.gte]: trendWindowStart }
      },
      attributes: ['category_id', 'category_name', 'goods_no', 'rank', 'product_name', 'product_url', 'collected_at'],
      order: [['collected_at', 'ASC']],
      raw: true
    });

    // 현재 시점 / 직전 시점 분리 (category_id + goods_no 키)
    // key: `${category_id}|${goods_no}`
    const currentByKey = new Map();
    const prevByKey = new Map();
    // (goods_no, category_id) → ranks/points/firstSeenAt (24h)
    const tsByCat = new Map(); // key → { ranks: [], points: [], firstSeenAt }

    for (const r of allRows) {
      const key = `${r.category_id}|${r.goods_no}`;

      const t = new Date(r.collected_at).getTime();
      if (t >= currentWindowStart.getTime() && t <= currentWindowEnd.getTime()) {
        // 현재 시점 (한 카테고리당 1행이지만 ±30분 윈도우라 여러 행 가능 — 가장 최신만 유지)
        const exist = currentByKey.get(key);
        if (!exist || new Date(exist.collected_at) < new Date(r.collected_at)) {
          currentByKey.set(key, r);
        }
      }
      if (previousCollectedAt && t >= prevWindowStart.getTime() && t <= prevWindowEnd.getTime()) {
        const exist = prevByKey.get(key);
        if (!exist || new Date(exist.collected_at) < new Date(r.collected_at)) {
          prevByKey.set(key, r);
        }
      }

      // 시계열 (윈도우 내 전체)
      if (!tsByCat.has(key)) {
        tsByCat.set(key, { ranks: [], points: [], firstSeenAt: r.collected_at });
      }
      const s = tsByCat.get(key);
      s.ranks.push(r.rank);
      s.points.push({ t: r.collected_at, r: r.rank });
      if (new Date(r.collected_at) < new Date(s.firstSeenAt)) s.firstSeenAt = r.collected_at;
    }

    // goods_no별 ranking 합성
    const productMap = new Map();
    for (const goodsNo of goodsNos) {
      productMap.set(goodsNo, {
        goods_no: goodsNo,
        product_name: ownNameMap.get(goodsNo) || null,
        product_url: null,
        rankings: []
      });
    }

    for (const [key, row] of currentByKey.entries()) {
      const goodsNo = row.goods_no;
      const product = productMap.get(goodsNo);
      if (!product) continue;
      if (!product.product_name) product.product_name = row.product_name;
      if (!product.product_url) product.product_url = row.product_url;

      const prev = prevByKey.get(key);
      const prevRank = prev ? prev.rank : null;
      const delta = prevRank !== null ? prevRank - row.rank : null;

      const stats = tsByCat.get(key);
      let best24h = null, worst24h = null, avg24h = null, samples24h = 0;
      if (stats && stats.ranks.length > 0) {
        best24h = Math.min(...stats.ranks);
        worst24h = Math.max(...stats.ranks);
        avg24h = stats.ranks.reduce((a, b) => a + b, 0) / stats.ranks.length;
        samples24h = stats.ranks.length;
      }

      const isNew = !prevRank && stats && new Date(stats.firstSeenAt) > trendWindowStart;

      product.rankings.push({
        category_id: row.category_id,
        category_name: row.category_name,
        rank: row.rank,
        prevRank,
        delta,
        isNew: !!isNew,
        best24h,
        worst24h,
        avg24h: avg24h !== null ? Math.round(avg24h * 10) / 10 : null,
        samples24h,
        trend: stats ? stats.points : []
      });
    }

    // 정렬: 각 product의 rankings를 rank 오름차순
    for (const p of productMap.values()) {
      p.rankings.sort((a, b) => a.rank - b.rank);
    }

    // products 정렬: 노출 우선 > 최고순위 낮은 순
    const products = Array.from(productMap.values()).sort((a, b) => {
      const aHas = a.rankings.length > 0;
      const bHas = b.rankings.length > 0;
      if (aHas !== bHas) return aHas ? -1 : 1;
      const aMin = a.rankings.length ? a.rankings[0].rank : 9999;
      const bMin = b.rankings.length ? b.rankings[0].rank : 9999;
      return aMin - bMin;
    });

    // dropouts: 직전 시점엔 있었지만 현재 시점에 없는 (goods_no, category_id) 조합
    const dropouts = [];
    for (const [key, prev] of prevByKey.entries()) {
      if (currentByKey.has(key)) continue;
      dropouts.push({
        goods_no: prev.goods_no,
        product_name: ownNameMap.get(prev.goods_no) || prev.product_name,
        category_id: prev.category_id,
        category_name: prev.category_name,
        prevRank: prev.rank,
        lastSeenAt: previousCollectedAt
      });
    }
    dropouts.sort((a, b) => a.prevRank - b.prevRank);

    // summary
    const exposedNow = products.filter(p => p.rankings.length > 0).length;
    const exposedRankings = products.reduce((sum, p) => sum + p.rankings.length, 0);
    const top10Count = products.reduce(
      (sum, p) => sum + p.rankings.filter(r => r.rank <= 10).length,
      0
    );

    // insights (자사 한정): 윈도우 시작 시점 vs 현재 시점의 변동
    // 한 (goods_no, category) 키 단위로 firstRank, latestRank 계산
    const insightItems = [];
    for (const [key, s] of tsByCat.entries()) {
      const [categoryId, goodsNo] = key.split('|');
      // 시간순 정렬되어 있음 (points)
      const firstPoint = s.points[0];
      const lastPoint = s.points[s.points.length - 1];
      if (!firstPoint || !lastPoint) continue;
      const ranksMax = Math.max(...s.ranks);
      const ranksMin = Math.min(...s.ranks);
      const ranksAvg = s.ranks.reduce((a, b) => a + b, 0) / s.ranks.length;

      // 현재 시점 카테고리/제품 정보 (currentByKey에서)
      const cur = currentByKey.get(key);
      const productInfo = {
        goods_no: goodsNo,
        product_name: ownNameMap.get(goodsNo) || (cur && cur.product_name) || null,
        product_url: (cur && cur.product_url) || null,
        category_id: categoryId,
        category_name: (cur && cur.category_name) || null
      };

      insightItems.push({
        ...productInfo,
        firstRank: firstPoint.r,
        latestRank: cur ? cur.rank : null,
        firstAt: s.firstSeenAt,
        rangeMaxMin: ranksMax - ranksMin,
        avgRank: ranksAvg,
        samples: s.ranks.length
      });
    }

    const newEntryThreshold = new Date(trendWindowStart.getTime() + 30 * 60 * 1000);

    const withDelta = insightItems
      .filter(it => it.latestRank !== null && it.firstRank !== it.latestRank)
      .map(it => ({ ...it, deltaFromStart: it.firstRank - it.latestRank }));

    const biggestGainers = withDelta
      .filter(it => it.deltaFromStart > 0)
      .sort((a, b) => b.deltaFromStart - a.deltaFromStart)
      .slice(0, 5)
      .map(it => ({
        goods_no: it.goods_no,
        product_name: it.product_name,
        product_url: it.product_url,
        category_id: it.category_id,
        category_name: it.category_name,
        rankNow: it.latestRank,
        rankBefore: it.firstRank,
        deltaFromStart: it.deltaFromStart
      }));

    const biggestLosers = withDelta
      .filter(it => it.deltaFromStart < 0)
      .sort((a, b) => a.deltaFromStart - b.deltaFromStart)
      .slice(0, 5)
      .map(it => ({
        goods_no: it.goods_no,
        product_name: it.product_name,
        product_url: it.product_url,
        category_id: it.category_id,
        category_name: it.category_name,
        rankNow: it.latestRank,
        rankBefore: it.firstRank,
        deltaFromStart: it.deltaFromStart
      }));

    const newEntries = insightItems
      .filter(it => it.latestRank !== null && new Date(it.firstAt) > newEntryThreshold)
      .sort((a, b) => new Date(b.firstAt) - new Date(a.firstAt))
      .slice(0, 5)
      .map(it => ({
        goods_no: it.goods_no,
        product_name: it.product_name,
        product_url: it.product_url,
        category_id: it.category_id,
        category_name: it.category_name,
        rankNow: it.latestRank,
        firstSeenAt: it.firstAt
      }));

    const consistent = insightItems
      .filter(it => it.latestRank !== null && it.samples >= 3 && it.rangeMaxMin < 5)
      .sort((a, b) => a.avgRank - b.avgRank)
      .slice(0, 5)
      .map(it => ({
        goods_no: it.goods_no,
        product_name: it.product_name,
        product_url: it.product_url,
        category_id: it.category_id,
        category_name: it.category_name,
        avgRank: Math.round(it.avgRank * 10) / 10,
        range: it.rangeMaxMin,
        samples: it.samples
      }));

    const responseData = {
      currentCollectedAt,
      previousCollectedAt,
      windowHours,
      products,
      dropouts,
      summary: {
        totalRegistered,
        exposedNow,
        exposedRankings,
        top10Count
      },
      insights: {
        biggestGainers,
        biggestLosers,
        newEntries,
        consistent
      }
    };
    await setQueryCache(cacheKey, responseData);
    return res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('getMyChanges error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 수집 트리거 (Admin/Brand 버튼)
 *
 * 응답:
 *  - 200 { status: 'started' | 'cached' | 'busy', ... }
 *  - 일일 한도 제한 없음. 캐시(30분) + 동시 실행 lock 으로만 제한.
 */
async function triggerCollection(req, res) {
  try {
    const triggeredBy = req.user.role === 'admin' ? 'admin' : 'brand';
    if (triggeredBy !== 'admin' && triggeredBy !== 'brand') {
      return res.status(403).json({ success: false, message: '접근 권한이 없습니다' });
    }
    // forceFresh는 admin만 허용 (캐시 무시하고 강제 새 수집)
    const forceFresh = triggeredBy === 'admin' && req.body && req.body.forceFresh === true;

    // 클라이언트 IP 추출 (X-Forwarded-For 고려)
    const xff = req.headers['x-forwarded-for'];
    const ip = (xff ? String(xff).split(',')[0].trim() : null) || req.ip || req.connection?.remoteAddress || null;

    const result = await triggerCollectionRound({
      triggeredBy,
      userId: req.user.id,
      ip,
      forceFresh
    });

    return res.json({ success: true, ...result, cacheTtlMs: CACHE_TTL_MS });
  } catch (err) {
    console.error('triggerCollection error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 진행 상태 + 마지막 수집 시각 (프론트 폴링용)
 *
 * 익명성 유지: triggered_by / triggered_user_id 등 트리거 주체 정보는 응답에 포함하지 않음.
 * 브랜드사 간/사용자 간 누가 수집을 트리거했는지 알 수 없도록 함.
 */
async function getProgress(req, res) {
  try {
    const rawJob = getRunningJobState();

    // job에서 트리거 주체 식별 필드 제거 (익명화)
    let job;
    if (rawJob && rawJob.running) {
      const { triggeredBy, triggeredUserId, ...safeJob } = rawJob;
      const startedAt = safeJob.startedAt ? new Date(safeJob.startedAt) : null;
      job = {
        ...safeJob,
        elapsedMs: startedAt ? Date.now() - startedAt.getTime() : null
      };
    } else {
      job = { running: false };
    }

    const lastCollectedAt = await getLastCollectedAt();
    const scheduler = getSchedulerStatus();

    // 최근 끝난 라운드 1건 (익명 필드만)
    let lastJob = null;
    try {
      const recent = await RankingCollectionJob.findOne({
        where: { status: { [Op.in]: ['completed', 'failed'] } },
        order: [['completed_at', 'DESC']],
        attributes: ['id', 'status', 'completed_at', 'duration_ms', 'success_count', 'fail_count', 'inserted_rows', 'total_categories', 'error_text']
      });
      if (recent) {
        // error_text 에서 "Failed: A, B, C" 부분 파싱
        let failedCategories = [];
        const errText = recent.error_text || '';
        const m = errText.match(/Failed:\s*(.+?)(?:\s*\|\s*|$)/);
        if (m) {
          failedCategories = m[1].split(',').map(s => s.trim()).filter(Boolean);
        }
        lastJob = {
          id: recent.id,
          status: recent.status,
          completed_at: recent.completed_at,
          duration_ms: recent.duration_ms,
          success_count: recent.success_count,
          fail_count: recent.fail_count,
          inserted_rows: recent.inserted_rows,
          total_categories: recent.total_categories,
          failed_categories: failedCategories,
          error_text: errText || null
        };
      }
    } catch (e) {
      // RankingCollectionJob 조회 실패해도 진행 상태는 반환
      console.warn('[getProgress] lastJob query failed:', e.message);
    }

    // 캐시 활용 중 여부 (최근 수집이 캐시 TTL 이내)
    const cacheActive = !!(lastCollectedAt &&
      (Date.now() - new Date(lastCollectedAt).getTime()) < CACHE_TTL_MS);

    return res.json({
      success: true,
      data: {
        job,
        lastCollectedAt,
        scheduler,
        lastJob,
        cacheActive,
        cacheTtlMs: CACHE_TTL_MS
      }
    });
  } catch (err) {
    console.error('getProgress error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getCategories,
  getLatest,
  getMyProductsRankings,
  getMyChanges,
  triggerCollection,
  getProgress,
  getChanges,
  getHistory,
  getInsights,
  // 33차: 새 수집 완료 시 caller가 호출 (수집 로직은 건드리지 않음)
  invalidateQueryCache
};
