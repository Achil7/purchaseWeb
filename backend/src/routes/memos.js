const express = require('express');
const router = express.Router();
const memoController = require('../controllers/memoController');
const { authenticate } = require('../middleware/auth');

// 모든 라우트에 인증 필요
router.use(authenticate);

// 내 메모 조회
router.get('/me', memoController.getMyMemo);

// 내 메모 저장
router.put('/me', memoController.saveMyMemo);

module.exports = router;
