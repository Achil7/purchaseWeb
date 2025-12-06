import axios from 'axios';

// API Base URL
// 프로덕션에서는 상대 경로 사용 (같은 서버에서 서빙)
// 개발 환경에서는 localhost:5000 사용
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

// Axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 - JWT 토큰 추가
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 에러 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('API Error:', error.response.data);

      // 401 에러 시 로그인 페이지로 리다이렉트
      if (error.response.status === 401) {
        // 모든 인증 데이터 삭제
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.clear();

        // 브라우저 히스토리 정리 후 로그인 페이지로 이동
        if (window.location.pathname !== '/login') {
          window.history.replaceState(null, '', '/login');
          window.location.replace('/login');
        }
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
