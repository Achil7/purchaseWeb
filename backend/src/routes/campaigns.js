const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/campaigns
 * @desc    캠페인 목록 조회 (역할별 필터링)
 * @access  Private
 */
router.get('/', authenticate, campaignController.getCampaigns);

/**
 * @route   POST /api/campaigns
 * @desc    캠페인 생성
 * @access  Private (Sales, Admin)
 */
router.post('/', authenticate, authorize(['sales', 'admin']), campaignController.createCampaign);

/**
 * @route   GET /api/campaigns/:id
 * @desc    캠페인 상세 조회
 * @access  Private
 */
router.get('/:id', authenticate, campaignController.getCampaign);

/**
 * @route   PUT /api/campaigns/:id
 * @desc    캠페인 수정
 * @access  Private (Owner, Admin)
 */
router.put('/:id', authenticate, campaignController.updateCampaign);

/**
 * @route   DELETE /api/campaigns/:id
 * @desc    캠페인 삭제
 * @access  Private (Owner, Admin)
 */
router.delete('/:id', authenticate, campaignController.deleteCampaign);

/**
 * @route   DELETE /api/campaigns/:id/cascade
 * @desc    캠페인 강제 삭제 - 모든 관련 데이터 cascading delete
 * @access  Private (Admin, Sales - 자신의 캠페인, Operator - 배정받은 캠페인)
 */
router.delete('/:id/cascade', authenticate, authorize(['admin', 'sales', 'operator']), campaignController.deleteCampaignCascade);

/**
 * @route   PATCH /api/campaigns/:id/hide
 * @desc    캠페인 숨기기
 * @access  Private (Sales, Admin, Operator, Brand)
 */
router.patch('/:id/hide', authenticate, campaignController.hideCampaign);

/**
 * @route   PATCH /api/campaigns/:id/restore
 * @desc    캠페인 복구
 * @access  Private (Sales, Admin, Operator, Brand)
 */
router.patch('/:id/restore', authenticate, campaignController.restoreCampaign);

/**
 * @route   POST /api/campaigns/:id/operators
 * @desc    진행자 배정
 * @access  Private (Admin only)
 */
router.post('/:id/operators', authenticate, authorize(['admin']), campaignController.assignOperator);

/**
 * @route   DELETE /api/campaigns/:campaignId/operators/:operatorId
 * @desc    진행자 배정 해제
 * @access  Private (Admin only)
 */
router.delete('/:campaignId/operators/:operatorId', authenticate, authorize(['admin']), campaignController.unassignOperator);

/**
 * @route   GET /api/campaigns/:id/operators
 * @desc    배정된 진행자 목록
 * @access  Private
 */
router.get('/:id/operators', authenticate, campaignController.getOperators);

/**
 * @route   PATCH /api/campaigns/:id/change-sales
 * @desc    캠페인 영업사 변경 (Admin 전용)
 * @access  Private (Admin only)
 */
router.patch('/:id/change-sales', authenticate, authorize(['admin']), campaignController.changeSales);

module.exports = router;
