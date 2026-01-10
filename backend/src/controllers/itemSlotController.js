const { ItemSlot, Item, Buyer, CampaignOperator, Campaign, User, Image } = require('../models');
const { Op } = require('sequelize');
const { normalizeAccountNumber } = require('../utils/accountNormalizer');

/**
 * 품목별 슬롯 목록 조회
 */
exports.getSlotsByItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    // 품목 존재 확인
    const item = await Item.findByPk(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '품목을 찾을 수 없습니다'
      });
    }

    const slots = await ItemSlot.findAll({
      where: { item_id: itemId },
      include: [
        {
          model: Buyer,
          as: 'buyer',
          attributes: ['id', 'buyer_name', 'order_number', 'payment_status']
        }
      ],
      order: [['slot_number', 'ASC']]
    });

    res.json({
      success: true,
      data: slots,
      count: slots.length,
      item: {
        id: item.id,
        product_name: item.product_name,
        total_purchase_count: item.total_purchase_count,
        daily_purchase_count: item.daily_purchase_count
      }
    });
  } catch (error) {
    console.error('Get slots by item error:', error);
    res.status(500).json({
      success: false,
      message: '슬롯 목록 조회 실패',
      error: error.message
    });
  }
};

/**
 * 슬롯 개별 수정
 */
exports.updateSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const slot = await ItemSlot.findByPk(id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: '슬롯을 찾을 수 없습니다'
      });
    }

    // 업데이트 가능한 필드만 필터링 (ItemSlot 모델 기준)
    const allowedFields = ['date', 'product_name', 'purchase_option', 'keyword', 'product_price', 'notes', 'status', 'buyer_id', 'expected_buyer', 'review_cost', 'day_group'];
    const filteredData = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    await slot.update(filteredData);

    // 업데이트된 슬롯 다시 조회 (buyer 포함)
    const updatedSlot = await ItemSlot.findByPk(id, {
      include: [
        {
          model: Buyer,
          as: 'buyer',
          attributes: ['id', 'buyer_name', 'order_number', 'payment_status']
        }
      ]
    });

    res.json({
      success: true,
      message: '슬롯이 수정되었습니다',
      data: updatedSlot
    });
  } catch (error) {
    console.error('Update slot error:', error);
    res.status(500).json({
      success: false,
      message: '슬롯 수정 실패',
      error: error.message
    });
  }
};

/**
 * 다중 슬롯 일괄 수정 (드래그 복사용 + 구매자 정보 붙여넣기)
 * - 구매자 정보가 포함된 경우 Buyer 생성/수정 후 슬롯에 연결
 */
