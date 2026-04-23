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
 * 공통 SQL fragment:
 *  - brand_id 기준 캠페인·아이템·슬롯·구매자 조인
 *  - 슬롯의 필드가 있으면 우선, 없으면 Item 값 사용 (platform / product_name)
 *  - is_temporary=false, images.status='approved'
 *  - is_hidden / is_suspended / deleted_at 필터
 *
 * 핵심 뷰: 각 buyer row 당 그 buyer 가 속한 item/slot 의 platform, product_name, amount, 리뷰완료 여부 (EXISTS)
 */
const BUYER_LEVEL_VIEW_SQL = `
  SELECT
    b.id                                                               AS buyer_id,
    b.item_id,
    c.id                                                               AS campaign_id,
    c.name                                                             AS campaign_name,
    COALESCE(NULLIF(TRIM(s.platform), ''), NULLIF(TRIM(i.platform), ''), '미지정')       AS platform,
    COALESCE(NULLIF(TRIM(s.product_name), ''), NULLIF(TRIM(i.product_name), ''))        AS product_name,
    CASE
      WHEN REPLACE(COALESCE(b.amount, '0'), ',', '') ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN REPLACE(b.amount, ',', '')::NUMERIC
      ELSE 0
    END                                                                AS amount_num,
    CASE WHEN EXISTS (
      SELECT 1 FROM images im
      WHERE im.buyer_id = b.id
        AND im.status = 'approved'
        AND im.deleted_at IS NULL
    ) THEN 1 ELSE 0 END                                                AS review_completed,
    (
      SELECT COUNT(im2.id) FROM images im2
      WHERE im2.buyer_id = b.id
        AND im2.status = 'approved'
        AND im2.deleted_at IS NULL
    )                                                                  AS image_count
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

    // 1. 플랫폼 목록 (탭)
    const platformRows = await sequelize.query(`
      WITH buyer_view AS (${BUYER_LEVEL_VIEW_SQL})
      SELECT
        platform,
        COUNT(*)                AS buyer_count,
        SUM(amount_num)         AS total_amount
      FROM buyer_view
      GROUP BY platform
      ORDER BY total_amount DESC NULLS LAST, buyer_count DESC
    `, {
      replacements: { brandId },
      type: sequelize.QueryTypes.SELECT
    });

    const perPlatform = platformRows.map(r => ({
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

    // "전체" 탭을 맨 앞에 주입 (합산)
    const allRow = {
      platform: ALL,
      buyerCount: perPlatform.reduce((a, b) => a + b.buyerCount, 0),
      totalAmount: perPlatform.reduce((a, b) => a + b.totalAmount, 0)
    };
    const platforms = [allRow, ...perPlatform];

    // 선택 플랫폼 결정: 요청값이 '전체' 또는 목록에 있으면 그 값, 아니면 기본 '전체'
    let selectedPlatform;
    if (requestedPlatform === ALL || platforms.some(p => p.platform === requestedPlatform)) {
      selectedPlatform = requestedPlatform;
    } else {
      selectedPlatform = ALL;
    }

    const isAll = selectedPlatform === ALL;
    const platformWhere = isAll ? '' : 'WHERE platform = :platform';
    const trendPlatformCond = isAll
      ? ''
      : `AND COALESCE(NULLIF(TRIM(s.platform), ''), NULLIF(TRIM(i.platform), ''), '미지정') = :platform`;
    const baseReplacements = isAll
      ? { brandId }
      : { brandId, platform: selectedPlatform };

    // 2. 선택 플랫폼 요약 (6지표)
    const summaryRows = await sequelize.query(`
      WITH buyer_view AS (${BUYER_LEVEL_VIEW_SQL})
      SELECT
        COUNT(*)                                         AS buyer_count,
        SUM(amount_num)                                  AS total_amount,
        SUM(review_completed)                            AS review_completed_count,
        COUNT(DISTINCT campaign_id)                      AS active_campaign_count,
        COUNT(DISTINCT product_name) FILTER (WHERE product_name IS NOT NULL AND product_name <> '')
                                                         AS product_count
      FROM buyer_view
      ${platformWhere}
    `, {
      replacements: baseReplacements,
      type: sequelize.QueryTypes.SELECT
    });

    const sRow = summaryRows[0] || {};
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
    //    (아래 '제품별 현황' 테이블과 집계 단위 일치)
    const productAgg = await sequelize.query(`
      WITH buyer_view AS (${BUYER_LEVEL_VIEW_SQL}),
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
      replacements: baseReplacements,
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

    // 4. 일별 추이 (최근 14일) - 선택 플랫폼 기준
    // 리뷰 완료 건수 (images.created_at, status=approved)
    // 구매자 등록 건수 (buyers.created_at, is_temporary=false)
    // KST 기준 날짜 집계 (서버 DB timezone 이 UTC 이므로 명시적 변환 필수)
    // - timestamp AT TIME ZONE 'Asia/Seoul' 로 KST 로컬 시각 산출 후 DATE() 추출
    // - 구매자·리뷰 업로드 시점을 브랜드사(KST)의 "하루" 경계로 자름
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
          AND (b.created_at AT TIME ZONE 'Asia/Seoul')::date >= ((NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '13 days')
          ${trendPlatformCond}
        GROUP BY (b.created_at AT TIME ZONE 'Asia/Seoul')::date
      ),
      review_daily AS (
        SELECT
          (im.created_at AT TIME ZONE 'Asia/Seoul')::date AS d,
          COUNT(*) AS cnt
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
          AND (im.created_at AT TIME ZONE 'Asia/Seoul')::date >= ((NOW() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '13 days')
          ${trendPlatformCond}
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
      replacements: baseReplacements,
      type: sequelize.QueryTypes.SELECT
    });

    const dailyTrend = trendRows.map(r => ({
      date: r.date, // YYYY-MM-DD
      buyersAdded: r.buyers_added,
      reviewCompleted: r.review_completed
    }));

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
 * GET /api/brand-dashboard/product-rollup
 *
 * Query:
 *   - platform       (필수)
 *   - query          (필수, trim 후 2자 이상)
 *   - viewAsUserId?
 */
