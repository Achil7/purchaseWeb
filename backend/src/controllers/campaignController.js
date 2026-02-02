const { Campaign, Item, User, CampaignOperator, Buyer, MonthlyBrand, sequelize } = require('../models');
const { Op } = require('sequelize');
const { notifyAllAdmins } = require('./notificationController');
const { formatDateToYYYYMMDD_KST } = require('../utils/dateUtils');

/**
 * 캠페인 목록 조회 (역할별 필터링)
 * Admin은 viewAsUserId + viewAsRole 쿼리 파라미터로 특정 사용자의 데이터 조회 가능
 */
exports.getCampaigns = async (req, res) => {
  try {
    // JWT에서 사용자 정보 가져오기
    let userId = req.user?.id || req.query.userId;
    const userRole = req.user?.role || req.query.userRole || 'admin';

    // Admin이 viewAsUserId로 특정 사용자 데이터 조회
    const viewAsUserId = req.query.viewAsUserId ? parseInt(req.query.viewAsUserId, 10) : null;
    const viewAsRole = req.query.viewAsRole || null;

    // 검색 파라미터
    const { search, brand_name, registered_from, registered_to } = req.query;

    let whereClause = {};

    // Admin인 경우 viewAsUserId + viewAsRole 필수, 없으면 빈 데이터 반환
    if (userRole === 'admin') {
      if (viewAsUserId && viewAsRole) {
        if (viewAsRole === 'brand') {
          whereClause.brand_id = viewAsUserId;
        } else if (viewAsRole === 'sales') {
          whereClause.created_by = viewAsUserId;
        } else if (viewAsRole === 'operator') {
          // 진행자 조회
          const operatorCampaigns = await CampaignOperator.findAll({
            where: { operator_id: viewAsUserId },
            attributes: ['campaign_id']
          });
          const campaignIds = operatorCampaigns.map(co => co.campaign_id);
          whereClause.id = { [Op.in]: campaignIds };
        }
      } else {
        // Admin이 viewAsUserId 없이 접근하면 빈 데이터 반환
        return res.json({
          success: true,
          data: [],
          message: 'viewAsUserId와 viewAsRole이 필요합니다'
        });
      }
    }
    // 역할별 필터링
    else if (userRole === 'sales') {
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

    // 등록날짜 범위 필터
    if (registered_from || registered_to) {
      whereClause.registered_at = {};
      if (registered_from) {
        whereClause.registered_at[Op.gte] = registered_from;
      }
      if (registered_to) {
        whereClause.registered_at[Op.lte] = registered_to;
      }
    }

    // 브랜드 검색을 위한 include 설정
    const brandInclude = {
      model: User,
      as: 'brand',
      attributes: ['id', 'name', 'username']
    };

    // 브랜드명 검색
    if (brand_name) {
      brandInclude.where = {
        name: { [Op.like]: `%${brand_name}%` }
      };
    }

    // 1단계: 캠페인 기본 정보 조회 (Buyer 제외 - 성능 최적화)
    const campaigns = await Campaign.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'username']
        },
        brandInclude,
        {
          model: MonthlyBrand,
          as: 'monthlyBrand',
          attributes: ['id', 'name', 'year_month']
        },
        {
          model: Item,
          as: 'items',
          attributes: [
            'id', 'product_name', 'status', 'shipping_type', 'keyword',
            'total_purchase_count', 'daily_purchase_count', 'product_url', 'purchase_option',
            'product_price', 'shipping_deadline', 'review_guide', 'courier_service_yn',
            'notes', 'deposit_name', 'registered_at', 'created_at'
          ]
        },
        {
          model: CampaignOperator,
          as: 'operatorAssignments',
          attributes: ['id', 'operator_id', 'item_id']
        }
      ],
      order: [['registered_at', 'ASC'], ['created_at', 'ASC']]
    });

    // 2단계: 품목별 구매자 수 별도 조회 (COUNT만)
    const allItemIds = campaigns.flatMap(c => c.items?.map(i => i.id) || []);
    let buyerStats = {};

    if (allItemIds.length > 0) {
      const stats = await Buyer.findAll({
        where: { item_id: { [Op.in]: allItemIds } },
        attributes: [
          'item_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'buyer_count']
        ],
        group: ['item_id'],
        raw: true
      });

      for (const stat of stats) {
        buyerStats[stat.item_id] = parseInt(stat.buyer_count, 10) || 0;
      }
    }

    // 3단계: 응답 데이터 조합 (기존 형식 유지)
    const campaignsWithBuyerCount = campaigns.map(campaign => {
      const campaignJson = campaign.toJSON();
      campaignJson.items = campaignJson.items.map(item => ({
        ...item,
        buyers: Array(buyerStats[item.id] || 0).fill({ id: 0 }) // 기존 호환성: buyers 배열 길이로 count
      }));
      return campaignJson;
    });

    res.json({
      success: true,
      data: campaignsWithBuyerCount,
      count: campaignsWithBuyerCount.length
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
        },
        {
          model: MonthlyBrand,
          as: 'monthlyBrand',
          attributes: ['id', 'name']
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
    const { name, description, brand_id, start_date, end_date, registered_at, monthly_brand_id, status } = req.body;

    // Admin인 경우 body에서 created_by를 받고, 그 외에는 JWT의 사용자 ID 사용
    const userRole = req.user?.role;
    const created_by = (userRole === 'admin' && req.body.created_by)
      ? req.body.created_by
      : req.user?.id;

    // 필수 필드 검증 - name은 자동생성 가능하므로 필수 아님
    if (!brand_id) {
      return res.status(400).json({
        success: false,
        message: '브랜드사 선택은 필수입니다'
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
      name: name || null,
      description: description || null,
      created_by,
      brand_id: brand_id || null,
      monthly_brand_id: monthly_brand_id || null,
      start_date: start_date || null,
      end_date: end_date || null,
      registered_at: registered_at || formatDateToYYYYMMDD_KST(new Date()),
      status: status || 'active'
    });

    // 영업사 및 브랜드 정보 조회 (알림용)
    const creator = await User.findByPk(created_by, { attributes: ['name'] });
    const brand = await User.findByPk(brand_id, { attributes: ['name'] });
    const creatorName = creator ? creator.name : '알 수 없음';
    const brandName = brand ? brand.name : '알 수 없음';

    // 모든 Admin에게 알림 생성 (캠페인 추가는 단순 정보 알림, 페이지 이동 없음)
    try {
      await notifyAllAdmins(
        'campaign_created',
        '캠페인 추가',
        `${creatorName}님이 ${brandName}의 "${campaign.name}"을 등록하였습니다.`,
        null,  // reference_type을 null로 설정하여 클릭 시 페이지 이동 없음
        null   // reference_id도 null
      );
    } catch (notifyError) {
      console.error('Notification error:', notifyError);
      // 알림 실패해도 캠페인 생성은 성공으로 처리
    }

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
    const { name, description, brand_id, start_date, end_date, status, registered_at, monthly_brand_id } = req.body;

    const campaign = await Campaign.findByPk(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: '캠페인을 찾을 수 없습니다'
      });
    }

    // TODO: 권한 체크 (영업사는 자신의 캠페인만 수정)

    await campaign.update({
      name: name !== undefined ? name : campaign.name,
      description: description !== undefined ? description : campaign.description,
      brand_id: brand_id !== undefined ? brand_id : campaign.brand_id,
      monthly_brand_id: monthly_brand_id !== undefined ? monthly_brand_id : campaign.monthly_brand_id,
      start_date: start_date || campaign.start_date,
      end_date: end_date || campaign.end_date,
      status: status || campaign.status,
      registered_at: registered_at || campaign.registered_at
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
 * 캠페인 강제 삭제 (Admin 전용) - 모든 관련 데이터 cascading delete
 * Items, Buyers, Images, ItemSlots, CampaignOperators 모두 삭제
 */
exports.deleteCampaignCascade = async (req, res) => {
  const sequelize = require('../models').sequelize;
  const { ItemSlot, Image } = require('../models');

  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const campaign = await Campaign.findByPk(id, {
      include: [
        {
          model: Item,
          as: 'items',
          include: [
            { model: Buyer, as: 'buyers', include: [{ model: Image, as: 'images' }] },
            { model: ItemSlot, as: 'slots' }
          ]
        }
      ]
    });

    if (!campaign) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '캠페인을 찾을 수 없습니다'
      });
    }

    // 권한 확인: admin은 모두 삭제 가능, sales는 자신이 만든 캠페인, operator는 배정받은 캠페인
    if (userRole !== 'admin') {
      if (userRole === 'sales' && campaign.created_by !== userId) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: '자신이 생성한 캠페인만 삭제할 수 있습니다'
        });
      }
      if (userRole === 'operator') {
        // operator는 배정받은 캠페인만 삭제 가능
        const isAssigned = await CampaignOperator.findOne({
          where: { campaign_id: id, operator_id: userId }
        });
        if (!isAssigned) {
          await transaction.rollback();
          return res.status(403).json({
            success: false,
            message: '배정받은 캠페인만 삭제할 수 있습니다'
          });
        }
      }
    }

    // 통계 수집
    let deletedStats = {
      images: 0,
      buyers: 0,
      slots: 0,
      items: 0,
      operators: 0
    };

    // 1. 캠페인 진행자 배정 삭제
    const operatorCount = await CampaignOperator.destroy({
      where: { campaign_id: id },
      transaction
    });
    deletedStats.operators = operatorCount;

    // 2. 품목별로 관련 데이터 삭제
    for (const item of campaign.items || []) {
      // 2-1. 구매자의 이미지 삭제
      for (const buyer of item.buyers || []) {
        const imageCount = await Image.destroy({
          where: { buyer_id: buyer.id },
          transaction
        });
        deletedStats.images += imageCount;
      }

      // 2-2. 구매자 삭제
      const buyerCount = await Buyer.destroy({
        where: { item_id: item.id },
        transaction
      });
      deletedStats.buyers += buyerCount;

      // 2-3. 품목 슬롯 삭제
      const slotCount = await ItemSlot.destroy({
        where: { item_id: item.id },
        transaction
      });
      deletedStats.slots += slotCount;
    }

    // 3. 품목 삭제
    const itemCount = await Item.destroy({
      where: { campaign_id: id },
      transaction
    });
    deletedStats.items = itemCount;

    // 4. 캠페인 삭제
    await campaign.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: '캠페인이 휴지통으로 이동되었습니다 (30일 후 영구 삭제)',
      data: {
        campaign_name: campaign.name,
        deleted: deletedStats
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Delete campaign cascade error:', error);
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
 * 캠페인 숨기기
 */
exports.hideCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByPk(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: '캠페인을 찾을 수 없습니다'
      });
    }

    await campaign.update({ is_hidden: true });

    res.json({
      success: true,
      message: '캠페인이 숨겨졌습니다',
      data: campaign
    });
  } catch (error) {
    console.error('Hide campaign error:', error);
    res.status(500).json({
      success: false,
      message: '캠페인 숨기기 실패',
      error: error.message
    });
  }
};

