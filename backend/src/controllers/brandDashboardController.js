const { User, sequelize } = require('../models');

/**
 * 공통: req 에서 대상 brandId 추출
 *  - brand: 본인 ID
 *  - admin: viewAsUserId 필수, 해당 유저 role='brand' 검증
 */
async function resolveBrandId(req) {
  if (req.user.role === 'brand') {
    return req.user.id;
  }
  if (req.user.role === 'admin') {
    const viewAsUserId = req.query.viewAsUserId ? parseInt(req.query.viewAsUserId, 10) : null;
    if (!viewAsUserId) return null;
    const target = await User.findByPk(viewAsUserId, { attributes: ['id', 'role'] });
    if (!target || target.role !== 'brand') return null;
    return target.id;
  }
  return null;
}

/**
 * 공통 SQL fragment 빌더
 *  - withImageCount=false (overview용): review_completed(0/1) - EXISTS 한 번
 *  - withImageCount=true (product-list용): image_count(숫자) - COUNT 한 번
 *  → 기존 EXISTS+COUNT 두 번 스캔을 한 번으로 축소
 */
function buildBuyerLevelView({ withImageCount }) {
  const reviewExpr = withImageCount
    ? `COALESCE((SELECT COUNT(*) FROM images im WHERE im.buyer_id = b.id AND im.status = 'approved' AND im.deleted_at IS NULL), 0) AS image_count`
    : `CASE WHEN EXISTS (SELECT 1 FROM images im WHERE im.buyer_id = b.id AND im.status = 'approved' AND im.deleted_at IS NULL) THEN 1 ELSE 0 END AS review_completed`;
  return `
    SELECT
      b.id AS buyer_id,
      b.item_id,
      c.id AS campaign_id,
      c.name AS campaign_name,
      COALESCE(NULLIF(TRIM(s.platform), ''), NULLIF(TRIM(i.platform), ''), '미지정') AS platform,
      COALESCE(NULLIF(TRIM(s.product_name), ''), NULLIF(TRIM(i.product_name), '')) AS product_name,
      CASE
        WHEN REPLACE(COALESCE(b.amount, '0'), ',', '') ~ '^[0-9]+(\\.[0-9]+)?$'
        THEN REPLACE(b.amount, ',', '')::NUMERIC
        ELSE 0
      END AS amount_num,
      ${reviewExpr}
    FROM buyers b
    INNER JOIN items i        ON b.item_id = i.id AND i.deleted_at IS NULL
    INNER JOIN campaigns c    ON i.campaign_id = c.id AND c.is_hidden = false AND c.deleted_at IS NULL
    INNER JOIN monthly_brands mb ON c.monthly_brand_id = mb.id
                                 AND mb.brand_id = :brandId
                                 AND mb.is_hidden = false
                                 AND mb.deleted_at IS NULL
    LEFT JOIN item_slots s    ON s.buyer_id = b.id
                                 AND s.deleted_at IS NULL
                                 AND s.is_suspended = false
    WHERE b.is_temporary = false
      AND b.deleted_at IS NULL
  `;
}

/**
 * In-memory 캐시 (daily trend 전용)
 *  - 키: brandId_platform
 *  - TTL: 60초 (브랜드 폴링 주기 30초보다 약간 김)
 *  - 인프라 변경 없음 (Node.js Map만 사용)
 */
const trendCache = new Map();
const TREND_TTL_MS = 60_000;

function getCachedTrend(brandId, platform) {
  const key = `${brandId}_${platform || 'ALL'}`;
  const entry = trendCache.get(key);
  if (entry && Date.now() - entry.ts < TREND_TTL_MS) return entry.data;
  return null;
}

function setCachedTrend(brandId, platform, data) {
  const key = `${brandId}_${platform || 'ALL'}`;
  trendCache.set(key, { ts: Date.now(), data });
  if (trendCache.size > 1000) {
    const firstKey = trendCache.keys().next().value;
    trendCache.delete(firstKey);
  }
}

/**
 * GET /api/brand-dashboard/overview
 *
 * Query:
 *   - platform?      : 미지정 시 금액 최대 플랫폼 자동 선택
 *   - viewAsUserId?  : admin 대리 조회
 */
