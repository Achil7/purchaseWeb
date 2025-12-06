const { User } = require('../models');
const { generateToken } = require('../middleware/auth');

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

    // 마지막 로그인 시간 업데이트
    await user.update({ last_login: new Date() });

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
  // JWT는 stateless이므로 서버에서 할 작업은 없음
  // 클라이언트에서 토큰을 삭제하면 됨
  res.json({
    success: true,
    message: '로그아웃 성공'
  });
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

module.exports = {
  login,
  logout,
  getMe,
  verifyPassword,
  updateProfile
};
