const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/rankingController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/categories', authenticate, rankingController.getCategories);

router.get('/latest', authenticate, authorize(['admin']), rankingController.getLatest);

// 시계열 분석 API (Admin 전용)
router.get('/changes', authenticate, authorize(['admin']), rankingController.getChanges);
// history는 추이 모달 재사용을 위해 brand에도 허용 (공개 BEST 100 데이터라 민감하지 않음)
router.get('/history', authenticate, authorize(['admin', 'brand']), rankingController.getHistory);
router.get('/insights', authenticate, authorize(['admin']), rankingController.getInsights);

router.get('/my-products', authenticate, authorize(['brand', 'admin']), rankingController.getMyProductsRankings);
// 자사 제품 종합 변동/추이/이탈/요약/인사이트 (Brand 전용 화면용)
router.get('/my-changes', authenticate, authorize(['brand', 'admin']), rankingController.getMyChanges);

// 수집 트리거 (Admin / Brand 모두 가능, 캐시/lock/rate-limit 자동 처리)
router.post('/trigger', authenticate, authorize(['admin', 'brand']), rankingController.triggerCollection);

// 진행 상태 폴링 (인증된 누구나)
router.get('/progress', authenticate, rankingController.getProgress);

// 본인 일일 사용량 (admin/brand)
module.exports = router;
