const { sequelize } = require('../models');

/**
 * Admin 브랜드/캠페인별 정산 요약
 * 브랜드사(User role=brand) > 연월브랜드 > 캠페인 3단 계층으로
 * 각 레벨에서 (전체 / 리뷰샷 제출분) 금액·리뷰비·결제금액(VAT)·수수료단가·구매자수 합산을 반환.
 *
 * - 금액: Buyer.amount (TEXT, 숫자만 추출)
 * - 리뷰비: ItemSlot.review_cost (TEXT, 숫자만 추출) — 슬롯당(=구매자당) 독립 값
 * - 결제 금액: 금액 × 1.1 (VAT 10%, 서버에서 round 후 누적)
 * - 수수료 단가: COALESCE(buyer.unit_price, slot.unit_price, item.unit_price) — 구매자별 합산
 * - 구매자 수: COUNT(DISTINCT buyer)
 * - 리뷰샷 제출 기준: images 테이블에 status='approved' 레코드 존재
 * - 휴지통/임시/숨김 제외
 */
exports.getSummary = async (req, res) => {
  try {
    // 30차: EXISTS 서브쿼리 3회 → 1회 LATERAL 평가로 통합
    // (buyer 단위에서 has_approved_image 한 번만 계산해 SUM/COUNT에 재사용)
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
        COALESCE(SUM(
          NULLIF(REGEXP_REPLACE(COALESCE(b.unit_price, s.unit_price, i.unit_price, ''), '[^0-9]', '', 'g'), '')::bigint
        ), 0) AS total_unit_price,
        COUNT(DISTINCT b.id) AS total_buyer_count,
        COALESCE(SUM(CASE WHEN bi.has_image
          THEN NULLIF(REGEXP_REPLACE(COALESCE(b.amount, ''), '[^0-9]', '', 'g'), '')::bigint END), 0) AS submitted_amount,
        COALESCE(SUM(CASE WHEN bi.has_image
          THEN NULLIF(REGEXP_REPLACE(COALESCE(s.review_cost, ''), '[^0-9]', '', 'g'), '')::bigint END), 0) AS submitted_review_cost,
        COUNT(DISTINCT CASE WHEN bi.has_image THEN b.id END) AS submitted_buyer_count
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
      LEFT JOIN LATERAL (
        SELECT EXISTS (
          SELECT 1 FROM images im
          WHERE im.buyer_id = b.id AND im.status = 'approved' AND im.deleted_at IS NULL
        ) AS has_image
      ) bi ON b.id IS NOT NULL
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
      const totalUnitPrice = Number(r.total_unit_price) || 0;
      const totalBuyerCount = Number(r.total_buyer_count) || 0;
      const submittedAmount = Number(r.submitted_amount) || 0;
      const submittedReviewCost = Number(r.submitted_review_cost) || 0;
      const submittedBuyerCount = Number(r.submitted_buyer_count) || 0;

      const campaign = {
        campaignId: r.campaign_id,
        campaignName: r.campaign_name,
        total: {
          amount: totalAmount,
          reviewCost: totalReviewCost,
          sum: totalAmount + totalReviewCost,
          paymentAmount: Math.round(totalAmount * 1.1),
          unitPrice: totalUnitPrice,
          buyerCount: totalBuyerCount,
        },
        submitted: {
          amount: submittedAmount,
          reviewCost: submittedReviewCost,
          sum: submittedAmount + submittedReviewCost,
          paymentAmount: Math.round(submittedAmount * 1.1),
          buyerCount: submittedBuyerCount,
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

    const emptyTotal = () => ({
      amount: 0, reviewCost: 0, sum: 0, paymentAmount: 0, unitPrice: 0, buyerCount: 0,
    });
    const emptySubmitted = () => ({
      amount: 0, reviewCost: 0, sum: 0, paymentAmount: 0, buyerCount: 0,
    });
    const emptyBuckets = () => ({ total: emptyTotal(), submitted: emptySubmitted() });
    const addBuckets = (dst, src) => {
      for (const k of Object.keys(dst.total)) dst.total[k] += src.total[k] || 0;
      for (const k of Object.keys(dst.submitted)) dst.submitted[k] += src.submitted[k] || 0;
    };

    const brands = [];
    const grandTotal = emptyBuckets();

    for (const brand of brandMap.values()) {
      const brandSubtotal = emptyBuckets();
      const monthlyBrands = [];

      for (const mb of brand.monthlyBrands.values()) {
        const mbSubtotal = emptyBuckets();
        for (const camp of mb.campaigns) {
          addBuckets(mbSubtotal, camp);
        }
        addBuckets(brandSubtotal, mbSubtotal);

        monthlyBrands.push({
          monthlyBrandId: mb.monthlyBrandId,
          monthlyBrandName: mb.monthlyBrandName,
          yearMonth: mb.yearMonth,
          subtotal: mbSubtotal,
          campaigns: mb.campaigns,
        });
      }

      addBuckets(grandTotal, brandSubtotal);

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

/**
 * Sales 전용 정산 요약 (제품 단위)
 * 본인이 created_by 인 캠페인의 제품들만 반환.
 * 응답에 브랜드별 distinct platforms / yearMonths 메타 포함하여 프론트 드롭다운 옵션 채움.
 */
exports.getSalesProductSummary = async (req, res) => {
  try {
    // admin 이 영업사 대신 보는 경우 viewAsUserId 지원
    const isAdmin = req.user.role === 'admin';
    const targetUserId = isAdmin && req.query.viewAsUserId
      ? Number(req.query.viewAsUserId)
      : req.user.id;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'userId 누락' });
    }

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
        i.id   AS product_id,
        i.product_name AS product_name,
        i.platform AS platform,
        COALESCE(SUM(
          NULLIF(REGEXP_REPLACE(COALESCE(b.amount, ''), '[^0-9]', '', 'g'), '')::bigint
        ), 0) AS total_amount,
        COALESCE(SUM(
          NULLIF(REGEXP_REPLACE(COALESCE(s.review_cost, ''), '[^0-9]', '', 'g'), '')::bigint
        ), 0) AS total_review_cost,
        COALESCE(SUM(
          NULLIF(REGEXP_REPLACE(COALESCE(b.unit_price, s.unit_price, i.unit_price, ''), '[^0-9]', '', 'g'), '')::bigint
        ), 0) AS total_unit_price,
        COUNT(DISTINCT b.id) AS total_buyer_count,
        COALESCE(SUM(CASE WHEN bi.has_image
          THEN NULLIF(REGEXP_REPLACE(COALESCE(b.amount, ''), '[^0-9]', '', 'g'), '')::bigint END), 0) AS submitted_amount,
        COALESCE(SUM(CASE WHEN bi.has_image
          THEN NULLIF(REGEXP_REPLACE(COALESCE(s.review_cost, ''), '[^0-9]', '', 'g'), '')::bigint END), 0) AS submitted_review_cost,
        COUNT(DISTINCT CASE WHEN bi.has_image THEN b.id END) AS submitted_buyer_count
      FROM users u
      JOIN monthly_brands mb
        ON mb.brand_id = u.id
       AND mb.deleted_at IS NULL
       AND COALESCE(mb.is_hidden, false) = false
      JOIN campaigns c
        ON c.monthly_brand_id = mb.id
       AND c.deleted_at IS NULL
       AND COALESCE(c.is_hidden, false) = false
       AND c.created_by = :userId
      JOIN items i
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
      LEFT JOIN LATERAL (
        SELECT EXISTS (
          SELECT 1 FROM images im
          WHERE im.buyer_id = b.id AND im.status = 'approved' AND im.deleted_at IS NULL
        ) AS has_image
      ) bi ON b.id IS NOT NULL
      WHERE u.role = 'brand'
        AND COALESCE(u.is_active, true) = true
      GROUP BY u.id, u.name, mb.id, mb.name, mb.year_month, c.id, c.name, i.id, i.product_name, i.platform
      ORDER BY u.name ASC, mb.year_month DESC NULLS LAST, mb.name ASC, c.id ASC, i.id ASC;
      `,
      {
        replacements: { userId: targetUserId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // 브랜드별 그룹 + 제품 평탄 리스트 + 드롭다운 메타
    const brandMap = new Map();

    for (const r of rows) {
      const totalAmount = Number(r.total_amount) || 0;
      const totalReviewCost = Number(r.total_review_cost) || 0;
      const totalUnitPrice = Number(r.total_unit_price) || 0;
      const totalBuyerCount = Number(r.total_buyer_count) || 0;
      const submittedAmount = Number(r.submitted_amount) || 0;
      const submittedReviewCost = Number(r.submitted_review_cost) || 0;
      const submittedBuyerCount = Number(r.submitted_buyer_count) || 0;

      const product = {
        productId: r.product_id,
        productName: r.product_name || '(제품명 없음)',
        platform: r.platform || '',
        campaignId: r.campaign_id,
        campaignName: r.campaign_name,
        monthlyBrandId: r.monthly_brand_id,
        monthlyBrandName: r.monthly_brand_name,
        yearMonth: r.year_month || '',
        total: {
          amount: totalAmount,
          reviewCost: totalReviewCost,
          sum: totalAmount + totalReviewCost,
          paymentAmount: Math.round(totalAmount * 1.1),
          unitPrice: totalUnitPrice,
          buyerCount: totalBuyerCount,
        },
        submitted: {
          amount: submittedAmount,
          reviewCost: submittedReviewCost,
          sum: submittedAmount + submittedReviewCost,
          paymentAmount: Math.round(submittedAmount * 1.1),
          buyerCount: submittedBuyerCount,
        },
      };

      if (!brandMap.has(r.brand_id)) {
        brandMap.set(r.brand_id, {
          brandId: r.brand_id,
          brandName: r.brand_name,
          products: [],
          platformsSet: new Set(),
          yearMonthsSet: new Set(),
        });
      }
      const brand = brandMap.get(r.brand_id);
      brand.products.push(product);
      if (product.platform) brand.platformsSet.add(product.platform);
      if (product.yearMonth) brand.yearMonthsSet.add(product.yearMonth);
    }

    const brands = [];
    for (const b of brandMap.values()) {
      brands.push({
        brandId: b.brandId,
        brandName: b.brandName,
        platforms: Array.from(b.platformsSet).sort(),
        yearMonths: Array.from(b.yearMonthsSet).sort().reverse(),
        products: b.products,
      });
    }

    return res.json({
      success: true,
      data: { brands },
    });
  } catch (error) {
    console.error('getSalesProductSummary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Sales 제품 정산 요약 조회 실패',
    });
  }
};