exports.updateSlotsBulk = async (req, res) => {
  try {
    const { slots } = req.body;
    const userId = req.user?.id;

    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({
        success: false,
        message: '슬롯 목록이 필요합니다'
      });
    }

    // 슬롯 필드 (ItemSlot 모델 기준)
    const slotFields = ['date', 'product_name', 'purchase_option', 'keyword', 'product_price', 'notes', 'status', 'buyer_id', 'expected_buyer', 'review_cost', 'day_group'];
    // 구매자 필드 (Buyer 모델 기준)
    const buyerFields = ['order_number', 'buyer_name', 'recipient_name', 'user_id', 'contact', 'address', 'account_info', 'amount', 'shipping_delayed', 'tracking_number', 'courier_company', 'payment_status'];

    const results = [];
    for (const slotData of slots) {
      if (!slotData.id) continue;

      const slot = await ItemSlot.findByPk(slotData.id);
      if (!slot) continue;

      // 슬롯 데이터 필터링
      const slotUpdateData = {};
      for (const field of slotFields) {
        if (slotData[field] !== undefined) {
          slotUpdateData[field] = slotData[field];
        }
      }

      // 구매자 데이터 필터링
      const buyerData = {};
      let hasBuyerData = false;
      for (const field of buyerFields) {
        if (slotData[field] !== undefined && slotData[field] !== '') {
          buyerData[field] = slotData[field];
          hasBuyerData = true;
        }
      }

      // 구매자 정보가 있으면 Buyer 생성/수정
      if (hasBuyerData) {
        // 기존 buyer가 있으면 수정, 없으면 생성
        if (slot.buyer_id) {
          const existingBuyer = await Buyer.findByPk(slot.buyer_id);
          if (existingBuyer) {
            // account_info가 변경되면 account_normalized도 재계산
            if (buyerData.account_info !== undefined) {
              buyerData.account_normalized = normalizeAccountNumber(buyerData.account_info);
            }
            await existingBuyer.update(buyerData);
          }
        } else {
          // 새 Buyer 생성
          const newBuyer = await Buyer.create({
            item_id: slot.item_id,
            order_number: buyerData.order_number || '',
            buyer_name: buyerData.buyer_name || '',
            recipient_name: buyerData.recipient_name || buyerData.buyer_name || '',
            user_id: buyerData.user_id || null,
            contact: buyerData.contact || null,
            address: buyerData.address || null,
            account_info: buyerData.account_info || null,
            account_normalized: normalizeAccountNumber(buyerData.account_info),
            amount: buyerData.amount ? parseInt(String(buyerData.amount).replace(/[^0-9]/g, '')) || 0 : 0,
            shipping_delayed: buyerData.shipping_delayed || false,
            tracking_number: buyerData.tracking_number || null,
            courier_company: buyerData.courier_company || null,
            created_by: userId
          });
          slotUpdateData.buyer_id = newBuyer.id;
        }
      }

      // 슬롯 업데이트
      if (Object.keys(slotUpdateData).length > 0) {
        await slot.update(slotUpdateData);
      }
      results.push(slot);
    }

    res.json({
      success: true,
      message: `${results.length}개 슬롯이 수정되었습니다`,
      count: results.length
    });
  } catch (error) {
    console.error('Update slots bulk error:', error);
    res.status(500).json({
      success: false,
      message: '슬롯 일괄 수정 실패',
      error: error.message
    });
  }
};

/**
 * 캠페인별 전체 슬롯 조회 (SalesItemSheet용 및 BrandItemSheet용)
 * - viewAsRole='brand'인 경우 구매자 이미지 포함
 */
exports.getSlotsByCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { viewAsRole } = req.query;
    const isBrandView = viewAsRole === 'brand';

    // 캠페인의 모든 품목 조회
    const items = await Item.findAll({
      where: { campaign_id: campaignId },
      attributes: ['id', 'product_name', 'total_purchase_count', 'daily_purchase_count', 'shipping_type', 'courier_service_yn', 'product_url'],
      order: [['created_at', 'ASC']]
    });

    if (items.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    const itemIds = items.map(i => i.id);

    // 구매자 include 옵션
    // Brand 뷰: 제한된 필드 (주소, 연락처, 계좌 제외)
    // Sales 뷰: 모든 필드 + 이미지 (진행자와 동일하게 연동)
    const buyerInclude = {
      model: Buyer,
      as: 'buyer',
      attributes: isBrandView
        ? ['id', 'buyer_name', 'recipient_name', 'order_number', 'user_id', 'amount', 'payment_status', 'is_temporary', 'tracking_number']
        : ['id', 'order_number', 'buyer_name', 'recipient_name', 'user_id', 'contact', 'address', 'account_info', 'amount', 'payment_status', 'notes', 'tracking_number', 'shipping_delayed', 'courier_company'],
      include: [
        {
          model: Image,
          as: 'images',
          attributes: ['id', 's3_url', 'file_name', 'created_at'],
          limit: 1,
          order: [['created_at', 'DESC']]
        }
      ]
    };

    // 해당 품목들의 모든 슬롯 조회
    const slots = await ItemSlot.findAll({
      where: { item_id: { [Op.in]: itemIds } },
      attributes: [
        'id', 'item_id', 'slot_number', 'date', 'product_name', 'purchase_option',
        'keyword', 'product_price', 'notes', 'status', 'expected_buyer', 'buyer_id',
        'day_group', 'upload_link_token', 'review_cost',
        'created_at', 'updated_at'
      ],
      include: [
        {
          model: Item,
          as: 'item',
          attributes: [
            'id', 'product_name', 'total_purchase_count', 'daily_purchase_count',
            'shipping_type', 'courier_service_yn', 'product_url', 'purchase_option',
            'keyword', 'product_price', 'notes', 'sale_price_per_unit', 'courier_price_per_unit',
            'platform', 'shipping_deadline', 'review_guide', 'deposit_name', 'status', 'upload_link_token',
            'date', 'display_order'
          ]
        },
        buyerInclude
      ],
      order: [
        ['item_id', 'ASC'],
        ['day_group', 'ASC'],
        ['slot_number', 'ASC']
      ]
    });

    res.json({
      success: true,
      data: slots,
      count: slots.length,
      items: items
    });
  } catch (error) {
    console.error('Get slots by campaign error:', error);
    res.status(500).json({
      success: false,
      message: '슬롯 목록 조회 실패',
      error: error.message
    });
  }
};

