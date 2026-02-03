const { Item, Campaign, Buyer, Image, User, CampaignOperator, ItemSlot, MonthlyBrand, sequelize } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { notifyAllAdmins, createNotification } = require('./notificationController');

/**
 * 일 구매 건수 문자열 파싱 (예: "6/6" -> [6, 6], "1/3/4/2" -> [1, 3, 4, 2])
 * 숫자만 입력된 경우 단일 배열로 반환 (예: "20" -> [20])
 */
const parseDailyPurchaseCounts = (value) => {
  if (!value) return [];
  const strValue = String(value).replace(/[^0-9/]/g, '');
  if (!strValue) return [];
  // 슬래시가 있으면 분리, 없으면 단일 값
  if (strValue.includes('/')) {
    return strValue.split('/').filter(n => n).map(n => parseInt(n, 10));
  }
  return [parseInt(strValue, 10)];
};

/**
 * 전체 품목 목록 조회 (Admin용 - 진행자 배정을 위한)
 * day_group별 배정 정보 포함
 */
exports.getAllItems = async (req, res) => {
  try {
    const items = await Item.findAll({
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name', 'brand_id', 'created_by', 'registered_at'],
          include: [
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'name', 'username']
            },
            {
              model: User,
              as: 'brand',
              attributes: ['id', 'name']
            }
          ]
        },
        {
          model: CampaignOperator,
          as: 'operatorAssignments',
          include: [
            {
              model: User,
              as: 'operator',
              attributes: ['id', 'name', 'username']
            }
          ]
        },
        {
          model: ItemSlot,
          as: 'slots',
          attributes: ['id', 'day_group', 'slot_number'],
          separate: true
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // 각 품목에 고유한 day_group 목록 추가
    const itemsWithDayGroups = items.map(item => {
      const itemData = item.toJSON();
      // 슬롯에서 고유한 day_group 목록 추출 및 정렬
      const dayGroups = [...new Set(itemData.slots?.map(s => s.day_group).filter(d => d != null))].sort((a, b) => a - b);
      delete itemData.slots; // slots 원본 데이터는 제거
      return {
        ...itemData,
        dayGroups // day_group 목록 추가 (예: [1, 2, 3])
      };
    });

    res.json({
      success: true,
      data: itemsWithDayGroups,
      count: itemsWithDayGroups.length
    });
  } catch (error) {
    console.error('Get all items error:', error);
    res.status(500).json({
      success: false,
      message: '품목 목록 조회 실패',
      error: error.message
    });
  }
};

/**
 * Sales용 전체 품목 목록 조회 (자신이 생성한 캠페인의 품목만)
 */
exports.getItemsBySales = async (req, res) => {
  try {
    const salesId = req.user.id;

    // 자신이 생성한 캠페인들 조회
    const campaigns = await Campaign.findAll({
      where: { created_by: salesId },
      attributes: ['id']
    });

    const campaignIds = campaigns.map(c => c.id);

    if (campaignIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    const items = await Item.findAll({
      where: { campaign_id: { [Op.in]: campaignIds } },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name', 'brand_id', 'created_by', 'registered_at'],
          include: [
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'name', 'username']
            },
            {
              model: User,
              as: 'brand',
              attributes: ['id', 'name']
            }
          ]
        },
        {
          model: CampaignOperator,
          as: 'operatorAssignments',
          include: [
            {
              model: User,
              as: 'operator',
              attributes: ['id', 'name', 'username']
            }
          ]
        }
      ],
      order: [[{ model: Campaign, as: 'campaign' }, 'registered_at', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: items,
      count: items.length
    });
  } catch (error) {
    console.error('Get items by sales error:', error);
    res.status(500).json({
      success: false,
      message: '품목 목록 조회 실패',
      error: error.message
    });
  }
};

/**
 * Operator용 전체 품목 목록 조회 (배정된 품목만, 플랫 리스트)
 */
exports.getItemsByOperator = async (req, res) => {
  try {
    const operatorId = req.user.id;

    // 배정된 품목 ID들과 day_group 조회
    const assignments = await CampaignOperator.findAll({
      where: { operator_id: operatorId },
      attributes: ['item_id', 'day_group']
    });

    const itemIds = [...new Set(assignments.map(a => a.item_id).filter(Boolean))];

    if (itemIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // 품목별 배정된 day_groups 매핑
    const itemDayGroupMap = {};
    for (const a of assignments) {
      if (a.item_id) {
        if (!itemDayGroupMap[a.item_id]) {
          itemDayGroupMap[a.item_id] = [];
        }
        if (a.day_group !== null) {
          itemDayGroupMap[a.item_id].push(a.day_group);
        }
      }
    }

    const items = await Item.findAll({
      where: { id: { [Op.in]: itemIds } },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name', 'brand_id', 'created_by', 'registered_at'],
          include: [
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'name', 'username']
            },
            {
              model: User,
              as: 'brand',
              attributes: ['id', 'name']
            }
          ]
        },
        {
          model: CampaignOperator,
          as: 'operatorAssignments',
          include: [
            {
              model: User,
              as: 'operator',
              attributes: ['id', 'name', 'username']
            }
          ]
        }
      ],
      order: [[{ model: Campaign, as: 'campaign' }, 'registered_at', 'DESC'], ['created_at', 'DESC']]
    });

    // 각 품목에 배정된 day_groups 정보 추가
    const itemsWithDayGroups = items.map(item => {
      const itemData = item.toJSON();
      itemData.assignedDayGroups = itemDayGroupMap[item.id] || [];
      return itemData;
    });

    res.json({
      success: true,
      data: itemsWithDayGroups,
      count: itemsWithDayGroups.length
    });
  } catch (error) {
    console.error('Get items by operator error:', error);
    res.status(500).json({
      success: false,
      message: '품목 목록 조회 실패',
      error: error.message
    });
  }
};

