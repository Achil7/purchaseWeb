const { sequelize } = require('../models');

/**
 * Admin 브랜드/캠페인별 정산 요약
 * 브랜드사(User role=brand) > 연월브랜드 > 캠페인 3단 계층으로
 * 각 레벨에서 (전체 / 리뷰샷 제출분) 금액·리뷰비 합산을 반환.
 *
 * - 금액: Buyer.amount (TEXT, 숫자만 추출)
 * - 리뷰비: ItemSlot.review_cost (TEXT, 숫자만 추출) — 슬롯당(=구매자당) 독립 값
 * - 리뷰샷 제출 기준: images 테이블에 status='approved' 레코드 존재
 * - 휴지통/임시/숨김 제외
 */
exports.getSummary = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `
      SELECT
        u.id   AS brand_id,
        u.name AS brand_name,
        mb.id  AS monthly_brand_id,
        mb.name AS monthly_brand_name,
        mb.year_month AS year_month,
        c.id   AS campaign_id,
        c.name AS campaign_name,
        COALESCE(SUM(
          NULLIF(REGEXP_REPLACE(COALESCE(b.amount, ''), '[^0-9]', '', 'g'), '')::bigint
        ), 0) AS total_amount,
        COALESCE(SUM(
          NULLIF(REGEXP_REPLACE(COALESCE(s.review_cost, ''), '[^0-9]', '', 'g'), '')::bigint
        ), 0) AS total_review_cost,
        COALESCE(SUM(CASE WHEN EXISTS (
          SELECT 1 FROM images i
          WHERE i.buyer_id = b.id AND i.status = 'approved' AND i.deleted_at IS NULL
        ) THEN NULLIF(REGEXP_REPLACE(COALESCE(b.amount, ''), '[^0-9]', '', 'g'), '')::bigint END), 0) AS submitted_amount,
        COALESCE(SUM(CASE WHEN EXISTS (
          SELECT 1 FROM images i
          WHERE i.buyer_id = b.id AND i.status = 'approved' AND i.deleted_at IS NULL
        ) THEN NULLIF(REGEXP_REPLACE(COALESCE(s.review_cost, ''), '[^0-9]', '', 'g'), '')::bigint END), 0) AS submitted_review_cost
      FROM users u
      JOIN monthly_brands mb
        ON mb.brand_id = u.id
       AND mb.deleted_at IS NULL
       AND COALESCE(mb.is_hidden, false) = false
      JOIN campaigns c
        ON c.monthly_brand_id = mb.id
       AND c.deleted_at IS NULL
       AND COALESCE(c.is_hidden, false) = false
      LEFT JOIN items i
        ON i.campaign_id = c.id
       AND i.deleted_at IS NULL
      LEFT JOIN item_slots s
        ON s.item_id = i.id
       AND s.deleted_at IS NULL
       AND COALESCE(s.is_suspended, false) = false
      LEFT JOIN buyers b
        ON b.id = s.buyer_id
       AND b.deleted_at IS NULL
       AND COALESCE(b.is_temporary, false) = false
      WHERE u.role = 'brand'
        AND COALESCE(u.is_active, true) = true
      GROUP BY u.id, u.name, mb.id, mb.name, mb.year_month, c.id, c.name
      ORDER BY u.name ASC, mb.year_month DESC NULLS LAST, mb.name ASC, c.id ASC;
      `,
      { type: sequelize.QueryTypes.SELECT }
    );

    // 평탄한 행 → 3단 계층 그룹핑
    const brandMap = new Map();

    for (const r of rows) {
      const totalAmount = Number(r.total_amount) || 0;
      const totalReviewCost = Number(r.total_review_cost) || 0;
      const submittedAmount = Number(r.submitted_amount) || 0;
      const submittedReviewCost = Number(r.submitted_review_cost) || 0;

      const campaign = {
        campaignId: r.campaign_id,
        campaignName: r.campaign_name,
        total: {
          amount: totalAmount,
          reviewCost: totalReviewCost,
          sum: totalAmount + totalReviewCost,
        },
        submitted: {
          amount: submittedAmount,
          reviewCost: submittedReviewCost,
          sum: submittedAmount + submittedReviewCost,
        },
      };

      if (!brandMap.has(r.brand_id)) {
        brandMap.set(r.brand_id, {
          brandId: r.brand_id,
          brandName: r.brand_name,
          monthlyBrands: new Map(),
        });
      }
      const brand = brandMap.get(r.brand_id);

      if (!brand.monthlyBrands.has(r.monthly_brand_id)) {
        brand.monthlyBrands.set(r.monthly_brand_id, {
          monthlyBrandId: r.monthly_brand_id,
          monthlyBrandName: r.monthly_brand_name,
          yearMonth: r.year_month,
          campaigns: [],
        });
      }
      brand.monthlyBrands.get(r.monthly_brand_id).campaigns.push(campaign);
    }

    const emptyBucket = () => ({ amount: 0, reviewCost: 0, sum: 0 });
    const addBucket = (dst, src) => {
      dst.amount += src.amount;
      dst.reviewCost += src.reviewCost;
      dst.sum += src.sum;
    };

    const brands = [];
    const grandTotal = { total: emptyBucket(), submitted: emptyBucket() };

    for (const brand of brandMap.values()) {
      const brandSubtotal = { total: emptyBucket(), submitted: emptyBucket() };
      const monthlyBrands = [];

      for (const mb of brand.monthlyBrands.values()) {
        const mbSubtotal = { total: emptyBucket(), submitted: emptyBucket() };
        for (const camp of mb.campaigns) {
          addBucket(mbSubtotal.total, camp.total);
          addBucket(mbSubtotal.submitted, camp.submitted);
        }
        addBucket(brandSubtotal.total, mbSubtotal.total);
        addBucket(brandSubtotal.submitted, mbSubtotal.submitted);

        monthlyBrands.push({
          monthlyBrandId: mb.monthlyBrandId,
          monthlyBrandName: mb.monthlyBrandName,
          yearMonth: mb.yearMonth,
          subtotal: mbSubtotal,
          campaigns: mb.campaigns,
        });
      }

      addBucket(grandTotal.total, brandSubtotal.total);
      addBucket(grandTotal.submitted, brandSubtotal.submitted);

      brands.push({
        brandId: brand.brandId,
        brandName: brand.brandName,
        subtotal: brandSubtotal,
        monthlyBrands,
      });
    }

    return res.json({
      success: true,
      data: { brands, grandTotal },
    });
  } catch (error) {
    console.error('getBrandSettlementSummary error:', error);
    return res.status(500).json({
      success: false,
      message: '브랜드 정산 요약 조회 실패',
    });
  }
};