/**
 * Operator용 캠페인별 배정된 슬롯만 조회
 * - 해당 진행자에게 배정된 품목의 day_group 슬롯만 반환
 * - Admin은 viewAsUserId 쿼리 파라미터로 특정 진행자의 데이터 조회 가능
 */
exports.getSlotsByCampaignForOperator = async (req, res) => {
  try {
    const { campaignId: rawCampaignId } = req.params;
    const campaignId = parseInt(rawCampaignId, 10);

    // Admin인 경우 viewAsUserId로 특정 사용자 조회 가능
    let operatorId = req.user.id;
    if (req.user.role === 'admin' && req.query.viewAsUserId) {
      operatorId = parseInt(req.query.viewAsUserId, 10);
    }

    // 해당 진행자에게 배정된 품목 및 day_group 조회
    const assignments = await CampaignOperator.findAll({
      where: {
        campaign_id: campaignId,
        operator_id: operatorId
      },
      attributes: ['item_id', 'day_group']
    });

    if (assignments.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        items: []
      });
    }

    // 배정된 품목 ID들 (중복 제거)
    const assignedItemIds = [...new Set(assignments.map(a => a.item_id).filter(id => id !== null))];

    if (assignedItemIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        items: []
      });
    }

    // 배정된 품목들 조회
    const items = await Item.findAll({
      where: { id: { [Op.in]: assignedItemIds } },
      attributes: ['id', 'product_name', 'total_purchase_count', 'daily_purchase_count'],
      order: [['created_at', 'ASC']]
    });

    // 품목별 day_group 매핑 생성
    // { item_id: [day_group1, day_group2, ...] } 또는 { item_id: null } (전체 배정)
    const itemDayGroupMap = {};
    for (const a of assignments) {
      if (a.item_id) {
        if (!itemDayGroupMap[a.item_id]) {
          itemDayGroupMap[a.item_id] = [];
        }
        // day_group이 null이면 전체 품목 배정
        if (a.day_group === null) {
          itemDayGroupMap[a.item_id] = null; // null means all day_groups
        } else if (itemDayGroupMap[a.item_id] !== null) {
          itemDayGroupMap[a.item_id].push(a.day_group);
        }
      }
    }

    // day_group 기반 슬롯 필터링을 위한 조건 생성
    const slotConditions = [];
    for (const itemId of assignedItemIds) {
      const dayGroups = itemDayGroupMap[itemId];
      if (dayGroups === null) {
        // 전체 품목 배정 (day_group이 null인 경우)
        slotConditions.push({ item_id: itemId });
      } else if (dayGroups && dayGroups.length > 0) {
        // 특정 day_group만 배정
        slotConditions.push({
          item_id: itemId,
          day_group: { [Op.in]: dayGroups }
        });
      }
    }

    if (slotConditions.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        items: items
      });
    }

    // 해당 품목들의 슬롯 조회 (day_group 기반 필터링, 구매자 상세 정보 포함)
    const slots = await ItemSlot.findAll({
      where: { [Op.or]: slotConditions },
      attributes: [
        'id', 'item_id', 'slot_number', 'date', 'product_name', 'purchase_option',
        'keyword', 'product_price', 'notes', 'status', 'expected_buyer', 'buyer_id',
        'day_group', 'upload_link_token', 'review_cost',
        'created_at', 'updated_at'
      ],
      include: [
        {
          model: Item,
          as: 'item',
          attributes: [
            'id', 'product_name', 'total_purchase_count', 'daily_purchase_count',
            'shipping_type', 'courier_service_yn', 'product_url', 'purchase_option',
            'keyword', 'product_price', 'notes', 'sale_price_per_unit', 'courier_price_per_unit',
            'platform', 'shipping_deadline', 'review_guide', 'deposit_name', 'status', 'upload_link_token',
            'date', 'display_order'
          ]
        },
        {
          model: Buyer,
          as: 'buyer',
          attributes: [
            'id', 'order_number', 'buyer_name', 'recipient_name', 'user_id',
            'contact', 'address', 'account_info', 'amount', 'payment_status', 'notes',
            'tracking_number', 'shipping_delayed', 'courier_company'
          ],
          include: [
            {
              model: Image,
              as: 'images',
              attributes: ['id', 's3_url', 'file_name', 'created_at'],
              limit: 1,
              order: [['created_at', 'DESC']]
            }
          ]
        }
      ],
      order: [
        ['item_id', 'ASC'],
        ['day_group', 'ASC'],
        ['slot_number', 'ASC']
      ]
    });

    res.json({
      success: true,
      data: slots,
      count: slots.length,
      items: items
    });
  } catch (error) {
    console.error('Get slots by campaign for operator error:', error);
    res.status(500).json({
      success: false,
      message: '슬롯 목록 조회 실패',
      error: error.message
    });
  }
};

