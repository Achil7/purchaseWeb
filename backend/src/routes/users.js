const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, UserActivity, Campaign, Item, Buyer, CampaignOperator, BrandSales, MonthlyBrand, ItemSlot, Image, sequelize } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/users
 * @desc    사용자 목록 조회 (role 필터 가능)
 * @access  Private (Admin only, 단 role=brand 조회는 sales도 가능)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { role } = req.query;

    // role=brand 조회는 sales, admin 허용 (캠페인 생성 시 브랜드 선택용)
    if (role === 'brand') {
      if (!['admin', 'sales'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: '접근 권한이 없습니다'
        });
      }
    } else {
      // 그 외 사용자 목록 조회는 admin만 가능
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '관리자만 접근 가능합니다'
        });
      }
    }

    const whereClause = {};
    if (role) {
      whereClause.role = role;
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: ['id', 'username', 'name', 'email', 'role', 'phone', 'is_active', 'last_login', 'created_at', 'assigned_sales_id'],
      include: role === 'brand' ? [{
        model: User,
        as: 'assignedSales',
        attributes: ['id', 'name']
      }] : [],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 목록 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   GET /api/users/my-brands
 * @desc    현재 로그인한 영업사가 담당하는 브랜드 목록 조회 (BrandSales 테이블 기준)
 * @access  Private (Sales, Admin)
 */
router.get('/my-brands', authenticate, authorize(['sales', 'admin']), async (req, res) => {
  try {
    // Admin은 모든 브랜드 조회 가능
    if (req.user.role === 'admin') {
      const brands = await User.findAll({
        where: {
          role: 'brand',
          is_active: true
        },
        attributes: ['id', 'username', 'name', 'email', 'phone', 'assigned_sales_id'],
        include: [{
          model: User,
          as: 'assignedSalesUsers',
          attributes: ['id', 'name'],
          through: { attributes: [] }
        }],
        order: [['name', 'ASC']]
      });

      return res.json({
        success: true,
        data: brands
      });
    }

    // 영업사는 BrandSales 테이블에서 자신이 담당하는 브랜드만 조회
    const brandSalesRecords = await BrandSales.findAll({
      where: { sales_id: req.user.id },
      include: [{
        model: User,
        as: 'brand',
        where: { is_active: true },
        attributes: ['id', 'username', 'name', 'email', 'phone', 'assigned_sales_id']
      }],
      order: [[{ model: User, as: 'brand' }, 'name', 'ASC']]
    });

    const brands = brandSalesRecords.map(record => record.brand);

    res.json({
      success: true,
      data: brands
    });
  } catch (error) {
    console.error('Get my brands error:', error);
    res.status(500).json({
      success: false,
      message: '담당 브랜드 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   GET /api/users/sales/:salesId/brands
 * @desc    특정 영업사가 담당하는 브랜드 목록 조회 (BrandSales 테이블 기준)
 * @access  Private (Admin only)
 */
router.get('/sales/:salesId/brands', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { salesId } = req.params;

    // BrandSales 테이블에서 해당 영업사가 담당하는 브랜드 조회
    const brandSalesRecords = await BrandSales.findAll({
      where: { sales_id: salesId },
      include: [{
        model: User,
        as: 'brand',
        where: { role: 'brand', is_active: true },
        attributes: ['id', 'username', 'name', 'email', 'phone', 'assigned_sales_id']
      }],
      order: [[{ model: User, as: 'brand' }, 'name', 'ASC']]
    });

    const brands = brandSalesRecords.map(record => record.brand);

    res.json({
      success: true,
      data: brands
    });
  } catch (error) {
    console.error('Get sales brands error:', error);
    res.status(500).json({
      success: false,
      message: '영업사 담당 브랜드 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   POST /api/users/brand
 * @desc    영업사가 브랜드 생성 (자동으로 해당 영업사에 할당 + BrandSales 추가)
 * @access  Private (Sales, Admin)
 */
router.post('/brand', authenticate, authorize(['sales', 'admin']), async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { username, password, name, email, phone } = req.body;

    // 필수 필드 검증
    if (!username || !password || !name) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '필수 필드를 모두 입력해주세요 (username, password, name)'
      });
    }

    // username 중복 체크
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '이미 사용 중인 사용자명입니다'
      });
    }

    // email 중복 체크 (이메일이 있는 경우만)
    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: '이미 사용 중인 이메일입니다'
        });
      }
    }

    // Admin이 viewAsUserId로 영업사 대신 생성하는 경우 처리
    let assignedSalesId = null;
    if (req.user.role === 'sales') {
      assignedSalesId = req.user.id;
    } else if (req.user.role === 'admin' && req.query.viewAsUserId) {
      assignedSalesId = parseInt(req.query.viewAsUserId, 10);
    }

    // 브랜드 생성 (영업사 자동 할당)
    const user = await User.create({
      username,
      password_hash: password, // beforeCreate 훅에서 해싱됨
      initial_password: password, // 초기 비밀번호 평문 저장
      name,
      email: email || null,
      role: 'brand',
      phone: phone || null,
      is_active: true,
      assigned_sales_id: assignedSalesId
    }, { transaction });

    // BrandSales 테이블에도 관계 추가
    if (assignedSalesId) {
      await BrandSales.create({
        brand_id: user.id,
        sales_id: assignedSalesId,
        created_by: req.user.id
      }, { transaction });
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: '브랜드가 생성되었습니다',
      data: user.toJSON()
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Create brand error:', error);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: error.errors.map(e => e.message).join(', ')
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: '중복된 값이 존재합니다'
      });
    }

    res.status(500).json({
      success: false,
      message: '브랜드 생성 중 오류가 발생했습니다'
    });
  }
});

