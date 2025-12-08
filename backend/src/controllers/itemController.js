const { Item, Campaign, Buyer, Image, User, CampaignOperator } = require('../models');

/**
 * 전체 품목 목록 조회 (Admin용 - 진행자 배정을 위한)
 */
exports.getAllItems = async (req, res) => {
  try {
    const items = await Item.findAll({
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name', 'brand_id', 'created_by'],
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
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: items,
      count: items.length
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
 * 품목에 진행자 배정
 */
exports.assignOperatorToItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { operator_id } = req.body;
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

    // 이미 배정되어 있는지 확인
    const existingAssignment = await CampaignOperator.findOne({
      where: {
        campaign_id: item.campaign_id,
        item_id: id,
        operator_id
      }
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: '이미 배정된 진행자입니다'
      });
    }

    // 배정 생성
    await CampaignOperator.create({
      campaign_id: item.campaign_id,
      item_id: id,
      operator_id,
      assigned_by
    });

    res.json({
      success: true,
      message: '진행자가 배정되었습니다'
    });
  } catch (error) {
    console.error('Assign operator error:', error);
    res.status(500).json({
      success: false,
      message: '진행자 배정 실패',
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

    // 진행자에게 배정된 품목들을 캠페인별로 그룹화
    const assignments = await CampaignOperator.findAll({
      where: { operator_id: operatorId },
      include: [
        {
          model: Item,
          as: 'item',
          include: [
            {
              model: Buyer,
              as: 'buyers'
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
            }
          ]
        }
      ],
      order: [['assigned_at', 'DESC']]
    });

    // 캠페인별로 그룹화
    const campaignMap = new Map();

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

      if (assignment.item) {
        campaignMap.get(campaignId).items.push({
          id: assignment.item.id,
          product_name: assignment.item.product_name,
          status: assignment.item.status,
          keyword: assignment.item.keyword,
          buyerCount: assignment.item.buyers?.length || 0,
          assigned_at: assignment.assigned_at
        });
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
 * 품목에서 진행자 배정 해제
 */
exports.unassignOperatorFromItem = async (req, res) => {
  try {
    const { id, operatorId } = req.params;

    const assignment = await CampaignOperator.findOne({
      where: {
        item_id: id,
        operator_id: operatorId
      }
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
          attributes: ['id', 'name']
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
        campaign_name: item.campaign?.name || '캠페인'
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

    const items = await Item.findAll({
      where: { campaign_id: campaignId },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name']
        },
        {
          model: Buyer,
          as: 'buyers',
          attributes: ['id', 'buyer_name', 'amount', 'payment_status']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: items,
      count: items.length
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
      notes
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
      notes
    });

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