/**
 * Operator용 전체 배정된 슬롯 조회 (모든 캠페인)
 * - day_group 기반으로 배정된 슬롯만 반환
 */
exports.getMyAssignedSlots = async (req, res) => {
  try {
    const operatorId = req.user.id;

    // 해당 진행자에게 배정된 모든 품목 및 day_group 조회
    const assignments = await CampaignOperator.findAll({
      where: { operator_id: operatorId },
      attributes: ['item_id', 'day_group', 'assigned_at']
    });

    if (assignments.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        items: []
      });
    }

    // 배정된 품목 ID들 (중복 제거)
    const assignedItemIds = [...new Set(assignments.map(a => a.item_id).filter(id => id !== null))];

    if (assignedItemIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        items: []
      });
    }

    // 배정된 품목들 조회
    const items = await Item.findAll({
      where: { id: { [Op.in]: assignedItemIds } },
      attributes: ['id', 'product_name', 'total_purchase_count', 'daily_purchase_count', 'campaign_id'],
      order: [['created_at', 'ASC']]
    });

    // 품목별 day_group 매핑 생성
    const itemDayGroupMap = {};
    for (const a of assignments) {
      if (a.item_id) {
        if (!itemDayGroupMap[a.item_id]) {
          itemDayGroupMap[a.item_id] = [];
        }
        if (a.day_group === null) {
          itemDayGroupMap[a.item_id] = null;
        } else if (itemDayGroupMap[a.item_id] !== null) {
          itemDayGroupMap[a.item_id].push(a.day_group);
        }
      }
    }

    // day_group 기반 슬롯 필터링을 위한 조건 생성
    const slotConditions = [];
    for (const itemId of assignedItemIds) {
      const dayGroups = itemDayGroupMap[itemId];
      if (dayGroups === null) {
        slotConditions.push({ item_id: itemId });
      } else if (dayGroups && dayGroups.length > 0) {
        slotConditions.push({
          item_id: itemId,
          day_group: { [Op.in]: dayGroups }
        });
      }
    }

    if (slotConditions.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        items: items
      });
    }

    // 해당 품목들의 슬롯 조회 (day_group 기반 필터링)
    const slots = await ItemSlot.findAll({
      where: { [Op.or]: slotConditions },
      include: [
        {
          model: Item,
          as: 'item',
          attributes: ['id', 'product_name', 'total_purchase_count', 'daily_purchase_count', 'campaign_id']
        },
        {
          model: Buyer,
          as: 'buyer',
          attributes: ['id', 'buyer_name', 'order_number', 'payment_status']
        }
      ],
      order: [
        ['item_id', 'ASC'],
        ['day_group', 'ASC'],
        ['slot_number', 'ASC']
      ]
    });

    res.json({
      success: true,
      data: slots,
      count: slots.length,
      items: items
    });
  } catch (error) {
    console.error('Get my assigned slots error:', error);
    res.status(500).json({
      success: false,
      message: '슬롯 목록 조회 실패',
      error: error.message
    });
  }
};