// ============================================
// 컨트롤 타워용 API (/:id 라우트보다 먼저 정의해야 함)
// ============================================

/**
 * @route   GET /api/users/control-tower/users
 * @desc    컨트롤 타워용 사용자 목록 (초기 비밀번호, 활동 상태 포함)
 * @access  Private (Admin only)
 */
router.get('/control-tower/users', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { role } = req.query;

    const whereClause = {
      role: { [Op.in]: ['operator', 'sales', 'brand'] }
    };

    if (role && ['operator', 'sales', 'brand'].includes(role)) {
      whereClause.role = role;
    }

    // 오늘 날짜 범위
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const users = await User.findAll({
      where: whereClause,
      attributes: [
        'id', 'username', 'name', 'email', 'role', 'phone',
        'is_active', 'last_login', 'last_activity', 'initial_password',
        'created_at', 'assigned_sales_id'
      ],
      include: [{
        model: User,
        as: 'assignedSales',
        attributes: ['id', 'name'],
        required: false
      }],
      order: [['name', 'ASC']]
    });

    // 각 사용자의 오늘 로그인 횟수 조회
    const userIds = users.map(u => u.id);
    const todayLogins = await UserActivity.findAll({
      attributes: [
        'user_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'login_count']
      ],
      where: {
        user_id: { [Op.in]: userIds },
        activity_type: 'login',
        created_at: { [Op.gte]: today, [Op.lt]: tomorrow }
      },
      group: ['user_id'],
      raw: true
    });

    // 로그인 횟수 맵 생성
    const loginCountMap = {};
    todayLogins.forEach(item => {
      loginCountMap[item.user_id] = parseInt(item.login_count);
    });

    // 5분 기준 온라인 여부 판단
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const result = users.map(user => {
      const userData = user.toJSON();
      userData.today_login_count = loginCountMap[user.id] || 0;
      userData.is_online = user.last_activity && new Date(user.last_activity) > fiveMinutesAgo;
      return userData;
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get control tower users error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 목록 조회 중 오류가 발생했습니다'
    });
  }
});

// ============================================
// 브랜드-영업사 매핑 관리 API (/:id 라우트보다 먼저 정의해야 함)
// ============================================

/**
 * @route   POST /api/users/brands/:brandId/assign-me
 * @desc    영업사가 기존 브랜드에 자신을 할당 (연월브랜드 생성 시 사용)
 * @access  Private (Sales, Admin)
 */