/**
 * 품목에 진행자 배정 (day_group 단위 지원)
 * @body operator_id - 진행자 ID
 * @body day_group - 일자 그룹 번호 (선택, null이면 전체 품목 배정)
 */
exports.assignOperatorToItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { operator_id, day_group: rawDayGroup } = req.body;
    const assigned_by = req.user?.id;

    // day_group을 정수로 변환 (null, undefined, '' 처리)
    // NaN 체크도 추가
    let day_group = null;
    if (rawDayGroup !== null && rawDayGroup !== undefined && rawDayGroup !== '') {
      const parsed = parseInt(rawDayGroup, 10);
      if (!isNaN(parsed)) {
        day_group = parsed;
      }
    }

    console.log('[assignOperatorToItem] Request:', {
      itemId: id,
      operator_id,
      rawDayGroup,
      rawDayGroupType: typeof rawDayGroup,
      day_group,
      day_group_type: typeof day_group,
      assigned_by
    });

    // 품목 존재 확인
    const item = await Item.findByPk(id, {
      include: [{ model: Campaign, as: 'campaign' }]
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: '품목을 찾을 수 없습니다'
      });
    }

    // 진행자 존재 및 역할 확인
    const operator = await User.findByPk(operator_id);
    if (!operator || operator.role !== 'operator') {
      return res.status(400).json({
        success: false,
        message: '유효한 진행자가 아닙니다'
      });
    }

    // 디버그: 해당 품목의 모든 배정 정보 조회
    const allAssignmentsForItem = await CampaignOperator.findAll({
      where: { item_id: id },
      attributes: ['id', 'item_id', 'operator_id', 'day_group']
    });
    console.log('[assignOperatorToItem] All assignments for item:', JSON.stringify(allAssignmentsForItem.map(a => ({
      id: a.id,
      item_id: a.item_id,
      operator_id: a.operator_id,
      day_group: a.day_group,
      day_group_type: typeof a.day_group
    }))));

    // 중요: 같은 진행자가 같은 품목의 "정확히 같은 day_group"에 이미 배정되어 있는지 확인
    // day_group이 null인 경우도 정확히 비교해야 함
    let existingAssignment;
    if (day_group === null) {
      existingAssignment = await CampaignOperator.findOne({
        where: {
          item_id: id,
          operator_id,
          day_group: { [Op.is]: null }
        }
      });
    } else {
      existingAssignment = await CampaignOperator.findOne({
        where: {
          item_id: id,
          operator_id,
          day_group: day_group
        }
      });
    }

    console.log('[assignOperatorToItem] Check existing same operator on same day_group:', {
      item_id: id,
      operator_id,
      day_group,
      day_group_type: typeof day_group,
      found: !!existingAssignment,
      existingId: existingAssignment?.id,
      existingDayGroup: existingAssignment?.day_group
    });

    if (existingAssignment) {
      console.log('[assignOperatorToItem] Already assigned:', existingAssignment.id, 'with day_group:', existingAssignment.day_group);
      return res.status(400).json({
        success: false,
        message: `해당 ${day_group}일차에 이미 같은 진행자가 배정되어 있습니다 (기존 day_group: ${existingAssignment.day_group})`
      });
    }

    // 해당 day_group에 다른 진행자가 이미 배정되어 있는지 확인
    let existingOtherAssignment;
    if (day_group === null) {
      existingOtherAssignment = await CampaignOperator.findOne({
        where: {
          item_id: id,
          day_group: { [Op.is]: null },
          operator_id: { [Op.ne]: operator_id }
        }
      });
    } else {
      existingOtherAssignment = await CampaignOperator.findOne({
        where: {
          item_id: id,
          day_group: day_group,
          operator_id: { [Op.ne]: operator_id }
        }
      });
    }

    console.log('[assignOperatorToItem] Check other operator on same day_group:', {
      item_id: id,
      day_group,
      found: !!existingOtherAssignment,
      otherOperatorId: existingOtherAssignment?.operator_id
    });

    if (existingOtherAssignment) {
      console.log('[assignOperatorToItem] Day group already has another operator:', existingOtherAssignment.operator_id);
      return res.status(400).json({
        success: false,
        message: `해당 ${day_group || '전체'}일차에 이미 다른 진행자가 배정되어 있습니다. 재배정을 선택해주세요.`
      });
    }

    console.log('[assignOperatorToItem] Creating assignment...', {
      campaign_id: item.campaign_id,
      item_id: id,
      operator_id,
      day_group
    });

    // 배정 생성
    await CampaignOperator.create({
      campaign_id: item.campaign_id,
      item_id: id,
      operator_id,
      assigned_by,
      day_group
    });

    // 브랜드 정보 조회 (알림용)
    const brand = await User.findByPk(item.campaign.brand_id, { attributes: ['name'] });
    const brandName = brand ? brand.name : '알 수 없음';

    // 진행자에게 알림 생성
    const dayGroupText = day_group ? ` (${day_group}일차)` : '';
    try {
      await createNotification(
        operator_id,
        'operator_assigned',
        '품목 배정',
        `${brandName}의 "${item.campaign.name}"의 "${item.product_name}"${dayGroupText}을 배정받았습니다. 작업을 진행해주세요.`,
        'item',
        item.id
      );
    } catch (notifyError) {
      console.error('Notification error:', notifyError);
    }

    res.json({
      success: true,
      message: '진행자가 배정되었습니다'
    });
  } catch (error) {
    console.error('Assign operator error:', error);

    // 유니크 제약조건 위반 에러 체크
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: '해당 일차에 이미 같은 진행자가 배정되어 있습니다'
      });
    }

    res.status(500).json({
      success: false,
      message: '진행자 배정 실패: ' + (error.message || '알 수 없는 오류'),
      error: error.message
    });
  }
};

