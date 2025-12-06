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

module.exports = router;
