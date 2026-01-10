const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   POST /api/images/upload/:token
 * @desc    토큰 기반 다중 이미지 업로드 (계좌번호 매칭)
 * @access  Public (토큰 검증)
 */
router.post('/upload/:token', imageController.uploadMiddleware, imageController.uploadImages);

/**
 * @route   GET /api/images/item/:itemId
 * @desc    품목의 이미지 목록
 * @access  Private
 */
router.get('/item/:itemId', authenticate, imageController.getImagesByItem);

/**
 * @route   DELETE /api/images/:id
 * @desc    이미지 삭제
 * @access  Private (Operator, Admin)
 */
router.delete('/:id', authenticate, authorize(['operator', 'admin', 'sales']), imageController.deleteImage);

module.exports = router;