router.post('/brands/:brandId/assign-me', authenticate, authorize(['sales', 'admin']), async (req, res) => {
  try {
    const { brandId } = req.params;

    // Admin이 viewAsUserId로 영업사 대신 요청하는 경우 처리
    let salesId = req.user.id;
    if (req.user.role === 'admin' && req.query.viewAsUserId) {
      salesId = parseInt(req.query.viewAsUserId, 10);
    }

    // 브랜드 존재 확인
    const brand = await User.findOne({
      where: { id: brandId, role: 'brand', is_active: true }
    });
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: '브랜드를 찾을 수 없습니다'
      });
    }

    // 이미 할당되어 있는지 확인
    const existing = await BrandSales.findOne({
      where: { brand_id: brandId, sales_id: salesId }
    });
    if (existing) {
      // 이미 할당되어 있으면 성공으로 처리 (멱등성)
      return res.json({
        success: true,
        message: '이미 해당 브랜드가 할당되어 있습니다',
        data: existing
      });
    }

    // 할당 생성
    const brandSales = await BrandSales.create({
      brand_id: brandId,
      sales_id: salesId,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: '브랜드가 할당되었습니다',
      data: brandSales
    });
  } catch (error) {
    console.error('Assign brand to me error:', error);
    res.status(500).json({
      success: false,
      message: '브랜드 할당 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   GET /api/users/brands/:brandId/sales
 * @desc    특정 브랜드를 담당하는 영업사 목록 조회
 * @access  Private (Admin only)
 */
router.get('/brands/:brandId/sales', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { brandId } = req.params;

    const brandSalesRecords = await BrandSales.findAll({
      where: { brand_id: brandId },
      include: [{
        model: User,
        as: 'salesUser',
        attributes: ['id', 'username', 'name', 'email', 'phone']
      }, {
        model: User,
        as: 'creator',
        attributes: ['id', 'name']
      }],
      order: [['created_at', 'ASC']]
    });

    res.json({
      success: true,
      data: brandSalesRecords.map(record => ({
        id: record.id,
        sales: record.salesUser,
        created_by: record.creator,
        created_at: record.created_at
      }))
    });
  } catch (error) {
    console.error('Get brand sales error:', error);
    res.status(500).json({
      success: false,
      message: '브랜드 담당 영업사 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   POST /api/users/brands/:brandId/sales
 * @desc    브랜드에 영업사 추가 할당
 * @access  Private (Admin only)
 */
router.post('/brands/:brandId/sales', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { brandId } = req.params;
    const { sales_id } = req.body;

    // 브랜드 존재 확인
    const brand = await User.findOne({
      where: { id: brandId, role: 'brand', is_active: true }
    });
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: '브랜드를 찾을 수 없습니다'
      });
    }

    // 영업사 존재 확인
    const salesUser = await User.findOne({
      where: { id: sales_id, role: 'sales', is_active: true }
    });
    if (!salesUser) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 영업사입니다'
      });
    }

    // 이미 할당되어 있는지 확인
    const existing = await BrandSales.findOne({
      where: { brand_id: brandId, sales_id }
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '이미 해당 영업사가 할당되어 있습니다'
      });
    }

    // 할당 생성
    const brandSales = await BrandSales.create({
      brand_id: brandId,
      sales_id,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: '영업사가 브랜드에 할당되었습니다',
      data: brandSales
    });
  } catch (error) {
    console.error('Add brand sales error:', error);
    res.status(500).json({
      success: false,
      message: '영업사 할당 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   DELETE /api/users/brands/:brandId/sales/:salesId
 * @desc    브랜드에서 영업사 할당 해제
 * @access  Private (Admin only)
 */
router.delete('/brands/:brandId/sales/:salesId', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { brandId, salesId } = req.params;

    const deleted = await BrandSales.destroy({
      where: { brand_id: brandId, sales_id: salesId }
    });

    if (deleted === 0) {
      return res.status(404).json({
        success: false,
        message: '할당 관계를 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      message: '영업사 할당이 해제되었습니다'
    });
  } catch (error) {
    console.error('Remove brand sales error:', error);
    res.status(500).json({
      success: false,
      message: '영업사 할당 해제 중 오류가 발생했습니다'
    });
  }
});

// ============================================
// 사용자 CRUD API
// ============================================

/**
 * @route   POST /api/users
 * @desc    사용자 생성
 * @access  Private (Admin only)
 */
router.post('/', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { username, password, name, email, role, phone, is_active, assigned_sales_id } = req.body;

    // 필수 필드 검증
    if (!username || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: '필수 필드를 모두 입력해주세요 (username, password, name, role)'
      });
    }

    // role 검증
    const validRoles = ['admin', 'sales', 'operator', 'brand'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 역할입니다'
      });
    }

    // 브랜드 역할인 경우 담당 영업사 검증
    if (role === 'brand' && assigned_sales_id) {
      const salesUser = await User.findOne({
        where: { id: assigned_sales_id, role: 'sales', is_active: true }
      });
      if (!salesUser) {
        return res.status(400).json({
          success: false,
          message: '유효하지 않은 담당 영업사입니다'
        });
      }
    }

    // username 중복 체크
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: '이미 사용 중인 사용자명입니다'
      });
    }

    // email 중복 체크 (이메일이 있는 경우만)
    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: '이미 사용 중인 이메일입니다'
        });
      }
    }

    // 사용자 생성 (초기 비밀번호 저장)
    const user = await User.create({
      username,
      password_hash: password, // beforeCreate 훅에서 해싱됨
      initial_password: password, // 초기 비밀번호 평문 저장 (Admin 확인용)
      name,
      email: email || null,
      role,
      phone: phone || null,
      is_active: is_active !== undefined ? is_active : true,
      assigned_sales_id: role === 'brand' ? (assigned_sales_id || null) : null
    });

    res.status(201).json({
      success: true,
      message: '사용자가 생성되었습니다',
      data: user.toJSON()
    });
  } catch (error) {
    console.error('Create user error:', error);

    // Sequelize validation error
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: error.errors.map(e => e.message).join(', ')
      });
    }

    // Unique constraint error
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: '중복된 값이 존재합니다'
      });
    }

    res.status(500).json({
      success: false,
      message: '사용자 생성 중 오류가 발생했습니다'
    });
  }
});

