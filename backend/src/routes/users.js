const express = require('express');
const router = express.Router();
const { User } = require('../models');
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
      attributes: ['id', 'username', 'name', 'email', 'role', 'phone', 'is_active', 'last_login', 'created_at'],
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
 * @route   POST /api/users
 * @desc    사용자 생성
 * @access  Private (Admin only)
 */
router.post('/', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { username, password, name, email, role, phone, is_active } = req.body;

    // 필수 필드 검증
    if (!username || !password || !name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: '필수 필드를 모두 입력해주세요 (username, password, name, email, role)'
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

    // username 중복 체크
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: '이미 사용 중인 사용자명입니다'
      });
    }

    // email 중복 체크
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: '이미 사용 중인 이메일입니다'
      });
    }

    // 사용자 생성
    const user = await User.create({
      username,
      password_hash: password, // beforeCreate 훅에서 해싱됨
      name,
      email,
      role,
      phone: phone || null,
      is_active: is_active !== undefined ? is_active : true
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
 * @route   DELETE /api/users/:id
 * @desc    사용자 삭제 (비활성화)
 * @access  Private (Admin only)
 */
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    // 실제 삭제 대신 비활성화
    user.is_active = false;
    await user.save();

    res.json({
      success: true,
      message: '사용자가 비활성화되었습니다'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 삭제 중 오류가 발생했습니다'
    });
  }
});

module.exports = router;
