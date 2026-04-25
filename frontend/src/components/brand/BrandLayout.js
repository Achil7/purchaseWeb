import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, Button, IconButton, Avatar, Paper,
  Badge, Menu, MenuItem, ListItemText, Divider,
  List, ListItemButton, ListItemIcon, CircularProgress, Chip, Tooltip, Collapse,
  TextField, InputAdornment, Pagination, Drawer, useMediaQuery, useTheme
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useAuth } from '../../context/AuthContext';
import ProfileEditDialog from '../common/ProfileEditDialog';
import BrandItemSheet from './BrandItemSheet';
import BrandDashboard from './BrandDashboard';
import { notificationService, monthlyBrandService } from '../../services';

const DEFAULT_DRAWER_WIDTH = 280;
const MIN_DRAWER_WIDTH = 200;
const MAX_DRAWER_WIDTH = 500;
const SIDEBAR_WIDTH_KEY = 'brand_sidebar_width';

function BrandLayout({ isAdminMode = false, viewAsUserId = null, isEmbedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const basePathOnly = isAdminMode ? '/admin/view-brand' : '/brand';
  // Admin 모드에서 userId 쿼리 파라미터 유지
  const basePath = isAdminMode && viewAsUserId ? `${basePathOnly}?userId=${viewAsUserId}` : basePathOnly;
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  // 모바일 사이드바 Drawer 열림 상태 (PC에서는 사용 안 됨)
  const [mobileOpen, setMobileOpen] = useState(false);

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
  // 새로고침 시 위치 유지용 localStorage 키
  const VIEW_MODE_KEY = 'brand_view_mode';
  const SELECTED_CAMPAIGN_KEY = 'brand_selected_campaign_id';

  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // 상단 탭 모드: 'dashboard' | 'campaigns' — localStorage 에서 복원
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      return saved === 'campaigns' ? 'campaigns' : 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  // 숨김 항목 표시 모드
  const [showHidden, setShowHidden] = useState(false);

  // 숨겨진 연월브랜드 ID 목록 (localStorage 기반 - 각 사용자 독립)
  const [hiddenMonthlyBrandIds, setHiddenMonthlyBrandIds] = useState(() => {
    try {
      const saved = localStorage.getItem('brand_hidden_monthly_brands');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 연월브랜드 검색 쿼리
  const [searchQuery, setSearchQuery] = useState('');

  // 제품명 통합 검색 (입력값 / 확정값 분리)
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [activeProductSearch, setActiveProductSearch] = useState('');

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // 사이드바 접기/펼치기 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 사이드바 너비 상태 - localStorage에서 복원
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      return saved ? parseInt(saved, 10) : DEFAULT_DRAWER_WIDTH;
    } catch {
      return DEFAULT_DRAWER_WIDTH;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef(null);

  // 알림 상태
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifAnchorEl, setNotifAnchorEl] = useState(null);

  // 디바운스용 ref
  const saveExpandedTimeoutRef = useRef(null);

  // 사이드바 DOM ref (리사이즈 시 직접 조작)
  const sidebarRef = useRef(null);

  // 사이드바 리사이즈 핸들러 (DOM 직접 조작으로 리렌더 방지)
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth
    };
  }, [sidebarWidth]);

  // 검색어 변경 시 페이지 초기화
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // 대시보드에서 캠페인 바로가기: /brand?openCampaign=123 로 들어오면
  // 캠페인 보기 탭 + 해당 캠페인을 자동 선택해 시트를 바로 표시
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openCampaignId = params.get('openCampaign');
    if (!openCampaignId || monthlyBrands.length === 0) return;
    const targetId = parseInt(openCampaignId, 10);
    let found = null;
    for (const mb of monthlyBrands) {
      const hit = (mb.campaigns || []).find(c => c.id === targetId);
      if (hit) { found = hit; break; }
    }
    if (found) {
      setViewMode('campaigns');
      setSelectedCampaign(found);
      setActiveProductSearch('');
      setProductSearchQuery('');
      // URL 정리: openCampaign 파라미터 제거 (뒤로가기/새로고침 시 혼란 방지)
      const cleanParams = new URLSearchParams(location.search);
      cleanParams.delete('openCampaign');
      const cleanQuery = cleanParams.toString();
      navigate(basePath + (cleanQuery ? `?${cleanQuery}` : ''), { replace: true });
    }
  }, [location.search, monthlyBrands, navigate, basePath]);

  // viewMode 변경 시 localStorage 저장 (새로고침 시 탭 위치 유지)
  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch {}
  }, [viewMode]);

  // selectedCampaign id 저장 (새로고침 시 캠페인 복원)
  useEffect(() => {
    try {
      if (selectedCampaign?.id) {
        localStorage.setItem(SELECTED_CAMPAIGN_KEY, String(selectedCampaign.id));
      } else {
        localStorage.removeItem(SELECTED_CAMPAIGN_KEY);
      }
    } catch {}
  }, [selectedCampaign]);

  // 새로고침 시 저장된 selectedCampaign id 를 monthlyBrands 로딩 후 복원
  // (Admin 모드에서도 viewAsUserId 별 구분 없이 단순 복원 — 사용자가 명시적으로 탭/캠페인 이동하면 갱신됨)
  useEffect(() => {
    if (selectedCampaign || monthlyBrands.length === 0) return;
    try {
      const savedId = localStorage.getItem(SELECTED_CAMPAIGN_KEY);
      if (!savedId) return;
      const targetId = parseInt(savedId, 10);
      for (const mb of monthlyBrands) {
        const hit = (mb.campaigns || []).find(c => c.id === targetId);
        if (hit) {
          setSelectedCampaign(hit);
          return;
        }
      }
      // 저장된 캠페인이 더 이상 존재하지 않으면 삭제
      localStorage.removeItem(SELECTED_CAMPAIGN_KEY);
    } catch {}
  }, [monthlyBrands, selectedCampaign]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !resizeRef.current) return;
      const diff = e.clientX - resizeRef.current.startX;
      const newWidth = Math.min(MAX_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, resizeRef.current.startWidth + diff));
      resizeRef.current.currentWidth = newWidth;
      if (sidebarRef.current) {
        sidebarRef.current.style.width = `${newWidth}px`;
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        const finalWidth = resizeRef.current.currentWidth || resizeRef.current.startWidth;
        setIsResizing(false);
        setSidebarWidth(finalWidth);
        localStorage.setItem(SIDEBAR_WIDTH_KEY, finalWidth.toString());
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // 시트 컴포넌트 메모이제이션 - 사이드바 토글 시 리렌더링 방지
  const memoizedSheet = useMemo(() => {
    // 제품명 검색 모드: 캠페인 선택과 무관하게 시트 표시
    if (activeProductSearch) {
      return (
        <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <BrandItemSheet
            searchMode
            searchProductName={activeProductSearch}
            viewAsUserId={viewAsUserId}
          />
        </Box>
      );
    }
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
  }, [selectedCampaign?.id, selectedCampaign?.name, viewAsUserId, activeProductSearch]);

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
    // 30초마다 알림 갱신 - Admin embedded 모드에서는 폴링 비활성화
    if (isAdminMode) return;
    const interval = setInterval(() => {
      if (document.hidden) return;  // 탭 비활성 시 폴링 중지
      loadNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadMonthlyBrands, isAdminMode]);

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
    // 캠페인 선택 시 제품명 검색 모드 해제
    setActiveProductSearch('');
    setProductSearchQuery('');
    // Embedded 모드가 아닐 때만 네비게이션 처리
    if (!isEmbedded && location.pathname !== basePathOnly && location.pathname !== `${basePathOnly}/`) {
      navigate(basePath);
    }
  };

  // 연월브랜드 숨기기 (localStorage 기반)
  const handleHideMonthlyBrand = useCallback((monthlyBrand, e) => {
    e.stopPropagation();
    setHiddenMonthlyBrandIds(prev => {
      const newHidden = [...prev, monthlyBrand.id];
      localStorage.setItem('brand_hidden_monthly_brands', JSON.stringify(newHidden));
      return newHidden;
    });
  }, []);

  // 연월브랜드 복구 (localStorage 기반)
  const handleRestoreMonthlyBrand = useCallback((monthlyBrand, e) => {
    e.stopPropagation();
    setHiddenMonthlyBrandIds(prev => {
      const newHidden = prev.filter(id => id !== monthlyBrand.id);
      localStorage.setItem('brand_hidden_monthly_brands', JSON.stringify(newHidden));
      return newHidden;
    });
  }, []);

  // 드래그 앤 드롭 핸들러 (연월브랜드 순서 변경)
  const handleDragEnd = useCallback(async (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    // 숨김 항목은 드래그 불가
    if (showHidden) return;

    const filteredMonthlyBrands = monthlyBrands.filter(mb => !mb._isHidden);
    const items = Array.from(filteredMonthlyBrands);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // 새 순서의 ID 배열
    const orderedIds = items.map(mb => mb.id);

    // 낙관적 UI 업데이트
    const hiddenItems = monthlyBrands.filter(mb => mb._isHidden);
    setMonthlyBrands([...items, ...hiddenItems]);

    try {
      await monthlyBrandService.reorderMonthlyBrandsBrand(orderedIds, viewAsUserId);
    } catch (err) {
      console.error('Failed to reorder monthly brands:', err);
      alert('순서 변경에 실패했습니다.');
      // 실패 시 원래 상태로 복원
      loadMonthlyBrands();
    }
  }, [monthlyBrands, showHidden, viewAsUserId, loadMonthlyBrands]);

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
          totalPurchaseCount += (item.slots || []).length;
          totalReviewCompleted += item.reviewCompletedCount || 0;
        }

        const isCompleted = totalPurchaseCount > 0 && totalReviewCompleted >= totalPurchaseCount;
        const rawRate = totalPurchaseCount > 0 ? Math.round((totalReviewCompleted / totalPurchaseCount) * 100) : 0;
        const completionRate = (!isCompleted && rawRate >= 100) ? 99 : rawRate;

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
        <Toolbar sx={{ px: { xs: 1, md: 3 } }}>
          {/* 모바일 전용: 햄버거 메뉴 (캠페인 보기 탭에서만 사이드바 토글) */}
          {isMobile && viewMode === 'campaigns' && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          {/* 왼쪽: 아이콘 및 타이틀 (모바일에서는 텍스트 숨김) */}
          <AssignmentIcon
            sx={{ mr: { xs: 0.5, md: 2 }, cursor: 'pointer' }}
            onClick={() => {
              setSelectedCampaign(null);
              navigate(basePath);
            }}
          />
          <Typography
            variant="h6"
            color="inherit"
            noWrap
            component="div"
            sx={{
              fontWeight: 'bold',
              cursor: 'pointer',
              display: { xs: 'none', md: 'block' }
            }}
            onClick={() => {
              setSelectedCampaign(null);
              navigate(basePath);
            }}
          >
            {isAdminMode ? '브랜드사 보기 (Admin)' : 'Campaign Manager'}
          </Typography>

          {/* 상단 탭: 현황 대시보드 / 캠페인 보기 */}
          <Box sx={{ display: 'flex', ml: { xs: 0.5, md: 3 }, gap: { xs: 0, md: 0.5 } }}>
            <Button
              color="inherit"
              onClick={() => {
                setViewMode('dashboard');
                setSelectedCampaign(null);
                setActiveProductSearch('');
                navigate(basePath);
              }}
              sx={{
                fontWeight: viewMode === 'dashboard' ? 'bold' : 'normal',
                borderBottom: viewMode === 'dashboard' ? '2px solid #fff' : '2px solid transparent',
                borderRadius: 0,
                px: { xs: 1, md: 2 },
                fontSize: { xs: '0.75rem', md: '0.875rem' },
                minWidth: { xs: 'auto', md: 64 }
              }}
            >
              {isMobile ? '대시보드' : '현황 대시보드'}
            </Button>
            <Button
              color="inherit"
              onClick={() => {
                setViewMode('campaigns');
                navigate(basePath);
              }}
              sx={{
                fontWeight: viewMode === 'campaigns' ? 'bold' : 'normal',
                borderBottom: viewMode === 'campaigns' ? '2px solid #fff' : '2px solid transparent',
                borderRadius: 0,
                px: { xs: 1, md: 2 },
                fontSize: { xs: '0.75rem', md: '0.875rem' },
                minWidth: { xs: 'auto', md: 64 }
              }}
            >
              {isMobile ? '캠페인' : '캠페인 보기'}
            </Button>
          </Box>

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

          {/* 오른쪽: 프로필 정보 박스 (클릭 시 프로필 수정)
              모바일: Avatar만 (배경 박스 제거로 공간 절약)
              PC: 기존 Avatar + 이름 박스 */}
          <Box
            onClick={() => setProfileDialogOpen(true)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              ml: { xs: 0.25, md: 2 },
              mr: { xs: 0.25, md: 2 },
              bgcolor: { xs: 'transparent', md: 'rgba(255,255,255,0.1)' },
              px: { xs: 0, md: 1.5 },
              py: { xs: 0, md: 0.5 },
              borderRadius: 2,
              cursor: 'pointer',
              '&:hover': { bgcolor: { xs: 'rgba(255,255,255,0.1)', md: 'rgba(255,255,255,0.2)' } }
            }}
          >
            <Avatar sx={{
              width: { xs: 28, md: 32 },
              height: { xs: 28, md: 32 },
              bgcolor: '#2c387e',
              fontSize: { xs: '0.85rem', md: '1.25rem' }
            }}>
              {user?.username?.charAt(0)?.toUpperCase() || 'B'}
            </Avatar>
            {/* 모바일에서는 사용자 이름 숨김 (공간 부족) */}
            <Typography variant="subtitle2" sx={{ display: { xs: 'none', md: 'block' } }}>
              {user?.name || '브랜드사'}
            </Typography>
          </Box>

          {/* 오른쪽: 로그아웃/돌아가기 버튼
              모바일: IconButton (Tooltip "로그아웃")
              PC: 기존 텍스트 Button */}
          {isMobile ? (
            <Tooltip title={isAdminMode ? 'Admin으로 돌아가기' : '로그아웃'}>
              <IconButton color="inherit" onClick={handleLogout} sx={{ p: 0.5 }}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              color="inherit"
              onClick={handleLogout}
              sx={{ fontWeight: 'bold' }}
            >
              {isAdminMode ? 'Admin으로 돌아가기' : '로그아웃'}
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {/* 메인 컨테이너 - 사이드바 + 콘텐츠 */}
      <Box sx={{ display: 'flex', flex: 1, pt: isEmbedded ? 0 : 8, overflow: 'hidden', minHeight: 0 }}>
      {/* 왼쪽 사이드바 - 연월브랜드/캠페인 목록 (캠페인 보기 탭에서만 노출)
          PC: 인라인 영구 사이드바 (기존 그대로)
          모바일: 임시 Drawer (햄버거 메뉴로 토글) */}
      {viewMode === 'campaigns' && isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: '85vw',
              maxWidth: 360,
              boxSizing: 'border-box'
            }
          }}
        >
          <Box sx={{ display: 'flex', flexShrink: 0, position: 'relative', height: '100%' }}>
            <Paper
              sx={{
                width: '100%',
                flexShrink: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 0,
                borderRight: 'none'
              }}
            >
              <Box sx={{ flex: 1, overflow: 'auto', pb: 1 }}>
                <Box sx={{ p: 1.5, bgcolor: showHidden ? '#fff3e0' : '#e8eaf6', borderBottom: '1px solid #e0e0e0' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarMonthIcon fontSize="small" />
                      {showHidden ? '숨긴 항목' : '내 캠페인 (연월브랜드)'}
                    </Typography>
                    <IconButton size="small" onClick={() => setMobileOpen(false)}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  {!showHidden && (
                    <TextField
                      size="small"
                      placeholder="연월브랜드 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      fullWidth
                      sx={{
                        mt: 1,
                        '& .MuiInputBase-root': { height: 32, fontSize: '0.85rem' }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ fontSize: 16, color: '#999' }} />
                          </InputAdornment>
                        )
                      }}
                    />
                  )}
                </Box>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <List dense sx={{ py: 0 }}>
                    {monthlyBrands
                      .filter(mb => {
                        const isMbHidden = hiddenMonthlyBrandIds.includes(mb.id);
                        if (showHidden) return isMbHidden;
                        const q = searchQuery.trim().toLowerCase();
                        if (q && !mb.name.toLowerCase().includes(q)) return false;
                        return !isMbHidden;
                      })
                      .map(mb => (
                        <Box key={mb.id}>
                          <ListItemButton
                            onClick={() => setExpandedMonthlyBrands(prev => ({ ...prev, [mb.id]: !prev[mb.id] }))}
                            sx={{ py: 1, borderBottom: '1px solid #f0f0f0' }}
                          >
                            <ListItemIcon sx={{ minWidth: 28 }}>
                              {expandedMonthlyBrands[mb.id] ? <ExpandLess /> : <ExpandMore />}
                            </ListItemIcon>
                            <ListItemText
                              primary={mb.name}
                              primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 'bold' }}
                            />
                          </ListItemButton>
                          <Collapse in={!!expandedMonthlyBrands[mb.id]}>
                            {(mb.campaigns || []).map(c => (
                              <ListItemButton
                                key={c.id}
                                selected={selectedCampaign?.id === c.id}
                                onClick={() => {
                                  setSelectedCampaign(c);
                                  setActiveProductSearch('');
                                  setProductSearchQuery('');
                                  setMobileOpen(false);
                                }}
                                sx={{ pl: 4, py: 0.75 }}
                              >
                                <ListItemText
                                  primary={c.name}
                                  primaryTypographyProps={{ fontSize: '0.8rem' }}
                                />
                              </ListItemButton>
                            ))}
                          </Collapse>
                        </Box>
                      ))}
                  </List>
                )}
              </Box>
            </Paper>
          </Box>
        </Drawer>
      )}
      {viewMode === 'campaigns' && !isMobile && (
      <Box sx={{ display: 'flex', flexShrink: 0, position: 'relative' }}>
        <Paper
          ref={sidebarRef}
          sx={{
            width: sidebarCollapsed ? 48 : sidebarWidth,
            flexShrink: 0,
            height: isEmbedded ? '100%' : 'calc(100vh - 64px)',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
            borderRight: 'none'
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

              {/* 연월브랜드 검색 */}
              {!showHidden && (
                <TextField
                  size="small"
                  placeholder="연월브랜드 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  fullWidth
                  sx={{
                    mt: 1,
                    '& .MuiInputBase-root': { height: 28, fontSize: '0.75rem' },
                    '& .MuiInputBase-input': { py: 0.5 }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 16, color: '#999' }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.2 }}>
                          <ClearIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              )}
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (() => {
              const searchLower = searchQuery.trim().toLowerCase();
              const hiddenMbSet = new Set(hiddenMonthlyBrandIds);

              const filteredMonthlyBrands = monthlyBrands.map(mb => {
                const isMbHidden = hiddenMbSet.has(mb.id);
                // 브랜드사는 캠페인 숨기기 없음 (연월브랜드만)
                return { ...mb, _isHidden: isMbHidden };
              }).filter(mb => {
                // 숨김 필터
                if (showHidden) {
                  return mb._isHidden;
                }
                // 연월브랜드 이름으로 검색
                if (searchLower && !mb.name.toLowerCase().includes(searchLower)) {
                  return false;
                }
                return !mb._isHidden;
              });

              // 페이지네이션 계산
              const brandTotalPages = Math.ceil(filteredMonthlyBrands.length / ITEMS_PER_PAGE);
              const brandStartIndex = (currentPage - 1) * ITEMS_PER_PAGE;
              const paginatedMonthlyBrands = filteredMonthlyBrands.slice(brandStartIndex, brandStartIndex + ITEMS_PER_PAGE);

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
                <>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="monthly-brands-brand" isDropDisabled={showHidden}>
                    {(provided) => (
                      <List
                        component="nav"
                        disablePadding
                        dense
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {paginatedMonthlyBrands.map((monthlyBrand, index) => {
                          const campaigns = monthlyBrand.campaigns || [];
                          return (
                            <Draggable
                              key={monthlyBrand.id}
                              draggableId={`mb-${monthlyBrand.id}`}
                              index={index}
                              isDragDisabled={showHidden}
                            >
                              {(provided, snapshot) => (
                                <React.Fragment>
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                  >
                                    <ListItemButton
                                      onClick={() => handleMonthlyBrandToggle(monthlyBrand.id)}
                                      sx={{
                                        bgcolor: snapshot.isDragging ? '#bbdefb' : monthlyBrand._isHidden ? '#fff3e0' : expandedMonthlyBrands[monthlyBrand.id] ? '#e8eaf6' : 'inherit',
                                        borderBottom: '1px solid #f0f0f0',
                                        py: 0.5,
                                        boxShadow: snapshot.isDragging ? 3 : 0
                                      }}
                                    >
                                      {/* 드래그 핸들 - 숨김 항목이 아닐 때만 표시 */}
                                      {!showHidden && (
                                        <Box
                                          {...provided.dragHandleProps}
                                          sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            mr: 0.5,
                                            cursor: 'grab',
                                            '&:active': { cursor: 'grabbing' }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <DragIndicatorIcon sx={{ fontSize: 18, color: '#9e9e9e' }} />
                                        </Box>
                                      )}
                                      <ListItemIcon sx={{ minWidth: 28 }}>
                                        <CalendarMonthIcon fontSize="small" color={monthlyBrand._isHidden ? 'warning' : 'primary'} />
                                      </ListItemIcon>
                                      <ListItemText
                                        primary={
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography variant="body2" fontWeight="bold" noWrap sx={{ flex: 1, fontSize: '0.85rem', color: monthlyBrand._isHidden ? 'text.secondary' : 'inherit' }}>
                                              {monthlyBrand.name}
                                            </Typography>
                                            {showHidden && monthlyBrand._isHidden ? (
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
                                  </div>
                                </React.Fragment>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </List>
                    )}
                  </Droppable>
                </DragDropContext>
                {brandTotalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 1, borderTop: '1px solid #e0e0e0' }}>
                    <Pagination
                      count={brandTotalPages}
                      page={currentPage}
                      onChange={(e, page) => setCurrentPage(page)}
                      color="primary"
                      size="small"
                      siblingCount={0}
                    />
                  </Box>
                )}
                </>
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
            minHeight: 48,
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

      {/* 리사이즈 핸들 */}
      {!sidebarCollapsed && (
        <Box
          onMouseDown={handleMouseDown}
          sx={{
            width: 4,
            cursor: 'col-resize',
            bgcolor: isResizing ? '#1976d2' : 'transparent',
            '&:hover': { bgcolor: '#90caf9' },
            transition: 'background-color 0.2s',
            flexShrink: 0
          }}
        />
      )}
      </Box>
      )}

      {/* 메인 콘텐츠 영역 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 1,
          // 시트의 Handsontable 높이 계산을 깨지 않기 위해 부모는 항상 hidden
          // 대시보드 탭의 페이지 스크롤은 BrandDashboard 컴포넌트 내부에서 처리
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {viewMode === 'dashboard' ? (
          /* 현황 대시보드 탭: 기본은 index 라우트의 Outlet (BrandDashboard).
             Admin 컨트롤타워에서 embedded 모드면 라우트 자식이 없으므로 직접 렌더 */
          isEmbedded ? (
            <BrandDashboard
              isAdminMode={isAdminMode}
              viewAsUserId={viewAsUserId}
              isEmbedded={true}
              onCampaignSelect={(campaignId) => {
                let found = null;
                for (const mb of monthlyBrands) {
                  const hit = (mb.campaigns || []).find(c => c.id === campaignId);
                  if (hit) { found = hit; break; }
                }
                if (found) {
                  setViewMode('campaigns');
                  setSelectedCampaign(found);
                  setActiveProductSearch('');
                  setProductSearchQuery('');
                }
              }}
            />
          ) : <Outlet />
        ) : (
          <>
            {/* 캠페인 보기 탭 공통 상단 툴바 - 제품명 통합 검색 (슬림) */}
            <Paper
              variant="outlined"
              sx={{
                mb: 0.75,
                px: 1.2,
                py: 0.4,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexShrink: 0,
                bgcolor: activeProductSearch ? '#fff8e1' : '#fafafa',
                borderColor: activeProductSearch ? '#ffb300' : '#e0e0e0'
              }}
            >
              <SearchIcon sx={{ fontSize: 16, color: activeProductSearch ? '#ef6c00' : '#757575' }} />
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontWeight: 'bold' }}>
                제품명 통합 검색
              </Typography>
              <TextField
                size="small"
                placeholder="제품명 입력 후 Enter (모든 캠페인/날짜 교차 조회)"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const trimmed = productSearchQuery.trim();
                    if (trimmed) {
                      setActiveProductSearch(trimmed);
                      setSelectedCampaign(null);
                    }
                  }
                }}
                fullWidth
                sx={{
                  '& .MuiInputBase-root': { height: 26, fontSize: '0.8rem', bgcolor: '#fff' },
                  '& .MuiInputBase-input': { py: 0.2 }
                }}
                InputProps={{
                  endAdornment: (productSearchQuery || activeProductSearch) && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setProductSearchQuery('');
                          setActiveProductSearch('');
                        }}
                        sx={{ p: 0.3 }}
                      >
                        <ClearIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <Button
                size="small"
                variant="contained"
                color="warning"
                onClick={() => {
                  const trimmed = productSearchQuery.trim();
                  if (trimmed) {
                    setActiveProductSearch(trimmed);
                    setSelectedCampaign(null);
                  }
                }}
                sx={{ flexShrink: 0, minWidth: 56, height: 26, py: 0, fontSize: '0.75rem' }}
              >
                검색
              </Button>
            </Paper>
            {activeProductSearch && isDefaultRoute ? (
          <>
            {/* 제품명 검색 헤더 (슬림) */}
            <Box sx={{ mb: 0.5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold" color="#ef6c00">
                제품명 검색: "{activeProductSearch}"
              </Typography>
              <Chip
                label="전체 캠페인 통합"
                size="small"
                color="warning"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Box>
            {memoizedSheet}
          </>
        ) : selectedCampaign && isDefaultRoute ? (
          <>
            {/* 선택된 캠페인 헤더 (슬림) */}
            <Box sx={{ mb: 0.5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold" color="#2c387e">
                {selectedCampaign.name}
              </Typography>
              <Chip
                label={getStatusLabel(selectedCampaign.status)}
                size="small"
                color={getStatusColor(selectedCampaign.status)}
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Box>
            {/* 시트 컴포넌트 - useMemo로 메모이제이션 */}
            {memoizedSheet}
          </>
        ) : (
          /* 캠페인 보기 탭 - 캠페인 미선택 안내 */
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
        )}
          </>
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
