const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

/**
 * JWT 토큰 생성
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );
};

/**
 * 인증 미들웨어 - JWT 토큰 검증
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 필요합니다'
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      // 사용자 조회
      const user = await User.findByPk(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: '사용자를 찾을 수 없습니다'
        });
      }

      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          message: '비활성화된 계정입니다'
        });
      }

      // req.user에 사용자 정보 저장
      req.user = user;
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: '토큰이 만료되었습니다'
        });
      }
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: '인증 처리 중 오류가 발생했습니다'
    });
  }
};

/**
 * 역할 기반 권한 체크 미들웨어
 * @param {string[]} allowedRoles - 허용된 역할 배열
 */
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '인증이 필요합니다'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '접근 권한이 없습니다'
      });
    }

    next();
  };
};

module.exports = {
  generateToken,
  authenticate,
  authorize,
  JWT_SECRET,
  JWT_EXPIRE
};
