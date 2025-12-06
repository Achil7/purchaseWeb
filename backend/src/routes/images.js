const express = require('express');
const router = express.Router();

/**
 * @route   POST /api/images/upload/:token
 * @desc    토큰 기반 이미지 업로드 (리뷰어용)
 * @access  Public (토큰 검증)
 */
router.post('/upload/:token', (req, res) => {
  res.json({ message: 'Upload image - To be implemented' });
});

/**
 * @route   GET /api/images/item/:itemId
 * @desc    품목의 이미지 목록
 * @access  Private
 */
router.get('/item/:itemId', (req, res) => {
  res.json({ message: 'Get images by item - To be implemented' });
});

/**
 * @route   DELETE /api/images/:id
 * @desc    이미지 삭제
 * @access  Private (Operator, Admin)
 */
router.delete('/:id', (req, res) => {
  res.json({ message: 'Delete image - To be implemented' });
});

module.exports = router;
