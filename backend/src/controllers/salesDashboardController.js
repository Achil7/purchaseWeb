const { sequelize } = require('../models');

/**
 * 영업사 대시보드 컨트롤러
 *
 * 진입 흐름: 브랜드 선택 → 플랫폼 선택 → 월 선택
 *
 * - 1 브랜드 ↔ 1 영업사 가정은 운영 데이터로 검증 완료 (2026-04)
 * - 단 방어적으로 모든 쿼리는 c.created_by = :salesId AND mb.brand_id = :brandId 동시 적용
 *   (다른 영업사가 만든 같은 브랜드 캠페인은 노출 안 함)
 * - 월 필터는 buyer.date 우선, 없으면 item_slot.date, 없으면 item.date 의 첫 5자(YY-MM)
 */

// 32차: Admin embedded 모드 전용 in-memory 캐시 (60초 TTL)
// admin이 viewAsUserId로 영업사 대시보드 조회 시 반복 클릭 캐싱
const ADMIN_CACHE_TTL_MS = 60_000;
const adminSalesCache = new Map();

function getAdminSalesCache(key) {
  const entry = adminSalesCache.get(key);
  if (entry && Date.now() - entry.ts < ADMIN_CACHE_TTL_MS) return entry.data;
  return null;
}

function setAdminSalesCache(key, data) {
  adminSalesCache.set(key, { ts: Date.now(), data });
  if (adminSalesCache.size > 1000) {
    const first = adminSalesCache.keys().next().value;
    adminSalesCache.delete(first);
  }
}

function isAdminView(req) {
  return req.user.role === 'admin' && req.query.viewAsUserId;
}

function adminCacheKey(prefix, req) {
  // 쿼리 파라미터를 정렬해서 직렬화 (캐시 키 안정성)
  const userId = parseInt(req.query.viewAsUserId, 10);
  const sortedKeys = Object.keys(req.query).sort();
  const paramStr = sortedKeys.map(k => `${k}=${req.query[k]}`).join('&');
  return `${prefix}_${userId}_${paramStr}`;
}

function resolveSalesId(req) {
  if (req.user.role === 'sales') return req.user.id;
  if (req.user.role === 'admin') {
    return req.query.viewAsUserId ? parseInt(req.query.viewAsUserId, 10) : null;
  }
  return null;
}

/**
 * 영업사용 buyer-level 뷰
 *  - brand 컨트롤러와 같은 구조이지만 created_by 추가 + 월 필터 적용 가능한 date_str 컬럼 노출
 *  - withImageCount=true 시 image_count 추가
 *  - month 파라미터: 'YY-MM' (예: '26-02') 이면 해당 월만, '__ALL__' 이면 전체
 */