/**
 * 진행자에게 배정된 품목 목록 조회 (Operator용)
 */
exports.getMyAssignedItems = async (req, res) => {
  try {
    const operatorId = req.user.id;

    // 진행자에게 배정된 품목들을 캠페인별로 그룹화 (Buyer 제외 - 성능 최적화)
    const assignments = await CampaignOperator.findAll({
      where: { operator_id: operatorId },
      include: [
        {
          model: Item,
          as: 'item',
          attributes: ['id', 'product_name', 'status', 'keyword']
        },
        {
          model: Campaign,
          as: 'campaign',
          include: [
            {
              model: User,
              as: 'brand',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      order: [['assigned_at', 'DESC']]
    });

    // 품목 ID들 수집
    const itemIds = [...new Set(assignments.map(a => a.item_id).filter(Boolean))];

    // 구매자 통계 별도 조회 (COUNT만)
    let buyerStats = {};
    if (itemIds.length > 0) {
      const stats = await Buyer.findAll({
        where: { item_id: { [Op.in]: itemIds } },
        attributes: [
          'item_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_count'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN is_temporary = true THEN 1 ELSE 0 END")), 'temp_count'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN is_temporary = false THEN 1 ELSE 0 END")), 'normal_count']
        ],
        group: ['item_id'],
        raw: true
      });

      for (const stat of stats) {
        buyerStats[stat.item_id] = {
          totalCount: parseInt(stat.total_count, 10) || 0,
          tempCount: parseInt(stat.temp_count, 10) || 0,
          normalCount: parseInt(stat.normal_count, 10) || 0
        };
      }
    }

    // 캠페인별로 그룹화
    const campaignMap = new Map();
    const itemDayGroupMap = {};

    for (const assignment of assignments) {
      const campaignId = assignment.campaign_id;

      if (!campaignMap.has(campaignId)) {
        campaignMap.set(campaignId, {
          id: campaignId,
          name: assignment.campaign?.name,
          brand: assignment.campaign?.brand?.name,
          status: assignment.campaign?.status,
          items: []
        });
      }

      // day_group 매핑 수집
      if (assignment.item_id) {
        if (!itemDayGroupMap[assignment.item_id]) {
          itemDayGroupMap[assignment.item_id] = [];
        }
        if (assignment.day_group !== null) {
          itemDayGroupMap[assignment.item_id].push(assignment.day_group);
        }
      }

      if (assignment.item) {
        const existingItem = campaignMap.get(campaignId).items.find(i => i.id === assignment.item.id);
        if (existingItem) {
          continue;
        }

        const stats = buyerStats[assignment.item.id] || { totalCount: 0, tempCount: 0, normalCount: 0 };

        campaignMap.get(campaignId).items.push({
          id: assignment.item.id,
          product_name: assignment.item.product_name,
          status: assignment.item.status,
          keyword: assignment.item.keyword,
          buyerCount: stats.totalCount,
          normalBuyerCount: stats.normalCount,
          tempBuyerCount: stats.tempCount,
          assigned_at: assignment.assigned_at,
          assignedDayGroups: []
        });
      }
    }

    for (const campaign of campaignMap.values()) {
      for (const item of campaign.items) {
        item.assignedDayGroups = itemDayGroupMap[item.id] || [];
      }
    }

    const campaigns = Array.from(campaignMap.values());

    res.json({
      success: true,
      data: campaigns,
      count: campaigns.length
    });
  } catch (error) {
    console.error('Get assigned items error:', error);
    res.status(500).json({
      success: false,
      message: '배정된 품목 조회 실패',
      error: error.message
    });
  }
};

/**
 * 진행자에게 배정된 연월브랜드 목록 조회 (Operator용 - SalesLayout과 동일한 구조)
 * Admin은 viewAsUserId 쿼리 파라미터로 특정 진행자의 데이터 조회 가능
 */
exports.getMyMonthlyBrands = async (req, res) => {
  try {
    // Admin인 경우 viewAsUserId 필수, 없으면 빈 데이터 반환
    let operatorId;
    if (req.user.role === 'admin') {
      if (req.query.viewAsUserId) {
        operatorId = parseInt(req.query.viewAsUserId, 10);
      } else {
        // Admin이 viewAsUserId 없이 접근하면 빈 데이터 반환
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: 'viewAsUserId가 필요합니다'
        });
      }
    } else {
      // 일반 진행자는 자신에게 배정된 것만
      operatorId = req.user.id;
    }

    // 진행자에게 배정된 품목들 조회 (buyers/images 제외 - 성능 최적화)
    const assignments = await CampaignOperator.findAll({
      where: { operator_id: operatorId },
      include: [
        {
          model: Item,
          as: 'item',
          attributes: ['id', 'product_name', 'status', 'keyword', 'total_purchase_count', 'courier_service_yn'],
          include: [
            {
              model: ItemSlot,
              as: 'slots',
              attributes: ['id', 'date', 'day_group']
            }
          ]
        },
        {
          model: Campaign,
          as: 'campaign',
          include: [
            {
              model: User,
              as: 'brand',
              attributes: ['id', 'name']
            },
            {
              model: MonthlyBrand,
              as: 'monthlyBrand',
              attributes: ['id', 'name', 'year_month', 'is_hidden']
            }
          ]
        }
      ],
      order: [['assigned_at', 'DESC']]
    });

    // 품목별 구매자 통계를 별도 쿼리로 조회 (COUNT만 - 훨씬 가벼움)
    const itemIds = [...new Set(assignments.map(a => a.item?.id).filter(Boolean))];

    let buyerStats = {};
    if (itemIds.length > 0) {
      const stats = await Buyer.findAll({
        where: { item_id: itemIds },
        attributes: [
          'item_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_count'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN is_temporary = true THEN 1 ELSE 0 END")), 'temp_count'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN is_temporary = false THEN 1 ELSE 0 END")), 'normal_count']
        ],
        group: ['item_id'],
        raw: true
      });

      // 리뷰 완료 수 (이미지가 있는 구매자) - 별도 쿼리
      const reviewStats = await Buyer.findAll({
        where: {
          item_id: itemIds,
          is_temporary: false
        },
        include: [{
          model: Image,
          as: 'images',
          attributes: [],
          required: true  // INNER JOIN - 이미지 있는 것만
        }],
        attributes: [
          'item_id',
          [sequelize.fn('COUNT', sequelize.literal('DISTINCT "Buyer"."id"')), 'review_count']
        ],
        group: ['Buyer.item_id'],
        raw: true
      });

      // 통계 매핑
      for (const stat of stats) {
        buyerStats[stat.item_id] = {
          totalCount: parseInt(stat.total_count, 10) || 0,
          tempCount: parseInt(stat.temp_count, 10) || 0,
          normalCount: parseInt(stat.normal_count, 10) || 0,
          reviewCount: 0
        };
      }

      for (const stat of reviewStats) {
        if (buyerStats[stat.item_id]) {
          buyerStats[stat.item_id].reviewCount = parseInt(stat.review_count, 10) || 0;
        }
      }
    }

    // 연월브랜드별로 그룹화
    const monthlyBrandMap = new Map();

    for (const assignment of assignments) {
      if (!assignment.item || !assignment.campaign) continue;

      const campaign = assignment.campaign;
      const monthlyBrand = campaign.monthlyBrand;

      // 연월브랜드가 없는 경우 "미분류" 그룹
      const mbId = monthlyBrand?.id || 0;
      const mbName = monthlyBrand?.name || '미분류';
      const mbYearMonth = monthlyBrand?.year_month || null;
      const mbIsHidden = monthlyBrand?.is_hidden || false;

      if (!monthlyBrandMap.has(mbId)) {
        monthlyBrandMap.set(mbId, {
          id: mbId,
          name: mbName,
          year_month: mbYearMonth,
          is_hidden: mbIsHidden,
          campaigns: new Map()
        });
      }

      const mb = monthlyBrandMap.get(mbId);

      // 캠페인 그룹화
      if (!mb.campaigns.has(campaign.id)) {
        mb.campaigns.set(campaign.id, {
          id: campaign.id,
          name: campaign.name,
          brand: campaign.brand?.name,
          status: campaign.status,
          is_hidden: campaign.is_hidden || false,
          items: []
        });
      }

      const item = assignment.item;
      // 구매자 통계는 미리 조회한 데이터 사용
      const stats = buyerStats[item.id] || { totalCount: 0, tempCount: 0, normalCount: 0, reviewCount: 0 };

      // 배정된 day_group의 슬롯만 필터링 (day_group이 null이면 전체 품목 배정)
      const assignedDayGroup = assignment.day_group;
      const assignedSlots = (item.slots || []).filter(s =>
        assignedDayGroup === null || s.day_group === assignedDayGroup
      );

      // 날짜가 비어있는 슬롯 수 계산 (배정된 day_group 기준)
      const emptyDateSlotCount = assignedSlots.filter(s => !s.date || s.date.trim() === '').length;

      mb.campaigns.get(campaign.id).items.push({
        id: item.id,
        product_name: item.product_name,
        status: item.status,
        keyword: item.keyword,
        buyerCount: stats.totalCount,
        normalBuyerCount: stats.normalCount,
        tempBuyerCount: stats.tempCount,
        reviewCompletedCount: stats.reviewCount,
        totalPurchaseCount: assignedSlots.length,
        courier_service_yn: item.courier_service_yn,
        assigned_at: assignment.assigned_at,
        emptyDateSlotCount  // 날짜 비어있는 슬롯 수 (배정된 day_group 기준)
      });
    }

    // Map을 배열로 변환
    const result = Array.from(monthlyBrandMap.values()).map(mb => ({
      ...mb,
      campaigns: Array.from(mb.campaigns.values())
    }));

    // 연월브랜드명으로 정렬 (최신 연월이 위로)
    result.sort((a, b) => {
      if (a.id === 0) return 1; // 미분류는 맨 아래
      if (b.id === 0) return -1;
      return (b.year_month || '').localeCompare(a.year_month || '');
    });

    res.json({
      success: true,
      data: result,
      count: result.length
    });
  } catch (error) {
    console.error('Get my monthly brands error:', error);
    res.status(500).json({
      success: false,
      message: '연월브랜드 조회 실패',
      error: error.message
    });
  }
};

