const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

/**
 * @route   GET /api/notifications
 * @desc    내 알림 목록 조회
 * @access  Private
 */
router.get('/', authenticate, notificationController.getMyNotifications);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    알림 읽음 처리
 * @access  Private
 */
router.patch('/:id/read', authenticate, notificationController.markAsRead);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    모든 알림 읽음 처리
 * @access  Private
 */
router.patch('/read-all', authenticate, notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    알림 삭제
 * @access  Private
 */
router.delete('/:id', authenticate, notificationController.deleteNotification);

module.exports = router;
