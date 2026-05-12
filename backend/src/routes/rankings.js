const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/rankingController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/categories', authenticate, rankingController.getCategories);

router.get('/latest', authenticate, authorize(['admin']), rankingController.getLatest);

router.get('/my-products', authenticate, authorize(['brand', 'admin']), rankingController.getMyProductsRankings);

// 수집 트리거 (Admin / Brand 모두 가능, 캐시/lock/rate-limit 자동 처리)
router.post('/trigger', authenticate, authorize(['admin', 'brand']), rankingController.triggerCollection);

// 진행 상태 폴링 (인증된 누구나)
router.get('/progress', authenticate, rankingController.getProgress);

// 본인 일일 사용량 (admin/brand)
module.exports = router;