/**
 * 진행자에게 배정된 품목 중 선 업로드가 있는 품목 조회 (Operator용 - 알림용)
 */
exports.getMyPreUploads = async (req, res) => {
  try {
    const operatorId = req.user.id;

    // 진행자에게 배정된 품목들 조회
    const assignments = await CampaignOperator.findAll({
      where: { operator_id: operatorId },
      include: [
        {
          model: Item,
          as: 'item',
          include: [
            {
              model: Buyer,
              as: 'buyers',
              where: { is_temporary: true },
              required: true // INNER JOIN - 임시 구매자가 있는 품목만
            }
          ]
        },
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name']
        }
      ]
    });

    // 선 업로드 정보 리스트 생성
    const preUploads = [];

    for (const assignment of assignments) {
      if (assignment.item && assignment.item.buyers?.length > 0) {
        preUploads.push({
          campaignId: assignment.campaign_id,
          campaignName: assignment.campaign?.name,
          itemId: assignment.item.id,
          itemName: assignment.item.product_name,
          preUploadCount: assignment.item.buyers.length
        });
      }
    }

    // 총 선 업로드 건수
    const totalCount = preUploads.reduce((sum, item) => sum + item.preUploadCount, 0);

    res.json({
      success: true,
      data: preUploads,
      totalCount
    });
  } catch (error) {
    console.error('Get pre-uploads error:', error);
    res.status(500).json({
      success: false,
      message: '선 업로드 조회 실패',
      error: error.message
    });
  }
};