exports.getProductRollup = async (req, res) => {
  try {
    const brandId = await resolveBrandId(req);
    if (!brandId) {
      return res.status(400).json({
        success: false,
        message: '브랜드 식별에 실패했습니다'
      });
    }

    const platform = req.query.platform ? String(req.query.platform) : null;
    const rawQuery = req.query.query ? String(req.query.query).trim() : '';

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'platform 파라미터가 필요합니다'
      });
    }
    if (rawQuery.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'query 는 2자 이상이어야 합니다'
      });
    }

    // item 단위 집계 (검색어 ILIKE + 선택 플랫폼)
    const rows = await sequelize.query(`
      WITH buyer_view AS (${BUYER_LEVEL_VIEW_SQL})
      SELECT
        item_id,
        campaign_id,
        campaign_name,
        product_name,
        COUNT(*)              AS buyer_count,
        SUM(review_completed) AS review_completed_count,
        SUM(amount_num)       AS total_amount,
        SUM(image_count)      AS image_count
      FROM buyer_view
      WHERE platform = :platform
        AND product_name IS NOT NULL
        AND product_name ILIKE :pattern
      GROUP BY item_id, campaign_id, campaign_name, product_name
      ORDER BY total_amount DESC NULLS LAST, buyer_count DESC
    `, {
      replacements: {
        brandId,
        platform,
        pattern: `%${rawQuery}%`
      },
      type: sequelize.QueryTypes.SELECT
    });

    const normalized = rows.map(r => {
      const bc = parseInt(r.buyer_count, 10) || 0;
      const rc = parseInt(r.review_completed_count, 10) || 0;
      return {
        item_id: r.item_id,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        product_name: r.product_name,
        buyerCount: bc,
        reviewCompletedCount: rc,
        totalAmount: parseFloat(r.total_amount) || 0,
        imageCount: parseInt(r.image_count, 10) || 0
      };
    });

    const totalBuyers = normalized.reduce((a, b) => a + b.buyerCount, 0);
    const totalReview = normalized.reduce((a, b) => a + b.reviewCompletedCount, 0);
    const totalAmount = normalized.reduce((a, b) => a + b.totalAmount, 0);
    const totalImages = normalized.reduce((a, b) => a + b.imageCount, 0);
    const campaignCount = new Set(normalized.map(r => r.campaign_id)).size;

    res.json({
      success: true,
      data: {
        rollup: {
          matchedProductCount: normalized.length,
          campaignCount,
          buyerCount: totalBuyers,
          reviewCompletedCount: totalReview,
          reviewCompletionRate: totalBuyers > 0 ? Math.round((totalReview / totalBuyers) * 100) : 0,
          totalAmount,
          imageCount: totalImages
        },
        rows: normalized
      }
    });
  } catch (error) {
    console.error('Brand dashboard product-rollup error:', error);
    res.status(500).json({
      success: false,
      message: '제품 통합 현황 조회 중 오류가 발생했습니다'
    });
  }
};