function buildSalesBuyerView({ withImageCount, monthFilter, allBrands }) {
  const reviewExpr = withImageCount
    ? `COALESCE((SELECT COUNT(*) FROM images im WHERE im.buyer_id = b.id AND im.status = 'approved' AND im.deleted_at IS NULL), 0) AS image_count`
    : `CASE WHEN EXISTS (SELECT 1 FROM images im WHERE im.buyer_id = b.id AND im.status = 'approved' AND im.deleted_at IS NULL) THEN 1 ELSE 0 END AS review_completed`;

  // 월 필터: buyer.date(우선) → slot.date → item.date 순서.
  // DB 의 date 가 "YY-MM-DD" 또는 "YYYY-MM-DD" 자유 포맷이라
  // 정규식으로 YY-MM (2자리 연도) 추출해 :month (YY-MM) 와 비교.
  const monthCond = monthFilter
    ? `AND SUBSTRING(
         COALESCE(NULLIF(TRIM(b.date), ''), NULLIF(TRIM(s.date), ''), NULLIF(TRIM(i.date), '')),
         '\\d{2}-\\d{2}'
       ) = :month`
    : '';

  // brand 필터: '__ALL__' 또는 미지정 시 mb.brand_id 조건 제거
  // (영업사 본인 캠페인만 보장하는 c.created_by = :salesId 는 그대로 유지되므로 자동으로 본인이 다루는 모든 브랜드로 한정)
  const brandJoin = allBrands
    ? `INNER JOIN monthly_brands mb ON c.monthly_brand_id = mb.id
                                       AND mb.is_hidden = false
                                       AND mb.deleted_at IS NULL`
    : `INNER JOIN monthly_brands mb ON c.monthly_brand_id = mb.id
                                       AND mb.brand_id = :brandId
                                       AND mb.is_hidden = false
                                       AND mb.deleted_at IS NULL`;

  return `
    SELECT
      b.id AS buyer_id,
      b.item_id,
      c.id AS campaign_id,
      c.name AS campaign_name,
      COALESCE(NULLIF(TRIM(s.platform), ''), NULLIF(TRIM(i.platform), ''), '미지정') AS platform,
      COALESCE(NULLIF(TRIM(s.product_name), ''), NULLIF(TRIM(i.product_name), '')) AS product_name,
      COALESCE(NULLIF(TRIM(b.date), ''), NULLIF(TRIM(s.date), ''), NULLIF(TRIM(i.date), '')) AS date_str,
      CASE
        WHEN REPLACE(COALESCE(b.amount, '0'), ',', '') ~ '^[0-9]+(\\.[0-9]+)?$'
        THEN REPLACE(b.amount, ',', '')::NUMERIC
        ELSE 0
      END AS amount_num,
      ${reviewExpr}
    FROM buyers b
    INNER JOIN items i        ON b.item_id = i.id AND i.deleted_at IS NULL
    INNER JOIN campaigns c    ON i.campaign_id = c.id
                                 AND c.is_hidden = false
                                 AND c.deleted_at IS NULL
                                 AND c.created_by = :salesId
    ${brandJoin}
    LEFT JOIN item_slots s    ON s.buyer_id = b.id
                                 AND s.deleted_at IS NULL
                                 AND s.is_suspended = false
    WHERE b.is_temporary = false
      AND b.deleted_at IS NULL
      ${monthCond}
  `;
}

// 클라이언트 month 입력 정규화: 'YYYY-MM' (예: '2026-02') → 'YY-MM' (예: '26-02')
// DB 원본이 YY-MM-DD 자유 포맷이라 비교 시 5자(YY-MM)로 맞춤
function normalizeMonthForDb(monthInput) {
  if (!monthInput || monthInput === '__ALL__') return null;
  const s = String(monthInput).trim();
  // 'YYYY-MM' 형식이면 앞 2자(연도 앞자리) 제거
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(2, 7); // '2026-02' → '26-02'
  // 이미 YY-MM 또는 YY-MM-* 면 첫 5자
  if (/^\d{2}-\d{2}/.test(s)) return s.slice(0, 5);
  return null;
}

// DB 의 자유 포맷 month (YY-MM 또는 YYYY-MM 등) → 표시용 'YYYY-MM' 통일
// - "26-03" → "2026-03"
// - "2026-" (date 가 "2026-03-15" 였던 경우 SUBSTRING 1,5 결과) → "2026-03" 으로 보정 못하므로 NULL 처리
// - 이미 "YYYY-MM" 이면 그대로
function displayMonth(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // YY-MM (5자, 4번째 인덱스가 '-' 가 아니라 숫자)
  if (/^\d{2}-\d{2}$/.test(s)) return `20${s}`;
  // YYYY-MM (7자)
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  // 그 외(예: "2026-" 처럼 SUBSTRING 으로 잘린 경우) 는 무효
  return null;
}

/**
 * GET /api/sales-dashboard/brands
 *  - 영업사가 캠페인을 만든 브랜드(monthly_brands.brand_id) 목록
 */
exports.getBrands = async (req, res) => {
  try {
    const salesId = resolveSalesId(req);
    if (!salesId) {
      return res.json({ success: true, data: { brands: [] } });
    }

    const rows = await sequelize.query(`
      SELECT DISTINCT
        u.id AS brand_id,
        u.name AS brand_name,
        u.username AS brand_username
      FROM campaigns c
      INNER JOIN monthly_brands mb ON c.monthly_brand_id = mb.id
                                   AND mb.is_hidden = false
                                   AND mb.deleted_at IS NULL
      INNER JOIN users u ON mb.brand_id = u.id AND u.role = 'brand' AND u.is_active = true
      WHERE c.created_by = :salesId
        AND c.is_hidden = false
        AND c.deleted_at IS NULL
      ORDER BY u.name ASC
    `, {
      replacements: { salesId },
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: {
        brands: rows.map(r => ({
          id: r.brand_id,
          name: r.brand_name || r.brand_username,
          username: r.brand_username
        }))
      }
    });
  } catch (error) {
    console.error('Sales dashboard brands error:', error);
    res.status(500).json({ success: false, message: '브랜드 목록 조회 중 오류가 발생했습니다' });
  }
};

