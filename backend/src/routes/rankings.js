const express = require('express');
const router = express.Router();
const rankingController = require('../controllers/rankingController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/categories', authenticate, rankingController.getCategories);

router.get('/latest', authenticate, authorize(['admin']), rankingController.getLatest);

router.get('/my-products', authenticate, authorize(['brand', 'admin']), rankingController.getMyProductsRankings);

module.exports = router;
