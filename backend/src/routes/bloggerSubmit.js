const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/bloggerSubmitController');

// 공개 토큰 기반 (인증 불필요)
router.get('/:token', ctrl.getByToken);
router.post('/:token', ctrl.submit);

module.exports = router;