/**
 * GET /api/sales-dashboard/months
 *  - 선택된 brand 내에서 사용 가능한 월 목록 (YY-MM)
 *  - platform 파라미터는 무시 (월 선택은 플랫폼 무관)
 */
exports.getMonths = async (req, res) => {
  try {
    const salesId = resolveSalesId(req);
    if (!salesId) {
      return res.status(400).json({ success: false, message: '인증이 필요합니다' });
    }

    const brandIdRaw = req.query.brandId;
    const allBrands = !brandIdRaw || brandIdRaw === '__ALL__';
    const brandId = allBrands ? null : parseInt(brandIdRaw, 10);

    const VIEW = buildSalesBuyerView({ withImageCount: false, monthFilter: false, allBrands });
    const replacements = allBrands ? { salesId } : { salesId, brandId };

    // date_str 에서 정규식으로 YY-MM 추출 (DB 가 YY-MM-DD / YYYY-MM-DD 자유포맷이라 둘 다 처리)
    const rows = await sequelize.query(`
      WITH buyer_view AS (${VIEW})
      SELECT DISTINCT SUBSTRING(date_str, '\\d{2}-\\d{2}') AS month
      FROM buyer_view
      WHERE date_str IS NOT NULL
        AND SUBSTRING(date_str, '\\d{2}-\\d{2}') IS NOT NULL
      ORDER BY month DESC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    // 응답: YY-MM → YYYY-MM 으로 변환 + 무효값 제거
    res.json({
      success: true,
      data: { months: rows.map(r => displayMonth(r.month)).filter(Boolean) }
    });
  } catch (error) {
    console.error('Sales dashboard months error:', error);
    res.status(500).json({ success: false, message: '월 목록 조회 중 오류가 발생했습니다' });
  }
};

/**
 * GET /api/sales-dashboard/overview
 *  - Query: brandId(필수), platform(필수, '__ALL__' 가능), month?(YY-MM, 미지정=전체)
 *  - brand-dashboard/overview 와 동일한 응답 구조
 */
exports.getOverview = async (req, res) => {
  try {
    const salesId = resolveSalesId(req);
    if (!salesId) {
      return res.status(400).json({ success: false, message: '인증이 필요합니다' });
    }

    // 32차: Admin viewAsUserId 캐시 조회
    const useCache = isAdminView(req);
    const cacheKey = useCache ? adminCacheKey('sales_overview', req) : null;
    if (useCache) {
      const cached = getAdminSalesCache(cacheKey);
      if (cached) return res.json({ success: true, data: cached });
    }

    const brandIdRaw = req.query.brandId;
    const allBrands = !brandIdRaw || brandIdRaw === '__ALL__';
    const brandId = allBrands ? null : parseInt(brandIdRaw, 10);

    const requestedPlatform = req.query.platform ? String(req.query.platform) : '__ALL__';
    const month = normalizeMonthForDb(req.query.month); // YYYY-MM → YY-MM
    const ALL = '__ALL__';

    const VIEW = buildSalesBuyerView({ withImageCount: false, monthFilter: !!month, allBrands });
    const baseReplacements = {
      salesId,
      ...(allBrands ? {} : { brandId }),
      ...(month ? { month } : {})
    };

    // 1. 플랫폼 목록 + 전체 합계 (GROUPING SETS)
    const groupedRows = await sequelize.query(`
      WITH buyer_view AS (${VIEW})
      SELECT
        platform,
        GROUPING(platform) AS is_total,
        COUNT(*) AS buyer_count,
        SUM(amount_num) AS total_amount,
        SUM(review_completed) AS review_completed_count,
        COUNT(DISTINCT campaign_id) AS active_campaign_count,
        COUNT(DISTINCT product_name) FILTER (WHERE product_name IS NOT NULL AND product_name <> '') AS product_count
      FROM buyer_view
      GROUP BY GROUPING SETS ((platform), ())
    `, {
      replacements: baseReplacements,
      type: sequelize.QueryTypes.SELECT
    });

    const totalRow = groupedRows.find(r => parseInt(r.is_total, 10) === 1);
    const perPlatform = groupedRows
      .filter(r => parseInt(r.is_total, 10) === 0)
      .map(r => ({
        platform: r.platform,
        buyerCount: parseInt(r.buyer_count, 10) || 0,
        totalAmount: parseFloat(r.total_amount) || 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount || b.buyerCount - a.buyerCount);

    if (perPlatform.length === 0) {
      return res.json({
        success: true,
        data: {
          platforms: [],
          selectedPlatform: null,
          summary: { totalAmount: 0, buyerCount: 0, reviewCompletedCount: 0, reviewCompletionRate: 0, activeCampaignCount: 0, productCount: 0 },
          issues: { lowCompletionRate: [], noReviewYet: [], topAmount: [] },
          dailyTrend: []
        }
      });
    }

    const allRow = {
      platform: ALL,
      buyerCount: parseInt(totalRow?.buyer_count, 10) || 0,
      totalAmount: parseFloat(totalRow?.total_amount) || 0
    };
    const platforms = [allRow, ...perPlatform];

    let selectedPlatform;
    if (requestedPlatform === ALL || platforms.some(p => p.platform === requestedPlatform)) {
      selectedPlatform = requestedPlatform;
    } else {
      selectedPlatform = ALL;
    }

    // 선택 플랫폼 요약
    let summarySource;
    if (selectedPlatform === ALL) {
      summarySource = totalRow;
    } else {
      summarySource = groupedRows.find(r => parseInt(r.is_total, 10) === 0 && r.platform === selectedPlatform);
    }
    const buyerCount = parseInt(summarySource?.buyer_count, 10) || 0;
    const reviewCompletedCount = parseInt(summarySource?.review_completed_count, 10) || 0;
    const totalAmount = parseFloat(summarySource?.total_amount) || 0;
    const activeCampaignCount = parseInt(summarySource?.active_campaign_count, 10) || 0;
    const productCount = parseInt(summarySource?.product_count, 10) || 0;
    const reviewCompletionRate = buyerCount > 0
      ? Math.round((reviewCompletedCount / buyerCount) * 100)
      : 0;

    // 이슈 리스트 — 제품명 단위 집계
    const isAll = selectedPlatform === ALL;
    const productAgg = await sequelize.query(`
      WITH buyer_view AS (${VIEW}),
      campaign_agg AS (
        SELECT
          product_name,
          campaign_id,
          campaign_name,
          COUNT(*)              AS c_buyer_count,
          SUM(review_completed) AS c_review_count,
          SUM(amount_num)       AS c_total_amount,
          ROW_NUMBER() OVER (PARTITION BY product_name ORDER BY COUNT(*) DESC, SUM(amount_num) DESC) AS rn
        FROM buyer_view
        WHERE product_name IS NOT NULL
          AND product_name <> ''
          ${isAll ? '' : 'AND platform = :platform'}
        GROUP BY product_name, campaign_id, campaign_name
      ),
      product_totals AS (
        SELECT
          product_name,
          SUM(c_buyer_count)    AS buyer_count,
          SUM(c_review_count)   AS review_completed_count,
          SUM(c_total_amount)   AS total_amount,
          COUNT(*)              AS campaign_count
        FROM campaign_agg
        GROUP BY product_name
      )
      SELECT
        pt.product_name,
        pt.buyer_count,
        pt.review_completed_count,
        pt.total_amount,
        pt.campaign_count,
        ca.campaign_id         AS primary_campaign_id,
        ca.campaign_name       AS primary_campaign_name
      FROM product_totals pt
      LEFT JOIN campaign_agg ca
        ON ca.product_name = pt.product_name AND ca.rn = 1
    `, {
      replacements: isAll ? baseReplacements : { ...baseReplacements, platform: selectedPlatform },
      type: sequelize.QueryTypes.SELECT
    });

    const productAggNormalized = productAgg.map(r => {
      const bc = parseInt(r.buyer_count, 10) || 0;
      const rc = parseInt(r.review_completed_count, 10) || 0;
      return {
        product_name: r.product_name,
        campaign_id: r.primary_campaign_id,
        campaign_name: r.primary_campaign_name,
        campaignCount: parseInt(r.campaign_count, 10) || 0,
        buyerCount: bc,
        reviewCompletedCount: rc,
        totalAmount: parseFloat(r.total_amount) || 0,
        rate: bc > 0 ? Math.round((rc / bc) * 100) : 0
      };
    });

    const lowCompletionRate = productAggNormalized
      .filter(r => r.buyerCount > 0 && r.reviewCompletedCount > 0 && r.rate < 100)
      .sort((a, b) => a.rate - b.rate || b.buyerCount - a.buyerCount)
      .slice(0, 3)
      .map(r => ({
        product_name: r.product_name,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        campaignCount: r.campaignCount,
        rate: r.rate,
        buyerCount: r.buyerCount,
        reviewCompletedCount: r.reviewCompletedCount
      }));

    const noReviewYet = productAggNormalized
      .filter(r => r.buyerCount > 0 && r.reviewCompletedCount === 0)
      .sort((a, b) => b.buyerCount - a.buyerCount)
      .slice(0, 3)
      .map(r => ({
        product_name: r.product_name,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        campaignCount: r.campaignCount,
        buyerCount: r.buyerCount
      }));

    const topAmount = productAggNormalized
      .slice()
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 3)
      .map(r => ({
        product_name: r.product_name,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        campaignCount: r.campaignCount,
        totalAmount: r.totalAmount
      }));

    // 일별 추이 (최근 14일) — KST
    const trendPlatformCond = isAll
      ? ''
      : `AND COALESCE(NULLIF(TRIM(s.platform), ''), NULLIF(TRIM(i.platform), ''), '미지정') = :platform`;
    const monthCondTrend = month
      ? `AND SUBSTRING(COALESCE(NULLIF(TRIM(b.date), ''), NULLIF(TRIM(s.date), ''), NULLIF(TRIM(i.date), '')), '\\d{2}-\\d{2}') = :month`
      : '';
    // brand 필터: __ALL__ 이면 mb.brand_id 조건 제거
    const trendBrandJoin = allBrands
      ? `INNER JOIN monthly_brands mb ON c.monthly_brand_id = mb.id
                                         AND mb.is_hidden = false
                                         AND mb.deleted_at IS NULL`
      : `INNER JOIN monthly_brands mb ON c.monthly_brand_id = mb.id
                                         AND mb.brand_id = :brandId
                                         AND mb.is_hidden = false
                                         AND mb.deleted_at IS NULL`;
    const trendReplacements = {
      salesId,
      ...(allBrands ? {} : { brandId }),
      ...(month ? { month } : {}),
      ...(isAll ? {} : { platform: selectedPlatform })
    };

    const trendRows = await sequelize.query(`
      WITH date_series AS (
        SELECT generate_series(
          ((NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '13 days')::date,
          (NOW() AT TIME ZONE 'Asia/Seoul')::date,
          '1 day'::interval
        )::date AS d
      ),
      buyer_daily AS (
        SELECT
          (b.created_at AT TIME ZONE 'Asia/Seoul')::date AS d,
          COUNT(*) AS cnt
        FROM buyers b
        INNER JOIN items i ON b.item_id = i.id AND i.deleted_at IS NULL
        INNER JOIN campaigns c ON i.campaign_id = c.id
                               AND c.is_hidden = false
                               AND c.deleted_at IS NULL
                               AND c.created_by = :salesId
        ${trendBrandJoin}
        LEFT JOIN item_slots s ON s.buyer_id = b.id
                               AND s.deleted_at IS NULL
                               AND s.is_suspended = false
        WHERE b.is_temporary = false
          AND b.deleted_at IS NULL
          AND (b.created_at AT TIME ZONE 'Asia/Seoul')::date >= ((NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '13 days')
          ${trendPlatformCond}
          ${monthCondTrend}
        GROUP BY (b.created_at AT TIME ZONE 'Asia/Seoul')::date
      ),
      review_daily AS (
        SELECT
          (im.created_at AT TIME ZONE 'Asia/Seoul')::date AS d,
          COUNT(*) AS cnt
        FROM images im
        INNER JOIN buyers b ON im.buyer_id = b.id AND b.deleted_at IS NULL AND b.is_temporary = false
        INNER JOIN items i ON b.item_id = i.id AND i.deleted_at IS NULL
        INNER JOIN campaigns c ON i.campaign_id = c.id
                               AND c.is_hidden = false
                               AND c.deleted_at IS NULL
                               AND c.created_by = :salesId
        ${trendBrandJoin}
        LEFT JOIN item_slots s ON s.buyer_id = b.id
                               AND s.deleted_at IS NULL
                               AND s.is_suspended = false
        WHERE im.status = 'approved'
          AND im.deleted_at IS NULL
          AND (im.created_at AT TIME ZONE 'Asia/Seoul')::date >= ((NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '13 days')
          ${trendPlatformCond}
          ${monthCondTrend}
        GROUP BY (im.created_at AT TIME ZONE 'Asia/Seoul')::date
      )
      SELECT
        ds.d::text                         AS date,
        COALESCE(bd.cnt, 0)::int           AS buyers_added,
        COALESCE(rd.cnt, 0)::int           AS review_completed
      FROM date_series ds
      LEFT JOIN buyer_daily  bd ON ds.d = bd.d
      LEFT JOIN review_daily rd ON ds.d = rd.d
      ORDER BY ds.d ASC
    `, {
      replacements: trendReplacements,
      type: sequelize.QueryTypes.SELECT
    });

    const dailyTrend = trendRows.map(r => ({
      date: r.date,
      buyersAdded: r.buyers_added,
      reviewCompleted: r.review_completed
    }));

    const responseData = {
      platforms,
      selectedPlatform,
      summary: {
        totalAmount,
        buyerCount,
        reviewCompletedCount,
        reviewCompletionRate,
        activeCampaignCount,
        productCount
      },
      issues: { lowCompletionRate, noReviewYet, topAmount },
      dailyTrend
    };

    // 32차: Admin viewAsUserId 캐시 저장
    if (useCache) setAdminSalesCache(cacheKey, responseData);

    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('Sales dashboard overview error:', error);
    res.status(500).json({ success: false, message: '영업사 대시보드 조회 중 오류가 발생했습니다' });
  }
};

/**
 * GET /api/sales-dashboard/product-list
 *  - Query: brandId, platform, month?, page?, pageSize?, sortKey?, sortDir?, filter?
 *  - brand-dashboard/product-list 와 동일한 응답 (rows + totalCount)
 */
exports.getProductList = async (req, res) => {
  try {
    const salesId = resolveSalesId(req);
    if (!salesId) {
      return res.status(400).json({ success: false, message: '인증이 필요합니다' });
    }

    // 32차: Admin viewAsUserId 캐시 조회
    const useCache = isAdminView(req);
    const cacheKey = useCache ? adminCacheKey('sales_product_list', req) : null;
    if (useCache) {
      const cached = getAdminSalesCache(cacheKey);
      if (cached) return res.json({ success: true, data: cached });
    }

    const brandIdRaw = req.query.brandId;
    const allBrands = !brandIdRaw || brandIdRaw === '__ALL__';
    const brandId = allBrands ? null : parseInt(brandIdRaw, 10);

    const platform = req.query.platform ? String(req.query.platform) : null;
    if (!platform) {
      return res.status(400).json({ success: false, message: 'platform 파라미터가 필요합니다' });
    }
    const month = normalizeMonthForDb(req.query.month); // YYYY-MM → YY-MM

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const allowedSortKeys = {
      product_name: 'product_name',
      buyerCount: 'buyer_count',
      reviewCompletedCount: 'review_completed_count',
      reviewCompletionRate: 'review_completion_rate',
      totalAmount: 'total_amount',
      imageCount: 'image_count',
      campaignCount: 'campaign_count'
    };
    const sortKeyRaw = req.query.sortKey ? String(req.query.sortKey) : 'totalAmount';
    const sortColumn = allowedSortKeys[sortKeyRaw] || 'total_amount';
    const sortDir = (req.query.sortDir === 'asc') ? 'ASC' : 'DESC';

    const filter = req.query.filter ? String(req.query.filter).trim() : '';
    const filterCond = filter ? `AND product_name ILIKE :filterPattern` : '';

    const isAll = platform === '__ALL__';
    const platformCond = isAll ? '' : 'AND platform = :platform';

    const VIEW = buildSalesBuyerView({ withImageCount: true, monthFilter: !!month, allBrands });

    const replacements = {
      salesId,
      ...(allBrands ? {} : { brandId }),
      ...(isAll ? {} : { platform }),
      ...(month ? { month } : {}),
      ...(filter ? { filterPattern: `%${filter}%` } : {}),
      pageLimit: pageSize,
      pageOffset: offset
    };

    // 제품명 단위 집계
    // - withImageCount: true 모드의 buyer_view 는 image_count 컬럼만 있고 review_completed 컬럼 없음
    // - 리뷰 완료 = image_count > 0 인 buyer 수
    const productAggSql = `
      WITH buyer_view AS (${VIEW}),
      product_agg AS (
        SELECT
          product_name,
          COUNT(*)              AS buyer_count,
          SUM(CASE WHEN image_count > 0 THEN 1 ELSE 0 END) AS review_completed_count,
          SUM(amount_num)       AS total_amount,
          SUM(image_count)      AS image_count,
          COUNT(DISTINCT campaign_id) AS campaign_count,
          CASE WHEN COUNT(*) > 0
               THEN ROUND((SUM(CASE WHEN image_count > 0 THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)) * 100)
               ELSE 0 END AS review_completion_rate
        FROM buyer_view
        WHERE product_name IS NOT NULL
          AND product_name <> ''
          ${platformCond}
          ${filterCond}
        GROUP BY product_name
      )
      SELECT *, COUNT(*) OVER() AS total_count
      FROM product_agg
      ORDER BY ${sortColumn} ${sortDir} NULLS LAST, product_name ASC
      LIMIT :pageLimit OFFSET :pageOffset
    `;

    const aggRows = await sequelize.query(productAggSql, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    const totalCount = aggRows[0]?.total_count ? parseInt(aggRows[0].total_count, 10) : 0;
    if (aggRows.length === 0) {
      return res.json({ success: true, data: { rows: [], totalCount: 0, page, pageSize } });
    }

    // 캠페인 서브 정보 (현재 페이지의 제품들에 한해)
    const productNames = aggRows.map(r => r.product_name);
    const campaignSubReplacements = {
      salesId,
      ...(allBrands ? {} : { brandId }),
      ...(isAll ? {} : { platform }),
      ...(month ? { month } : {}),
      productNames
    };
    const campaignSubSql = `
      WITH buyer_view AS (${VIEW})
      SELECT
        product_name,
        campaign_id,
        campaign_name,
        COUNT(*)              AS buyer_count,
        SUM(CASE WHEN image_count > 0 THEN 1 ELSE 0 END) AS review_completed_count,
        SUM(amount_num)       AS total_amount
      FROM buyer_view
      WHERE product_name IN (:productNames)
        ${platformCond}
      GROUP BY product_name, campaign_id, campaign_name
      ORDER BY product_name ASC, total_amount DESC NULLS LAST
    `;
    const campaignSubRows = await sequelize.query(campaignSubSql, {
      replacements: campaignSubReplacements,
      type: sequelize.QueryTypes.SELECT
    });

    const campaignsByProduct = new Map();
    for (const r of campaignSubRows) {
      if (!campaignsByProduct.has(r.product_name)) campaignsByProduct.set(r.product_name, []);
      campaignsByProduct.get(r.product_name).push({
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        buyerCount: parseInt(r.buyer_count, 10) || 0,
        reviewCompletedCount: parseInt(r.review_completed_count, 10) || 0,
        totalAmount: parseFloat(r.total_amount) || 0
      });
    }

    const rows = aggRows.map(r => ({
      product_name: r.product_name,
      buyerCount: parseInt(r.buyer_count, 10) || 0,
      reviewCompletedCount: parseInt(r.review_completed_count, 10) || 0,
      reviewCompletionRate: parseInt(r.review_completion_rate, 10) || 0,
      totalAmount: parseFloat(r.total_amount) || 0,
      imageCount: parseInt(r.image_count, 10) || 0,
      campaignCount: parseInt(r.campaign_count, 10) || 0,
      campaigns: campaignsByProduct.get(r.product_name) || []
    }));

    const responseData = { rows, totalCount, page, pageSize };

    // 32차: Admin viewAsUserId 캐시 저장
    if (useCache) setAdminSalesCache(cacheKey, responseData);

    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('Sales dashboard product-list error:', error);
    res.status(500).json({ success: false, message: '제품 리스트 조회 중 오류가 발생했습니다' });
  }
};
