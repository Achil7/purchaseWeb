const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const { authenticate, authorize } = require('../middleware/auth');

// 모든 라우트에 인증 필요
router.use(authenticate);

// Admin 전용
router.get('/months', authorize(['admin']), settlementController.getAvailableMonths);
router.get('/summary', authorize(['admin']), settlementController.getSummary);
router.get('/settings', authorize(['admin']), settlementController.getSettings);
router.put('/settings', authorize(['admin']), settlementController.updateSettings);
router.get('/', authorize(['admin']), settlementController.getSettlements);
router.get('/:id', authorize(['admin']), settlementController.getSettlementById);
router.post('/bulk', authorize(['admin']), settlementController.createSettlementsBulk);
router.post('/', authorize(['admin']), settlementController.createSettlement);
router.put('/:id', authorize(['admin']), settlementController.updateSettlement);
router.delete('/:id', authorize(['admin']), settlementController.deleteSettlement);

module.exports = router;
