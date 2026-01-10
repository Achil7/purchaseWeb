const express = require('express');
const router = express.Router();
const multer = require('multer');
const settingController = require('../controllers/settingController');
const { authenticate, authorize } = require('../middleware/auth');

// multer 설정
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다'), false);
    }
  }
});

/**
 * @route   GET /api/settings/login
 * @desc    로그인 페이지 설정 조회 (Public)
 * @access  Public
 */
router.get('/login', settingController.getLoginSettings);

/**
 * @route   PUT /api/settings/login
 * @desc    로그인 페이지 설정 수정
 * @access  Private (Admin)
 */
router.put('/login', authenticate, authorize(['admin']), settingController.updateLoginSettings);

/**
 * @route   POST /api/settings/login/banner
 * @desc    로그인 배너 이미지 업로드
 * @access  Private (Admin)
 */
router.post('/login/banner', authenticate, authorize(['admin']), upload.single('image'), settingController.uploadLoginBanner);

/**
 * @route   DELETE /api/settings/login/banner
 * @desc    로그인 배너 이미지 삭제
 * @access  Private (Admin)
 */
router.delete('/login/banner', authenticate, authorize(['admin']), settingController.deleteLoginBanner);

module.exports = router;
