import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Button, Container, IconButton, Avatar } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import NotificationsIcon from '@mui/icons-material/Notifications'; // 알림 아이콘

function BrandLayout() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      
      {/* 헤더 (상단 고정) */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#4a148c' }}>
        <Toolbar>
          {/* 왼쪽: 아이콘 및 타이틀 */}
          <AssignmentIcon sx={{ mr: 2 }} />
          <Typography 
            variant="h6" 
            color="inherit" 
            noWrap 
            component="div"
            sx={{ flexGrow: 1, fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => navigate('/brand')} // 로고 클릭 시 홈으로
          >
            Campaign Manager
          </Typography>

          {/* 오른쪽: 알림 아이콘 */}
          <IconButton color="inherit">
            <NotificationsIcon />
          </IconButton>

          {/* 오른쪽: 프로필 정보 박스 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2, mr: 2, bgcolor: 'rgba(255,255,255,0.1)', px: 1.5, py: 0.5, borderRadius: 2 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'purple' }}>M</Avatar>
            <Typography variant="subtitle2">마엔라(주)</Typography>
          </Box>

          {/* 오른쪽: 로그아웃 버튼 */}
          <Button color="inherit" onClick={() => navigate('/')} sx={{ fontWeight: 'bold' }}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* AppBar가 position="fixed"가 되면 콘텐츠 위로 떠오르게 됩니다.
         따라서 AppBar의 높이만큼 콘텐츠를 아래로 밀어주기 위해 빈 Toolbar를 하나 둡니다.
      */}
      <Toolbar />

      {/* 실제 콘텐츠가 렌더링되는 영역 */}
      <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
}

export default BrandLayout;