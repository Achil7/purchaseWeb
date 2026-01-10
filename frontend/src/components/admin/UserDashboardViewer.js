import React from 'react';
import { Box, Typography, Card, CardContent, Chip } from '@mui/material';

// 각 역할별 실제 레이아웃 컴포넌트 import
import OperatorLayout from '../operator/OperatorLayout';
import SalesLayout from '../sales/SalesLayout';
import BrandLayout from '../brand/BrandLayout';

/**
 * 컨트롤 타워에서 선택한 사용자의 실제 대시보드를 보여주는 컴포넌트
 * 진행자/영업사/브랜드사 각각의 실제 페이지를 그대로 렌더링
 */
function UserDashboardViewer({ user, roleLabels }) {
  // 역할별 테마 색상
  const getRoleTheme = () => {
    switch (user?.role) {
      case 'operator':
        return { primaryColor: '#00897b' };
      case 'sales':
        return { primaryColor: '#1976d2' };
      case 'brand':
        return { primaryColor: '#7b1fa2' };
      default:
        return { primaryColor: '#757575' };
    }
  };

  const theme = getRoleTheme();

  if (!user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary">왼쪽에서 사용자를 선택하세요</Typography>
      </Box>
    );
  }

  // 역할별 실제 레이아웃 컴포넌트 렌더링
  const renderRolePage = () => {
    switch (user.role) {
      case 'operator':
        return (
          <OperatorLayout
            isAdminMode={true}
            viewAsUserId={user.id}
            isEmbedded={true}
          />
        );
      case 'sales':
        return (
          <SalesLayout
            isAdminMode={true}
            viewAsUserId={user.id}
            isEmbedded={true}
          />
        );
      case 'brand':
        return (
          <BrandLayout
            isAdminMode={true}
            viewAsUserId={user.id}
            isEmbedded={true}
          />
        );
      default:
        return (
          <Typography color="text.secondary">
            지원되지 않는 역할입니다.
          </Typography>
        );
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 사용자 정보 헤더 */}
      <Card sx={{ mb: 0, bgcolor: theme.primaryColor, color: 'white', flexShrink: 0, borderRadius: 0 }}>
        <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">{user.name}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                @{user.username} · {roleLabels[user.role]}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                label={user.is_online ? '온라인' : '오프라인'}
                size="small"
                sx={{
                  bgcolor: user.is_online ? 'success.light' : 'grey.500',
                  color: 'white',
                  fontWeight: 'bold',
                  height: 24
                }}
              />
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                오늘 접속: {user.today_login_count || 0}회
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 역할별 실제 페이지 - 높이를 채우도록 (calc로 헤더 높이 제외) */}
      <Box sx={{ height: 'calc(100% - 50px)', overflow: 'hidden' }}>
        {renderRolePage()}
      </Box>
    </Box>
  );
}

export default UserDashboardViewer;