// ============================================
// /:id 기반 라우트 (더 구체적인 경로가 먼저 정의되어야 함)
// ============================================

/**
 * @route   GET /api/users/:id
 * @desc    사용자 상세 조회
 * @access  Private (Admin only)
 */
router.get('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'username', 'name', 'email', 'role', 'phone', 'is_active', 'last_login', 'created_at', 'updated_at']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    사용자 수정
 * @access  Private (Admin only)
 */
router.put('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    const { username, password, name, email, role, phone, is_active } = req.body;

    // 업데이트할 필드 설정
    if (username) user.username = username;
    if (password) user.password_hash = password; // beforeUpdate 훅에서 해싱됨
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (is_active !== undefined) user.is_active = is_active;

    await user.save();

    res.json({
      success: true,
      message: '사용자 정보가 수정되었습니다',
      data: user.toJSON()
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 수정 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   PATCH /api/users/:id/deactivate
 * @desc    사용자 비활성화 (로그인 차단, 데이터 유지)
 * @access  Private (Admin only)
 */
router.patch('/:id/deactivate', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    // 비활성화
    user.is_active = false;
    await user.save();

    // 해당 사용자의 모든 리프레시 토큰 폐기 (즉시 로그아웃)
    const { RefreshToken } = require('../models');
    await RefreshToken.update(
      { is_revoked: true },
      { where: { user_id: user.id } }
    );

    res.json({
      success: true,
      message: '사용자가 비활성화되었습니다. 더 이상 로그인할 수 없습니다.'
    });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 비활성화 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   PATCH /api/users/:id/activate
 * @desc    사용자 활성화 (비활성화된 사용자 다시 활성화)
 * @access  Private (Admin only)
 */
router.patch('/:id/activate', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    // 활성화
    user.is_active = true;
    await user.save();

    res.json({
      success: true,
      message: '사용자가 활성화되었습니다. 다시 로그인할 수 있습니다.'
    });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 활성화 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   DELETE /api/users/:id
 * @desc    사용자 삭제 (연관 데이터 체크/위임/강제 삭제 지원)
 * @access  Private (Admin only)
 * @query   force - true면 연관 데이터 모두 삭제
 * @query   delegateTo - 연관 데이터를 위임할 사용자 ID
 */
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = parseInt(req.params.id, 10);
    const { force, delegateTo } = req.query;
    const user = await User.findByPk(userId);

    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    // 마스터 관리자는 삭제 불가
    if (user.username === 'achiladmin') {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: '마스터 관리자 계정은 삭제할 수 없습니다'
      });
    }

    const { RefreshToken, UserMemo, Notification, SheetMemo } = require('../models');

    // Step 1: 연관 데이터 조회
    const relatedData = {
      monthlyBrandsCreated: await MonthlyBrand.count({ where: { created_by: userId } }),
      campaignsCreated: await Campaign.count({ where: { created_by: userId } }),
      operatorAssignments: await CampaignOperator.count({ where: { operator_id: userId } }),
      brandMonthlyBrands: await MonthlyBrand.count({ where: { brand_id: userId } })
    };
    const hasRelatedData = Object.values(relatedData).some(v => v > 0);

    // Step 2: force 없이 연관 데이터 있으면 경고 반환
    if (hasRelatedData && force !== 'true' && !delegateTo) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        requiresAction: true,
        relatedData,
        user: { id: user.id, name: user.name, username: user.username, role: user.role },
        message: '이 사용자가 생성한 데이터가 있습니다. 다른 사용자에게 위임하거나 모두 삭제하세요.'
      });
    }

    // Step 3: delegateTo 파라미터 있으면 위임 처리
    if (delegateTo) {
      const targetUserId = parseInt(delegateTo, 10);
      const targetUser = await User.findByPk(targetUserId);

      if (!targetUser) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: '위임 대상 사용자를 찾을 수 없습니다'
        });
      }

      // 연월브랜드 위임
      await MonthlyBrand.update(
        { created_by: targetUserId },
        { where: { created_by: userId }, transaction }
      );

      // 캠페인 위임
      await Campaign.update(
        { created_by: targetUserId },
        { where: { created_by: userId }, transaction }
      );

      // 진행자 배정은 위임하지 않고 삭제 (다른 진행자에게 재배정 필요)
      // 아래에서 일괄 삭제됨
    }

    // Step 4: force=true면 연관 데이터 cascade 삭제
    if (force === 'true') {
      // 브랜드로 연결된 연월브랜드의 하위 데이터 삭제
      const brandMonthlyBrands = await MonthlyBrand.findAll({
        where: { brand_id: userId },
        transaction
      });

      for (const mb of brandMonthlyBrands) {
        // 캠페인 -> 품목 -> 구매자/이미지/슬롯 cascade 삭제
        const campaigns = await Campaign.findAll({ where: { monthly_brand_id: mb.id }, transaction });
        for (const campaign of campaigns) {
          const items = await Item.findAll({ where: { campaign_id: campaign.id }, transaction });
          for (const item of items) {
            // 이미지 삭제 (구매자 통해)
            const buyers = await Buyer.findAll({ where: { item_id: item.id }, transaction });
            for (const buyer of buyers) {
              await Image.destroy({ where: { buyer_id: buyer.id }, transaction });
            }
            await Buyer.destroy({ where: { item_id: item.id }, transaction });
            await ItemSlot.destroy({ where: { item_id: item.id }, transaction });
            await CampaignOperator.destroy({ where: { item_id: item.id }, transaction });
          }
          await Item.destroy({ where: { campaign_id: campaign.id }, transaction });
        }
        await Campaign.destroy({ where: { monthly_brand_id: mb.id }, transaction });
      }
      await MonthlyBrand.destroy({ where: { brand_id: userId }, transaction });

      // 영업사가 생성한 연월브랜드의 하위 데이터 삭제
      const createdMonthlyBrands = await MonthlyBrand.findAll({
        where: { created_by: userId },
        transaction
      });

      for (const mb of createdMonthlyBrands) {
        const campaigns = await Campaign.findAll({ where: { monthly_brand_id: mb.id }, transaction });
        for (const campaign of campaigns) {
          const items = await Item.findAll({ where: { campaign_id: campaign.id }, transaction });
          for (const item of items) {
            const buyers = await Buyer.findAll({ where: { item_id: item.id }, transaction });
            for (const buyer of buyers) {
              await Image.destroy({ where: { buyer_id: buyer.id }, transaction });
            }
            await Buyer.destroy({ where: { item_id: item.id }, transaction });
            await ItemSlot.destroy({ where: { item_id: item.id }, transaction });
            await CampaignOperator.destroy({ where: { item_id: item.id }, transaction });
          }
          await Item.destroy({ where: { campaign_id: campaign.id }, transaction });
        }
        await Campaign.destroy({ where: { monthly_brand_id: mb.id }, transaction });
      }
      await MonthlyBrand.destroy({ where: { created_by: userId }, transaction });

      // 영업사가 직접 생성한 캠페인 (연월브랜드 없이) 삭제
      const directCampaigns = await Campaign.findAll({
        where: { created_by: userId },
        transaction
      });

      for (const campaign of directCampaigns) {
        const items = await Item.findAll({ where: { campaign_id: campaign.id }, transaction });
        for (const item of items) {
          const buyers = await Buyer.findAll({ where: { item_id: item.id }, transaction });
          for (const buyer of buyers) {
            await Image.destroy({ where: { buyer_id: buyer.id }, transaction });
          }
          await Buyer.destroy({ where: { item_id: item.id }, transaction });
          await ItemSlot.destroy({ where: { item_id: item.id }, transaction });
          await CampaignOperator.destroy({ where: { item_id: item.id }, transaction });
        }
        await Item.destroy({ where: { campaign_id: campaign.id }, transaction });
      }
      await Campaign.destroy({ where: { created_by: userId }, transaction });
    }

    // Step 5: 기존 삭제 로직 (사용자 관련 부가 데이터)

    // 리프레시 토큰 삭제
    await RefreshToken.destroy({
      where: { user_id: userId },
      transaction
    });

    // 사용자 활동 로그 삭제
    await UserActivity.destroy({
      where: { user_id: userId },
      transaction
    });

    // 사용자 메모 삭제
    await UserMemo.destroy({
      where: { user_id: userId },
      transaction
    });

    // 알림 삭제
    await Notification.destroy({
      where: { user_id: userId },
      transaction
    });

    // 시트 메모 삭제
    await SheetMemo.destroy({
      where: { user_id: userId },
      transaction
    });

    // 브랜드-영업사 매핑 삭제
    await BrandSales.destroy({
      where: {
        [Op.or]: [
          { brand_id: userId },
          { sales_id: userId },
          { created_by: userId }
        ]
      },
      transaction
    });

    // 진행자 배정 삭제 (Operator인 경우)
    await CampaignOperator.destroy({
      where: { operator_id: userId },
      transaction
    });

    // 다른 사용자의 assigned_sales_id를 null로 설정
    await User.update(
      { assigned_sales_id: null },
      {
        where: { assigned_sales_id: userId },
        transaction
      }
    );

    // 사용자 삭제
    await user.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `사용자 "${user.name}" (${user.username})이(가) 삭제되었습니다.`
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 삭제 중 오류가 발생했습니다: ' + error.message
    });
  }
});

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    사용자 비밀번호 초기화
 * @access  Private (Admin only)
 */
