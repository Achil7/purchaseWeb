import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, Button, IconButton, Avatar, Paper,
  Badge, Menu, MenuItem, ListItemText, Divider,
  List, ListItemButton, ListItemIcon, CircularProgress, Chip, Tooltip, Collapse
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RestoreIcon from '@mui/icons-material/Restore';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import { useAuth } from '../../context/AuthContext';
import ProfileEditDialog from '../common/ProfileEditDialog';
import BrandItemSheet from './BrandItemSheet';
import { notificationService, monthlyBrandService } from '../../services';

const DRAWER_WIDTH = 280;

function BrandLayout({ isAdminMode = false, viewAsUserId = null, isEmbedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const basePathOnly = isAdminMode ? '/admin/view-brand' : '/brand';
  // Admin 모드에서 userId 쿼리 파라미터 유지
  const basePath = isAdminMode && viewAsUserId ? `${basePathOnly}?userId=${viewAsUserId}` : basePathOnly;
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  // 연월브랜드 데이터
  const [monthlyBrands, setMonthlyBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  // 확장된 연월브랜드 상태 - localStorage에서 복원
  const EXPANDED_MB_KEY = 'brand_expanded_monthly_brands';
  const [expandedMonthlyBrands, setExpandedMonthlyBrands] = useState(() => {
    try {
      const saved = localStorage.getItem(EXPANDED_MB_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 선택된 캠페인 (메인 영역에 시트 표시용)
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // 숨김 항목 표시 모드
  const [showHidden, setShowHidden] = useState(false);

  // 사이드바 접기/펼치기 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 알림 상태
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifAnchorEl, setNotifAnchorEl] = useState(null);

  // 디바운스용 ref
  const saveExpandedTimeoutRef = useRef(null);

  // 시트 컴포넌트 메모이제이션 - 사이드바 토글 시 리렌더링 방지
  const memoizedSheet = useMemo(() => {
    if (!selectedCampaign) return null;
    return (
      <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <BrandItemSheet
          campaignId={selectedCampaign.id}
          campaignName={selectedCampaign.name}
          viewAsUserId={viewAsUserId}
        />
      </Box>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaign?.id, selectedCampaign?.name, viewAsUserId]);

  // 연월브랜드 데이터 로드 (브랜드사용)
  const loadMonthlyBrands = useCallback(async () => {
    try {
      setLoading(true);
      // viewAsUserId가 있으면 해당 브랜드사의 데이터 조회 (Admin용)
      const response = await monthlyBrandService.getMyBrandMonthlyBrands(viewAsUserId);
      const data = response.data || [];

      // 캠페인 이름으로 Natural Sort (숫자를 올바르게 정렬: 1차, 2차, 3차... 10차, 11차)
      const naturalSort = (a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        const regex = /(\d+)|(\D+)/g;
        const partsA = nameA.match(regex) || [];
        const partsB = nameB.match(regex) || [];
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
          const partA = partsA[i] || '';
          const partB = partsB[i] || '';
          const numA = parseInt(partA, 10);
          const numB = parseInt(partB, 10);
          if (!isNaN(numA) && !isNaN(numB)) {
            if (numA !== numB) return numA - numB;
          } else {
            const cmp = partA.localeCompare(partB, 'ko');
            if (cmp !== 0) return cmp;
          }
        }
        return 0;
      };

      data.forEach(mb => {
        if (mb.campaigns) {
          mb.campaigns.sort(naturalSort);
        }
      });

      setMonthlyBrands(data);
      // 모든 연월브랜드는 기본적으로 접힌 상태로 시작
    } catch (err) {
      console.error('Failed to load monthly brands:', err);
    } finally {
      setLoading(false);
    }
  }, [viewAsUserId]);

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

  // 알림 클릭 시 해당 페이지로 이동
  const handleNotificationClick = (notification) => {
    handleMarkAsRead(notification.id);
    setNotifAnchorEl(null);

    if (notification.reference_type === 'item' && notification.reference_id) {
      navigate(basePath);
    }
  };

  useEffect(() => {
    loadMonthlyBrands();
    loadNotifications();
    // 30초마다 알림 갱신
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadMonthlyBrands]);

  // 연월브랜드 확장/축소 토글 (localStorage 저장 디바운스로 성능 최적화)
  const handleMonthlyBrandToggle = useCallback((monthlyBrandId) => {
    setExpandedMonthlyBrands(prev => {
      const newState = {
        ...prev,
        [monthlyBrandId]: !prev[monthlyBrandId]
      };

      // localStorage 저장 디바운스 (300ms) - 동기 I/O 블로킹 방지
      if (saveExpandedTimeoutRef.current) {
        clearTimeout(saveExpandedTimeoutRef.current);
      }
      saveExpandedTimeoutRef.current = setTimeout(() => {
        try {
          localStorage.setItem(EXPANDED_MB_KEY, JSON.stringify(newState));
        } catch (e) {
          console.error('Failed to save expanded state:', e);
        }
      }, 300);

      return newState;
    });
  }, []);

  // 모든 연월브랜드 펼치기
  const handleExpandAllMonthlyBrands = useCallback(() => {
    const newState = {};
    monthlyBrands.forEach(mb => {
      newState[mb.id] = true;
    });
    setExpandedMonthlyBrands(newState);

    // localStorage 저장 디바운스
    if (saveExpandedTimeoutRef.current) {
      clearTimeout(saveExpandedTimeoutRef.current);
    }
    saveExpandedTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(EXPANDED_MB_KEY, JSON.stringify(newState));
      } catch (e) {
        console.error('Failed to save expanded state:', e);
      }
    }, 300);
  }, [monthlyBrands]);

  // 모든 연월브랜드 접기
  const handleCollapseAllMonthlyBrands = useCallback(() => {
    const newState = {};
    monthlyBrands.forEach(mb => {
      newState[mb.id] = false;
    });
    setExpandedMonthlyBrands(newState);

    // localStorage 저장 디바운스
    if (saveExpandedTimeoutRef.current) {
      clearTimeout(saveExpandedTimeoutRef.current);
    }
    saveExpandedTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(EXPANDED_MB_KEY, JSON.stringify(newState));
      } catch (e) {
        console.error('Failed to save expanded state:', e);
      }
    }, 300);
  }, [monthlyBrands]);

  // 캠페인 클릭 - 메인 영역에 시트 표시
  const handleCampaignClick = (campaign) => {
    setSelectedCampaign(campaign);
    // Embedded 모드가 아닐 때만 네비게이션 처리
    if (!isEmbedded && location.pathname !== basePathOnly && location.pathname !== `${basePathOnly}/`) {
      navigate(basePath);
    }
  };

  // 연월브랜드 숨기기
  const handleHideMonthlyBrand = async (monthlyBrand, e) => {
    e.stopPropagation();
    if (window.confirm(`"${monthlyBrand.name}" 연월브랜드를 숨기시겠습니까?`)) {
      try {
        await monthlyBrandService.hideMonthlyBrand(monthlyBrand.id);
        loadMonthlyBrands();
      } catch (err) {
        console.error('Failed to hide monthly brand:', err);
        alert('숨기기에 실패했습니다.');
      }
    }
  };

  // 연월브랜드 복구
  const handleRestoreMonthlyBrand = async (monthlyBrand, e) => {
    e.stopPropagation();
    try {
      await monthlyBrandService.restoreMonthlyBrand(monthlyBrand.id);
      loadMonthlyBrands();
    } catch (err) {
      console.error('Failed to restore monthly brand:', err);
      alert('복구에 실패했습니다.');
    }
  };

  const handleLogout = async () => {
    if (isAdminMode) {
      navigate('/admin');
    } else {
      await logout();
      navigate('/login', { replace: true });
    }
  };

  // 상태별 색상
  const getStatusColor = (status) => {
    const colorMap = {
      'active': 'primary',
      'completed': 'success',
      'cancelled': 'error',
      'new': 'warning',
      'pending': 'default'
    };
    return colorMap[status] || 'default';
  };

  // 상태별 라벨
  const getStatusLabel = (status) => {
    const labelMap = {
      'active': '진행',
      'completed': '완료',
      'cancelled': '취소',
      'new': '신규',
      'pending': '대기'
    };
    return labelMap[status] || status;
  };

  // 캠페인별 통계 캐싱 (성능 최적화)
  const campaignStatsMap = useMemo(() => {
    const statsMap = new Map();
    monthlyBrands.forEach(mb => {
      (mb.campaigns || []).forEach(campaign => {
        const items = campaign.items || [];
        let totalReviewCompleted = 0;
        let totalPurchaseCount = 0;

        for (const item of items) {
          totalPurchaseCount += parseInt(item.total_purchase_count) || 0;
          const buyers = item.buyers || [];
          const realBuyers = buyers.filter(b => !b.is_temporary);
          const reviewedBuyers = realBuyers.filter(b => b.images && b.images.length > 0);
          totalReviewCompleted += reviewedBuyers.length;
        }

        const isCompleted = totalPurchaseCount > 0 && totalReviewCompleted >= totalPurchaseCount;
        const completionRate = totalPurchaseCount > 0 ? Math.round((totalReviewCompleted / totalPurchaseCount) * 100) : 0;

        statsMap.set(campaign.id, {
          totalReviewCompleted,
          totalBuyerCount: totalPurchaseCount,
          isCompleted,
          completionRate
        });
      });
    });
    return statsMap;
  }, [monthlyBrands]);

  // 캐싱된 통계 조회
  const getCampaignStats = useCallback((campaign) => {
    return campaignStatsMap.get(campaign.id) || {
      totalReviewCompleted: 0,
      totalBuyerCount: 0,
      isCompleted: false,
      completionRate: 0
    };
  }, [campaignStatsMap]);

  // Outlet을 사용할지 시트를 표시할지 결정
  const isDefaultRoute = isEmbedded ? true : (location.pathname === basePathOnly || location.pathname === `${basePathOnly}/`);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: isEmbedded ? '100%' : '100vh', bgcolor: '#f5f5f5', overflow: 'hidden' }}>

      {/* 헤더 - isEmbedded일 때는 relative 포지션 */}
      <AppBar position={isEmbedded ? "relative" : "fixed"} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#2c387e', flexShrink: 0 }}>
        <Toolbar>
          {/* 왼쪽: 아이콘 및 타이틀 */}
          <AssignmentIcon sx={{ mr: 2 }} />
          <Typography
            variant="h6"
            color="inherit"
            noWrap
            component="div"
            sx={{ fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => {
              setSelectedCampaign(null);
              navigate(basePath);
            }}
          >
            {isAdminMode ? '브랜드사 보기 (Admin)' : 'Campaign Manager'}
          </Typography>

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

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
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#2c387e' }}>
              {user?.username?.charAt(0)?.toUpperCase() || 'B'}
            </Avatar>
            <Typography variant="subtitle2">{user?.name || '브랜드사'}</Typography>
          </Box>

          {/* 오른쪽: 로그아웃/돌아가기 버튼 */}
          <Button color="inherit" onClick={handleLogout} sx={{ fontWeight: 'bold' }}>
            {isAdminMode ? 'Admin으로 돌아가기' : '로그아웃'}
          </Button>
        </Toolbar>
      </AppBar>

      {/* 메인 컨테이너 - 사이드바 + 콘텐츠 */}
      <Box sx={{ display: 'flex', flex: 1, pt: isEmbedded ? 0 : 8, overflow: 'hidden', minHeight: 0 }}>
      {/* 왼쪽 사이드바 - 연월브랜드/캠페인 목록 */}
      <Paper
        sx={{
          width: sidebarCollapsed ? 40 : DRAWER_WIDTH,
          flexShrink: 0,
          height: isEmbedded ? '100%' : 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0,
          borderRight: '1px solid #e0e0e0'
        }}
      >
        {!sidebarCollapsed && (
          <Box sx={{ flex: 1, overflow: 'auto', pb: 1 }}>
            <Box sx={{ p: 1.5, bgcolor: showHidden ? '#fff3e0' : '#e8eaf6', borderBottom: '1px solid #e0e0e0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarMonthIcon fontSize="small" />
                  {showHidden ? '숨긴 항목' : '내 캠페인 (연월브랜드)'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {!showHidden && (
                    <>
                      <Tooltip title="모두 펼치기">
                        <IconButton size="small" onClick={handleExpandAllMonthlyBrands} sx={{ p: 0.5 }}>
                          <UnfoldMoreIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="모두 접기">
                        <IconButton size="small" onClick={handleCollapseAllMonthlyBrands} sx={{ p: 0.5 }}>
                          <UnfoldLessIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip title={showHidden ? '일반 목록 보기' : '숨긴 항목 보기'}>
                    <IconButton size="small" onClick={() => setShowHidden(!showHidden)} sx={{ p: 0.5 }} color={showHidden ? 'warning' : 'default'}>
                      {showHidden ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {showHidden ? '숨긴 연월브랜드/캠페인을 복구할 수 있습니다' : '캠페인 클릭 시 리뷰 현황이 표시됩니다'}
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (() => {
              const filteredMonthlyBrands = monthlyBrands.filter(mb => showHidden ? mb.is_hidden : !mb.is_hidden);

              if (filteredMonthlyBrands.length === 0) {
                return (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {showHidden ? '숨긴 항목이 없습니다' : '등록된 연월브랜드가 없습니다'}
                    </Typography>
                    {!showHidden && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        영업사가 브랜드에 연월브랜드를 연결하면 여기에 표시됩니다
                      </Typography>
                    )}
                  </Box>
                );
              }

              return (
                <List component="nav" disablePadding dense>
                  {filteredMonthlyBrands.map((monthlyBrand) => {
                    const campaigns = monthlyBrand.campaigns || [];
                    return (
                      <React.Fragment key={monthlyBrand.id}>
                        <ListItemButton
                          onClick={() => handleMonthlyBrandToggle(monthlyBrand.id)}
                          sx={{
                            bgcolor: monthlyBrand.is_hidden ? '#fff3e0' : expandedMonthlyBrands[monthlyBrand.id] ? '#e8eaf6' : 'inherit',
                            borderBottom: '1px solid #f0f0f0',
                            py: 0.5
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <CalendarMonthIcon fontSize="small" color={monthlyBrand.is_hidden ? 'warning' : 'primary'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="body2" fontWeight="bold" noWrap sx={{ flex: 1, fontSize: '0.85rem', color: monthlyBrand.is_hidden ? 'text.secondary' : 'inherit' }}>
                                  {monthlyBrand.name}
                                </Typography>
                                {showHidden && monthlyBrand.is_hidden ? (
                                  <Tooltip title="복구">
                                    <IconButton size="small" color="success" onClick={(e) => handleRestoreMonthlyBrand(monthlyBrand, e)} sx={{ p: 0.3 }}>
                                      <RestoreIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Tooltip>
                                ) : !showHidden ? (
                                  <Tooltip title="숨기기">
                                    <IconButton size="small" color="default" onClick={(e) => handleHideMonthlyBrand(monthlyBrand, e)} sx={{ p: 0.3 }}>
                                      <VisibilityOffIcon sx={{ fontSize: 16, color: '#bbb' }} />
                                    </IconButton>
                                  </Tooltip>
                                ) : null}
                                <Chip label={campaigns.length} size="small" sx={{ height: 18, minWidth: 20, fontSize: '0.65rem' }} />
                              </Box>
                            }
                          />
                          {expandedMonthlyBrands[monthlyBrand.id] ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                        </ListItemButton>

                        <Collapse in={expandedMonthlyBrands[monthlyBrand.id]} timeout={0}>
                          <List component="div" disablePadding dense>
                            {campaigns.length > 0 ? (
                              campaigns.map((campaign) => {
                                const isSelected = selectedCampaign?.id === campaign.id;
                                const stats = getCampaignStats(campaign);
                                return (
                                  <ListItemButton
                                    key={campaign.id}
                                    onClick={() => handleCampaignClick(campaign)}
                                    sx={{
                                      pl: 4, py: 0.3,
                                      bgcolor: isSelected ? '#c5cae9' : 'inherit',
                                      borderLeft: isSelected ? '3px solid #2c387e' : '3px solid transparent',
                                      '&:hover': { bgcolor: isSelected ? '#c5cae9' : '#f5f5f5' }
                                    }}
                                  >
                                    <ListItemIcon sx={{ minWidth: 24 }}>
                                      <FolderIcon sx={{ fontSize: 16 }} color={isSelected ? 'primary' : 'action'} />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <Typography variant="body2" fontWeight={isSelected ? 'bold' : 'normal'} noWrap sx={{ fontSize: '0.8rem', flex: 1 }}>
                                            {campaign.name}
                                          </Typography>
                                          {stats.isCompleted ? (
                                            <Tooltip title={`완료! ${stats.totalReviewCompleted}/${stats.totalBuyerCount}`}>
                                              <CheckCircleIcon sx={{ fontSize: 18, color: '#4caf50' }} />
                                            </Tooltip>
                                          ) : stats.totalBuyerCount > 0 ? (
                                            <Tooltip title={`진행률: ${stats.totalReviewCompleted}/${stats.totalBuyerCount}`}>
                                              <Chip
                                                label={`${stats.completionRate}%`}
                                                size="small"
                                                sx={{
                                                  height: 16, fontSize: '0.6rem',
                                                  bgcolor: stats.completionRate >= 80 ? '#c8e6c9' : stats.completionRate >= 50 ? '#fff9c4' : '#ffecb3',
                                                  color: stats.completionRate >= 80 ? '#2e7d32' : stats.completionRate >= 50 ? '#f57f17' : '#ff6f00',
                                                  fontWeight: 'bold'
                                                }}
                                              />
                                            </Tooltip>
                                          ) : (
                                            <Chip label={`${campaign.items?.length || 0}개`} size="small" sx={{ height: 14, fontSize: '0.6rem', minWidth: 16 }} />
                                          )}
                                          <Chip label={getStatusLabel(campaign.status)} size="small" color={getStatusColor(campaign.status)} variant="outlined" sx={{ height: 16, fontSize: '0.6rem' }} />
                                        </Box>
                                      }
                                    />
                                  </ListItemButton>
                                );
                              })
                            ) : (
                              <Box sx={{ pl: 4, py: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  캠페인 없음
                                </Typography>
                              </Box>
                            )}
                          </List>
                        </Collapse>
                      </React.Fragment>
                    );
                  })}
                </List>
              );
            })()}
          </Box>
        )}

        {/* 접기/펼치기 버튼 - 하단 고정 */}
        <Box
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          sx={{
            flexShrink: 0,
            marginTop: 'auto',
            bgcolor: '#2c387e',
            color: 'white',
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: '#3f51b5' }
          }}
        >
          {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          {!sidebarCollapsed && <Typography variant="caption" sx={{ ml: 0.5 }}>접기</Typography>}
        </Box>
      </Paper>

      {/* 메인 콘텐츠 영역 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {selectedCampaign && isDefaultRoute ? (
          <>
            {/* 선택된 캠페인 헤더 */}
            <Box sx={{ mb: 1, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="h6" fontWeight="bold" color="#2c387e">
                  {selectedCampaign.name}
                </Typography>
                <Chip
                  label={getStatusLabel(selectedCampaign.status)}
                  size="small"
                  color={getStatusColor(selectedCampaign.status)}
                  sx={{ height: 22 }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                리뷰 현황 시트 - 구매자가 업로드한 리뷰 이미지를 확인하세요
              </Typography>
            </Box>
            {/* 시트 컴포넌트 - useMemo로 메모이제이션 */}
            {memoizedSheet}
          </>
        ) : isDefaultRoute ? (
          /* 캠페인 미선택 시 안내 메시지 */
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            color: 'text.secondary'
          }}>
            <FolderIcon sx={{ fontSize: 80, color: '#e0e0e0', mb: 2 }} />
            <Typography variant="h6" color="text.disabled">
              캠페인을 선택해주세요
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              왼쪽 사이드바에서 연월브랜드를 펼쳐 캠페인을 클릭하면 리뷰 현황이 표시됩니다
            </Typography>
          </Box>
        ) : (
          /* 다른 라우트일 때 Outlet 표시 */
          <Outlet />
        )}
      </Box>
      </Box>

      {/* 프로필 수정 다이얼로그 */}
      <ProfileEditDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
      />
    </Box>
  );
}

export default BrandLayout;