/**
 * GET /api/brand-dashboard/product-list
 *
 * 선택 플랫폼(또는 전체='__ALL__') 내에서 제품명(product_name) 100% 일치 단위로
 * 합산한 전체 제품 리스트를 반환. 각 제품 행에 포함된 캠페인 목록을 함께 담아
 * 프론트에서 Collapse 펼칠 때 추가 API 호출이 필요 없도록 한다.
 *
 * Query:
 *   - platform       (필수, '__ALL__' 가능)
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

    const isAll = platform === '__ALL__';
    const platformCond = isAll ? '' : 'AND platform = :platform';
    const replacements = isAll ? { brandId } : { brandId, platform };

    // 캠페인 단위 세부 집계 → 프론트에서 product_name 기준으로 묶음
    const campaignRows = await sequelize.query(`
      WITH buyer_view AS (${BUYER_LEVEL_VIEW_SQL})
      SELECT
        product_name,
        campaign_id,
        campaign_name,
        COUNT(*)              AS buyer_count,
        SUM(review_completed) AS review_completed_count,
        SUM(amount_num)       AS total_amount,
        SUM(image_count)      AS image_count
      FROM buyer_view
      WHERE product_name IS NOT NULL
        AND product_name <> ''
        ${platformCond}
      GROUP BY product_name, campaign_id, campaign_name
      ORDER BY product_name ASC, total_amount DESC NULLS LAST, buyer_count DESC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    // product_name 별로 묶기
    const productMap = new Map();
    for (const r of campaignRows) {
      const bc = parseInt(r.buyer_count, 10) || 0;
      const rc = parseInt(r.review_completed_count, 10) || 0;
      const amt = parseFloat(r.total_amount) || 0;
      const img = parseInt(r.image_count, 10) || 0;

      if (!productMap.has(r.product_name)) {
        productMap.set(r.product_name, {
          product_name: r.product_name,
          buyerCount: 0,
          reviewCompletedCount: 0,
          totalAmount: 0,
          imageCount: 0,
          campaigns: []
        });
      }
      const p = productMap.get(r.product_name);
      p.buyerCount += bc;
      p.reviewCompletedCount += rc;
      p.totalAmount += amt;
      p.imageCount += img;
      p.campaigns.push({
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        buyerCount: bc,
        reviewCompletedCount: rc,
        totalAmount: amt
      });
    }

    const rows = Array.from(productMap.values()).map(p => ({
      ...p,
      campaignCount: p.campaigns.length,
      reviewCompletionRate: p.buyerCount > 0
        ? Math.round((p.reviewCompletedCount / p.buyerCount) * 100)
        : 0
    }));

    // 금액 내림차순 정렬
    rows.sort((a, b) => b.totalAmount - a.totalAmount);

    res.json({
      success: true,
      data: { rows }
    });
  } catch (error) {
    console.error('Brand dashboard product-list error:', error);
    res.status(500).json({
      success: false,
      message: '제품 리스트 조회 중 오류가 발생했습니다'
    });
  }
};