/**
 * 슬롯 토큰으로 정보 조회 (Public - 이미지 업로드 페이지용)
 * - 일 구매건수 그룹별 업로드 링크 지원
 */
exports.getSlotByToken = async (req, res) => {
  try {
    const { token } = req.params;

    // 토큰으로 첫 번째 슬롯 조회 (같은 그룹의 슬롯들은 같은 토큰을 공유)
    const slot = await ItemSlot.findOne({
      where: { upload_link_token: token },
      include: [
        {
          model: Item,
          as: 'item',
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
        }
      ]
    });

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: '유효하지 않은 업로드 링크입니다'
      });
    }

    res.json({
      success: true,
      data: {
        item_id: slot.item_id,
        product_name: slot.item?.product_name || '',
        campaign_name: slot.item?.campaign?.name || '캠페인',
        brand_name: slot.item?.campaign?.brand?.name || '',
        day_group: slot.day_group
      }
    });
  } catch (error) {
    console.error('Get slot by token error:', error);
    res.status(500).json({
      success: false,
      message: '슬롯 조회 실패',
      error: error.message
    });
  }
};

/**
 * 슬롯 추가 (구매자 행 추가)
 * - 지정된 품목의 특정 day_group에 새 슬롯 추가
 * - slot_number는 해당 그룹 내 최대값 + 1
 */
exports.createSlot = async (req, res) => {
  try {
    const { itemId, dayGroup } = req.body;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: '품목 ID가 필요합니다'
      });
    }

    // 품목 존재 확인
    const item = await Item.findByPk(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '품목을 찾을 수 없습니다'
      });
    }

    const targetDayGroup = dayGroup || 1;

    // 해당 그룹 내 최대 slot_number 조회
    const maxSlotResult = await ItemSlot.findOne({
      where: { item_id: itemId, day_group: targetDayGroup },
      attributes: [[require('sequelize').fn('MAX', require('sequelize').col('slot_number')), 'maxSlot']]
    });
    const nextSlotNumber = (maxSlotResult?.dataValues?.maxSlot || 0) + 1;

    // 해당 그룹의 upload_link_token 가져오기 (기존 슬롯에서)
    const existingSlot = await ItemSlot.findOne({
      where: { item_id: itemId, day_group: targetDayGroup },
      attributes: ['upload_link_token']
    });
    const uploadToken = existingSlot?.upload_link_token || require('uuid').v4();

    // 새 슬롯 생성
    const newSlot = await ItemSlot.create({
      item_id: itemId,
      slot_number: nextSlotNumber,
      day_group: targetDayGroup,
      upload_link_token: uploadToken,
      status: 'active'
    });

    // 생성된 슬롯 조회 (buyer 포함)
    const createdSlot = await ItemSlot.findByPk(newSlot.id, {
      include: [
        {
          model: Item,
          as: 'item',
          attributes: ['id', 'product_name']
        },
        {
          model: Buyer,
          as: 'buyer'
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: '슬롯이 추가되었습니다',
      data: createdSlot
    });
  } catch (error) {
    console.error('Create slot error:', error);
    res.status(500).json({
      success: false,
      message: '슬롯 추가 실패',
      error: error.message
    });
  }
};

