const { Settlement, SettlementProduct, MarginSetting, sequelize } = require('../models');
const { Op } = require('sequelize');

// 정산 목록 조회
const getSettlements = async (req, res) => {
  try {
    const { month } = req.query;
    const where = {};
    if (month) where.month = month;

    const settlements = await Settlement.findAll({
      where,
      include: [{
        model: SettlementProduct,
        as: 'products',
        order: [['sort_order', 'ASC']]
      }],
      order: [['settlement_id', 'ASC'], ['id', 'ASC']]
    });

    res.json(settlements);
  } catch (error) {
    console.error('정산 목록 조회 실패:', error);
    res.status(500).json({ message: '정산 목록 조회 실패', error: error.message });
  }
};

// 정산 상세 조회
const getSettlementById = async (req, res) => {
  try {
    const settlement = await Settlement.findByPk(req.params.id, {
      include: [{
        model: SettlementProduct,
        as: 'products',
        order: [['sort_order', 'ASC']]
      }]
    });

    if (!settlement) {
      return res.status(404).json({ message: '정산 데이터를 찾을 수 없습니다' });
    }

    res.json(settlement);
  } catch (error) {
    console.error('정산 상세 조회 실패:', error);
    res.status(500).json({ message: '정산 상세 조회 실패', error: error.message });
  }
};

// 정산 생성
const createSettlement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { products, ...settlementData } = req.body;

    const settlement = await Settlement.create(settlementData, { transaction: t });

    if (products && products.length > 0) {
      const productRecords = products.map((p, idx) => ({
        ...p,
        settlement_id: settlement.id,
        sort_order: p.sort_order ?? idx
      }));
      await SettlementProduct.bulkCreate(productRecords, { transaction: t });
    }

    await t.commit();

    const result = await Settlement.findByPk(settlement.id, {
      include: [{ model: SettlementProduct, as: 'products' }]
    });
    res.status(201).json(result);
  } catch (error) {
    await t.rollback();
    console.error('정산 생성 실패:', error);
    res.status(500).json({ message: '정산 생성 실패', error: error.message });
  }
};

// 정산 일괄 생성 (견적서 → 정산 변환용)
const createSettlementsBulk = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { settlements } = req.body;
    if (!settlements || !Array.isArray(settlements)) {
      return res.status(400).json({ message: 'settlements 배열이 필요합니다' });
    }

    const created = [];
    for (const item of settlements) {
      const { products, ...settlementData } = item;
      const settlement = await Settlement.create(settlementData, { transaction: t });

      if (products && products.length > 0) {
        const productRecords = products.map((p, idx) => ({
          ...p,
          settlement_id: settlement.id,
          sort_order: p.sort_order ?? idx
        }));
        await SettlementProduct.bulkCreate(productRecords, { transaction: t });
      }
      created.push(settlement.id);
    }

    await t.commit();

    const results = await Settlement.findAll({
      where: { id: { [Op.in]: created } },
      include: [{ model: SettlementProduct, as: 'products' }]
    });
    res.status(201).json(results);
  } catch (error) {
    await t.rollback();
    console.error('정산 일괄 생성 실패:', error);
    res.status(500).json({ message: '정산 일괄 생성 실패', error: error.message });
  }
};

// 정산 수정
const updateSettlement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const settlement = await Settlement.findByPk(req.params.id);
    if (!settlement) {
      return res.status(404).json({ message: '정산 데이터를 찾을 수 없습니다' });
    }

    const { products, ...updateData } = req.body;
    await settlement.update(updateData, { transaction: t });

    // products가 전달되면 기존 삭제 후 재생성
    if (products !== undefined) {
      await SettlementProduct.destroy({
        where: { settlement_id: settlement.id },
        transaction: t
      });

      if (products && products.length > 0) {
        const productRecords = products.map((p, idx) => ({
          ...p,
          settlement_id: settlement.id,
          sort_order: p.sort_order ?? idx
        }));
        await SettlementProduct.bulkCreate(productRecords, { transaction: t });
      }
    }

    await t.commit();

    const result = await Settlement.findByPk(settlement.id, {
      include: [{ model: SettlementProduct, as: 'products' }]
    });
    res.json(result);
  } catch (error) {
    await t.rollback();
    console.error('정산 수정 실패:', error);
    res.status(500).json({ message: '정산 수정 실패', error: error.message });
  }
};

// 정산 삭제
const deleteSettlement = async (req, res) => {
  try {
    const settlement = await Settlement.findByPk(req.params.id);
    if (!settlement) {
      return res.status(404).json({ message: '정산 데이터를 찾을 수 없습니다' });
    }

    await settlement.destroy(); // CASCADE로 products도 삭제
    res.json({ message: '정산 데이터가 삭제되었습니다' });
  } catch (error) {
    console.error('정산 삭제 실패:', error);
    res.status(500).json({ message: '정산 삭제 실패', error: error.message });
  }
};

