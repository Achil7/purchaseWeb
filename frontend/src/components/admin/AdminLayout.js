import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Button, Container, IconButton, Avatar } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HomeIcon from '@mui/icons-material/Home';
import { useAuth } from '../../context/AuthContext';
import ProfileEditDialog from '../common/ProfileEditDialog';

function AdminLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>

      {/* 헤더 (상단 고정) */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#2c387e' }}>
        <Toolbar>
          {/* 왼쪽: 아이콘 및 타이틀 */}
          <AssignmentIcon sx={{ mr: 2 }} />
          <Typography
            variant="h6"
            color="inherit"
            noWrap
            component="div"
            sx={{ flexGrow: 1, fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => navigate('/admin/campaigns')}
          >
            Campaign Manager (Admin)
          </Typography>

          {/* 대시보드 버튼 */}
          <Button
            color="inherit"
            startIcon={<HomeIcon />}
            onClick={() => navigate('/admin')}
            sx={{ mr: 2 }}
          >
            대시보드
          </Button>

          {/* 오른쪽: 알림 아이콘 */}
          <IconButton color="inherit">
            <NotificationsIcon />
          </IconButton>

          {/* 오른쪽: 프로필 정보 박스 (클릭 시 프로필 수정) */}
          <Box
            onClick={() => setProfileDialogOpen(true)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, ml: 2, mr: 2,
              bgcolor: 'rgba(255,255,255,0.1)', px: 1.5, py: 0.5, borderRadius: 2,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
            }}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#1976d2' }}>
              {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </Avatar>
            <Typography variant="subtitle2">{user?.name || '관리자'}</Typography>
          </Box>

          {/* 오른쪽: 로그아웃 버튼 */}
          <Button color="inherit" onClick={handleLogout} sx={{ fontWeight: 'bold' }}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      <Toolbar />

      {/* 실제 콘텐츠가 렌더링되는 영역 */}
      <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: 3 }}>
        <Outlet />
      </Container>

      {/* 프로필 수정 다이얼로그 */}
      <ProfileEditDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
      />
    </Box>
  );
}

export default AdminLayout;
