const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/items
 * @desc    전체 품목 목록 (Admin용 - 진행자 배정)
 * @access  Private (Admin)
 */
router.get('/', authenticate, authorize(['admin']), itemController.getAllItems);

/**
 * @route   GET /api/items/my-assigned
 * @desc    내게 배정된 품목 목록 (Operator용)
 * @access  Private (Operator)
 */
router.get('/my-assigned', authenticate, authorize(['operator']), itemController.getMyAssignedItems);

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
 * @route   DELETE /api/items/:id/operator/:operatorId
 * @desc    품목에서 진행자 배정 해제
 * @access  Private (Admin only)
 */
router.delete('/:id/operator/:operatorId', authenticate, authorize(['admin']), itemController.unassignOperatorFromItem);

/**
 * @route   DELETE /api/items/:id
 * @desc    품목 삭제
 * @access  Private (Owner, Admin)
 */
router.delete('/:id', authenticate, itemController.deleteItem);

module.exports = router;
