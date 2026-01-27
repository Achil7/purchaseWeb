const { Estimate, User } = require('../models');
const { Op } = require('sequelize');
const { nowKST } = require('../utils/dateUtils');

// 견적서 목록 조회 (Admin 전용)
const getEstimates = async (req, res) => {
  try {
    const { year, month, company_name } = req.query;

    const where = {};

    // 날짜 필터
    if (year && month) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      where.estimate_date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      where.estimate_date = {
        [Op.between]: [startDate, endDate]
      };
    }

    // 회사명 필터
    if (company_name) {
      where.company_name = {
        [Op.iLike]: `%${company_name}%`
      };
    }

    const estimates = await Estimate.findAll({
      where,
      include: [{
        model: User,
        as: 'uploader',
        attributes: ['id', 'name', 'username']
      }],
      order: [['estimate_date', 'DESC'], ['created_at', 'DESC']]
    });

    res.json(estimates);
  } catch (error) {
    console.error('견적서 목록 조회 실패:', error);
    res.status(500).json({ message: '견적서 목록 조회 실패', error: error.message });
  }
};

// 견적서 상세 조회
const getEstimateById = async (req, res) => {
  try {
    const { id } = req.params;

    const estimate = await Estimate.findByPk(id, {
      include: [{
        model: User,
        as: 'uploader',
        attributes: ['id', 'name', 'username']
      }]
    });

    if (!estimate) {
      return res.status(404).json({ message: '견적서를 찾을 수 없습니다' });
    }

    res.json(estimate);
  } catch (error) {
    console.error('견적서 상세 조회 실패:', error);
    res.status(500).json({ message: '견적서 상세 조회 실패', error: error.message });
  }
};

// 견적서 생성
const createEstimate = async (req, res) => {
  try {
    const {
      file_name,
      company_name,
      company_contact,
      company_tel,
      company_email,
      agency_name,
      agency_representative,
      agency_tel,
      agency_email,
      category_review,
      category_product,
      category_delivery,
      category_other,
      supply_amount,
      vat_amount,
      total_amount,
      items,
      estimate_date,
      memo
    } = req.body;

    const estimate = await Estimate.create({
      file_name,
      company_name,
      company_contact,
      company_tel,
      company_email,
      agency_name,
      agency_representative,
      agency_tel,
      agency_email,
      category_review: category_review || 0,
      category_product: category_product || 0,
      category_delivery: category_delivery || 0,
      category_other: category_other || 0,
      supply_amount: supply_amount || 0,
      vat_amount: vat_amount || 0,
      total_amount: total_amount || 0,
      items_json: items ? JSON.stringify(items) : null,
      estimate_date,
      uploaded_by: req.user.id,
      memo
    });

    res.status(201).json(estimate);
  } catch (error) {
    console.error('견적서 생성 실패:', error);
    res.status(500).json({ message: '견적서 생성 실패', error: error.message });
  }
};

// 견적서 수정
const updateEstimate = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const estimate = await Estimate.findByPk(id);
    if (!estimate) {
      return res.status(404).json({ message: '견적서를 찾을 수 없습니다' });
    }

    // items를 JSON 문자열로 변환
    if (updateData.items) {
      updateData.items_json = JSON.stringify(updateData.items);
      delete updateData.items;
    }

    await estimate.update(updateData);
    res.json(estimate);
  } catch (error) {
    console.error('견적서 수정 실패:', error);
    res.status(500).json({ message: '견적서 수정 실패', error: error.message });
  }
};

// 견적서 삭제
const deleteEstimate = async (req, res) => {
  try {
    const { id } = req.params;

    const estimate = await Estimate.findByPk(id);
    if (!estimate) {
      return res.status(404).json({ message: '견적서를 찾을 수 없습니다' });
    }

    await estimate.destroy();
    res.json({ message: '견적서가 삭제되었습니다' });
  } catch (error) {
    console.error('견적서 삭제 실패:', error);
    res.status(500).json({ message: '견적서 삭제 실패', error: error.message });
  }
};

// 월별 견적서 요약
const getEstimateSummary = async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year || nowKST().getFullYear();

    const estimates = await Estimate.findAll({
      where: {
        estimate_date: {
          [Op.between]: [
            new Date(targetYear, 0, 1),
            new Date(targetYear, 11, 31)
          ]
        }
      },
      order: [['estimate_date', 'DESC']]
    });

    // 월별로 그룹화
    const monthlyData = {};
    estimates.forEach(est => {
      const date = new Date(est.estimate_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          estimates: [],
          totals: {
            review: 0,
            product: 0,
            delivery: 0,
            other: 0,
            supply: 0,
            vat: 0,
            total: 0
          }
        };
      }

      monthlyData[monthKey].estimates.push(est);
      monthlyData[monthKey].totals.review += parseFloat(est.category_review) || 0;
      monthlyData[monthKey].totals.product += parseFloat(est.category_product) || 0;
      monthlyData[monthKey].totals.delivery += parseFloat(est.category_delivery) || 0;
      monthlyData[monthKey].totals.other += parseFloat(est.category_other) || 0;
      monthlyData[monthKey].totals.supply += parseFloat(est.supply_amount) || 0;
      monthlyData[monthKey].totals.vat += parseFloat(est.vat_amount) || 0;
      monthlyData[monthKey].totals.total += parseFloat(est.total_amount) || 0;
    });

    res.json(Object.values(monthlyData).sort((a, b) => b.month.localeCompare(a.month)));
  } catch (error) {
    console.error('견적서 요약 조회 실패:', error);
    res.status(500).json({ message: '견적서 요약 조회 실패', error: error.message });
  }
};

module.exports = {
  getEstimates,
  getEstimateById,
  createEstimate,
  updateEstimate,
  deleteEstimate,
  getEstimateSummary
};
