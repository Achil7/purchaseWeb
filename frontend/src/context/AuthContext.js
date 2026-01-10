import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import authService from '../services/authService';
import { sendHeartbeat } from '../services/userService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const heartbeatIntervalRef = useRef(null);

  // Heartbeat 시스템 (5분 주기)
  useEffect(() => {
    if (user) {
      // 초기 heartbeat 전송
      sendHeartbeat().catch(err => console.log('Initial heartbeat failed:', err));

      // 5분마다 heartbeat 전송
      heartbeatIntervalRef.current = setInterval(() => {
        sendHeartbeat().catch(err => console.log('Heartbeat failed:', err));
      }, 5 * 60 * 1000); // 5분

      return () => {
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
      };
    }
  }, [user]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedUser = authService.getUser();

        if (savedUser && authService.isAuthenticated()) {
          // 모바일 모드인 경우: 토큰 유효성 확인 및 갱신 시도
          if (authService.isMobileAuth() && authService.getRefreshToken()) {
            try {
              // 서버에 현재 토큰으로 사용자 정보 요청
              const response = await authService.getMe();
              if (response.success) {
                setUser(response.data);
              } else {
                // 토큰 만료 시 갱신 시도
                await authService.refreshToken();
                setUser(savedUser);
              }
            } catch (error) {
              // 토큰 갱신 시도
              try {
                await authService.refreshToken();
                setUser(savedUser);
              } catch (refreshError) {
                // 갱신 실패 시 로그아웃 처리
                console.log('Token refresh failed, clearing auth');
                authService.clearLocalAuth();
              }
            }
          } else {
            // 웹 모드: 기존 방식
            setUser(savedUser);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    // 로그인 전 기존 인증 데이터 완전 정리
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();

    const result = await authService.login(username, password);

    if (result.success) {
      setUser(result.data.user);
    }

    return result;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      // 브라우저 히스토리 정리 - 뒤로가기 방지
      window.history.replaceState(null, '', '/login');
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
