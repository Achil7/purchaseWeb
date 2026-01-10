import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, Button, Container, IconButton, Avatar,
  Badge, Menu, MenuItem, ListItemText, Divider
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PaymentsIcon from '@mui/icons-material/Payments';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SettingsIcon from '@mui/icons-material/Settings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useAuth } from '../../context/AuthContext';
import ProfileEditDialog from '../common/ProfileEditDialog';
import AdminUserCreate from './AdminUserCreate';
import AdminLoginSettings from './AdminLoginSettings';
import { notificationService } from '../../services';

function AdminLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // 알림 상태
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifAnchorEl, setNotifAnchorEl] = useState(null);

  // 알림 목록 조회
  const loadNotifications = async () => {
    try {
      const response = await notificationService.getMyNotifications();
      setNotifications(response.data || []);
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  // 알림 읽음 처리
  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // 모든 알림 읽음 처리
  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // 알림 클릭 시 처리
  const handleNotificationClick = async (notification) => {
    // 먼저 읽음 처리
    await handleMarkAsRead(notification.id);
    setNotifAnchorEl(null);

    // 제품 알림인 경우 해당 제품의 캠페인으로 이동
    if (notification.reference_type === 'item' && notification.reference_id) {
      try {
        // 제품 정보를 조회하여 캠페인 ID 가져오기
        const { itemService } = await import('../../services');
        const response = await itemService.getItem(notification.reference_id);
        if (response.success && response.data?.campaign_id) {
          navigate(`/admin/campaigns/${response.data.campaign_id}`);
        } else {
          navigate('/admin/campaigns');
        }
      } catch (error) {
        console.error('Failed to get item info:', error);
        navigate('/admin/campaigns');
      }
    }
    // 캠페인 알림이거나 reference_type이 없는 경우 단순 읽음 처리 (페이지 이동 없음)
  };

  useEffect(() => {
    loadNotifications();
    // 30초마다 알림 갱신
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>

      {/* 헤더 (상단 고정) */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#2c387e' }}>
        <Toolbar>
          {/* 왼쪽: 아이콘 및 타이틀 (클릭 시 메인=컨트롤타워) */}
          <DashboardIcon sx={{ mr: 2 }} />
          <Typography
            variant="h6"
            color="inherit"
            noWrap
            component="div"
            sx={{ fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => navigate('/admin')}
          >
            Campaign Manager (Admin)
          </Typography>

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* 날짜별 입금관리 버튼 */}
          <Button
            color="inherit"
            startIcon={<PaymentsIcon />}
            onClick={() => navigate('/admin/daily-payments')}
            sx={{ mr: 2 }}
          >
            날짜 별 입금관리
          </Button>

          {/* 마진 현황 버튼 */}
          <Button
            color="inherit"
            startIcon={<TrendingUpIcon />}
            onClick={() => navigate('/admin/margin')}
            sx={{ mr: 2 }}
          >
            마진 현황
          </Button>

          {/* 사용자 등록 버튼 */}
          <Button
            variant="contained"
            color="success"
            startIcon={<PersonAddIcon />}
            onClick={() => setUserDialogOpen(true)}
            sx={{ mr: 1, fontWeight: 'bold' }}
          >
            사용자 등록
          </Button>

          {/* 로그인 페이지 설정 버튼 */}
          <IconButton
            color="inherit"
            onClick={() => setSettingsDialogOpen(true)}
            title="로그인 페이지 설정"
            sx={{ mr: 1 }}
          >
            <SettingsIcon />
          </IconButton>

          {/* 오른쪽: 알림 아이콘 */}
          <IconButton color="inherit" onClick={(e) => setNotifAnchorEl(e.currentTarget)}>
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <Menu
            anchorEl={notifAnchorEl}
            open={Boolean(notifAnchorEl)}
            onClose={() => setNotifAnchorEl(null)}
            PaperProps={{ sx: { width: 360, maxHeight: 400 } }}
          >
            <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" fontWeight="bold">알림</Typography>
              {unreadCount > 0 && (
                <Button size="small" startIcon={<DoneAllIcon />} onClick={handleMarkAllAsRead}>
                  모두 읽음
                </Button>
              )}
            </Box>
            <Divider />
            {notifications.filter(n => !n.is_read).length === 0 ? (
              <MenuItem disabled>
                <ListItemText primary="알림이 없습니다" />
              </MenuItem>
            ) : (
              notifications.filter(n => !n.is_read).slice(0, 10).map((notif) => (
                <MenuItem
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  sx={{
                    bgcolor: notif.is_read ? 'inherit' : 'action.hover',
                    whiteSpace: 'normal'
                  }}
                >
                  <ListItemText
                    primary={notif.title}
                    secondary={
                      <>
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'block' }}>
                          {notif.message}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {new Date(notif.created_at).toLocaleString('ko-KR')}
                        </Typography>
                      </>
                    }
                  />
                </MenuItem>
              ))
            )}
          </Menu>

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

      {/* 사용자 등록 다이얼로그 */}
      <AdminUserCreate
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        onSuccess={() => {}}
      />

      {/* 로그인 페이지 설정 다이얼로그 */}
      <AdminLoginSettings
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
      />
    </Box>
  );
}

export default AdminLayout;
