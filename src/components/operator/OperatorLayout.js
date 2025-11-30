import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Button, Container } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';

function OperatorLayout() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* 상단 네비게이션 바 */}
      <AppBar position="static" color="default" sx={{ bgcolor: '#fff', boxShadow: 1 }}>
        <Toolbar>
          <AssignmentIcon sx={{ mr: 2, color: '#00897b' }} />
          <Typography 
            variant="h6" 
            color="inherit" 
            noWrap 
            sx={{ flexGrow: 1, fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => navigate('/operator')} // 로고 클릭 시 홈으로
          >
            진행자 대시보드
          </Typography>
          <Button color="inherit" onClick={() => navigate('/')}>로그아웃</Button>
        </Toolbar>
      </AppBar>

      {/* 실제 콘텐츠가 렌더링되는 영역 */}
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}

export default OperatorLayout;