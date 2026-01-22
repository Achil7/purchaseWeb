const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/images/search-buyers/:token
 * @desc    이름으로 구매자 검색 (업로드 페이지용)
 * @access  Public (토큰 검증)
 */
router.get('/search-buyers/:token', imageController.searchBuyersByName);

/**
 * @route   POST /api/images/upload/:token
 * @desc    토큰 기반 다중 이미지 업로드 (buyer_ids 직접 매칭)
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

/**
 * @route   GET /api/images/pending
 * @desc    대기 중인 재제출 이미지 목록 (Admin)
 * @access  Private (Admin)
 */
router.get('/pending', authenticate, authorize(['admin']), imageController.getPendingImages);

/**
 * @route   GET /api/images/pending/count
 * @desc    대기 중인 재제출 이미지 개수 (Admin 알림 배지용)
 * @access  Private (Admin)
 */
router.get('/pending/count', authenticate, authorize(['admin']), imageController.getPendingCount);

/**
 * @route   POST /api/images/:id/approve
 * @desc    재제출 이미지 승인 (Admin)
 * @access  Private (Admin)
 */
router.post('/:id/approve', authenticate, authorize(['admin']), imageController.approveImage);

/**
 * @route   POST /api/images/:id/reject
 * @desc    재제출 이미지 거절 (Admin)
 * @access  Private (Admin)
 */
router.post('/:id/reject', authenticate, authorize(['admin']), imageController.rejectImage);

module.exports = router;
