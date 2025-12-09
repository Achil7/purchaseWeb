import axios from 'axios';

// API Base URL
// 프로덕션에서는 상대 경로 사용 (같은 서버에서 서빙)
// 개발 환경에서는 localhost:5000 사용
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

// 토큰 갱신 중인지 확인하는 플래그
let isRefreshing = false;
// 토큰 갱신 대기 중인 요청들
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

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

// 응답 인터셉터 - 에러 처리 및 토큰 자동 갱신
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response) {
      console.error('API Error:', error.response.data);

      // 401 에러 시 처리
      if (error.response.status === 401 && !originalRequest._retry) {
        const authMode = localStorage.getItem('authMode');
        const refreshToken = localStorage.getItem('refreshToken');

        // 모바일 모드이고 Refresh Token이 있으면 토큰 갱신 시도
        if (authMode === 'mobile' && refreshToken) {
          // 이미 토큰 갱신 중이면 대기
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            }).then(token => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return apiClient(originalRequest);
            }).catch(err => {
              return Promise.reject(err);
            });
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            // 토큰 갱신 요청
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken
            });

            if (response.data.success) {
              const { accessToken, user } = response.data.data;
              localStorage.setItem('token', accessToken);
              localStorage.setItem('user', JSON.stringify(user));

              // 대기 중인 요청들 처리
              processQueue(null, accessToken);

              // 원래 요청 재시도
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return apiClient(originalRequest);
            }
          } catch (refreshError) {
            // 토큰 갱신 실패 - 대기 중인 요청들에 에러 전달
            processQueue(refreshError, null);

            // 로그인 페이지로 이동
            clearAuthAndRedirect();
            return Promise.reject(refreshError);
          } finally {
            isRefreshing = false;
          }
        }

        // 웹 모드이거나 Refresh Token이 없으면 로그인 페이지로
        clearAuthAndRedirect();
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

// 인증 데이터 삭제 및 로그인 페이지로 이동
function clearAuthAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('authMode');
  sessionStorage.clear();

  if (window.location.pathname !== '/login') {
    window.history.replaceState(null, '', '/login');
    window.location.replace('/login');
  }
}

export default apiClient;
