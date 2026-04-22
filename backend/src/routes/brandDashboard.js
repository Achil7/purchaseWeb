const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const brandDashboardController = require('../controllers/brandDashboardController');

router.get(
  '/overview',
  authenticate,
  authorize(['brand', 'admin']),
  brandDashboardController.getOverview
);

router.get(
  '/product-rollup',
  authenticate,
  authorize(['brand', 'admin']),
  brandDashboardController.getProductRollup
);

module.exports = router;