/**
 * 품목의 진행자 재배정 (day_group 단위 지원)
 * @body operator_id - 새 진행자 ID
 * @body day_group - 일자 그룹 번호 (선택, null이면 전체 품목 재배정)
 */
exports.reassignOperatorToItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { operator_id, day_group } = req.body;
    const assigned_by = req.user?.id;

    // 품목 존재 확인
    const item = await Item.findByPk(id, {
      include: [{ model: Campaign, as: 'campaign' }]
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: '품목을 찾을 수 없습니다'
      });
    }

    // 진행자 존재 및 역할 확인
    const operator = await User.findByPk(operator_id);
    if (!operator || operator.role !== 'operator') {
      return res.status(400).json({
        success: false,
        message: '유효한 진행자가 아닙니다'
      });
    }

    // 기존 배정 삭제 (day_group 기준)
    const deleteWhere = { item_id: id };
    if (day_group !== undefined && day_group !== null) {
      deleteWhere.day_group = day_group;
    }
    await CampaignOperator.destroy({
      where: deleteWhere
    });

    // 새 진행자 배정
    await CampaignOperator.create({
      campaign_id: item.campaign_id,
      item_id: id,
      operator_id,
      assigned_by,
      day_group: day_group !== undefined ? day_group : null
    });

    res.json({
      success: true,
      message: '진행자가 재배정되었습니다'
    });
  } catch (error) {
    console.error('Reassign operator error:', error);
    res.status(500).json({
      success: false,
      message: '진행자 재배정 실패',
      error: error.message
    });
  }
};

/**
 * 품목에서 진행자 배정 해제 (day_group 단위 지원)
 * @param operatorId - 진행자 ID
 * @query day_group - 일자 그룹 번호 (선택)
 */
exports.unassignOperatorFromItem = async (req, res) => {
  try {
    const { id, operatorId } = req.params;
    const { day_group } = req.query;

    const whereClause = {
      item_id: id,
      operator_id: operatorId
    };

    // day_group이 있으면 해당 그룹만 해제
    if (day_group !== undefined && day_group !== null && day_group !== '') {
      whereClause.day_group = parseInt(day_group);
    }

    const assignment = await CampaignOperator.findOne({
      where: whereClause
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: '배정 정보를 찾을 수 없습니다'
      });
    }

    await assignment.destroy();

    res.json({
      success: true,
      message: '진행자 배정이 해제되었습니다'
    });
  } catch (error) {
    console.error('Unassign operator error:', error);
    res.status(500).json({
      success: false,
      message: '진행자 배정 해제 실패',
      error: error.message
    });
  }
};

