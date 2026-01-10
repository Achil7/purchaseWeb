const jwt = require('jsonwebtoken');
const { User, RefreshToken } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// 모바일용 짧은 Access Token (15분)
const ACCESS_TOKEN_EXPIRE = '15m';
// Refresh Token 유효기간 (30일)
const REFRESH_TOKEN_EXPIRE_DAYS = 30;

/**
 * JWT 토큰 생성 (기존 웹용 - 7일 유효)
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
 * 짧은 Access Token 생성 (모바일용 - 15분 유효)
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRE }
  );
};

/**
 * Refresh Token 생성 및 저장
 */
const createRefreshToken = async (user, deviceInfo = null) => {
  const token = RefreshToken.generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRE_DAYS);

  await RefreshToken.create({
    user_id: user.id,
    token,
    device_info: deviceInfo,
    expires_at: expiresAt
  });

  return token;
};

/**
 * Refresh Token 검증 및 새 Access Token 발급
 */
const refreshAccessToken = async (refreshToken) => {
  const storedToken = await RefreshToken.findOne({
    where: { token: refreshToken },
    include: [{ model: User, as: 'user' }]
  });

  if (!storedToken) {
    throw new Error('유효하지 않은 리프레시 토큰입니다');
  }

  if (!storedToken.isValid()) {
    throw new Error('리프레시 토큰이 만료되었거나 폐기되었습니다');
  }

  if (!storedToken.user || !storedToken.user.is_active) {
    throw new Error('비활성화된 계정입니다');
  }

  // 새 Access Token 발급
  const accessToken = generateAccessToken(storedToken.user);

  return {
    accessToken,
    user: storedToken.user.toJSON()
  };
};

/**
 * 사용자의 모든 Refresh Token 폐기 (로그아웃 시)
 */
const revokeAllUserTokens = async (userId) => {
  await RefreshToken.update(
    { is_revoked: true },
    { where: { user_id: userId, is_revoked: false } }
  );
};

/**
 * 특정 Refresh Token 폐기
 */
const revokeRefreshToken = async (token) => {
  await RefreshToken.update(
    { is_revoked: true },
    { where: { token } }
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
  generateAccessToken,
  createRefreshToken,
  refreshAccessToken,
  revokeAllUserTokens,
  revokeRefreshToken,
  authenticate,
  authorize,
  JWT_SECRET,
  JWT_EXPIRE,
  ACCESS_TOKEN_EXPIRE,
  REFRESH_TOKEN_EXPIRE_DAYS
};
