import apiClient from './api';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

const authService = {
  /**
   * 로그인
   */
  async login(username, password) {
    const response = await apiClient.post('/auth/login', { username, password });

    if (response.data.success) {
      const { token, user } = response.data.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    return response.data;
  },

  /**
   * 로그아웃 - 모든 인증 데이터 완전 삭제
   */
  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // 로그아웃 실패해도 로컬 토큰은 삭제
      console.error('Logout API error:', error);
    }

    // 모든 인증 관련 데이터 삭제
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.clear();

    // 캐시된 API 응답도 정리
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
  },

  /**
   * 현재 사용자 정보 조회
   */
  async getMe() {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  /**
   * 토큰 가져오기
   */
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * 저장된 사용자 정보 가져오기
   */
  getUser() {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * 로그인 여부 확인
   */
  isAuthenticated() {
    return !!this.getToken();
  }
};

export default authService;
