import apiClient from './api';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const REFRESH_TOKEN_KEY = 'refreshToken';
const AUTH_MODE_KEY = 'authMode'; // 'web' or 'mobile'

/**
 * 모바일 디바이스 감지
 */
const isMobileDevice = () => {
  // PWA standalone 모드 감지
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  // 모바일 브라우저 감지
  const isMobileBrowser = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // 화면 크기 감지 (768px 이하)
  const isSmallScreen = window.innerWidth <= 768;

  // PWA standalone이면 무조건 모바일 모드
  // 모바일 브라우저 + 작은 화면이면 모바일 모드
  return isStandalone || (isMobileBrowser && isSmallScreen);
};

/**
 * 디바이스 정보 수집
 */
const getDeviceInfo = () => {
  return `${navigator.userAgent.substring(0, 100)}`;
};

const authService = {
  /**
   * 로그인 - 디바이스에 따라 다른 방식 사용
   */
  async login(username, password) {
    const useMobileAuth = isMobileDevice();

    if (useMobileAuth) {
      // 모바일: Access Token + Refresh Token 방식
      return this.mobileLogin(username, password);
    } else {
      // 웹: 기존 방식 (7일 토큰)
      return this.webLogin(username, password);
    }
  },

  /**
   * 웹 로그인 (기존 방식 - 7일 토큰)
   */
  async webLogin(username, password) {
    const response = await apiClient.post('/auth/login', { username, password });

    if (response.data.success) {
      const { token, user } = response.data.data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(AUTH_MODE_KEY, 'web');
    }

    return response.data;
  },

  /**
   * 모바일 로그인 (Access Token 15분 + Refresh Token 30일)
   */
  async mobileLogin(username, password) {
    const deviceInfo = getDeviceInfo();
    const response = await apiClient.post('/auth/mobile-login', {
      username,
      password,
      deviceInfo
    });

    if (response.data.success) {
      const { accessToken, refreshToken, user } = response.data.data;
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(AUTH_MODE_KEY, 'mobile');
    }

    return response.data;
  },

  /**
   * 로그아웃 - 모든 인증 데이터 완전 삭제
   */
  async logout() {
    const authMode = localStorage.getItem(AUTH_MODE_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    try {
      if (authMode === 'mobile' && refreshToken) {
        // 모바일: Refresh Token 폐기
        await apiClient.post('/auth/mobile-logout', { refreshToken });
      } else {
        // 웹: 기존 로그아웃
        await apiClient.post('/auth/logout');
      }
    } catch (error) {
      // 로그아웃 실패해도 로컬 토큰은 삭제
      console.error('Logout API error:', error);
    }

    // 모든 인증 관련 데이터 삭제
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_MODE_KEY);
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
  },

  /**
   * 모바일 인증 모드인지 확인
   */
  isMobileAuth() {
    return localStorage.getItem(AUTH_MODE_KEY) === 'mobile';
  },

  /**
   * Refresh Token 가져오기
   */
  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Access Token 갱신 (모바일용)
   */
  async refreshToken() {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiClient.post('/auth/refresh', { refreshToken });

    if (response.data.success) {
      const { accessToken, user } = response.data.data;
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return accessToken;
    }

    throw new Error('Token refresh failed');
  },

  /**
   * 로컬 인증 데이터만 삭제 (서버 호출 없이)
   */
  clearLocalAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_MODE_KEY);
    sessionStorage.clear();
  }
};

export default authService;