/**
 * 토큰으로 품목 조회 (Public - 이미지 업로드 페이지용)
 */
exports.getItemByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const item = await Item.findOne({
      where: { upload_link_token: token },
      attributes: ['id', 'product_name', 'campaign_id'],
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name', 'brand_id'],
          include: [
            {
              model: User,
              as: 'brand',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: '유효하지 않은 업로드 링크입니다'
      });
    }

    res.json({
      success: true,
      data: {
        item_id: item.id,
        product_name: item.product_name,
        campaign_name: item.campaign?.name || '캠페인',
        brand_name: item.campaign?.brand?.name || ''
      }
    });
  } catch (error) {
    console.error('Get item by token error:', error);
    res.status(500).json({
      success: false,
      message: '품목 조회 실패',
      error: error.message
    });
  }
};

/**
 * 캠페인의 품목 목록 조회
 */
exports.getItemsByCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;

    // 1단계: 품목 기본 정보 조회 (Buyer 제외 - 성능 최적화)
    const items = await Item.findAll({
      where: { campaign_id: campaignId },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name']
        },
        {
          model: CampaignOperator,
          as: 'operatorAssignments',
          attributes: ['id', 'operator_id', 'day_group', 'assigned_at'],
          include: [
            {
              model: User,
              as: 'operator',
              attributes: ['id', 'name', 'username']
            }
          ]
        },
        {
          model: ItemSlot,
          as: 'slots',
          attributes: ['id', 'day_group', 'date', 'slot_number'],
          separate: true,
          order: [['slot_number', 'ASC']]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // 2단계: 구매자 통계 별도 조회 (COUNT만)
    const itemIds = items.map(i => i.id);
    let buyerStats = {};

    if (itemIds.length > 0) {
      const stats = await Buyer.findAll({
        where: { item_id: { [Op.in]: itemIds } },
        attributes: [
          'item_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_count'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN is_temporary = true THEN 1 ELSE 0 END")), 'temp_count'],
          [sequelize.fn('SUM', sequelize.literal("CASE WHEN is_temporary = false THEN 1 ELSE 0 END")), 'normal_count']
        ],
        group: ['item_id'],
        raw: true
      });

      for (const stat of stats) {
        buyerStats[stat.item_id] = {
          totalCount: parseInt(stat.total_count, 10) || 0,
          tempCount: parseInt(stat.temp_count, 10) || 0,
          normalCount: parseInt(stat.normal_count, 10) || 0
        };
      }
    }

    // 각 품목에 day_group 목록 및 구매자 통계 추가
    const itemsWithDayGroups = items.map(item => {
      const itemData = item.toJSON();
      const slots = itemData.slots || [];
      const stats = buyerStats[item.id] || { totalCount: 0, tempCount: 0, normalCount: 0 };

      const dayGroups = [...new Set(slots.map(s => s.day_group).filter(d => d != null))].sort((a, b) => a - b);

      const dayGroupDates = {};
      dayGroups.forEach(dayGroup => {
        const firstSlot = slots
          .filter(s => s.day_group === dayGroup)
          .sort((a, b) => a.slot_number - b.slot_number)[0];
        dayGroupDates[dayGroup] = firstSlot?.date || null;
      });

      delete itemData.slots;
      return {
        ...itemData,
        dayGroups,
        dayGroupDates,
        buyers: [], // 빈 배열 (기존 호환성 유지)
        buyerCount: stats.totalCount,
        normalBuyerCount: stats.normalCount,
        tempBuyerCount: stats.tempCount
      };
    });

    res.json({
      success: true,
      data: itemsWithDayGroups,
      count: itemsWithDayGroups.length
    });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({
      success: false,
      message: '품목 목록 조회 실패',
      error: error.message
    });
  }
};

/**
 * 품목 상세 조회
 */
exports.getItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findByPk(id, {
      include: [
        {
          model: Campaign,
          as: 'campaign'
        },
        {
          model: Buyer,
          as: 'buyers'
        }
      ]
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: '품목을 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({
      success: false,
      message: '품목 조회 실패',
      error: error.message
    });
  }
};

/**
 * 품목 생성
 */
