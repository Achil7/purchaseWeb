import apiClient from './api';

const settingService = {
  // 로그인 페이지 설정 조회 (Public)
  getLoginSettings: async () => {
    try {
      const response = await apiClient.get('/settings/login');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 로그인 페이지 설정 수정 (Admin only)
  updateLoginSettings: async (data) => {
    try {
      const response = await apiClient.put('/settings/login', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 로그인 배너 이미지 업로드 (Admin only)
  uploadLoginBanner: async (file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await apiClient.post('/settings/login/banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 로그인 배너 이미지 삭제 (Admin only)
  deleteLoginBanner: async () => {
    try {
      const response = await apiClient.delete('/settings/login/banner');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default settingService;
