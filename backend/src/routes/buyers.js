const express = require('express');
const router = express.Router();
const buyerController = require('../controllers/buyerController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/buyers/by-month
 * @desc    월별 구매자 조회 (이미지 업로드 날짜 기준, Asia/Seoul)
 * @access  Private (Operator, Sales, Admin)
 */
router.get('/by-month', authenticate, authorize(['operator', 'sales', 'admin']), buyerController.getBuyersByMonth);

/**
 * @route   GET /api/buyers/by-date
 * @desc    일별 구매자 조회 (이미지 업로드 날짜 기준, Asia/Seoul)
 * @access  Private (Operator, Sales, Admin)
 */
router.get('/by-date', authenticate, authorize(['operator', 'sales', 'admin']), buyerController.getBuyersByDate);

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
 * @route   POST /api/buyers/item/:itemId/bulk
 * @desc    다중 구매자 일괄 추가
 * @access  Private (Operator, Admin)
 */
router.post('/item/:itemId/bulk', authenticate, authorize(['operator', 'admin']), buyerController.createBuyersBulk);

/**
 * @route   POST /api/buyers/item/:itemId/tracking-bulk
 * @desc    송장번호 일괄 입력 (구매자 등록 순서대로 매칭)
 * @access  Private (Admin only)
 */
router.post('/item/:itemId/tracking-bulk', authenticate, authorize(['admin']), buyerController.updateTrackingNumbersBulk);

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

/**
 * @route   PATCH /api/buyers/:id/tracking
 * @desc    송장번호 수정 (영업사, 관리자)
 * @access  Private (Sales, Admin)
 */
router.patch('/:id/tracking', authenticate, authorize(['sales', 'admin']), buyerController.updateTrackingNumber);

/**
 * @route   PATCH /api/buyers/:id/tracking-info
 * @desc    송장정보(송장번호+택배사) 수정 (관리자)
 * @access  Private (Admin only)
 */
router.patch('/:id/tracking-info', authenticate, authorize(['admin']), buyerController.updateTrackingInfo);

/**
 * @route   PATCH /api/buyers/:id/shipping-delayed
 * @desc    배송지연 상태 토글 (Admin, Operator)
 * @access  Private (Admin, Operator)
 */
router.patch('/:id/shipping-delayed', authenticate, authorize(['admin', 'operator']), buyerController.toggleShippingDelayed);

/**
 * @route   PATCH /api/buyers/:id/courier
 * @desc    택배사 수정 (Admin)
 * @access  Private (Admin only)
 */
router.patch('/:id/courier', authenticate, authorize(['admin']), buyerController.updateCourierCompany);

module.exports = router;