/**
 * 개별 슬롯 삭제 (구매자도 함께 삭제)
 */
exports.deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;

    const slot = await ItemSlot.findByPk(id);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: '슬롯을 찾을 수 없습니다'
      });
    }

    // 연결된 구매자가 있으면 구매자도 삭제
    if (slot.buyer_id) {
      await Buyer.destroy({ where: { id: slot.buyer_id } });
    }

    await slot.destroy();

    res.json({
      success: true,
      message: '슬롯이 삭제되었습니다'
    });
  } catch (error) {
    console.error('Delete slot error:', error);
    res.status(500).json({
      success: false,
      message: '슬롯 삭제 실패',
      error: error.message
    });
  }
};

/**
 * 다중 슬롯 삭제 (행 단위)
 * - 삭제 후 해당 품목에 슬롯이 없으면 품목도 함께 삭제
 */
exports.deleteSlotsBulk = async (req, res) => {
  try {
    const { slotIds } = req.body;

    if (!Array.isArray(slotIds) || slotIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '삭제할 슬롯 ID 목록이 필요합니다'
      });
    }

    // 삭제할 슬롯들의 item_id 조회 (삭제 전에)
    const slotsToDelete = await ItemSlot.findAll({
      where: { id: { [Op.in]: slotIds } },
      attributes: ['item_id']
    });
    const affectedItemIds = [...new Set(slotsToDelete.map(s => s.item_id))];

    // 슬롯 삭제
    const deletedCount = await ItemSlot.destroy({
      where: { id: { [Op.in]: slotIds } }
    });

    // 영향받은 품목들 중 슬롯이 없는 품목 삭제
    let deletedItemCount = 0;
    for (const itemId of affectedItemIds) {
      const remainingSlots = await ItemSlot.count({ where: { item_id: itemId } });
      if (remainingSlots === 0) {
        await Item.destroy({ where: { id: itemId } });
        deletedItemCount++;
      }
    }

    res.json({
      success: true,
      message: deletedItemCount > 0
        ? `${deletedCount}개 슬롯과 ${deletedItemCount}개 품목이 삭제되었습니다`
        : `${deletedCount}개 슬롯이 삭제되었습니다`,
      count: deletedCount,
      deletedItemCount
    });
  } catch (error) {
    console.error('Delete slots bulk error:', error);
    res.status(500).json({
      success: false,
      message: '슬롯 일괄 삭제 실패',
      error: error.message
    });
  }
};

/**
 * 그룹별 슬롯 삭제 (day_group 기준)
 * - 삭제 후 해당 품목에 슬롯이 없으면 품목도 함께 삭제
 */
exports.deleteSlotsByGroup = async (req, res) => {
  try {
    const { itemId, dayGroup } = req.params;

    // 해당 그룹의 슬롯들 삭제
    const deletedCount = await ItemSlot.destroy({
      where: {
        item_id: itemId,
        day_group: dayGroup
      }
    });

    // 삭제할 슬롯이 없어도 성공으로 처리 (이미 삭제된 경우)
    if (deletedCount === 0) {
      return res.json({
        success: true,
        message: '이미 삭제되었거나 삭제할 슬롯이 없습니다',
        count: 0,
        itemDeleted: false
      });
    }

    // 해당 품목에 남은 슬롯이 없으면 품목도 삭제
    let itemDeleted = false;
    const remainingSlots = await ItemSlot.count({ where: { item_id: itemId } });
    if (remainingSlots === 0) {
      await Item.destroy({ where: { id: itemId } });
      itemDeleted = true;
    }

    res.json({
      success: true,
      message: itemDeleted
        ? `${dayGroup}일차 슬롯 ${deletedCount}개와 품목이 삭제되었습니다`
        : `${dayGroup}일차 슬롯 ${deletedCount}개가 삭제되었습니다`,
      count: deletedCount,
      itemDeleted
    });
  } catch (error) {
    console.error('Delete slots by group error:', error);
    res.status(500).json({
      success: false,
      message: '그룹별 슬롯 삭제 실패',
      error: error.message
    });
  }
};