router.post('/:id/reset-password', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    // 랜덤 임시 비밀번호 생성 (8자리)
    const tempPassword = Math.random().toString(36).slice(-8);

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // 비밀번호 및 초기 비밀번호 업데이트 (훅 우회)
    await User.update(
      {
        password_hash: hashedPassword,
        initial_password: tempPassword
      },
      {
        where: { id: user.id },
        individualHooks: false // beforeUpdate 훅 우회 (이미 해싱됨)
      }
    );

    res.json({
      success: true,
      message: '비밀번호가 초기화되었습니다',
      data: {
        new_password: tempPassword
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 초기화 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   GET /api/users/:id/activities
 * @desc    사용자 활동 로그 조회
 * @access  Private (Admin only)
 */
router.get('/:id/activities', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { limit = 50, offset = 0, date } = req.query;

    const whereClause = {
      user_id: req.params.id
    };

    // 날짜 필터
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      whereClause.created_at = {
        [Op.gte]: startDate,
        [Op.lt]: endDate
      };
    }

    const activities = await UserActivity.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: activities.rows,
      total: activities.count
    });
  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({
      success: false,
      message: '활동 로그 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   GET /api/users/:id/stats
 * @desc    사용자 활동 통계 조회
 * @access  Private (Admin only)
 */
router.get('/:id/stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const userId = req.params.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    // 날짜 범위
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    // 일별 로그인 횟수
    const dailyLogins = await UserActivity.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        user_id: userId,
        activity_type: 'login',
        created_at: { [Op.gte]: startDate }
      },
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role
        },
        daily_logins: dailyLogins
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 통계 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   GET /api/users/:id/campaigns
 * @desc    사용자의 캠페인 목록 조회 (역할에 따라 다른 결과)
 * @access  Private (Admin only)
 */
router.get('/:id/campaigns', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    let campaigns;

    if (user.role === 'sales') {
      // 영업사: 생성한 캠페인
      campaigns = await Campaign.findAll({
        where: { created_by: user.id },
        include: [
          { model: User, as: 'brand', attributes: ['id', 'name'] },
          { model: Item, as: 'items', attributes: ['id', 'product_name', 'status', 'keyword'] }
        ],
        order: [['created_at', 'DESC']]
      });
    } else if (user.role === 'operator') {
      // 진행자: 배정된 캠페인
      campaigns = await user.getAssignedCampaigns({
        include: [
          { model: User, as: 'brand', attributes: ['id', 'name'] },
          { model: User, as: 'creator', attributes: ['id', 'name'] },
          { model: Item, as: 'items', attributes: ['id', 'product_name', 'status', 'keyword'] }
        ],
        order: [['created_at', 'DESC']]
      });
    } else if (user.role === 'brand') {
      // 브랜드: 본인 브랜드의 캠페인
      campaigns = await Campaign.findAll({
        where: { brand_id: user.id },
        include: [
          { model: User, as: 'creator', attributes: ['id', 'name'] },
          { model: Item, as: 'items', attributes: ['id', 'product_name', 'status', 'keyword'] }
        ],
        order: [['created_at', 'DESC']]
      });
    } else {
      campaigns = [];
    }

    res.json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    console.error('Get user campaigns error:', error);
    res.status(500).json({
      success: false,
      message: '캠페인 목록 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   GET /api/users/:id/items
 * @desc    사용자의 품목 목록 조회
 * @access  Private (Admin only)
 */
router.get('/:id/items', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { campaign_id } = req.query;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    let items;
    const whereClause = {};

    if (campaign_id) {
      whereClause.campaign_id = campaign_id;
    }

    if (user.role === 'operator') {
      // 진행자: CampaignOperator를 통해 배정된 품목 조회
      const assignedItemIds = await CampaignOperator.findAll({
        where: { operator_id: user.id },
        attributes: ['item_id'],
        raw: true
      }).then(rows => rows.map(r => r.item_id).filter(id => id != null));

      if (assignedItemIds.length === 0) {
        items = [];
      } else {
        const itemWhereClause = { id: { [Op.in]: assignedItemIds } };
        if (campaign_id) {
          itemWhereClause.campaign_id = campaign_id;
        }
        items = await Item.findAll({
          where: itemWhereClause,
          include: [
            { model: Campaign, as: 'campaign', attributes: ['id', 'name'] }
          ],
          order: [['created_at', 'DESC']]
        });
      }
    } else if (user.role === 'sales') {
      // 영업사: 생성한 캠페인의 품목들
      const campaignIds = await Campaign.findAll({
        where: { created_by: user.id },
        attributes: ['id'],
        raw: true
      }).then(campaigns => campaigns.map(c => c.id));

      if (campaign_id) {
        if (!campaignIds.includes(parseInt(campaign_id))) {
          items = [];
        } else {
          items = await Item.findAll({
            where: { campaign_id },
            include: [
              { model: Campaign, as: 'campaign', attributes: ['id', 'name'] }
            ],
            order: [['created_at', 'DESC']]
          });
        }
      } else {
        items = await Item.findAll({
          where: { campaign_id: { [Op.in]: campaignIds } },
          include: [
            { model: Campaign, as: 'campaign', attributes: ['id', 'name'] }
          ],
          order: [['created_at', 'DESC']]
        });
      }
    } else if (user.role === 'brand') {
      // 브랜드: 본인 브랜드 캠페인의 품목들
      const campaignIds = await Campaign.findAll({
        where: { brand_id: user.id },
        attributes: ['id'],
        raw: true
      }).then(campaigns => campaigns.map(c => c.id));

      if (campaign_id) {
        if (!campaignIds.includes(parseInt(campaign_id))) {
          items = [];
        } else {
          items = await Item.findAll({
            where: { campaign_id },
            include: [
              { model: Campaign, as: 'campaign', attributes: ['id', 'name'] }
            ],
            order: [['created_at', 'DESC']]
          });
        }
      } else {
        items = await Item.findAll({
          where: { campaign_id: { [Op.in]: campaignIds } },
          include: [
            { model: Campaign, as: 'campaign', attributes: ['id', 'name'] }
          ],
          order: [['created_at', 'DESC']]
        });
      }
    } else {
      items = [];
    }

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Get user items error:', error);
    res.status(500).json({
      success: false,
      message: '품목 목록 조회 중 오류가 발생했습니다'
    });
  }
});

/**
 * @route   GET /api/users/:id/buyers
 * @desc    사용자의 구매자 목록 조회
 * @access  Private (Admin only)
 */
router.get('/:id/buyers', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { item_id } = req.query;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    let buyers;
    const whereClause = {};

    if (item_id) {
      whereClause.item_id = item_id;
    }

    if (user.role === 'operator') {
      // 진행자: CampaignOperator를 통해 배정된 품목의 구매자들
      const itemIds = await CampaignOperator.findAll({
        where: { operator_id: user.id },
        attributes: ['item_id'],
        raw: true
      }).then(rows => rows.map(r => r.item_id).filter(id => id != null));

      if (item_id) {
        if (!itemIds.includes(parseInt(item_id))) {
          buyers = [];
        } else {
          buyers = await Buyer.findAll({
            where: { item_id },
            include: [
              { model: Item, as: 'item', attributes: ['id', 'product_name'] }
            ],
            order: [['created_at', 'DESC']]
          });
        }
      } else if (itemIds.length === 0) {
        buyers = [];
      } else {
        buyers = await Buyer.findAll({
          where: { item_id: { [Op.in]: itemIds } },
          include: [
            { model: Item, as: 'item', attributes: ['id', 'product_name'] }
          ],
          order: [['created_at', 'DESC']]
        });
      }
    } else {
      // 다른 역할: 생성한 구매자들
      whereClause.created_by = user.id;
      buyers = await Buyer.findAll({
        where: whereClause,
        include: [
          { model: Item, as: 'item', attributes: ['id', 'product_name'] }
        ],
        order: [['created_at', 'DESC']]
      });
    }

    res.json({
      success: true,
      data: buyers
    });
  } catch (error) {
    console.error('Get user buyers error:', error);
    res.status(500).json({
      success: false,
      message: '구매자 목록 조회 중 오류가 발생했습니다'
    });
  }
});

module.exports = router;
