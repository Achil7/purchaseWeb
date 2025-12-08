const express = require('express');
const router = express.Router();
const buyerController = require('../controllers/buyerController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/buyers/item/:itemId
 * @desc    품목의 구매자 목록
 * @access  Private
 */
router.get('/item/:itemId', authenticate, buyerController.getBuyersByItem);

/**
 * @route   POST /api/buyers/item/:itemId
 * @desc    구매자 추가
 * @access  Private (Operator, Admin)
 */
router.post('/item/:itemId', authenticate, authorize(['operator', 'admin']), buyerController.createBuyer);

/**
 * @route   POST /api/buyers/item/:itemId/parse
 * @desc    슬래시 구분 데이터 파싱 후 구매자 추가
 * @access  Private (Operator, Admin)
 */
router.post('/item/:itemId/parse', authenticate, authorize(['operator', 'admin']), buyerController.parseBuyer);

/**
 * @route   GET /api/buyers/:id
 * @desc    구매자 상세 조회
 * @access  Private
 */
router.get('/:id', authenticate, buyerController.getBuyer);

/**
 * @route   PUT /api/buyers/:id
 * @desc    구매자 수정
 * @access  Private (Operator, Admin)
 */
router.put('/:id', authenticate, authorize(['operator', 'admin']), buyerController.updateBuyer);

/**
 * @route   DELETE /api/buyers/:id
 * @desc    구매자 삭제
 * @access  Private (Operator, Admin)
 */
router.delete('/:id', authenticate, authorize(['operator', 'admin']), buyerController.deleteBuyer);

/**
 * @route   PATCH /api/buyers/:id/payment
 * @desc    입금 확인 (총관리자만)
 * @access  Private (Admin only)
 */
router.patch('/:id/payment', authenticate, authorize(['admin']), buyerController.confirmPayment);

module.exports = router;