/**
 * 캠페인 복구
 */
exports.restoreCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    // paranoid: false로 soft-deleted 캠페인도 조회
    const campaign = await Campaign.findByPk(id, { paranoid: false });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: '캠페인을 찾을 수 없습니다'
      });
    }

    // is_hidden과 deleted_at 모두 초기화하여 완전히 복원
    await campaign.update({ is_hidden: false, deleted_at: null });

    res.json({
      success: true,
      message: '캠페인이 복구되었습니다',
      data: campaign
    });
  } catch (error) {
    console.error('Restore campaign error:', error);
    res.status(500).json({
      success: false,
      message: '캠페인 복구 실패',
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

/**
 * 캠페인 영업사 변경 (Admin 전용)
 * 기존 영업사가 퇴사 등의 이유로 다른 영업사에게 캠페인 이관
 *
 * 동작:
 * - 캠페인의 created_by만 새 영업사로 변경
 * - 연월브랜드는 변경하지 않음 (원래 영업사가 계속 관리)
 * - 새 영업사는 캠페인의 created_by 기준으로 해당 캠페인을 볼 수 있음
 */
exports.changeSales = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_sales_id } = req.body;

    if (!new_sales_id) {
      return res.status(400).json({
        success: false,
        message: '새 영업사 ID가 필요합니다'
      });
    }

    const campaign = await Campaign.findByPk(id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: MonthlyBrand, as: 'monthlyBrand', include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }] }
      ]
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: '캠페인을 찾을 수 없습니다'
      });
    }

    // 새 영업사 존재 및 역할 확인
    const newSales = await User.findOne({
      where: { id: new_sales_id, role: 'sales' }
    });

    if (!newSales) {
      return res.status(404).json({
        success: false,
        message: '해당 영업사를 찾을 수 없습니다'
      });
    }

    const oldSalesName = campaign.creator?.name || '알 수 없음';

    // 캠페인 영업사만 변경 (연월브랜드는 유지)
    await campaign.update({ created_by: new_sales_id });

    res.json({
      success: true,
      message: `캠페인 영업사가 ${oldSalesName}에서 ${newSales.name}(으)로 변경되었습니다`,
      data: {
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        old_sales_name: oldSalesName,
        new_sales_id: new_sales_id,
        new_sales_name: newSales.name,
        monthly_brand_name: campaign.monthlyBrand?.name || null
      }
    });
  } catch (error) {
    console.error('Change sales error:', error);
    res.status(500).json({
      success: false,
      message: '영업사 변경 실패',
      error: error.message
    });
  }
};
