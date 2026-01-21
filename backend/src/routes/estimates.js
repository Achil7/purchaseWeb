const express = require('express');
const router = express.Router();
const estimateController = require('../controllers/estimateController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 모든 라우트에 인증 필요
router.use(authenticateToken);

// Admin 전용 라우트
router.get('/', requireAdmin, estimateController.getEstimates);
router.get('/summary', requireAdmin, estimateController.getEstimateSummary);
router.get('/:id', requireAdmin, estimateController.getEstimateById);
router.post('/', requireAdmin, estimateController.createEstimate);
router.put('/:id', requireAdmin, estimateController.updateEstimate);
router.delete('/:id', requireAdmin, estimateController.deleteEstimate);

module.exports = router;
