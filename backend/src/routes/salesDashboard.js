const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/salesDashboardController');

router.get('/brands',       authenticate, authorize(['sales', 'admin']), ctrl.getBrands);
router.get('/months',       authenticate, authorize(['sales', 'admin']), ctrl.getMonths);
router.get('/overview',     authenticate, authorize(['sales', 'admin']), ctrl.getOverview);
router.get('/product-list', authenticate, authorize(['sales', 'admin']), ctrl.getProductList);

module.exports = router;