// 총정리 (Summary) 조회
const getSummary = async (req, res) => {
  try {
    const { month } = req.query;
    const where = {};
    if (month) where.month = month;

    const settlements = await Settlement.findAll({
      where,
      include: [{
        model: SettlementProduct,
        as: 'products'
      }],
      order: [['settlement_id', 'ASC']]
    });

    // 설정값 조회
    const deliverySetting = await MarginSetting.findOne({
      where: { key: 'delivery_cost_with_vat' }
    });
    const deliveryCostWithVat = parseFloat(deliverySetting?.value) || 2750;

    // 정산ID별 그룹핑 및 계산
    const bySettlementId = {};

    settlements.forEach(s => {
      const sid = s.settlement_id;
      if (!bySettlementId[sid]) {
        bySettlementId[sid] = {
          settlementId: sid,
          companyName: s.company_name,
          // 매출
          revProcessingFee: 0,
          revProcessingQty: 0,
          revDeliveryFee: 0,
          revDeliveryQty: 0,
          productTotalSupply: 0,
          // 지출
          expProcessingFee: 0,
        };
      }

      const group = bySettlementId[sid];
      const rpf = parseFloat(s.rev_processing_fee) || 0;
      const rpq = parseInt(s.rev_processing_qty) || 0;
      const rdf = parseFloat(s.rev_delivery_fee) || 0;
      const rdq = parseInt(s.rev_delivery_qty) || 0;
      const epf = parseFloat(s.exp_processing_fee) || 0;

      group.revProcessingFee = rpf;
      group.revProcessingQty = rpq;
      group.revDeliveryFee = rdf;
      group.revDeliveryQty = rdq;
      group.expProcessingFee = epf;

      // 제품비 합산
      if (s.products) {
        s.products.forEach(p => {
          const qty = parseInt(p.product_qty) || 0;
          const price = parseFloat(p.product_unit_price) || 0;
          group.productTotalSupply += qty * price;
        });
      }
    });

    // 각 그룹별 계산
    let totalRevenueSupply = 0;
    let totalExpense = 0;

    const summaryList = Object.values(bySettlementId).map(g => {
      const processingSupply = g.revProcessingFee * g.revProcessingQty;
      const deliverySupply = g.revDeliveryFee * g.revDeliveryQty;
      const revenueSupply = processingSupply + g.productTotalSupply + deliverySupply;
      const revenueWithVat = Math.round(revenueSupply * 1.1);

      const expProcessingTotal = g.expProcessingFee * g.revProcessingQty;
      const expDeliveryTotal = deliveryCostWithVat * g.revDeliveryQty;
      const expense = expProcessingTotal + g.productTotalSupply + expDeliveryTotal;
      const netMargin = revenueSupply - expense;

      totalRevenueSupply += revenueSupply;
      totalExpense += expense;

      return {
        settlementId: g.settlementId,
        companyName: g.companyName,
        revenueSupply: Math.round(revenueSupply),
        revenueWithVat,
        totalExpense: Math.round(expense),
        netMargin: Math.round(netMargin)
      };
    });

    const overview = {
      totalRevenueSupply: Math.round(totalRevenueSupply),
      totalRevenueWithVat: Math.round(totalRevenueSupply * 1.1),
      totalVat: Math.round(totalRevenueSupply * 0.1),
      totalExpense: Math.round(totalExpense),
      netMargin: Math.round(totalRevenueSupply - totalExpense)
    };

    res.json({
      overview,
      bySettlementId: summaryList,
      settings: { deliveryCostWithVat }
    });
  } catch (error) {
    console.error('총정리 조회 실패:', error);
    res.status(500).json({ message: '총정리 조회 실패', error: error.message });
  }
};

// 사용 가능한 월 목록 조회
const getAvailableMonths = async (req, res) => {
  try {
    const months = await Settlement.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('month')), 'month']],
      where: { month: { [Op.ne]: null } },
      order: [[sequelize.col('month'), 'DESC']],
      raw: true
    });
    res.json(months.map(m => m.month));
  } catch (error) {
    console.error('월 목록 조회 실패:', error);
    res.status(500).json({ message: '월 목록 조회 실패', error: error.message });
  }
};

// 설정값 조회
const getSettings = async (req, res) => {
  try {
    const settings = await MarginSetting.findAll();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json(result);
  } catch (error) {
    console.error('설정 조회 실패:', error);
    res.status(500).json({ message: '설정 조회 실패', error: error.message });
  }
};

// 설정값 수정
const updateSettings = async (req, res) => {
  try {
    const updates = req.body; // { key: value, ... }
    for (const [key, value] of Object.entries(updates)) {
      await MarginSetting.upsert({ key, value: String(value) });
    }
    const settings = await MarginSetting.findAll();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json(result);
  } catch (error) {
    console.error('설정 수정 실패:', error);
    res.status(500).json({ message: '설정 수정 실패', error: error.message });
  }
};

module.exports = {
  getSettlements,
  getSettlementById,
  createSettlement,
  createSettlementsBulk,
  updateSettlement,
  deleteSettlement,
  getSummary,
  getAvailableMonths,
  getSettings,
  updateSettings
};
