const express = require('express');
const router = express.Router();
const estimateController = require('../controllers/estimateController');
const { authenticate, authorize } = require('../middleware/auth');

// 모든 라우트에 인증 필요
router.use(authenticate);

// Admin 전용 라우트
router.get('/', authorize(['admin']), estimateController.getEstimates);
router.get('/summary', authorize(['admin']), estimateController.getEstimateSummary);
router.get('/:id', authorize(['admin']), estimateController.getEstimateById);
router.post('/', authorize(['admin']), estimateController.createEstimate);
router.put('/:id', authorize(['admin']), estimateController.updateEstimate);
router.delete('/:id', authorize(['admin']), estimateController.deleteEstimate);

module.exports = router;