/**
 * 품목과 모든 슬롯 삭제
 */
exports.deleteSlotsByItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    // 슬롯 먼저 삭제
    const deletedSlotCount = await ItemSlot.destroy({
      where: { item_id: itemId }
    });

    // 품목 삭제
    const deletedItemCount = await Item.destroy({
      where: { id: itemId }
    });

    res.json({
      success: true,
      message: `품목과 슬롯 ${deletedSlotCount}개가 삭제되었습니다`,
      slotCount: deletedSlotCount,
      itemDeleted: deletedItemCount > 0
    });
  } catch (error) {
    console.error('Delete slots by item error:', error);
    res.status(500).json({
      success: false,
      message: '품목 삭제 실패',
      error: error.message
    });
  }
};

/**
 * 일 마감 - day_group 분할
 * - 특정 슬롯을 기준으로 해당 슬롯 이후의 모든 슬롯을 새로운 day_group으로 이동
 * - 새 day_group에는 새로운 upload_link_token 생성
 */
exports.splitDayGroup = async (req, res) => {
  try {
    const { slotId } = req.params;

    // 기준 슬롯 조회
    const targetSlot = await ItemSlot.findByPk(slotId);
    if (!targetSlot) {
      return res.status(404).json({
        success: false,
        message: '슬롯을 찾을 수 없습니다'
      });
    }

    const { item_id, day_group: currentDayGroup, slot_number: splitSlotNumber } = targetSlot;

    // 현재 품목의 최대 day_group 조회
    const maxDayGroupResult = await ItemSlot.findOne({
      where: { item_id },
      attributes: [[require('sequelize').fn('MAX', require('sequelize').col('day_group')), 'maxDayGroup']]
    });
    const maxDayGroup = maxDayGroupResult?.dataValues?.maxDayGroup || 1;
    const newDayGroup = maxDayGroup + 1;

    // 새로운 upload_link_token 생성
    const newUploadToken = require('uuid').v4();

    // 기준 슬롯 이후의 모든 슬롯 조회 (같은 품목, 같은 day_group, slot_number > splitSlotNumber)
    const slotsToMove = await ItemSlot.findAll({
      where: {
        item_id,
        day_group: currentDayGroup,
        slot_number: { [Op.gt]: splitSlotNumber }
      },
      order: [['slot_number', 'ASC']]
    });

    if (slotsToMove.length === 0) {
      return res.status(400).json({
        success: false,
        message: '마지막 행에서는 일 마감을 할 수 없습니다. 다음 일차로 이동할 행이 없습니다.'
      });
    }

    // 해당 슬롯들의 day_group과 upload_link_token 업데이트
    await ItemSlot.update(
      {
        day_group: newDayGroup,
        upload_link_token: newUploadToken
      },
      {
        where: {
          id: { [Op.in]: slotsToMove.map(s => s.id) }
        }
      }
    );

    res.json({
      success: true,
      message: `${slotsToMove.length}개 행이 ${newDayGroup}일차로 분할되었습니다`,
      data: {
        originalDayGroup: currentDayGroup,
        newDayGroup,
        movedCount: slotsToMove.length,
        splitAfterSlotNumber: splitSlotNumber
      }
    });
  } catch (error) {
    console.error('Split day group error:', error);
    res.status(500).json({
      success: false,
      message: '일 마감 처리 실패',
      error: error.message
    });
  }
};
