const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

/**
 * @route   POST /api/auth/login
 * @desc    로그인
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /api/auth/logout
 * @desc    로그아웃
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   GET /api/auth/me
 * @desc    현재 사용자 정보
 * @access  Private
 */
router.get('/me', authenticate, authController.getMe);

/**
 * @route   POST /api/auth/verify-password
 * @desc    비밀번호 재확인 (2차 검증)
 * @access  Private
 */
router.post('/verify-password', authenticate, authController.verifyPassword);

/**
 * @route   PUT /api/auth/profile
 * @desc    프로필 수정 (name, password)
 * @access  Private
 */
router.put('/profile', authenticate, authController.updateProfile);

/**
 * @route   POST /api/auth/mobile-login
 * @desc    모바일 로그인 (Access Token + Refresh Token 발급)
 * @access  Public
 */
router.post('/mobile-login', authController.mobileLogin);

/**
 * @route   POST /api/auth/refresh
 * @desc    Access Token 갱신
 * @access  Public
 */
router.post('/refresh', authController.refresh);

/**
 * @route   POST /api/auth/mobile-logout
 * @desc    모바일 로그아웃 (Refresh Token 폐기)
 * @access  Public
 */
router.post('/mobile-logout', authController.mobileLogout);

/**
 * @route   POST /api/auth/heartbeat
 * @desc    사용자 활동 상태 업데이트 (5분 주기)
 * @access  Private
 */
router.post('/heartbeat', authenticate, authController.heartbeat);

module.exports = router;
