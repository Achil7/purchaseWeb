import apiClient from './api';

const notificationService = {
  // 내 알림 목록 조회
  getMyNotifications: async (unreadOnly = false) => {
    const params = unreadOnly ? { unread_only: 'true' } : {};
    const response = await apiClient.get('/notifications', { params });
    return response.data;
  },

  // 알림 읽음 처리
  markAsRead: async (id) => {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data;
  },

  // 모든 알림 읽음 처리
  markAllAsRead: async () => {
    const response = await apiClient.patch('/notifications/read-all');
    return response.data;
  },

  // 알림 삭제
  deleteNotification: async (id) => {
    const response = await apiClient.delete(`/notifications/${id}`);
    return response.data;
  }
};

export default notificationService;
