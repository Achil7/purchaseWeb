const express = require('express');
const router = express.Router();
const brandSettlementController = require('../controllers/brandSettlementController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Admin 전용: 브랜드사 > 연월브랜드 > 캠페인 3단 정산 요약
router.get('/summary', authorize(['admin']), brandSettlementController.getSummary);

module.exports = router;