exports.createItem = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const {
      product_name,
      shipping_type,
      keyword,
      total_purchase_count,
      daily_purchase_count,
      product_url,
      purchase_option,
      product_price,
      shipping_deadline,
      review_guide,
      courier_service_yn,
      notes,
      platform
    } = req.body;

    // 캠페인 존재 확인
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: '캠페인을 찾을 수 없습니다'
      });
    }

    const item = await Item.create({
      campaign_id: campaignId,
      product_name,
      shipping_type,
      keyword,
      total_purchase_count,
      daily_purchase_count,
      product_url,
      purchase_option,
      product_price,
      shipping_deadline,
      review_guide,
      courier_service_yn,
      notes,
      platform
    });

    // ItemSlot 자동 생성 (total_purchase_count 개수만큼)
    // 일 구매건수 기준으로 day_group 설정, 그룹별로 upload_link_token 생성
    // 일 구매건수가 슬래시로 구분된 경우 (예: "6/6", "1/3/4/2") 파싱하여 처리
    // 일 구매건수가 빈 값이면 총 구매건수와 동일하게 처리 (day_group 1개로 생성)
    const slotCount = parseInt(total_purchase_count, 10) || 0;  // TEXT를 숫자로 파싱
    let dailyCounts = parseDailyPurchaseCounts(daily_purchase_count);

    // 일 구매건수가 없으면 총 구매건수를 하나의 그룹으로 처리
    if (dailyCounts.length === 0 && slotCount > 0) {
      dailyCounts = [slotCount];
    }

    if (slotCount > 0) {
      const slots = [];
      let slotNumber = 1;

      if (dailyCounts.length > 0) {
        // 슬래시 구분 방식: 각 day_group별로 지정된 건수만큼 슬롯 생성
        for (let dayGroup = 0; dayGroup < dailyCounts.length; dayGroup++) {
          const groupCount = dailyCounts[dayGroup];
          const groupToken = uuidv4();

          for (let i = 0; i < groupCount && slotNumber <= slotCount; i++) {
            slots.push({
              item_id: item.id,
              slot_number: slotNumber,
              product_name: product_name,
              purchase_option: purchase_option,
              keyword: keyword,
              product_price: product_price,
              notes: notes,
              status: 'active',
              day_group: dayGroup + 1,
              upload_link_token: groupToken
            });
            slotNumber++;
          }
        }
      } else {
        // 일 구매건수가 없으면 전체를 하나의 그룹으로
        const groupToken = uuidv4();
        for (let i = 1; i <= slotCount; i++) {
          slots.push({
            item_id: item.id,
            slot_number: i,
            product_name: product_name,
            purchase_option: purchase_option,
            keyword: keyword,
            product_price: product_price,
            notes: notes,
            status: 'active',
            day_group: 1,
            upload_link_token: groupToken
          });
        }
      }

      await ItemSlot.bulkCreate(slots);
    }

    // 영업사 정보 조회 (알림용)
    const creator = await User.findByPk(campaign.created_by, { attributes: ['name'] });
    const creatorName = creator ? creator.name : '알 수 없음';

    // 모든 Admin에게 알림 생성 (품목 추가 시 해당 캠페인/품목으로 이동 가능)
    try {
      await notifyAllAdmins(
        'item_created',
        '품목 추가',
        `${creatorName}님이 "${campaign.name}"의 "${product_name}"을 등록하였습니다. 진행자를 배정해주세요.`,
        'item',
        item.id
      );
    } catch (notifyError) {
      console.error('Notification error:', notifyError);
      // 알림 실패해도 품목 생성은 성공으로 처리
    }

    res.status(201).json({
      success: true,
      message: '품목이 생성되었습니다',
      data: item
    });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({
      success: false,
      message: '품목 생성 실패',
      error: error.message
    });
  }
};

/**
 * 품목 일괄 생성 (여러 품목 동시 추가)
 */
exports.createItemsBulk = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '품목 목록이 필요합니다'
      });
    }

    // 캠페인 존재 확인
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: '캠페인을 찾을 수 없습니다'
      });
    }

    // 품목들 일괄 생성
    const createdItems = [];
    for (const itemData of items) {
      const item = await Item.create({
        campaign_id: campaignId,
        product_name: itemData.product_name,
        shipping_type: itemData.shipping_type,
        keyword: itemData.keyword,
        total_purchase_count: itemData.total_purchase_count,
        daily_purchase_count: itemData.daily_purchase_count,
        product_url: itemData.product_url,
        purchase_option: itemData.purchase_option,
        product_price: itemData.product_price,
        shipping_deadline: itemData.shipping_deadline,
        review_guide: itemData.review_guide,
        courier_service_yn: itemData.courier_service_yn,
        notes: itemData.notes,
        platform: itemData.platform
      });

      // ItemSlot 자동 생성 (total_purchase_count 개수만큼)
      // 일 구매건수 슬래시 구분 방식으로 day_group 설정, 그룹별로 upload_link_token 생성
      // 일 구매건수가 빈 값이면 총 구매건수와 동일하게 처리 (day_group 1개로 생성)
      const slotCount = parseInt(itemData.total_purchase_count, 10) || 0;  // TEXT를 숫자로 파싱
      if (slotCount > 0) {
        const slots = [];
        let slotNumber = 1;

        // 슬래시 구분 방식으로 일 구매건수 파싱 (예: "6/6" -> [6, 6], "1/3/4/2" -> [1, 3, 4, 2])
        let dailyCounts = parseDailyPurchaseCounts(itemData.daily_purchase_count);

        // 일 구매건수가 없으면 총 구매건수를 하나의 그룹으로 처리
        if (dailyCounts.length === 0) {
          dailyCounts = [slotCount];
        }

        if (dailyCounts.length > 0) {
          // 슬래시 구분 방식: 각 day_group별로 지정된 건수만큼 슬롯 생성
          for (let dayGroup = 0; dayGroup < dailyCounts.length; dayGroup++) {
            const groupCount = dailyCounts[dayGroup];
            const groupToken = uuidv4();

            for (let i = 0; i < groupCount && slotNumber <= slotCount; i++) {
              slots.push({
                item_id: item.id,
                slot_number: slotNumber,
                product_name: itemData.product_name,
                purchase_option: itemData.purchase_option,
                keyword: itemData.keyword,
                product_price: itemData.product_price,
                notes: itemData.notes,
                status: 'active',
                day_group: dayGroup + 1,
                upload_link_token: groupToken
              });
              slotNumber++;
            }
          }
        } else {
          // 일 구매건수가 없으면 모두 day_group 1로 생성
          const groupToken = uuidv4();
          for (let i = 1; i <= slotCount; i++) {
            slots.push({
              item_id: item.id,
              slot_number: i,
              product_name: itemData.product_name,
              purchase_option: itemData.purchase_option,
              keyword: itemData.keyword,
              product_price: itemData.product_price,
              notes: itemData.notes,
              status: 'active',
              day_group: 1,
              upload_link_token: groupToken
            });
          }
        }

        await ItemSlot.bulkCreate(slots);
      }

      createdItems.push(item);
    }

    // 영업사 정보 조회 (알림용)
    const creator = await User.findByPk(campaign.created_by, { attributes: ['name'] });
    const creatorName = creator ? creator.name : '알 수 없음';

    // 모든 Admin에게 알림 생성
    try {
      const productNames = createdItems.map(i => i.product_name).slice(0, 3).join(', ');
      const moreCount = createdItems.length > 3 ? ` 외 ${createdItems.length - 3}개` : '';
      await notifyAllAdmins(
        'item_created',
        '품목 일괄 추가',
        `${creatorName}님이 "${campaign.name}"에 ${createdItems.length}개 품목(${productNames}${moreCount})을 등록하였습니다. 진행자를 배정해주세요.`,
        'campaign',
        campaignId
      );
    } catch (notifyError) {
      console.error('Notification error:', notifyError);
    }

    res.status(201).json({
      success: true,
      message: `${createdItems.length}개 품목이 생성되었습니다`,
      data: createdItems,
      count: createdItems.length
    });
  } catch (error) {
    console.error('Create items bulk error:', error);
    res.status(500).json({
      success: false,
      message: '품목 일괄 생성 실패',
      error: error.message
    });
  }
};

