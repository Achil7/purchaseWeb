const { PlatformRanking, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { CATEGORIES } = require('../services/rankingTracker/categories');

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

    const latest = await PlatformRanking.findOne({
      where: { category_id: categoryId },
      attributes: ['collected_at'],
      order: [['collected_at', 'DESC']]
    });

    if (!latest) {
      return res.json({ success: true, data: { collected_at: null, rankings: [] } });
    }

    const rankings = await PlatformRanking.findAll({
      where: { category_id: categoryId, collected_at: latest.collected_at },
      order: [['rank', 'ASC']]
    });

    return res.json({
      success: true,
      data: {
        collected_at: latest.collected_at,
        rankings
      }
    });
  } catch (err) {
    console.error('getLatest error:', err);
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
async function getMyProductsRankings(req, res) {
  try {
    let brandId = null;
    if (req.user.role === 'brand') {
      brandId = req.user.id;
    } else if (req.user.role === 'admin') {
      const viewAsUserId = req.query.viewAsUserId ? parseInt(req.query.viewAsUserId, 10) : null;
      if (!viewAsUserId) {
        return res.status(400).json({ success: false, message: 'admin은 viewAsUserId가 필요합니다' });
      }
      const target = await User.findByPk(viewAsUserId, { attributes: ['id', 'role'] });
      if (!target || target.role !== 'brand') {
        return res.status(400).json({ success: false, message: '대상 사용자가 brand 역할이 아닙니다' });
      }
      brandId = target.id;
    } else {
      return res.status(403).json({ success: false, message: '접근 권한이 없습니다' });
    }

    // 자사 product_url 목록 (item_slots, items 모두에서)
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

    if (!rows || rows.length === 0) {
      return res.json({ success: true, data: { collected_at: null, products: [] } });
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
      attributes: ['category_id', 'category_name', 'rank', 'goods_no', 'product_name', 'product_url', 'image_url', 'price', 'collected_at'],
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
      if (!entry.image_url) entry.image_url = m.image_url;
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

    return res.json({
      success: true,
      data: {
        collected_at: latest.collected_at,
        products
      }
    });
  } catch (err) {
    console.error('getMyProductsRankings error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getCategories,
  getLatest,
  getMyProductsRankings
};
