const { User, UserActivity } = require('../models');
const {
  generateToken,
  generateAccessToken,
  createRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllUserTokens
} = require('../middleware/auth');

/**
 * 로그인
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 입력값 검증
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '아이디와 비밀번호를 입력해주세요'
      });
    }

    // 사용자 조회
    const user = await User.findOne({ where: { username } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '아이디 또는 비밀번호가 올바르지 않습니다'
      });
    }

    // 계정 활성화 여부 확인
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: '비활성화된 계정입니다. 관리자에게 문의하세요'
      });
    }

    // 비밀번호 검증
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '아이디 또는 비밀번호가 올바르지 않습니다'
      });
    }

    // 마지막 로그인 시간 및 활동 시간 업데이트
    const now = new Date();
    await user.update({ last_login: now, last_activity: now });

    // 로그인 활동 기록
    await UserActivity.create({
      user_id: user.id,
      activity_type: 'login',
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.get('User-Agent')?.substring(0, 500)
    });

    // JWT 토큰 생성
    const token = generateToken(user);

    res.json({
      success: true,
      message: '로그인 성공',
      data: {
        token,
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: '로그인 처리 중 오류가 발생했습니다'
    });
  }
};

/**
 * 로그아웃
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    // 로그아웃 활동 기록
    await UserActivity.create({
      user_id: req.user.id,
      activity_type: 'logout',
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.get('User-Agent')?.substring(0, 500)
    });

    res.json({
      success: true,
      message: '로그아웃 성공'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({
      success: true,
      message: '로그아웃 성공'
    });
  }
};

/**
 * Heartbeat - 사용자 활동 상태 업데이트
 * POST /api/auth/heartbeat
 */
const heartbeat = async (req, res) => {
  try {
    const now = new Date();

    // last_activity 업데이트
    await User.update(
      { last_activity: now },
      { where: { id: req.user.id } }
    );

    // heartbeat 활동 기록 (선택적 - 로그가 많아질 수 있음)
    // await UserActivity.create({
    //   user_id: req.user.id,
    //   activity_type: 'heartbeat',
    //   ip_address: req.ip || req.connection?.remoteAddress
    // });

    res.json({
      success: true,
      timestamp: now
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({
      success: false,
      message: '활동 상태 업데이트 실패'
    });
  }
};

/**
 * 현재 사용자 정보 조회
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    // authenticate 미들웨어에서 req.user가 설정됨
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      data: user.toJSON()
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 정보 조회 중 오류가 발생했습니다'
    });
  }
};

/**
 * 비밀번호 재확인 (2차 검증)
 * POST /api/auth/verify-password
 */
const verifyPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: '비밀번호를 입력해주세요'
      });
    }

    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '비밀번호가 일치하지 않습니다'
      });
    }

    res.json({
      success: true,
      message: '비밀번호 확인 완료'
    });
  } catch (error) {
    console.error('VerifyPassword error:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 확인 중 오류가 발생했습니다'
    });
  }
};

/**
 * 프로필 수정 (name, password)
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { name, newPassword } = req.body;

    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다'
      });
    }

    // name 업데이트
    if (name && name.trim()) {
      user.name = name.trim();
    }

    // 비밀번호 업데이트 (beforeUpdate 훅에서 해싱됨)
    if (newPassword && newPassword.length >= 4) {
      user.password_hash = newPassword;
      // Admin이 볼 수 있도록 초기 비밀번호 필드도 업데이트
      user.initial_password = newPassword;
    }

    await user.save();

    res.json({
      success: true,
      message: '프로필이 수정되었습니다',
      data: user.toJSON()
    });
  } catch (error) {
    console.error('UpdateProfile error:', error);
    res.status(500).json({
      success: false,
      message: '프로필 수정 중 오류가 발생했습니다'
    });
  }
};

/**
 * 모바일 로그인 (Access Token + Refresh Token 발급)
 * POST /api/auth/mobile-login
 */
const mobileLogin = async (req, res) => {
  try {
    const { username, password, deviceInfo } = req.body;

    // 입력값 검증
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '아이디와 비밀번호를 입력해주세요'
      });
    }

    // 사용자 조회
    const user = await User.findOne({ where: { username } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '아이디 또는 비밀번호가 올바르지 않습니다'
      });
    }

    // 계정 활성화 여부 확인
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: '비활성화된 계정입니다. 관리자에게 문의하세요'
      });
    }

    // 비밀번호 검증
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '아이디 또는 비밀번호가 올바르지 않습니다'
      });
    }

    // 마지막 로그인 시간 업데이트
    await user.update({ last_login: new Date() });

    // Access Token (15분) 생성
    const accessToken = generateAccessToken(user);

    // Refresh Token (30일) 생성 및 저장
    const refreshToken = await createRefreshToken(user, deviceInfo);

    res.json({
      success: true,
      message: '로그인 성공',
      data: {
        accessToken,
        refreshToken,
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Mobile login error:', error);
    res.status(500).json({
      success: false,
      message: '로그인 처리 중 오류가 발생했습니다'
    });
  }
};

/**
 * Access Token 갱신
 * POST /api/auth/refresh
 */
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: '리프레시 토큰이 필요합니다'
      });
    }

    const result = await refreshAccessToken(refreshToken);

    res.json({
      success: true,
      message: '토큰 갱신 성공',
      data: {
        accessToken: result.accessToken,
        user: result.user
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: error.message || '토큰 갱신에 실패했습니다'
    });
  }
};

/**
 * 모바일 로그아웃 (Refresh Token 폐기)
 * POST /api/auth/mobile-logout
 */
const mobileLogout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    res.json({
      success: true,
      message: '로그아웃 성공'
    });
  } catch (error) {
    console.error('Mobile logout error:', error);
    res.status(500).json({
      success: false,
      message: '로그아웃 처리 중 오류가 발생했습니다'
    });
  }
};

module.exports = {
  login,
  logout,
  getMe,
  verifyPassword,
  updateProfile,
  mobileLogin,
  refresh,
  mobileLogout,
  heartbeat
};