exports.getOverview = async (req, res) => {
  try {
    const brandId = await resolveBrandId(req);
    if (!brandId) {
      return res.json({
        success: true,
        data: {
          platforms: [],
          selectedPlatform: null,
          summary: { totalAmount: 0, buyerCount: 0, reviewCompletedCount: 0, reviewCompletionRate: 0, activeCampaignCount: 0, productCount: 0 },
          issues: { lowCompletionRate: [], noReviewYet: [], topAmount: [] }
        }
      });
    }

    const requestedPlatform = req.query.platform ? String(req.query.platform) : null;
    const ALL = '__ALL__';

    const BUYER_VIEW = buildBuyerLevelView({ withImageCount: false });

    // 1. 플랫폼 목록 + 전체 합계 통계 (GROUPING SETS로 1번 쿼리)
    //    - is_total = 1 행: 전체 합계
    //    - 나머지 행: 플랫폼별 통계
    const groupedRows = await sequelize.query(`
      WITH buyer_view AS (${BUYER_VIEW})
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
      replacements: { brandId },
      type: sequelize.QueryTypes.SELECT
    });

    // is_total = 1 행 (전체 합계) 분리
    const totalRow = groupedRows.find(r => parseInt(r.is_total, 10) === 1);
    const platformOnlyRows = groupedRows
      .filter(r => parseInt(r.is_total, 10) === 0)
      .sort((a, b) => {
        const ta = parseFloat(a.total_amount) || 0;
        const tb = parseFloat(b.total_amount) || 0;
        if (tb !== ta) return tb - ta;
        return (parseInt(b.buyer_count, 10) || 0) - (parseInt(a.buyer_count, 10) || 0);
      });

    const perPlatform = platformOnlyRows.map(r => ({
      platform: r.platform,
      buyerCount: parseInt(r.buyer_count, 10) || 0,
      totalAmount: parseFloat(r.total_amount) || 0
    }));

    // 데이터 없음
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

    // "전체" 탭 — DB의 GROUPING 합계 사용
    const allRow = {
      platform: ALL,
      buyerCount: totalRow ? (parseInt(totalRow.buyer_count, 10) || 0) : 0,
      totalAmount: totalRow ? (parseFloat(totalRow.total_amount) || 0) : 0
    };
    const platforms = [allRow, ...perPlatform];

    // 선택 플랫폼 결정
    let selectedPlatform;
    if (requestedPlatform === ALL || platforms.some(p => p.platform === requestedPlatform)) {
      selectedPlatform = requestedPlatform;
    } else {
      selectedPlatform = ALL;
    }

    const isAll = selectedPlatform === ALL;

    // 2. 선택 플랫폼 요약 (6지표) — DB GROUPING 결과 직접 활용 (추가 쿼리 없음)
    let summaryRow;
    if (isAll) {
      summaryRow = totalRow;
    } else {
      summaryRow = platformOnlyRows.find(r => r.platform === selectedPlatform);
    }
    const sRow = summaryRow || {};
    const buyerCount = parseInt(sRow.buyer_count, 10) || 0;
    const reviewCompletedCount = parseInt(sRow.review_completed_count, 10) || 0;
    const totalAmount = parseFloat(sRow.total_amount) || 0;
    const activeCampaignCount = parseInt(sRow.active_campaign_count, 10) || 0;
    const productCount = parseInt(sRow.product_count, 10) || 0;
    const reviewCompletionRate = buyerCount > 0
      ? Math.round((reviewCompletedCount / buyerCount) * 100)
      : 0;

    // 3. 이슈 리스트 3개 — 제품명(product_name) 단위로 집계
    //    대표 캠페인: 같은 제품명 내에서 구매자 수 최대인 campaign 을 대표로 선택
    const platformWhereInner = isAll ? '' : 'AND platform = :platform';
    const issueReplacements = isAll ? { brandId } : { brandId, platform: selectedPlatform };

    const productAgg = await sequelize.query(`
      WITH buyer_view AS (${BUYER_VIEW}),
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
          ${platformWhereInner}
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
      replacements: issueReplacements,
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

    // 4. 일별 추이 (최근 14일) - 캐시 우선
    let dailyTrend = getCachedTrend(brandId, selectedPlatform);

    if (!dailyTrend) {
      const trendPlatformCond = isAll
        ? ''
        : `AND COALESCE(NULLIF(TRIM(s.platform), ''), NULLIF(TRIM(i.platform), ''), '미지정') = :platform`;
      const trendReplacements = isAll ? { brandId } : { brandId, platform: selectedPlatform };

      const trendRows = await sequelize.query(`
        WITH date_series AS (
          SELECT generate_series(
            ((NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '13 days')::date,
            (NOW() AT TIME ZONE 'Asia/Seoul')::date,
            '1 day'::interval
          )::date AS d
        ),
        buyer_daily AS (
          SELECT d, COUNT(*) AS cnt
          FROM (
            SELECT (b.created_at AT TIME ZONE 'Asia/Seoul')::date AS d
            FROM buyers b
            INNER JOIN items i ON b.item_id = i.id AND i.deleted_at IS NULL
            INNER JOIN campaigns c ON i.campaign_id = c.id AND c.is_hidden = false AND c.deleted_at IS NULL
            INNER JOIN monthly_brands mb ON c.monthly_brand_id = mb.id
                                         AND mb.brand_id = :brandId
                                         AND mb.is_hidden = false
                                         AND mb.deleted_at IS NULL
            LEFT JOIN item_slots s ON s.buyer_id = b.id
                                   AND s.deleted_at IS NULL
                                   AND s.is_suspended = false
            WHERE b.is_temporary = false
              AND b.deleted_at IS NULL
              ${trendPlatformCond}
          ) sub
          WHERE d >= ((NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '13 days')
          GROUP BY d
        ),
        review_daily AS (
          SELECT d, COUNT(*) AS cnt
          FROM (
            SELECT (im.created_at AT TIME ZONE 'Asia/Seoul')::date AS d
            FROM images im
            INNER JOIN buyers b ON im.buyer_id = b.id AND b.deleted_at IS NULL AND b.is_temporary = false
            INNER JOIN items i ON b.item_id = i.id AND i.deleted_at IS NULL
            INNER JOIN campaigns c ON i.campaign_id = c.id AND c.is_hidden = false AND c.deleted_at IS NULL
            INNER JOIN monthly_brands mb ON c.monthly_brand_id = mb.id
                                         AND mb.brand_id = :brandId
                                         AND mb.is_hidden = false
                                         AND mb.deleted_at IS NULL
            LEFT JOIN item_slots s ON s.buyer_id = b.id
                                   AND s.deleted_at IS NULL
                                   AND s.is_suspended = false
            WHERE im.status = 'approved'
              AND im.deleted_at IS NULL
              ${trendPlatformCond}
          ) sub
          WHERE d >= ((NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '13 days')
          GROUP BY d
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

      dailyTrend = trendRows.map(r => ({
        date: r.date,
        buyersAdded: r.buyers_added,
        reviewCompleted: r.review_completed
      }));

      setCachedTrend(brandId, selectedPlatform, dailyTrend);
    }

    res.json({
      success: true,
      data: {
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
        issues: {
          lowCompletionRate,
          noReviewYet,
          topAmount
        },
        dailyTrend
      }
    });
  } catch (error) {
    console.error('Brand dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: '브랜드 대시보드 조회 중 오류가 발생했습니다'
    });
  }
};

/**
 * GET /api/brand-dashboard/product-list
 *
 * 선택 플랫폼(또는 전체='__ALL__') 내에서 제품명(product_name) 100% 일치 단위로
 * 합산. 서버 사이드 페이지네이션/정렬/필터 지원.
 *
 * Query:
 *   - platform       (필수, '__ALL__' 가능)
 *   - page?          (기본 1)
 *   - pageSize?      (기본 20, 최대 100)
 *   - sortKey?       (기본 'totalAmount')
 *   - sortDir?       (기본 'desc')
 *   - filter?        (제품명 검색어, ILIKE)
 *   - viewAsUserId?
 */
exports.getProductList = async (req, res) => {
  try {
    const brandId = await resolveBrandId(req);
    if (!brandId) {
      return res.status(400).json({
        success: false,
        message: '브랜드 식별에 실패했습니다'
      });
    }

    const platform = req.query.platform ? String(req.query.platform) : null;
    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'platform 파라미터가 필요합니다'
      });
    }

    // 페이지네이션 파라미터
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    // 정렬 파라미터 (whitelist 검증)
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

    // 필터 파라미터 (제품명)
    const filter = req.query.filter ? String(req.query.filter).trim() : '';

    const isAll = platform === '__ALL__';
    const platformCond = isAll ? '' : 'AND platform = :platform';
    const filterCond = filter ? 'AND product_name ILIKE :filterPattern' : '';

    const replacements = { brandId };
    if (!isAll) replacements.platform = platform;
    if (filter) replacements.filterPattern = `%${filter}%`;

    const BUYER_VIEW = buildBuyerLevelView({ withImageCount: true });

    // 1. 제품명별 통합 통계 (totalCount 계산용 + 페이지 데이터)
    //    - 제품명 그룹 기준 페이지네이션
    //    - 같은 product_name의 캠페인 상세는 별도 쿼리로
    const productSummary = await sequelize.query(`
      WITH buyer_view AS (${BUYER_VIEW}),
      product_agg AS (
        SELECT
          product_name,
          SUM(buyer_count_per_campaign) AS buyer_count,
          SUM(review_count_per_campaign) AS review_completed_count,
          SUM(total_amount_per_campaign) AS total_amount,
          SUM(image_count_per_campaign) AS image_count,
          COUNT(*) AS campaign_count,
          CASE WHEN SUM(buyer_count_per_campaign) > 0
            THEN ROUND(SUM(review_count_per_campaign) * 100.0 / SUM(buyer_count_per_campaign))
            ELSE 0
          END AS review_completion_rate
        FROM (
          SELECT
            product_name,
            campaign_id,
            COUNT(*) AS buyer_count_per_campaign,
            SUM(review_completed_or_image) AS review_count_per_campaign,
            SUM(amount_num) AS total_amount_per_campaign,
            SUM(image_count) AS image_count_per_campaign
          FROM (
            SELECT
              product_name,
              campaign_id,
              amount_num,
              image_count,
              CASE WHEN image_count > 0 THEN 1 ELSE 0 END AS review_completed_or_image
            FROM buyer_view
            WHERE product_name IS NOT NULL
              AND product_name <> ''
              ${platformCond}
              ${filterCond}
          ) bv2
          GROUP BY product_name, campaign_id
        ) campaign_level
        GROUP BY product_name
      )
      SELECT
        product_name,
        buyer_count,
        review_completed_count,
        total_amount,
        image_count,
        campaign_count,
        review_completion_rate,
        COUNT(*) OVER () AS total_count
      FROM product_agg
      ORDER BY ${sortColumn} ${sortDir} NULLS LAST, product_name ASC
      LIMIT :pageSize OFFSET :offset
    `, {
      replacements: { ...replacements, pageSize, offset },
      type: sequelize.QueryTypes.SELECT
    });

    const totalCount = productSummary.length > 0
      ? parseInt(productSummary[0].total_count, 10) || 0
      : 0;

    const productNames = productSummary.map(r => r.product_name);

    // 2. 페이지에 포함된 제품들의 캠페인 상세 (Collapse 펼침용)
    let campaignsByProduct = {};
    if (productNames.length > 0) {
      const campaignReplacements = { brandId, productNames };
      if (!isAll) campaignReplacements.platform = platform;

      const campaignRows = await sequelize.query(`
        WITH buyer_view AS (${BUYER_VIEW})
        SELECT
          product_name,
          campaign_id,
          campaign_name,
          COUNT(*) AS buyer_count,
          SUM(CASE WHEN image_count > 0 THEN 1 ELSE 0 END) AS review_completed_count,
          SUM(amount_num) AS total_amount
        FROM buyer_view
        WHERE product_name IN (:productNames)
          ${platformCond}
        GROUP BY product_name, campaign_id, campaign_name
        ORDER BY product_name ASC, total_amount DESC NULLS LAST, buyer_count DESC
      `, {
        replacements: campaignReplacements,
        type: sequelize.QueryTypes.SELECT
      });

      for (const r of campaignRows) {
        if (!campaignsByProduct[r.product_name]) campaignsByProduct[r.product_name] = [];
        campaignsByProduct[r.product_name].push({
          campaign_id: r.campaign_id,
          campaign_name: r.campaign_name,
          buyerCount: parseInt(r.buyer_count, 10) || 0,
          reviewCompletedCount: parseInt(r.review_completed_count, 10) || 0,
          totalAmount: parseFloat(r.total_amount) || 0
        });
      }
    }

    // 응답 데이터 구성 (기존 응답 구조 유지: campaigns 포함)
    const rows = productSummary.map(r => ({
      product_name: r.product_name,
      buyerCount: parseInt(r.buyer_count, 10) || 0,
      reviewCompletedCount: parseInt(r.review_completed_count, 10) || 0,
      totalAmount: parseFloat(r.total_amount) || 0,
      imageCount: parseInt(r.image_count, 10) || 0,
      campaignCount: parseInt(r.campaign_count, 10) || 0,
      reviewCompletionRate: parseInt(r.review_completion_rate, 10) || 0,
      campaigns: campaignsByProduct[r.product_name] || []
    }));

    res.json({
      success: true,
      data: {
        rows,
        totalCount,
        page,
        pageSize
      }
    });
  } catch (error) {
    console.error('Brand dashboard product-list error:', error);
    res.status(500).json({
      success: false,
      message: '제품 리스트 조회 중 오류가 발생했습니다'
    });
  }
};
