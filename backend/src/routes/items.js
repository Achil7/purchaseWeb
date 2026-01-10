const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/items/token/:token
 * @desc    토큰으로 품목 조회 (이미지 업로드 페이지용)
 * @access  Public
 */
router.get('/token/:token', itemController.getItemByToken);

/**
 * @route   GET /api/items
 * @desc    전체 품목 목록 (Admin용 - 진행자 배정)
 * @access  Private (Admin)
 */
router.get('/', authenticate, authorize(['admin']), itemController.getAllItems);

/**
 * @route   GET /api/items/my-assigned
 * @desc    내게 배정된 품목 목록 (Operator용)
 * @access  Private (Operator, Admin)
 */
router.get('/my-assigned', authenticate, authorize(['operator', 'admin']), itemController.getMyAssignedItems);

/**
 * @route   GET /api/items/my-monthly-brands
 * @desc    내게 배정된 연월브랜드 목록 (Operator용 - SalesLayout과 동일한 구조)
 * @access  Private (Operator, Admin)
 */
router.get('/my-monthly-brands', authenticate, authorize(['operator', 'admin']), itemController.getMyMonthlyBrands);

/**
 * @route   GET /api/items/my-preuploads
 * @desc    내게 배정된 품목 중 선 업로드가 있는 품목 (Operator용 - 알림)
 * @access  Private (Operator, Admin)
 */
router.get('/my-preuploads', authenticate, authorize(['operator', 'admin']), itemController.getMyPreUploads);

/**
 * @route   GET /api/items/by-brand
 * @desc    브랜드별 품목 목록 (Brand용 - 캠페인 없이 품목 직접 표시)
 * @access  Private (Brand, Admin)
 */
router.get('/by-brand', authenticate, authorize(['brand', 'admin']), itemController.getItemsByBrand);

/**
 * @route   GET /api/items/margin-summary
 * @desc    마진 대시보드 데이터 조회 (Admin: 전체, Sales: 자신의 캠페인만)
 * @access  Private (Admin, Sales)
 */
router.get('/margin-summary', authenticate, authorize(['admin', 'sales']), itemController.getMarginSummary);

/**
 * @route   GET /api/items/by-sales
 * @desc    영업사가 생성한 캠페인의 품목 목록 (Sales용 - 일별 조회)
 * @access  Private (Sales, Admin)
 */
router.get('/by-sales', authenticate, authorize(['sales', 'admin']), itemController.getItemsBySales);

/**
 * @route   GET /api/items/by-operator
 * @desc    진행자에게 배정된 품목 목록 (Operator용 - 일별 조회, 플랫 리스트)
 * @access  Private (Operator, Admin)
 */
router.get('/by-operator', authenticate, authorize(['operator', 'admin']), itemController.getItemsByOperator);

/**
 * @route   GET /api/items/campaign/:campaignId
 * @desc    캠페인의 품목 목록
 * @access  Private
 */
router.get('/campaign/:campaignId', authenticate, itemController.getItemsByCampaign);

/**
 * @route   POST /api/items/campaign/:campaignId
 * @desc    품목 생성
 * @access  Private (Sales, Admin)
 */
router.post('/campaign/:campaignId', authenticate, authorize(['sales', 'admin']), itemController.createItem);

/**
 * @route   POST /api/items/campaign/:campaignId/bulk
 * @desc    품목 일괄 생성 (여러 품목 동시 추가)
 * @access  Private (Sales, Admin)
 */
router.post('/campaign/:campaignId/bulk', authenticate, authorize(['sales', 'admin']), itemController.createItemsBulk);

/**
 * @route   GET /api/items/:id
 * @desc    품목 상세 조회
 * @access  Private
 */
router.get('/:id', authenticate, itemController.getItem);

/**
 * @route   PUT /api/items/:id
 * @desc    품목 수정
 * @access  Private (Owner, Admin)
 */
router.put('/:id', authenticate, itemController.updateItem);

/**
 * @route   POST /api/items/:id/operator
 * @desc    품목에 진행자 배정
 * @access  Private (Admin only)
 */
router.post('/:id/operator', authenticate, authorize(['admin']), itemController.assignOperatorToItem);

/**
 * @route   PUT /api/items/:id/operator
 * @desc    품목의 진행자 재배정
 * @access  Private (Admin only)
 */
router.put('/:id/operator', authenticate, authorize(['admin']), itemController.reassignOperatorToItem);

/**
 * @route   DELETE /api/items/:id/operator/:operatorId
 * @desc    품목에서 진행자 배정 해제
 * @access  Private (Admin only)
 */
router.delete('/:id/operator/:operatorId', authenticate, authorize(['admin']), itemController.unassignOperatorFromItem);

/**
 * @route   PATCH /api/items/:id/deposit-name
 * @desc    품목 입금명 수정
 * @access  Private (Operator, Admin, Sales)
 */
router.patch('/:id/deposit-name', authenticate, authorize(['operator', 'admin', 'sales']), itemController.updateDepositName);

/**
 * @route   PUT /api/items/:id/expense
 * @desc    품목 지출 입력/수정
 * @access  Private (Admin only)
 */
router.put('/:id/expense', authenticate, authorize(['admin']), itemController.updateItemExpense);

/**
 * @route   GET /api/items/:id/margin
 * @desc    단일 품목 마진 조회
 * @access  Private (Admin, Sales)
 */
router.get('/:id/margin', authenticate, authorize(['admin', 'sales']), itemController.getItemMargin);

/**
 * @route   DELETE /api/items/:id
 * @desc    품목 삭제
 * @access  Private (Owner, Admin)
 */
router.delete('/:id', authenticate, itemController.deleteItem);

module.exports = router;
