import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, CircularProgress } from '@mui/material';

/**
 * 보호된 라우트 컴포넌트
 * @param {React.ReactNode} children - 자식 컴포넌트
 * @param {string[]} allowedRoles - 허용된 역할 배열 (비어있으면 인증만 체크)
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // 로딩 중일 때 로딩 표시
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // localStorage 토큰과 상태 동기화 확인
  const token = localStorage.getItem('token');

  // 인증되지 않거나 토큰이 없는 경우 로그인 페이지로 리다이렉트
  if (!isAuthenticated || !token) {
    // 토큰 없으면 정리 후 로그인으로
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 역할 체크가 필요한 경우
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    // 권한이 없는 경우 해당 역할의 기본 페이지로 리다이렉트
    const roleRedirects = {
      admin: '/admin',
      sales: '/sales',
      operator: '/operator',
      brand: '/brand'
    };

    const redirectPath = roleRedirects[user?.role] || '/login';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

export default ProtectedRoute;
