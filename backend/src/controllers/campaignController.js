const { Campaign, Item, User, CampaignOperator } = require('../models');
const { Op } = require('sequelize');

/**
 * 캠페인 목록 조회 (역할별 필터링)
 */
exports.getCampaigns = async (req, res) => {
  try {
    // JWT에서 사용자 정보 가져오기
    const userId = req.user?.id || req.query.userId;
    const userRole = req.user?.role || req.query.userRole || 'admin';

    let whereClause = {};

    // 역할별 필터링
    if (userRole === 'sales') {
      // 영업사: 자신이 생성한 캠페인만
      whereClause.created_by = userId;
    } else if (userRole === 'brand') {
      // 브랜드사: 자신이 연결된 캠페인만
      whereClause.brand_id = userId;
    } else if (userRole === 'operator') {
      // 진행자: 배정된 캠페인만 (CampaignOperator 조인 필요)
      const operatorCampaigns = await CampaignOperator.findAll({
        where: { operator_id: userId },
        attributes: ['campaign_id']
      });
      const campaignIds = operatorCampaigns.map(co => co.campaign_id);
      whereClause.id = { [Op.in]: campaignIds };
    }
    // admin은 모든 캠페인 조회

    const campaigns = await Campaign.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'username']
        },
        {
          model: User,
          as: 'brand',
          attributes: ['id', 'name', 'username']
        },
        {
          model: Item,
          as: 'items',
          attributes: ['id', 'product_name', 'status']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: campaigns,
      count: campaigns.length
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      success: false,
      message: '캠페인 목록 조회 실패',
      error: error.message
    });
  }
};

/**
 * 캠페인 상세 조회
 */
exports.getCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'username', 'email']
        },
        {
          model: User,
          as: 'brand',
          attributes: ['id', 'name', 'username', 'email']
        },
        {
          model: Item,
          as: 'items'
        },
        {
          model: User,
          as: 'operators',
          attributes: ['id', 'name', 'username'],
          through: { attributes: ['assigned_at'] }
        }
      ]
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: '캠페인을 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({
      success: false,
      message: '캠페인 조회 실패',
      error: error.message
    });
  }
};

/**
 * 캠페인 생성
 */
exports.createCampaign = async (req, res) => {
  try {
    const { name, description, brand_id, start_date, end_date } = req.body;

    // JWT에서 사용자 ID 가져오기
    const created_by = req.user?.id || req.body.created_by;

    // 필수 필드 검증
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '캠페인 이름은 필수입니다'
      });
    }

    if (!created_by) {
      return res.status(400).json({
        success: false,
        message: '생성자 정보가 필요합니다'
      });
    }

    // 빈 문자열을 null로 변환 (PostgreSQL 날짜 필드 호환)
    const campaign = await Campaign.create({
      name,
      description: description || null,
      created_by,
      brand_id: brand_id || null,
      start_date: start_date || null,
      end_date: end_date || null,
      status: 'active'
    });

    res.status(201).json({
      success: true,
      message: '캠페인이 생성되었습니다',
      data: campaign
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({
      success: false,
      message: '캠페인 생성 실패',
      error: error.message
    });
  }
};

/**
 * 캠페인 수정
 */
exports.updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, brand_id, start_date, end_date, status } = req.body;

    const campaign = await Campaign.findByPk(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: '캠페인을 찾을 수 없습니다'
      });
    }

    // TODO: 권한 체크 (영업사는 자신의 캠페인만 수정)

    await campaign.update({
      name: name || campaign.name,
      description: description !== undefined ? description : campaign.description,
      brand_id: brand_id !== undefined ? brand_id : campaign.brand_id,
      start_date: start_date || campaign.start_date,
      end_date: end_date || campaign.end_date,
      status: status || campaign.status
    });

    res.json({
      success: true,
      message: '캠페인이 수정되었습니다',
      data: campaign
    });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({
      success: false,
      message: '캠페인 수정 실패',
      error: error.message
    });
  }
};

/**
 * 캠페인 삭제
 */
exports.deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByPk(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: '캠페인을 찾을 수 없습니다'
      });
    }

    // TODO: 권한 체크

    await campaign.destroy();

    res.json({
      success: true,
      message: '캠페인이 삭제되었습니다'
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({
      success: false,
      message: '캠페인 삭제 실패',
      error: error.message
    });
  }
};

/**
 * 진행자 배정
 */
exports.assignOperator = async (req, res) => {
  try {
    const { id } = req.params; // campaign_id
    const { operator_id, item_id } = req.body;

    // TODO: JWT에서 관리자 확인
    const assigned_by = req.body.assigned_by || 1; // 임시

    // 캠페인 존재 확인
    const campaign = await Campaign.findByPk(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: '캠페인을 찾을 수 없습니다'
      });
    }

    // 진행자 존재 확인
    const operator = await User.findOne({
      where: { id: operator_id, role: 'operator' }
    });
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: '진행자를 찾을 수 없습니다'
      });
    }

    // 이미 배정되어 있는지 확인
    const existing = await CampaignOperator.findOne({
      where: {
        campaign_id: id,
        operator_id,
        item_id: item_id || null
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: '이미 배정된 진행자입니다'
      });
    }

    // 배정
    const assignment = await CampaignOperator.create({
      campaign_id: id,
      operator_id,
      item_id: item_id || null,
      assigned_by
    });

    res.status(201).json({
      success: true,
      message: '진행자가 배정되었습니다',
      data: assignment
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
 * 진행자 배정 해제
 */
exports.unassignOperator = async (req, res) => {
  try {
    const { campaignId, operatorId } = req.params;

    const deleted = await CampaignOperator.destroy({
      where: {
        campaign_id: campaignId,
        operator_id: operatorId
      }
    });

    if (deleted === 0) {
      return res.status(404).json({
        success: false,
        message: '배정 정보를 찾을 수 없습니다'
      });
    }

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
 * 배정된 진행자 목록
 */
exports.getOperators = async (req, res) => {
  try {
    const { id } = req.params;

    const operators = await CampaignOperator.findAll({
      where: { campaign_id: id },
      include: [
        {
          model: User,
          as: 'operator',
          attributes: ['id', 'name', 'username', 'email', 'phone']
        },
        {
          model: Item,
          as: 'item',
          attributes: ['id', 'product_name']
        }
      ]
    });

    res.json({
      success: true,
      data: operators,
      count: operators.length
    });
  } catch (error) {
    console.error('Get operators error:', error);
    res.status(500).json({
      success: false,
      message: '진행자 목록 조회 실패',
      error: error.message
    });
  }
};
