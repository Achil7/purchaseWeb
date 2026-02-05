const express = require('express');
const router = express.Router();
const itemSlotController = require('../controllers/itemSlotController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/item-slots/item/:itemId
 * @desc    품목별 슬롯 목록 조회
 * @access  Private (Sales, Admin, Operator)
 */
router.get('/item/:itemId', authenticate, authorize(['sales', 'admin', 'operator']), itemSlotController.getSlotsByItem);

/**
 * @route   GET /api/item-slots/campaign/:campaignId
 * @desc    캠페인별 전체 슬롯 조회
 * @access  Private (Sales, Admin, Brand)
 */
router.get('/campaign/:campaignId', authenticate, authorize(['sales', 'admin', 'brand']), itemSlotController.getSlotsByCampaign);

/**
 * @route   GET /api/item-slots/operator/campaign/:campaignId
 * @desc    Operator용 캠페인별 배정된 슬롯만 조회
 * @access  Private (Operator, Admin)
 */
router.get('/operator/campaign/:campaignId', authenticate, authorize(['operator', 'admin']), itemSlotController.getSlotsByCampaignForOperator);

/**
 * @route   GET /api/item-slots/operator/my-assigned
 * @desc    Operator용 전체 배정된 슬롯 조회
 * @access  Private (Operator, Admin)
 */
router.get('/operator/my-assigned', authenticate, authorize(['operator', 'admin']), itemSlotController.getMyAssignedSlots);

/**
 * @route   GET /api/item-slots/by-date
 * @desc    날짜별 슬롯 조회 (날짜별 작업 페이지용)
 * @access  Private (Operator, Sales, Admin)
 */
router.get('/by-date', authenticate, authorize(['operator', 'sales', 'admin']), itemSlotController.getSlotsByDate);

/**
 * @route   POST /api/item-slots
 * @desc    슬롯 추가 (구매자 행 추가)
 * @access  Private (Sales, Admin, Operator)
 */
router.post('/', authenticate, authorize(['sales', 'admin', 'operator']), itemSlotController.createSlot);

/**
 * @route   PUT /api/item-slots/:id
 * @desc    슬롯 개별 수정
 * @access  Private (Sales, Admin, Operator)
 */
router.put('/:id', authenticate, authorize(['sales', 'admin', 'operator']), itemSlotController.updateSlot);

/**
 * @route   PUT /api/item-slots/bulk
 * @desc    다중 슬롯 일괄 수정
 * @access  Private (Sales, Admin, Operator)
 */
router.put('/bulk/update', authenticate, authorize(['sales', 'admin', 'operator']), itemSlotController.updateSlotsBulk);

/**
 * @route   GET /api/item-slots/token/:token
 * @desc    슬롯 토큰으로 정보 조회 (이미지 업로드 페이지용)
 * @access  Public
 */
router.get('/token/:token', itemSlotController.getSlotByToken);

/**
 * @route   DELETE /api/item-slots/bulk/delete
 * @desc    다중 슬롯 삭제 (행 단위)
 * @access  Private (Sales, Admin, Operator)
 */
router.delete('/bulk/delete', authenticate, authorize(['sales', 'admin', 'operator']), itemSlotController.deleteSlotsBulk);

/**
 * @route   DELETE /api/item-slots/group/:itemId/:dayGroup
 * @desc    그룹별 슬롯 삭제 (day_group 기준)
 * @access  Private (Sales, Admin, Operator)
 */
router.delete('/group/:itemId/:dayGroup', authenticate, authorize(['sales', 'admin', 'operator']), itemSlotController.deleteSlotsByGroup);

/**
 * @route   DELETE /api/item-slots/item/:itemId
 * @desc    품목의 모든 슬롯 삭제
 * @access  Private (Sales, Admin)
 */
router.delete('/item/:itemId', authenticate, authorize(['sales', 'admin']), itemSlotController.deleteSlotsByItem);

/**
 * @route   DELETE /api/item-slots/:id
 * @desc    개별 슬롯 삭제
 * @access  Private (Sales, Admin, Operator)
 */
router.delete('/:id', authenticate, authorize(['sales', 'admin', 'operator']), itemSlotController.deleteSlot);

/**
 * @route   POST /api/item-slots/:slotId/split-day-group
 * @desc    일 마감 - 해당 슬롯 이후의 행들을 새로운 day_group으로 분할
 * @access  Private (Sales, Admin, Operator)
 */
router.post('/:slotId/split-day-group', authenticate, authorize(['sales', 'admin', 'operator']), itemSlotController.splitDayGroup);

/**
 * @route   POST /api/item-slots/suspend
 * @desc    day_group 중단 처리 (배정 해제 + 중단 상태로 변경)
 * @access  Private (Admin)
 */
router.post('/suspend', authenticate, authorize(['admin']), itemSlotController.suspendDayGroup);

/**
 * @route   POST /api/item-slots/resume
 * @desc    day_group 재개 처리 (중단 상태 해제)
 * @access  Private (Admin)
 */
router.post('/resume', authenticate, authorize(['admin']), itemSlotController.resumeDayGroup);

module.exports = router;
