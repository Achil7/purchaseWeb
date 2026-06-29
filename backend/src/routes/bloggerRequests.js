const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/bloggerRequestController');
const { authenticate, authorize } = require('../middleware/auth');

// 협의 요청 생성 (brand, admin)
router.post('/', authenticate, authorize(['brand', 'admin']), ctrl.createRequest);

// 내 요청 목록 (brand 본인 / admin 대리)
router.get('/my', authenticate, authorize(['brand', 'admin']), ctrl.getMyRequests);

// 전체 인박스 (admin)
router.get('/', authenticate, authorize(['admin']), ctrl.getAllRequests);

// 항목 수정 / 토큰 발급 (admin) - '/:id' 보다 먼저 선언
router.put('/items/:itemId', authenticate, authorize(['admin']), ctrl.updateRequestItem);
router.post('/items/:itemId/issue-token', authenticate, authorize(['admin']), ctrl.issueToken);

// 요청 상세 (admin, brand 소유자)
router.get('/:id', authenticate, authorize(['admin', 'brand']), ctrl.getRequest);

// 요청 수정 (admin)
router.put('/:id', authenticate, authorize(['admin']), ctrl.updateRequest);

// 요청 취소 (brand 소유자, admin)
router.patch('/:id/cancel', authenticate, authorize(['brand', 'admin']), ctrl.cancelRequest);

module.exports = router;
