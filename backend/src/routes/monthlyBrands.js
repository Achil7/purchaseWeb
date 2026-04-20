const express = require('express');
const router = express.Router();
const { MonthlyBrand, Campaign, Item, User, Buyer, Image, ItemSlot, CampaignOperator } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { Op } = require('sequelize');

/**
 * @route   GET /api/monthly-brands/my-brand
 * @desc    브랜드사용 - 자신의 브랜드에 연결된 연월브랜드 목록 조회
 * @access  Private (Brand, Admin)
 * @query   viewAsUserId - Admin인 경우 특정 브랜드사의 데이터 조회 가능
 */
router.get('/my-brand', authenticate, authorize(['brand', 'admin']), async (req, res) => {
  try {
    let brandUserId;

    // Admin인 경우 viewAsUserId로 조회
    if (req.user.role === 'admin') {
      if (req.query.viewAsUserId) {
        brandUserId = parseInt(req.query.viewAsUserId, 10);
      } else {
        return res.json({
          success: true,
          data: [],
          message: 'viewAsUserId가 필요합니다'
        });
      }
    } else {
      // 브랜드사는 자신의 ID 사용
      brandUserId = req.user.id;
    }

    const { sequelize } = require('../models');

    // ✅ Step 1: Buyer/Image 없이 기본 구조만 로드
    const monthlyBrands = await MonthlyBrand.findAll({
      where: {
        brand_id: brandUserId,
        is_hidden: false
      },
      include: [
        {
          model: User,
          as: 'brand',
          attributes: ['id', 'name', 'username']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'username']
        },
        {
          model: Campaign,
          as: 'campaigns',
          include: [
            {
              model: Item,
              as: 'items',
              attributes: ['id', 'product_name', 'shipping_type', 'courier_service_yn', 'product_price', 'status', 'total_purchase_count', 'daily_purchase_count', 'purchase_option', 'keyword', 'notes'],
              include: [
                {
                  model: ItemSlot,
                  as: 'slots',
                  attributes: ['id']
                }
              ]
            }
          ]
        }
      ],
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']]
    });

    // ✅ Step 2: 품목 ID 수집
    const allItemIds = [];
    monthlyBrands.forEach(mb => {
      (mb.campaigns || []).forEach(campaign => {
        (campaign.items || []).forEach(item => allItemIds.push(item.id));
      });
    });

    // ✅ Step 3: COUNT/SUM 쿼리로 통계만 조회 (객체 전체 로드 안 함)
    let buyerStatsMap = {};
    if (allItemIds.length > 0) {
      // 품목별 일반 구매자 수 + 금액 합계 + 리뷰 완료 수 + 이미지 수 (단일 raw SQL)
      const stats = await sequelize.query(`
        SELECT
          bc.item_id,
          bc.normal_count,
          bc.total_amount,
          COALESCE(rc.review_count, 0) AS review_count,
          COALESCE(rc.image_count, 0) AS image_count
        FROM (
          SELECT
            item_id,
            COUNT(id) AS normal_count,
            SUM(CASE
              WHEN REPLACE(amount, ',', '') ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN REPLACE(amount, ',', '')::NUMERIC
              ELSE 0
            END) AS total_amount
          FROM buyers
          WHERE item_id IN (:itemIds) AND is_temporary = false
          GROUP BY item_id
        ) bc
        LEFT JOIN (
          SELECT
            b.item_id,
            COUNT(DISTINCT b.id) AS review_count,
            COUNT(i.id) AS image_count
          FROM buyers b
          INNER JOIN images i ON i.buyer_id = b.id AND i.status = 'approved'
          WHERE b.item_id IN (:itemIds) AND b.is_temporary = false
          GROUP BY b.item_id
        ) rc ON bc.item_id = rc.item_id
      `, {
        replacements: { itemIds: allItemIds },
        type: sequelize.QueryTypes.SELECT
      });

      for (const stat of stats) {
        buyerStatsMap[stat.item_id] = {
          normalCount: parseInt(stat.normal_count, 10) || 0,
          totalAmount: parseFloat(stat.total_amount) || 0,
          reviewCount: parseInt(stat.review_count, 10) || 0,
          imageCount: parseInt(stat.image_count, 10) || 0
        };
      }
    }

    // ✅ Step 4: 통계 합쳐서 응답
    const result = monthlyBrands.map(mb => {
      const mbData = mb.toJSON();
      if (mbData.campaigns) {
        mbData.campaigns = mbData.campaigns.map(campaign => {
          if (campaign.items) {
            campaign.items = campaign.items.map(item => {
              const stats = buyerStatsMap[item.id] || { normalCount: 0, totalAmount: 0, reviewCount: 0, imageCount: 0 };
              return {
                ...item,
                normalBuyerCount: stats.normalCount,
                reviewCompletedCount: stats.reviewCount,
                totalImageCount: stats.imageCount,
                totalAmount: stats.totalAmount
              };
            });
          }
          return campaign;
        });
      }
      return mbData;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get brand monthly brands error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 목록 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   GET /api/monthly-brands/all
 * @desc    Admin 전용 - 모든 연월브랜드 목록 조회 (진행자 배정용)
 * @access  Private (Admin only)
 */
router.get('/all', authenticate, authorize(['admin']), async (req, res) => {
  try {
    // 24차 최적화: 4단계 JOIN → 분리 쿼리로 데카르트곱 제거
    // Step 1: MonthlyBrand + Campaign (Item/ItemSlot include 제거)
    const monthlyBrands = await MonthlyBrand.findAll({
      where: { is_hidden: false },
      include: [
        {
          model: User,
          as: 'brand',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name']
        },
        {
          model: Campaign,
          as: 'campaigns',
          where: { is_hidden: false },
          required: false,
          attributes: ['id', 'name', 'status', 'registered_at', 'created_at', 'created_by', 'monthly_brand_id', 'brand_id', 'description', 'start_date', 'end_date'],
          include: [
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      order: [
        ['sort_order', 'ASC'],
        ['created_at', 'ASC'],
        [{ model: Campaign, as: 'campaigns' }, 'name', 'ASC']
      ]
    });

    // Step 2: 모든 캠페인 ID 수집
    const allCampaignIds = monthlyBrands
      .flatMap(mb => (mb.campaigns || []).map(c => c.id))
      .filter(Boolean);

    if (allCampaignIds.length === 0) {
      return res.json({
        success: true,
        data: monthlyBrands.map(mb => mb.toJSON())
      });
    }

    // Step 3: Item 기본 정보를 별도 쿼리로 조회 (JOIN 없이)
    const items = await Item.findAll({
      where: { campaign_id: { [Op.in]: allCampaignIds } },
      attributes: ['id', 'campaign_id', 'product_name', 'daily_purchase_count'],
      raw: true
    });

    const allItemIds = items.map(i => i.id);

    // Step 4: Active day_group을 GROUP BY로 조회 (전체 슬롯 로드 대신)
    let activeDayGroupMap = new Map(); // key: item_id → Set of day_groups
    if (allItemIds.length > 0) {
      const activeDayGroups = await ItemSlot.findAll({
        attributes: ['item_id', 'day_group'],
        where: {
          item_id: { [Op.in]: allItemIds },
          is_suspended: false
        },
        group: ['item_id', 'day_group'],
        raw: true
      });

      activeDayGroups.forEach(row => {
        if (!activeDayGroupMap.has(row.item_id)) {
          activeDayGroupMap.set(row.item_id, new Set());
        }
        activeDayGroupMap.get(row.item_id).add(row.day_group);
      });
    }

    // Step 5: Item을 campaign_id별로 그룹화
    const itemsByCampaign = new Map();
    items.forEach(item => {
      if (!itemsByCampaign.has(item.campaign_id)) {
        itemsByCampaign.set(item.campaign_id, []);
      }
      itemsByCampaign.get(item.campaign_id).push(item);
    });

    // Step 6: 배정 상태를 단일 쿼리로 조회
    let assignmentMap = new Map();
    const assignmentCounts = await CampaignOperator.findAll({
      attributes: ['campaign_id', 'item_id', 'day_group'],
      where: {
        campaign_id: { [Op.in]: allCampaignIds }
      },
      group: ['campaign_id', 'item_id', 'day_group'],
      raw: true
    });

    assignmentCounts.forEach(row => {
      const key = `${row.campaign_id}_${row.item_id}_${row.day_group}`;
      assignmentMap.set(key, true);
    });

    // Step 7: 배정 상태 계산 (메모리에서 처리)
    const monthlyBrandsWithAssignment = monthlyBrands.map(mb => {
      const mbData = mb.toJSON();

      if (mbData.campaigns && mbData.campaigns.length > 0) {
        mbData.campaigns = mbData.campaigns.map(campaign => {
          const campaignItems = itemsByCampaign.get(campaign.id) || [];

          // 품목이 없으면 배정 완료로 간주
          if (campaignItems.length === 0) {
            return {
              ...campaign,
              items: [],
              isFullyAssigned: true,
              assignmentStatus: 'no_items'
            };
          }

          let totalRequiredSlots = 0;
          let assignedCount = 0;

          const itemsWithSlots = campaignItems.map(item => {
            const dayGroups = activeDayGroupMap.get(item.id) || new Set();
            totalRequiredSlots += dayGroups.size;

            for (const dayGroup of dayGroups) {
              const key = `${campaign.id}_${item.id}_${dayGroup}`;
              if (assignmentMap.has(key)) {
                assignedCount++;
              }
            }

            return {
              ...item,
              slots: [...dayGroups].map(dg => ({ day_group: dg, is_suspended: false }))
            };
          });

          const isFullyAssigned = assignedCount >= totalRequiredSlots;

          return {
            ...campaign,
            items: itemsWithSlots,
            isFullyAssigned,
            assignmentStatus: isFullyAssigned ? 'complete' : 'incomplete',
            totalRequiredSlots,
            assignedCount
          };
        });
      }

      return mbData;
    });

    res.json({
      success: true,
      data: monthlyBrandsWithAssignment
    });
  } catch (error) {
    console.error('Get all monthly brands error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 목록 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   GET /api/monthly-brands
 * @desc    연월브랜드 목록 조회
 * @access  Private (Sales, Admin)
 * @query   viewAsUserId - Admin인 경우 특정 영업사의 데이터 조회 가능
 *
 * 조회 기준:
 * - 자신이 생성한 연월브랜드 (MonthlyBrand.created_by)
 * - OR 자신이 담당하는 캠페인이 포함된 연월브랜드 (Campaign.created_by)
 */
router.get('/', authenticate, authorize(['sales', 'admin']), async (req, res) => {
  try {
    let salesId;

    // Admin인 경우 viewAsUserId 필수, 없으면 빈 데이터 반환
    if (req.user.role === 'admin') {
      if (req.query.viewAsUserId) {
        salesId = parseInt(req.query.viewAsUserId, 10);
      } else {
        // Admin이 viewAsUserId 없이 접근하면 빈 데이터 반환
        return res.json({
          success: true,
          data: [],
          message: 'viewAsUserId가 필요합니다'
        });
      }
    }
    // 영업사는 자신의 ID 사용
    else if (req.user.role === 'sales') {
      salesId = req.user.id;
    }

    // 1. 해당 영업사가 담당하는 캠페인이 속한 연월브랜드 ID 조회
    const campaignsWithMonthlyBrand = await Campaign.findAll({
      where: { created_by: salesId },
      attributes: ['monthly_brand_id'],
      raw: true
    });
    const monthlyBrandIdsFromCampaigns = campaignsWithMonthlyBrand
      .map(c => c.monthly_brand_id)
      .filter(id => id !== null);

    // 2. 해당 영업사가 생성한 연월브랜드 OR 담당 캠페인이 포함된 연월브랜드 조회
    const whereClause = {
      [Op.or]: [
        { created_by: salesId },
        ...(monthlyBrandIdsFromCampaigns.length > 0
          ? [{ id: { [Op.in]: monthlyBrandIdsFromCampaigns } }]
          : [])
      ]
    };

    // 26차: Include에서 Item+ItemSlot 제거 (4단계 JOIN → 2단계로 축소)
    const monthlyBrands = await MonthlyBrand.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'brand',
          attributes: ['id', 'name', 'username']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'username']
        },
        {
          model: Campaign,
          as: 'campaigns',
          where: { created_by: salesId },
          required: false,
          attributes: ['id', 'name', 'status', 'registered_at', 'created_at', 'created_by', 'monthly_brand_id', 'brand_id', 'description', 'start_date', 'end_date']
        }
      ],
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']]
    });

    // 캠페인이 없는 연월브랜드 필터링
    const filteredMonthlyBrands = monthlyBrands.filter(mb => {
      if (mb.created_by === salesId) return true;
      return mb.campaigns && mb.campaigns.length > 0;
    });

    // 캠페인 ID 수집
    const allCampaignIds = [];
    filteredMonthlyBrands.forEach(mb => {
      (mb.campaigns || []).forEach(c => allCampaignIds.push(c.id));
    });

    // 26차: Item + ItemSlot을 별도 쿼리로 조회 (JOIN 분리)
    let itemsByCampaign = {};
    let slotsByItem = {};
    if (allCampaignIds.length > 0) {
      const items = await Item.findAll({
        where: { campaign_id: { [Op.in]: allCampaignIds } },
        attributes: ['id', 'campaign_id', 'product_name', 'shipping_type', 'courier_service_yn', 'product_price', 'status', 'total_purchase_count', 'daily_purchase_count', 'purchase_option', 'keyword', 'notes'],
        raw: true
      });
      for (const item of items) {
        if (!itemsByCampaign[item.campaign_id]) itemsByCampaign[item.campaign_id] = [];
        itemsByCampaign[item.campaign_id].push(item);
      }

      const allItemIds = items.map(i => i.id);
      if (allItemIds.length > 0) {
        const slots = await ItemSlot.findAll({
          where: { item_id: { [Op.in]: allItemIds } },
          attributes: ['id', 'item_id', 'date', 'day_group'],
          raw: true
        });
        for (const slot of slots) {
          if (!slotsByItem[slot.item_id]) slotsByItem[slot.item_id] = [];
          slotsByItem[slot.item_id].push(slot);
        }
      }
    }

    // 전체 item ID 수집
    const allItemIds = Object.values(itemsByCampaign).flat().map(i => i.id);

    // 26차: 4개 통계 쿼리 → 1개 raw SQL 통합 (EXISTS 서브쿼리로 images JOIN 방지)
    let buyerStatsMap = {};
    let dayGroupBuyerStats = {};
    let dayGroupReviewStats = {};
    if (allItemIds.length > 0) {
      const sequelize = require('../models').sequelize;
      const placeholders = allItemIds.map((_, i) => `$${i + 1}`).join(',');
      const combinedStats = await sequelize.query(`
        SELECT
          s.item_id,
          s.day_group,
          COUNT(DISTINCT s.buyer_id) FILTER (WHERE b.is_temporary = false) AS normal_count,
          COUNT(DISTINCT s.buyer_id) FILTER (
            WHERE b.is_temporary = false
            AND EXISTS (SELECT 1 FROM images i WHERE i.buyer_id = b.id AND i.status = 'approved')
          ) AS review_count
        FROM item_slots s
        INNER JOIN buyers b ON b.id = s.buyer_id
        WHERE s.item_id IN (${placeholders})
          AND s.buyer_id IS NOT NULL
        GROUP BY s.item_id, s.day_group
      `, {
        bind: allItemIds,
        type: sequelize.QueryTypes.SELECT
      });

      for (const row of combinedStats) {
        const itemId = row.item_id;
        const dayGroup = row.day_group;
        const normalCount = parseInt(row.normal_count, 10) || 0;
        const reviewCount = parseInt(row.review_count, 10) || 0;

        if (!buyerStatsMap[itemId]) {
          buyerStatsMap[itemId] = { normalCount: 0, reviewCount: 0 };
        }
        buyerStatsMap[itemId].normalCount += normalCount;
        buyerStatsMap[itemId].reviewCount += reviewCount;

        if (!dayGroupBuyerStats[itemId]) dayGroupBuyerStats[itemId] = {};
        dayGroupBuyerStats[itemId][dayGroup] = normalCount;

        if (!dayGroupReviewStats[itemId]) dayGroupReviewStats[itemId] = {};
        dayGroupReviewStats[itemId][dayGroup] = reviewCount;
      }
    }

    // 각 품목별 emptyDateSlotCount + 구매자 통계 추가
    const processedMonthlyBrands = filteredMonthlyBrands.map(mb => {
      const mbData = mb.toJSON();
      if (mbData.campaigns) {
        mbData.campaigns = mbData.campaigns.map(campaign => {
          const items = itemsByCampaign[campaign.id] || [];
          campaign.items = items.map(item => {
            const stats = buyerStatsMap[item.id] || { normalCount: 0, reviewCount: 0 };
            const slots = slotsByItem[item.id] || [];
            const dayGroupSlotStats = {};
            for (const s of slots) {
              dayGroupSlotStats[s.day_group] = (dayGroupSlotStats[s.day_group] || 0) + 1;
            }
            return {
              ...item,
              slots,
              emptyDateSlotCount: slots.filter(s => !s.date || s.date.trim() === '').length,
              slotCount: slots.length,
              normalBuyerCount: stats.normalCount,
              reviewCompletedCount: stats.reviewCount,
              dayGroupBuyerStats: dayGroupBuyerStats[item.id] || {},
              dayGroupReviewStats: dayGroupReviewStats[item.id] || {},
              dayGroupSlotStats,
              dayGroupCount: new Set(slots.map(s => s.day_group)).size
            };
          });
          return campaign;
        });
      }
      return mbData;
    });

    res.json({
      success: true,
      data: processedMonthlyBrands
    });
  } catch (error) {
    console.error('Get monthly brands error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 목록 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   GET /api/monthly-brands/:id
 * @desc    연월브랜드 상세 조회
 * @access  Private (Sales, Admin)
 */
router.get('/:id', authenticate, authorize(['sales', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const monthlyBrand = await MonthlyBrand.findByPk(id, {
      include: [
        {
          model: User,
          as: 'brand',
          attributes: ['id', 'name', 'username']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'username']
        },
        {
          model: Campaign,
          as: 'campaigns',
          include: [
            {
              model: Item,
              as: 'items'
            }
          ]
        }
      ]
    });

    if (!monthlyBrand) {
      return res.status(404).json({
        success: false,
        message: '연월브랜드를 찾을 수 없습니다'
      });
    }

    // 영업사는 자신이 생성한 연월브랜드만 조회 가능
    if (req.user.role === 'sales' && monthlyBrand.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '접근 권한이 없습니다'
      });
    }

    res.json({
      success: true,
      data: monthlyBrand
    });
  } catch (error) {
    console.error('Get monthly brand error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   POST /api/monthly-brands
 * @desc    연월브랜드 생성
 * @access  Private (Sales, Admin)
 */
router.post('/', authenticate, authorize(['sales', 'admin']), async (req, res) => {
  try {
    const { name, brand_id, year_month, description, status } = req.body;

    // 필수 필드 검증
    if (!name || !brand_id) {
      return res.status(400).json({
        success: false,
        message: '필수 필드를 입력해주세요 (name, brand_id)'
      });
    }

    // 브랜드 존재 확인
    const brand = await User.findOne({
      where: { id: brand_id, role: 'brand' }
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: '해당 브랜드를 찾을 수 없습니다'
      });
    }

    // Admin이 viewAsUserId로 영업사 대신 생성하는 경우 처리
    let createdBy = req.user.id;
    if (req.user.role === 'admin' && req.query.viewAsUserId) {
      createdBy = parseInt(req.query.viewAsUserId, 10);
    }

    // 현재 해당 영업사의 최대 sort_order 조회
    const maxSortOrder = await MonthlyBrand.max('sort_order', {
      where: { created_by: createdBy }
    });
    const newSortOrder = (maxSortOrder || 0) + 1;

    // 연월브랜드 생성
    const monthlyBrand = await MonthlyBrand.create({
      name,
      brand_id,
      created_by: createdBy,
      year_month: year_month || null,
      description: description || null,
      status: status || 'active',
      sort_order: newSortOrder
    });

    // 생성된 연월브랜드 조회 (관계 포함)
    const createdMonthlyBrand = await MonthlyBrand.findByPk(monthlyBrand.id, {
      include: [
        {
          model: User,
          as: 'brand',
          attributes: ['id', 'name', 'username']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'username']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: '연월브랜드가 생성되었습니다',
      data: createdMonthlyBrand
    });
  } catch (error) {
    console.error('Create monthly brand error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 생성 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   PUT /api/monthly-brands/:id
 * @desc    연월브랜드 수정
 * @access  Private (Sales, Admin)
 */
router.put('/:id', authenticate, authorize(['sales', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, year_month, description, status } = req.body;

    const monthlyBrand = await MonthlyBrand.findByPk(id);

    if (!monthlyBrand) {
      return res.status(404).json({
        success: false,
        message: '연월브랜드를 찾을 수 없습니다'
      });
    }

    // 영업사는 자신이 생성한 연월브랜드만 수정 가능
    if (req.user.role === 'sales' && monthlyBrand.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '수정 권한이 없습니다'
      });
    }

    // 수정
    await monthlyBrand.update({
      name: name !== undefined ? name : monthlyBrand.name,
      year_month: year_month !== undefined ? year_month : monthlyBrand.year_month,
      description: description !== undefined ? description : monthlyBrand.description,
      status: status !== undefined ? status : monthlyBrand.status
    });

    // 수정된 연월브랜드 조회
    const updatedMonthlyBrand = await MonthlyBrand.findByPk(id, {
      include: [
        {
          model: User,
          as: 'brand',
          attributes: ['id', 'name', 'username']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'username']
        }
      ]
    });

    res.json({
      success: true,
      message: '연월브랜드가 수정되었습니다',
      data: updatedMonthlyBrand
    });
  } catch (error) {
    console.error('Update monthly brand error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 수정 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   PATCH /api/monthly-brands/:id/hide
 * @desc    연월브랜드 숨기기
 * @access  Private (Sales, Admin, Operator, Brand)
 */
router.patch('/:id/hide', authenticate, authorize(['sales', 'admin', 'operator', 'brand']), async (req, res) => {
  try {
    const { id } = req.params;

    const monthlyBrand = await MonthlyBrand.findByPk(id);

    if (!monthlyBrand) {
      return res.status(404).json({
        success: false,
        message: '연월브랜드를 찾을 수 없습니다'
      });
    }

    await monthlyBrand.update({ is_hidden: true });

    res.json({
      success: true,
      message: '연월브랜드가 숨겨졌습니다',
      data: monthlyBrand
    });
  } catch (error) {
    console.error('Hide monthly brand error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 숨기기 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   PATCH /api/monthly-brands/:id/restore
 * @desc    연월브랜드 복구
 * @access  Private (Sales, Admin, Operator, Brand)
 */
router.patch('/:id/restore', authenticate, authorize(['sales', 'admin', 'operator', 'brand']), async (req, res) => {
  try {
    const { id } = req.params;

    // paranoid: false로 soft-deleted 연월브랜드도 조회
    const monthlyBrand = await MonthlyBrand.findByPk(id, { paranoid: false });

    if (!monthlyBrand) {
      return res.status(404).json({
        success: false,
        message: '연월브랜드를 찾을 수 없습니다'
      });
    }

    // is_hidden과 deleted_at 모두 초기화하여 완전히 복원
    await monthlyBrand.update({ is_hidden: false, deleted_at: null });

    res.json({
      success: true,
      message: '연월브랜드가 복구되었습니다',
      data: monthlyBrand
    });
  } catch (error) {
    console.error('Restore monthly brand error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 복구 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   DELETE /api/monthly-brands/:id
 * @desc    연월브랜드 삭제
 * @access  Private (Sales, Admin)
 */
router.delete('/:id', authenticate, authorize(['sales', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const monthlyBrand = await MonthlyBrand.findByPk(id, {
      include: [{ model: Campaign, as: 'campaigns' }]
    });

    if (!monthlyBrand) {
      return res.status(404).json({
        success: false,
        message: '연월브랜드를 찾을 수 없습니다'
      });
    }

    // 영업사는 자신이 생성한 연월브랜드만 삭제 가능
    if (req.user.role === 'sales' && monthlyBrand.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '삭제 권한이 없습니다'
      });
    }

    // 캠페인이 있는 경우 경고
    if (monthlyBrand.campaigns && monthlyBrand.campaigns.length > 0) {
      return res.status(400).json({
        success: false,
        message: `해당 연월브랜드에 ${monthlyBrand.campaigns.length}개의 캠페인이 있습니다. 먼저 캠페인을 삭제해주세요.`
      });
    }

    await monthlyBrand.destroy();

    res.json({
      success: true,
      message: '연월브랜드가 삭제되었습니다'
    });
  } catch (error) {
    console.error('Delete monthly brand error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 삭제 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   DELETE /api/monthly-brands/:id/cascade
 * @desc    연월브랜드 강제 삭제 - 모든 관련 데이터 cascading delete
 * @access  Private (Admin, Sales - 자신의 연월브랜드, Operator - 배정받은 연월브랜드)
 */
router.delete('/:id/cascade', authenticate, authorize(['admin', 'sales', 'operator']), async (req, res) => {
  const sequelize = require('../models').sequelize;
  const { ItemSlot, CampaignOperator } = require('../models');

  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // 27차: include 전부 제거 - 권한 체크용 최소 필드만 조회
    const monthlyBrand = await MonthlyBrand.findByPk(id, {
      attributes: ['id', 'name', 'created_by'],
      transaction
    });

    if (!monthlyBrand) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '연월브랜드를 찾을 수 없습니다'
      });
    }

    // 캠페인 ID 목록 조회 (권한 체크 + 삭제용)
    const campaigns = await Campaign.findAll({
      where: { monthly_brand_id: id },
      attributes: ['id'],
      transaction,
      raw: true
    });
    const campaignIds = campaigns.map(c => c.id);

    // 권한 확인: admin은 모두 삭제 가능, sales는 자신이 만든 연월브랜드, operator는 배정받은 연월브랜드
    if (userRole !== 'admin') {
      if (userRole === 'sales' && monthlyBrand.created_by !== userId) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: '자신이 생성한 연월브랜드만 삭제할 수 있습니다'
        });
      }
      if (userRole === 'operator') {
        if (campaignIds.length > 0) {
          const isAssigned = await CampaignOperator.findOne({
            where: {
              campaign_id: campaignIds,
              operator_id: userId
            },
            transaction
          });
          if (!isAssigned) {
            await transaction.rollback();
            return res.status(403).json({
              success: false,
              message: '배정받은 연월브랜드만 삭제할 수 있습니다'
            });
          }
        } else {
          await transaction.rollback();
          return res.status(403).json({
            success: false,
            message: '배정받은 연월브랜드만 삭제할 수 있습니다'
          });
        }
      }
    }

    // 통계 수집
    let deletedStats = {
      campaigns: 0,
      items: 0,
      buyers: 0,
      images: 0,
      slots: 0,
      operators: 0
    };

    // 27차: raw SQL로 직접 삭제 (5단계 include + 중첩 루프 제거)
    if (campaignIds.length > 0) {
      // 1. images 삭제 (campaigns → items → buyers → images 경로)
      const [, imageCount] = await sequelize.query(`
        DELETE FROM images
        WHERE id IN (
          SELECT im.id FROM images im
          INNER JOIN buyers b ON im.buyer_id = b.id
          INNER JOIN items it ON b.item_id = it.id
          WHERE it.campaign_id IN (:campaignIds)
        )
      `, { replacements: { campaignIds }, transaction });
      deletedStats.images = imageCount.rowCount || 0;

      // 2. buyers 삭제
      const [, buyerCount] = await sequelize.query(`
        DELETE FROM buyers
        WHERE item_id IN (SELECT id FROM items WHERE campaign_id IN (:campaignIds))
      `, { replacements: { campaignIds }, transaction });
      deletedStats.buyers = buyerCount.rowCount || 0;

      // 3. item_slots 삭제
      const [, slotCount] = await sequelize.query(`
        DELETE FROM item_slots
        WHERE item_id IN (SELECT id FROM items WHERE campaign_id IN (:campaignIds))
      `, { replacements: { campaignIds }, transaction });
      deletedStats.slots = slotCount.rowCount || 0;

      // 4. items 삭제
      const [, itemCount] = await sequelize.query(`
        DELETE FROM items WHERE campaign_id IN (:campaignIds)
      `, { replacements: { campaignIds }, transaction });
      deletedStats.items = itemCount.rowCount || 0;

      // 5. campaign_operators 삭제
      const operatorCount = await CampaignOperator.destroy({
        where: { campaign_id: campaignIds },
        transaction
      });
      deletedStats.operators = operatorCount;

      // 6. campaigns 삭제
      const campaignCount = await Campaign.destroy({
        where: { id: campaignIds },
        transaction
      });
      deletedStats.campaigns = campaignCount;
    }

    // 7. 연월브랜드 삭제
    await monthlyBrand.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: '연월브랜드가 휴지통으로 이동되었습니다 (30일 후 영구 삭제)',
      data: {
        monthly_brand_name: monthlyBrand.name,
        deleted: deletedStats
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Delete monthly brand cascade error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 삭제 중 오류가 발생했습니다',
      error: error.message
    });
  }
});

/**
 * @route   PATCH /api/monthly-brands/reorder
 * @desc    연월브랜드 순서 변경 (영업사용 - created_by 기준)
 * @access  Private (Sales, Admin)
 * @body    { orderedIds: [id1, id2, ...] } - 순서대로 정렬된 연월브랜드 ID 배열
 */
router.patch('/reorder', authenticate, authorize(['sales', 'admin']), async (req, res) => {
  const sequelize = require('../models').sequelize;
  const transaction = await sequelize.transaction();

  try {
    const { orderedIds } = req.body;

    if (!orderedIds || !Array.isArray(orderedIds) || orderedIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'orderedIds 배열이 필요합니다'
      });
    }

    // 권한 확인: Admin은 viewAsUserId로 영업사 대신 변경 가능
    let targetUserId = req.user.id;
    if (req.user.role === 'admin' && req.query.viewAsUserId) {
      targetUserId = parseInt(req.query.viewAsUserId, 10);
    }

    // 해당 연월브랜드들이 모두 해당 사용자의 것인지 확인
    const monthlyBrands = await MonthlyBrand.findAll({
      where: {
        id: { [Op.in]: orderedIds },
        created_by: targetUserId
      },
      attributes: ['id']
    });

    if (monthlyBrands.length !== orderedIds.length) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: '권한이 없는 연월브랜드가 포함되어 있습니다'
      });
    }

    // 순서 업데이트
    for (let i = 0; i < orderedIds.length; i++) {
      await MonthlyBrand.update(
        { sort_order: i + 1 },
        {
          where: { id: orderedIds[i] },
          transaction
        }
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      message: '연월브랜드 순서가 변경되었습니다'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Reorder monthly brands error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 순서 변경 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   PATCH /api/monthly-brands/reorder-operator
 * @desc    연월브랜드 순서 변경 (진행자용 - 배정받은 연월브랜드 기준)
 * @access  Private (Operator, Admin)
 * @body    { orderedIds: [id1, id2, ...] } - 순서대로 정렬된 연월브랜드 ID 배열
 */
router.patch('/reorder-operator', authenticate, authorize(['operator', 'admin']), async (req, res) => {
  const sequelize = require('../models').sequelize;
  const transaction = await sequelize.transaction();

  try {
    const { orderedIds } = req.body;

    if (!orderedIds || !Array.isArray(orderedIds) || orderedIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'orderedIds 배열이 필요합니다'
      });
    }

    // 권한 확인: Admin은 viewAsUserId로 진행자 대신 변경 가능
    let targetUserId = req.user.id;
    if (req.user.role === 'admin' && req.query.viewAsUserId) {
      targetUserId = parseInt(req.query.viewAsUserId, 10);
    }

    // 해당 진행자가 배정받은 연월브랜드 ID 목록 조회
    const assignedMonthlyBrandIds = await CampaignOperator.findAll({
      where: { operator_id: targetUserId },
      include: [{
        model: Campaign,
        as: 'campaign',
        attributes: ['monthly_brand_id']
      }],
      attributes: [],
      raw: true,
      nest: true
    });

    const allowedMonthlyBrandIds = [...new Set(
      assignedMonthlyBrandIds
        .map(co => co.campaign?.monthly_brand_id)
        .filter(id => id != null)
    )];

    // 모든 orderedIds가 배정받은 연월브랜드인지 확인
    const invalidIds = orderedIds.filter(id => !allowedMonthlyBrandIds.includes(id));
    if (invalidIds.length > 0) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: '배정받지 않은 연월브랜드가 포함되어 있습니다'
      });
    }

    // 순서 업데이트
    for (let i = 0; i < orderedIds.length; i++) {
      await MonthlyBrand.update(
        { sort_order: i + 1 },
        {
          where: { id: orderedIds[i] },
          transaction
        }
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      message: '연월브랜드 순서가 변경되었습니다'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Reorder monthly brands (operator) error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 순서 변경 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   PATCH /api/monthly-brands/reorder-brand
 * @desc    연월브랜드 순서 변경 (브랜드사용 - brand_id 기준)
 * @access  Private (Brand, Admin)
 * @body    { orderedIds: [id1, id2, ...] } - 순서대로 정렬된 연월브랜드 ID 배열
 */
router.patch('/reorder-brand', authenticate, authorize(['brand', 'admin']), async (req, res) => {
  const sequelize = require('../models').sequelize;
  const transaction = await sequelize.transaction();

  try {
    const { orderedIds } = req.body;

    if (!orderedIds || !Array.isArray(orderedIds) || orderedIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'orderedIds 배열이 필요합니다'
      });
    }

    // 권한 확인: Admin은 viewAsUserId로 브랜드사 대신 변경 가능
    let targetUserId = req.user.id;
    if (req.user.role === 'admin' && req.query.viewAsUserId) {
      targetUserId = parseInt(req.query.viewAsUserId, 10);
    }

    // 해당 연월브랜드들이 모두 해당 브랜드사의 것인지 확인 (brand_id 기준)
    const monthlyBrands = await MonthlyBrand.findAll({
      where: {
        id: { [Op.in]: orderedIds },
        brand_id: targetUserId
      },
      attributes: ['id']
    });

    if (monthlyBrands.length !== orderedIds.length) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: '권한이 없는 연월브랜드가 포함되어 있습니다'
      });
    }

    // 순서 업데이트
    for (let i = 0; i < orderedIds.length; i++) {
      await MonthlyBrand.update(
        { sort_order: i + 1 },
        {
          where: { id: orderedIds[i] },
          transaction
        }
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      message: '연월브랜드 순서가 변경되었습니다'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Reorder monthly brands (brand) error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 순서 변경 중 오류가 발생했습니다'
    });
  }
});

module.exports = router;
