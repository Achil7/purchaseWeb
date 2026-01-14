const express = require('express');
const router = express.Router();
const { MonthlyBrand, Campaign, Item, User, Buyer, Image } = require('../models');
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

    // 해당 브랜드에 연결된 연월브랜드 조회
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
                  model: Buyer,
                  as: 'buyers',
                  attributes: ['id', 'is_temporary'],
                  include: [
                    {
                      model: Image,
                      as: 'images',
                      attributes: ['id']
                    }
                  ]
                }
              ]
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: monthlyBrands
    });
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
    // Admin용: 숨긴 항목도 모두 조회 (숨김 관리 기능 위해)
    const monthlyBrands = await MonthlyBrand.findAll({
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
          attributes: ['id', 'name', 'status', 'registered_at', 'created_at', 'is_hidden'],
          include: [
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'name', 'username']
            },
            {
              model: Item,
              as: 'items',
              attributes: ['id', 'product_name', 'status']
            }
          ]
        }
      ],
      order: [
        ['created_at', 'DESC'],
        [{ model: Campaign, as: 'campaigns' }, 'name', 'ASC']
      ]
    });

    res.json({
      success: true,
      data: monthlyBrands
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
          // 해당 영업사가 담당하는 캠페인만 필터링
          where: { created_by: salesId },
          required: false, // LEFT JOIN (캠페인 없어도 연월브랜드 표시)
          include: [
            {
              model: Item,
              as: 'items',
              attributes: ['id', 'product_name', 'shipping_type', 'courier_service_yn', 'product_price', 'status', 'total_purchase_count', 'daily_purchase_count', 'purchase_option', 'keyword', 'notes']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // 캠페인이 없는 연월브랜드 필터링 (자신이 생성했지만 캠페인이 모두 이전된 경우 제외)
    const filteredMonthlyBrands = monthlyBrands.filter(mb => {
      // 자신이 생성한 연월브랜드는 캠페인 유무와 관계없이 표시 (연월브랜드 관리 목적)
      if (mb.created_by === salesId) return true;
      // 자신이 담당하는 캠페인이 있는 연월브랜드만 표시
      return mb.campaigns && mb.campaigns.length > 0;
    });

    res.json({
      success: true,
      data: filteredMonthlyBrands
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

    // 연월브랜드 생성
    const monthlyBrand = await MonthlyBrand.create({
      name,
      brand_id,
      created_by: createdBy,
      year_month: year_month || null,
      description: description || null,
      status: status || 'active'
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

    const monthlyBrand = await MonthlyBrand.findByPk(id);

    if (!monthlyBrand) {
      return res.status(404).json({
        success: false,
        message: '연월브랜드를 찾을 수 없습니다'
      });
    }

    await monthlyBrand.update({ is_hidden: false });

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

    const monthlyBrand = await MonthlyBrand.findByPk(id, {
      include: [
        {
          model: Campaign,
          as: 'campaigns',
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
        }
      ]
    });

    if (!monthlyBrand) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '연월브랜드를 찾을 수 없습니다'
      });
    }

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
        // operator는 배정받은 연월브랜드만 삭제 가능 (연월브랜드 내 캠페인에 배정되어 있는지 확인)
        const campaignIds = (monthlyBrand.campaigns || []).map(c => c.id);
        if (campaignIds.length > 0) {
          const isAssigned = await CampaignOperator.findOne({
            where: {
              campaign_id: campaignIds,
              operator_id: userId
            }
          });
          if (!isAssigned) {
            await transaction.rollback();
            return res.status(403).json({
              success: false,
              message: '배정받은 연월브랜드만 삭제할 수 있습니다'
            });
          }
        } else {
          // 캠페인이 없는 연월브랜드는 operator가 삭제 불가
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

    // 캠페인별로 관련 데이터 삭제
    for (const campaign of monthlyBrand.campaigns || []) {
      // 1. 캠페인 진행자 배정 삭제
      const operatorCount = await CampaignOperator.destroy({
        where: { campaign_id: campaign.id },
        transaction
      });
      deletedStats.operators += operatorCount;

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
        where: { campaign_id: campaign.id },
        transaction
      });
      deletedStats.items += itemCount;

      // 4. 캠페인 삭제
      await campaign.destroy({ transaction });
      deletedStats.campaigns++;
    }

    // 5. 연월브랜드 삭제
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

module.exports = router;
