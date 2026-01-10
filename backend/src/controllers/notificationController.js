const { Notification, User } = require('../models');
const { Op } = require('sequelize');

/**
 * 내 알림 목록 조회
 */
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { unread_only } = req.query;

    const whereClause = { user_id: userId };
    if (unread_only === 'true') {
      whereClause.is_read = false;
    }

    const notifications = await Notification.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: 50
    });

    // 읽지 않은 알림 수
    const unreadCount = await Notification.count({
      where: { user_id: userId, is_read: false }
    });

    res.json({
      success: true,
      data: notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: '알림 조회 실패',
      error: error.message
    });
  }
};

/**
 * 알림 읽음 처리
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      where: { id, user_id: userId }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: '알림을 찾을 수 없습니다'
      });
    }

    await notification.update({ is_read: true });

    res.json({
      success: true,
      message: '알림이 읽음 처리되었습니다'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: '알림 읽음 처리 실패',
      error: error.message
    });
  }
};

/**
 * 모든 알림 읽음 처리
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.update(
      { is_read: true },
      { where: { user_id: userId, is_read: false } }
    );

    res.json({
      success: true,
      message: '모든 알림이 읽음 처리되었습니다'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: '알림 읽음 처리 실패',
      error: error.message
    });
  }
};

/**
 * 알림 삭제
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deleted = await Notification.destroy({
      where: { id, user_id: userId }
    });

    if (deleted === 0) {
      return res.status(404).json({
        success: false,
        message: '알림을 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      message: '알림이 삭제되었습니다'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: '알림 삭제 실패',
      error: error.message
    });
  }
};

/**
 * 알림 생성 유틸리티 함수 (다른 컨트롤러에서 사용)
 */
exports.createNotification = async (userId, type, title, message, referenceType = null, referenceId = null) => {
  try {
    const notification = await Notification.create({
      user_id: userId,
      type,
      title,
      message,
      reference_type: referenceType,
      reference_id: referenceId
    });
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

/**
 * 모든 Admin에게 알림 생성
 */
exports.notifyAllAdmins = async (type, title, message, referenceType = null, referenceId = null) => {
  try {
    const admins = await User.findAll({
      where: { role: 'admin', is_active: true },
      attributes: ['id']
    });

    const notifications = admins.map(admin => ({
      user_id: admin.id,
      type,
      title,
      message,
      reference_type: referenceType,
      reference_id: referenceId
    }));

    await Notification.bulkCreate(notifications);
  } catch (error) {
    console.error('Notify all admins error:', error);
    throw error;
  }
};
