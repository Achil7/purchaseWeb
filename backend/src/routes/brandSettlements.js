const express = require('express');
const router = express.Router();
const brandSettlementController = require('../controllers/brandSettlementController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// 브랜드사 > 연월브랜드 > 캠페인 3단 정산 요약 (admin 전용)
router.get('/summary', authorize(['admin']), brandSettlementController.getSummary);

// 영업사 본인 캠페인의 제품 단위 정산 요약 (sales 전용, admin 도 viewAsUserId 로 조회 가능)
router.get('/sales-products', authorize(['admin', 'sales']), brandSettlementController.getSalesProductSummary);

module.exports = router;