/**
 * 품목 수정
 */
exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findByPk(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '품목을 찾을 수 없습니다'
      });
    }

    await item.update(req.body);

    res.json({
      success: true,
      message: '품목이 수정되었습니다',
      data: item
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({
      success: false,
      message: '품목 수정 실패',
      error: error.message
    });
  }
};

/**
 * 품목 삭제
 */
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findByPk(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '품목을 찾을 수 없습니다'
      });
    }

    await item.destroy();

    res.json({
      success: true,
      message: '품목이 삭제되었습니다'
    });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({
      success: false,
      message: '품목 삭제 실패',
      error: error.message
    });
  }
};

/**
 * 품목 입금명 수정 (Operator, Admin)
 */
exports.updateDepositName = async (req, res) => {
  try {
    const { id } = req.params;
    const { deposit_name } = req.body;

    const item = await Item.findByPk(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '품목을 찾을 수 없습니다'
      });
    }

    await item.update({ deposit_name });

    res.json({
      success: true,
      message: '입금명이 업데이트되었습니다',
      data: item
    });
  } catch (error) {
    console.error('Update deposit name error:', error);
    res.status(500).json({
      success: false,
      message: '입금명 수정 실패',
      error: error.message
    });
  }
};

/**
 * 브랜드별 품목 목록 조회 (Brand용 - 캠페인 없이 품목 직접 표시)
 */
exports.getItemsByBrand = async (req, res) => {
  try {
    const brandId = req.user.id;

    // 해당 브랜드의 모든 캠페인 조회
    const campaigns = await Campaign.findAll({
      where: { brand_id: brandId },
      attributes: ['id']
    });

    const campaignIds = campaigns.map(c => c.id);

    if (campaignIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // 해당 캠페인들의 모든 품목 조회 (등록일 기준 내림차순 정렬)
    const items = await Item.findAll({
      where: { campaign_id: { [Op.in]: campaignIds } },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name', 'registered_at', 'status'],
          include: [
            {
              model: User,
              as: 'brand',
              attributes: ['id', 'name']
            }
          ]
        },
        {
          model: Buyer,
          as: 'buyers',
          attributes: ['id', 'payment_status']
        }
      ],
      order: [
        [{ model: Campaign, as: 'campaign' }, 'registered_at', 'DESC'],
        ['created_at', 'DESC']
      ]
    });

    // 응답 데이터 가공
    const itemsWithStats = items.map(item => {
      const buyers = item.buyers || [];
      const completedCount = buyers.filter(b => b.payment_status === 'confirmed').length;

      return {
        id: item.id,
        product_name: item.product_name,
        status: item.status,
        total_purchase_count: item.total_purchase_count,
        completed_count: completedCount,
        buyer_count: buyers.length,
        registered_at: item.campaign?.registered_at,
        campaign_id: item.campaign_id,
        campaign_name: item.campaign?.name,
        campaign_status: item.campaign?.status
      };
    });

    res.json({
      success: true,
      data: itemsWithStats,
      count: itemsWithStats.length
    });
  } catch (error) {
    console.error('Get items by brand error:', error);
    res.status(500).json({
      success: false,
      message: '품목 목록 조회 실패',
      error: error.message
    });
  }
};
