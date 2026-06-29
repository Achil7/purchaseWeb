const express = require('express');
const router = express.Router();
const bloggerController = require('../controllers/bloggerController');
const { authenticate, authorize } = require('../middleware/auth');

// 목록 조회 (admin: 전체+내부필드 / brand: 노출중인 것만)
router.get('/', authenticate, authorize(['admin', 'brand']), bloggerController.getBloggers);

// 등록/수정/삭제/노출토글 (admin 전용)
router.post('/', authenticate, authorize(['admin']), bloggerController.createBlogger);
router.put('/:id', authenticate, authorize(['admin']), bloggerController.updateBlogger);
router.delete('/:id', authenticate, authorize(['admin']), bloggerController.deleteBlogger);
router.patch('/:id/active', authenticate, authorize(['admin']), bloggerController.toggleActive);

module.exports = router;
