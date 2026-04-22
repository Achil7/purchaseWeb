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

    // 1. 플랫폼 목록 (탭)
    const platformRows = await sequelize.query(`
      WITH buyer_view AS (${BUYER_LEVEL_VIEW_SQL})
      SELECT
        platform,
        COUNT(*)                AS buyer_count,
        SUM(amount_num)         AS total_amount
      FROM buyer_view
      GROUP BY platform
      ORDER BY total_amount DESC, buyer_count DESC
    `, {
      replacements: { brandId },
      type: sequelize.QueryTypes.SELECT
    });

    const platforms = platformRows.map(r => ({
      platform: r.platform,
      buyerCount: parseInt(r.buyer_count, 10) || 0,
      totalAmount: parseFloat(r.total_amount) || 0
    }));

    // 선택 플랫폼 결정
    let selectedPlatform = null;
    if (platforms.length > 0) {
      if (requestedPlatform && platforms.some(p => p.platform === requestedPlatform)) {
        selectedPlatform = requestedPlatform;
      } else {
        selectedPlatform = platforms[0].platform;
      }
    }

    // 데이터 없음
    if (!selectedPlatform) {
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
      WHERE platform = :platform
    `, {
      replacements: { brandId, platform: selectedPlatform },
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

    // 3. 이슈 리스트 3개 (각 5건)
    // item 단위로 집계 → product_name 이 비어있는 item 은 제외
    const itemAgg = await sequelize.query(`
      WITH buyer_view AS (${BUYER_LEVEL_VIEW_SQL})
      SELECT
        item_id,
        campaign_id,
        campaign_name,
        product_name,
        COUNT(*)              AS buyer_count,
        SUM(review_completed) AS review_completed_count,
        SUM(amount_num)       AS total_amount
      FROM buyer_view
      WHERE platform = :platform
        AND product_name IS NOT NULL
        AND product_name <> ''
      GROUP BY item_id, campaign_id, campaign_name, product_name
    `, {
      replacements: { brandId, platform: selectedPlatform },
      type: sequelize.QueryTypes.SELECT
    });

    const itemAggNormalized = itemAgg.map(r => {
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
        rate: bc > 0 ? Math.round((rc / bc) * 100) : 0
      };
    });

    const lowCompletionRate = itemAggNormalized
      .filter(r => r.buyerCount > 0 && r.reviewCompletedCount > 0 && r.rate < 100)
      .sort((a, b) => a.rate - b.rate || b.buyerCount - a.buyerCount)
      .slice(0, 5)
      .map(r => ({
        product_name: r.product_name,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        rate: r.rate,
        buyerCount: r.buyerCount,
        reviewCompletedCount: r.reviewCompletedCount
      }));

    const noReviewYet = itemAggNormalized
      .filter(r => r.buyerCount > 0 && r.reviewCompletedCount === 0)
      .sort((a, b) => b.buyerCount - a.buyerCount)
      .slice(0, 5)
      .map(r => ({
        product_name: r.product_name,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        buyerCount: r.buyerCount
      }));

    const topAmount = itemAggNormalized
      .slice()
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5)
      .map(r => ({
        product_name: r.product_name,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        totalAmount: r.totalAmount
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
        }
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
      ORDER BY total_amount DESC, buyer_count DESC
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
