const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/buyerAnalyticsController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/buyer-analytics/accounts
 * @desc    계좌(account_normalized) 단위 구매자 통계 집계
 * @access  Private (Admin, Operator)
 */
router.get('/accounts', authenticate, authorize(['admin', 'operator']), ctrl.getAccounts);

/**
 * @route   GET /api/buyer-analytics/accounts/:accountNormalized/buyers
 * @desc    특정 계좌에 묶인 buyer 상세 목록
 * @access  Private (Admin, Operator)
 */
router.get('/accounts/:accountNormalized/buyers', authenticate, authorize(['admin', 'operator']), ctrl.getAccountBuyers);

module.exports = router;
