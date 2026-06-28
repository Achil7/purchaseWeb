const express = require('express');
const router = express.Router();
const aiChatController = require('../controllers/aiChatController');
const { authenticate, authorize } = require('../middleware/auth');

// AI 챗 (Admin 전용, 컨트롤러에서 masterkangwoo 추가 검증)
router.post('/', authenticate, authorize(['admin']), aiChatController.chat);

module.exports = router;
