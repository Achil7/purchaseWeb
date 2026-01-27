import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, Button, IconButton, Avatar,
  Badge, Menu, MenuItem, ListItemText, Divider, Chip, Paper,
  List, ListItemButton, ListItemIcon, CircularProgress, Collapse, Tooltip, Alert,
  Tabs, Tab
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FolderIcon from '@mui/icons-material/Folder';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FiberNewIcon from '@mui/icons-material/FiberNew';
import WarningIcon from '@mui/icons-material/Warning';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAuth } from '../../context/AuthContext';
import ProfileEditDialog from '../common/ProfileEditDialog';
import OperatorMemoDialog from './OperatorMemoDialog';
import OperatorItemSheet from './OperatorItemSheet';
import UnifiedItemSheet from '../common/UnifiedItemSheet';
import DailyWorkSheet from '../common/DailyWorkSheet';
import { itemService } from '../../services';

const DRAWER_WIDTH = 280;

// 통합 시트 사용 여부 (true: UnifiedItemSheet 사용, false: 기존 OperatorItemSheet 사용)
const USE_UNIFIED_SHEET = false;

function OperatorLayout({ isAdminMode = false, viewAsUserId = null, isEmbedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [memoDialogOpen, setMemoDialogOpen] = useState(false);

  // 연월브랜드 데이터
  const [monthlyBrands, setMonthlyBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  // 확장된 연월브랜드 상태 - localStorage에서 복원
  const EXPANDED_MB_KEY = 'operator_expanded_monthly_brands';
  const [expandedMonthlyBrands, setExpandedMonthlyBrands] = useState(() => {
    try {
      const saved = localStorage.getItem(EXPANDED_MB_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 선택된 캠페인 (오른쪽에 시트 표시)
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // 시트 탭 상태 (0: 기본 시트, 1: 날짜별 작업)
  const [sheetTab, setSheetTab] = useState(0);

  // 선 업로드 알림 관련 상태
  const [preUploads, setPreUploads] = useState([]);
  const [totalPreUploadCount, setTotalPreUploadCount] = useState(0);
  const [notificationAnchor, setNotificationAnchor] = useState(null);

  // 숨김 항목 표시 모드
  const [showHidden, setShowHidden] = useState(false);
  // 숨겨진 캠페인 ID 목록 (로컬 스토리지에서 관리)
  const [hiddenCampaignIds, setHiddenCampaignIds] = useState(() => {
    const saved = localStorage.getItem('operator_hidden_campaigns');
    return saved ? JSON.parse(saved) : [];
  });
  // 숨겨진 연월브랜드 ID 목록 (로컬 스토리지에서 관리)
  const [hiddenMonthlyBrandIds, setHiddenMonthlyBrandIds] = useState(() => {
    const saved = localStorage.getItem('operator_hidden_monthly_brands');
    return saved ? JSON.parse(saved) : [];
  });
  // 사이드바 접기/펼치기 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // 일괄 삭제용 선택 상태
  const [selectedForBulkDelete, setSelectedForBulkDelete] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // 새로 추가된 캠페인 ID 추적 (실시간 업데이트용)
  const [newlyAddedCampaignIds, setNewlyAddedCampaignIds] = useState(new Set());
  const previousCampaignIdsRef = React.useRef(new Set());

  // 같은 캠페인 내 새 품목 배정 알림 (시트 상단 배너용)
  const [hasNewItemsInCurrentCampaign, setHasNewItemsInCurrentCampaign] = useState(false);
  const previousItemCountRef = React.useRef({}); // { campaignId: itemCount }
  const sheetRef = React.useRef(null); // OperatorItemSheet ref

  // 연월브랜드별 캠페인 데이터 로드
  const loadMonthlyBrands = useCallback(async (selectedCampaignId = null, isPolling = false) => {
    try {
      // 최초 로드시에만 로딩 표시 (polling 중에는 로딩 표시 안함)
      if (!isPolling) {
        setLoading(true);
      }
      // viewAsUserId가 있으면 해당 사용자의 데이터 조회 (Admin용)
      const response = await itemService.getMyMonthlyBrands(viewAsUserId);
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

      // 새로 추가된 캠페인 감지 (polling 중일 때만)
      if (isPolling) {
        const currentCampaignIds = new Set();
        data.forEach(mb => {
          (mb.campaigns || []).forEach(c => currentCampaignIds.add(c.id));
        });

        const newIds = new Set();
        currentCampaignIds.forEach(id => {
          if (!previousCampaignIdsRef.current.has(id)) {
            newIds.add(id);
          }
        });

        if (newIds.size > 0) {
          setNewlyAddedCampaignIds(prev => new Set([...prev, ...newIds]));
          // 새로운 배정이 포함된 연월브랜드 자동 펼치기
          data.forEach(mb => {
            const hasNewCampaign = (mb.campaigns || []).some(c => newIds.has(c.id));
            if (hasNewCampaign) {
              setExpandedMonthlyBrands(prev => {
                const newState = { ...prev, [mb.id]: true };
                try {
                  localStorage.setItem(EXPANDED_MB_KEY, JSON.stringify(newState));
                } catch (e) {
                  console.error('Failed to save expanded state:', e);
                }
                return newState;
              });
            }
          });
        }

        previousCampaignIdsRef.current = currentCampaignIds;

        // 같은 캠페인 내 품목 수 변화 감지 (현재 선택된 캠페인만)
        if (selectedCampaignId) {
          const currentCampaign = data.flatMap(mb => mb.campaigns || [])
            .find(c => c.id === selectedCampaignId);

          const prevCount = previousItemCountRef.current[selectedCampaignId] || 0;
          const currentCount = currentCampaign?.items?.length || 0;

          // 이전에 품목이 있었고, 새로 품목이 추가된 경우에만 배너 표시
          if (currentCount > prevCount && prevCount > 0) {
            setHasNewItemsInCurrentCampaign(true);
          }
        }
      } else {
        // 최초 로드시 현재 캠페인 ID 저장
        const currentCampaignIds = new Set();
        data.forEach(mb => {
          (mb.campaigns || []).forEach(c => currentCampaignIds.add(c.id));
        });
        previousCampaignIdsRef.current = currentCampaignIds;
      }

      // 모든 캠페인의 품목 수 저장 (polling, 최초 로드 모두)
      data.forEach(mb => {
        (mb.campaigns || []).forEach(c => {
          previousItemCountRef.current[c.id] = c.items?.length || 0;
        });
      });

      setMonthlyBrands(data);
      // 모든 연월브랜드는 기본적으로 접힌 상태로 시작

      // 선택된 캠페인 업데이트
      if (selectedCampaignId) {
        for (const mb of data) {
          const campaign = mb.campaigns?.find(c => c.id === selectedCampaignId);
          if (campaign) {
            setSelectedCampaign(campaign);
            break;
          }
        }
      }
    } catch (err) {
      console.error('Failed to load monthly brands:', err);
    } finally {
      if (!isPolling) {
        setLoading(false);
      }
    }
  }, [viewAsUserId]);

  // 선 업로드 데이터 로드
  const loadPreUploads = useCallback(async () => {
    try {
      const response = await itemService.getMyPreUploads();
      setPreUploads(response.data || []);
      setTotalPreUploadCount(response.totalCount || 0);
    } catch (err) {
      console.error('Failed to load pre-uploads:', err);
    }
  }, []);

  // SalesLayout과 동일하게 loadMonthlyBrands 변경 시 로드
  useEffect(() => {
    loadMonthlyBrands();
  }, [loadMonthlyBrands]);

  // 실시간 배정 업데이트 polling (60초마다) - 일반 모드에서만
  useEffect(() => {
    if (isAdminMode) return;

    const interval = setInterval(() => {
      // 현재 선택된 캠페인 ID 유지하면서 백그라운드 새로고침 (isPolling = true)
      loadMonthlyBrands(selectedCampaign?.id, true);
    }, 60000); // 60초

    return () => clearInterval(interval);
  }, [isAdminMode, loadMonthlyBrands, selectedCampaign?.id]);

  // 선 업로드는 일반 모드에서만 폴링
  useEffect(() => {
    if (isAdminMode) return;
    loadPreUploads();
    const interval = setInterval(loadPreUploads, 30000);
    return () => clearInterval(interval);
  }, [isAdminMode, loadPreUploads]);

  // 한국 시간(UTC+9) 기준 날짜 가져오기
  const getKoreanDateString = (date) => {
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(date.getTime() + kstOffset);
    return kstDate.toISOString().split('T')[0];
  };

  // 신규/진행 상태 판단 함수
  const getAssignmentStatus = (assignedAt) => {
    if (!assignedAt) return 'in_progress';
    const assignedDate = new Date(assignedAt);
    const today = new Date();
    const assignedDateKST = getKoreanDateString(assignedDate);
    const todayKST = getKoreanDateString(today);
    return assignedDateKST === todayKST ? 'new' : 'in_progress';
  };

  // 캠페인별 통계 캐싱 (성능 최적화)
  const campaignStatsMap = useMemo(() => {
    const statsMap = new Map();
    monthlyBrands.forEach(mb => {
      (mb.campaigns || []).forEach(campaign => {
        const items = campaign.items || [];
        let newCount = 0;
        let warningCount = 0;
        let totalReviewCompleted = 0;
        let totalPurchaseTarget = 0;
        let courierCount = 0;

        for (const item of items) {
          const status = getAssignmentStatus(item.assigned_at);
          if (status === 'new') {
            newCount++;
          } else {
            if ((item.normalBuyerCount || 0) === 0) {
              warningCount++;
            }
          }
          totalReviewCompleted += item.reviewCompletedCount || 0;
          totalPurchaseTarget += item.totalPurchaseCount || 0;
          if (item.courier_service_yn === 'Y' || item.courier_service_yn === true) {
            courierCount++;
          }
        }

        const isCompleted = totalPurchaseTarget > 0 && totalReviewCompleted >= totalPurchaseTarget;
        const completionRate = totalPurchaseTarget > 0 ? Math.round((totalReviewCompleted / totalPurchaseTarget) * 100) : 0;

        statsMap.set(campaign.id, {
          newCount,
          warningCount,
          totalItems: items.length,
          totalReviewCompleted,
          totalPurchaseTarget,
          isCompleted,
          completionRate,
          courierCount
        });
      });
    });
    return statsMap;
  }, [monthlyBrands]);

  // 캐싱된 통계 조회
  const getCampaignStats = useCallback((campaign) => {
    return campaignStatsMap.get(campaign.id) || {
      newCount: 0,
      warningCount: 0,
      totalItems: 0,
      totalReviewCompleted: 0,
      totalPurchaseTarget: 0,
      isCompleted: false,
      completionRate: 0,
      courierCount: 0
    };
  }, [campaignStatsMap]);

  // 연월브랜드 확장/축소 토글
  const handleMonthlyBrandToggle = (monthlyBrandId) => {
    setExpandedMonthlyBrands(prev => {
      const newState = {
        ...prev,
        [monthlyBrandId]: !prev[monthlyBrandId]
      };
      // localStorage에 저장
      try {
        localStorage.setItem(EXPANDED_MB_KEY, JSON.stringify(newState));
      } catch (e) {
        console.error('Failed to save expanded state:', e);
      }
      return newState;
    });
  };

  // 모든 연월브랜드 펼치기
  const handleExpandAllMonthlyBrands = () => {
    const newState = {};
    monthlyBrands.forEach(mb => {
      newState[mb.id] = true;
    });
    setExpandedMonthlyBrands(newState);
    try {
      localStorage.setItem(EXPANDED_MB_KEY, JSON.stringify(newState));
    } catch (e) {
      console.error('Failed to save expanded state:', e);
    }
  };

  // 모든 연월브랜드 접기
  const handleCollapseAllMonthlyBrands = () => {
    const newState = {};
    monthlyBrands.forEach(mb => {
      newState[mb.id] = false;
    });
    setExpandedMonthlyBrands(newState);
    try {
      localStorage.setItem(EXPANDED_MB_KEY, JSON.stringify(newState));
    } catch (e) {
      console.error('Failed to save expanded state:', e);
    }
  };

  // 캠페인 클릭 - 오른쪽에 시트 표시
  const handleCampaignClick = (campaign) => {
    setSelectedCampaign(campaign);
    // 새로 추가된 캠페인 하이라이트 제거
    if (newlyAddedCampaignIds.has(campaign.id)) {
      setNewlyAddedCampaignIds(prev => {
        const next = new Set(prev);
        next.delete(campaign.id);
        return next;
      });
    }
    // 캠페인 변경 시 신규 품목 배너 초기화
    setHasNewItemsInCurrentCampaign(false);
    // Embedded 모드가 아닐 때만 네비게이션 처리
    if (!isEmbedded && location.pathname !== basePathOnly && location.pathname !== `${basePathOnly}/`) {
      navigate(basePath);
    }
  };

  const handleNotificationClick = (event) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  const handleNavigateToItem = (campaignId, itemId) => {
    handleNotificationClose();
    navigate(`/operator/campaign/${campaignId}/item/${itemId}`);
  };

  const handleLogout = async () => {
    if (isAdminMode) {
      navigate('/admin');
    } else {
      await logout();
      navigate('/login', { replace: true });
    }
  };

  // 시트 새로고침 (신규 품목 배정 배너 클릭 시)
  const handleRefreshSheet = () => {
    setHasNewItemsInCurrentCampaign(false);
    // 시트 ref가 있으면 loadSlots 호출, 아니면 전체 새로고침
    if (sheetRef.current?.loadSlots) {
      sheetRef.current.loadSlots();
    }
    // 캠페인 데이터도 새로고침
    loadMonthlyBrands(selectedCampaign?.id);
  };

  // 연월브랜드 숨기기 (로컬 저장)
  const handleHideMonthlyBrand = (monthlyBrandId, e) => {
    e.stopPropagation();
    const newHidden = [...hiddenMonthlyBrandIds, monthlyBrandId];
    setHiddenMonthlyBrandIds(newHidden);
    localStorage.setItem('operator_hidden_monthly_brands', JSON.stringify(newHidden));
  };

  // 연월브랜드 복구
  const handleRestoreMonthlyBrand = (monthlyBrandId, e) => {
    e.stopPropagation();
    const newHidden = hiddenMonthlyBrandIds.filter(id => id !== monthlyBrandId);
    setHiddenMonthlyBrandIds(newHidden);
    localStorage.setItem('operator_hidden_monthly_brands', JSON.stringify(newHidden));
  };

  // 캠페인 숨기기 (로컬 저장)
  const handleHideCampaign = (campaignId, e) => {
    e.stopPropagation();
    const newHidden = [...hiddenCampaignIds, campaignId];
    setHiddenCampaignIds(newHidden);
    localStorage.setItem('operator_hidden_campaigns', JSON.stringify(newHidden));
    if (selectedCampaign?.id === campaignId) {
      setSelectedCampaign(null);
    }
  };

  // 캠페인 복구
  const handleRestoreCampaign = (campaignId, e) => {
    e.stopPropagation();
    const newHidden = hiddenCampaignIds.filter(id => id !== campaignId);
    setHiddenCampaignIds(newHidden);
    localStorage.setItem('operator_hidden_campaigns', JSON.stringify(newHidden));
  };

  // 일괄 삭제용 선택 토글
  const toggleBulkDeleteSelection = (type, id, e) => {
    e.stopPropagation();
    const key = `${type}_${id}`;
    setSelectedForBulkDelete(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 일괄 삭제 실행 (숨김 해제만 - 로컬 스토리지에서 삭제)
  const handleBulkDelete = async () => {
    if (selectedForBulkDelete.size === 0) return;

    const confirmMsg = `선택한 ${selectedForBulkDelete.size}개 항목을 숨김 목록에서 영구 삭제하시겠습니까?\n(숨김 해제가 아닌 완전 삭제입니다)`;
    if (!window.confirm(confirmMsg)) return;

    setBulkDeleting(true);
    try {
      const mbIdsToDelete = [];
      const campaignIdsToDelete = [];

      selectedForBulkDelete.forEach(key => {
        const [type, id] = key.split('_');
        if (type === 'mb') {
          mbIdsToDelete.push(parseInt(id));
        } else if (type === 'campaign') {
          campaignIdsToDelete.push(parseInt(id));
        }
      });

      // 로컬 스토리지에서 삭제 (숨김 목록에서 제거)
      if (mbIdsToDelete.length > 0) {
        const newHiddenMb = hiddenMonthlyBrandIds.filter(id => !mbIdsToDelete.includes(id));
        setHiddenMonthlyBrandIds(newHiddenMb);
        localStorage.setItem('operator_hidden_monthly_brands', JSON.stringify(newHiddenMb));
      }

      if (campaignIdsToDelete.length > 0) {
        const newHiddenCampaigns = hiddenCampaignIds.filter(id => !campaignIdsToDelete.includes(id));
        setHiddenCampaignIds(newHiddenCampaigns);
        localStorage.setItem('operator_hidden_campaigns', JSON.stringify(newHiddenCampaigns));
      }

      setSelectedForBulkDelete(new Set());
      alert('선택한 항목이 숨김 목록에서 삭제되었습니다.');
    } catch (err) {
      console.error('Bulk delete failed:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Outlet을 사용할지 시트를 표시할지 결정
  const basePathOnly = isAdminMode ? '/admin/view-operator' : '/operator';
  // Admin 모드에서 userId 쿼리 파라미터 유지
  const basePath = isAdminMode && viewAsUserId ? `${basePathOnly}?userId=${viewAsUserId}` : basePathOnly;
  const isDefaultRoute = isEmbedded ? true : (location.pathname === basePathOnly || location.pathname === `${basePathOnly}/`);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: isEmbedded ? '100%' : '100vh', minHeight: isEmbedded ? 0 : '100vh', bgcolor: '#f5f5f5', overflow: 'hidden' }}>

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
            {isAdminMode ? '진행자 보기 (Admin)' : 'Campaign Manager'}
          </Typography>

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* 메모장 버튼 */}
          <Button
            color="inherit"
            startIcon={<NoteAltIcon />}
            onClick={() => setMemoDialogOpen(true)}
            sx={{ mr: 2 }}
          >
            메모장
          </Button>

          {/* 오른쪽: 선 업로드 알림 */}
          <IconButton color="inherit" onClick={handleNotificationClick}>
            <Badge badgeContent={totalPreUploadCount} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <Menu
            anchorEl={notificationAnchor}
            open={Boolean(notificationAnchor)}
            onClose={handleNotificationClose}
            PaperProps={{
              sx: { minWidth: 320, maxHeight: 400 }
            }}
          >
            <Box sx={{ px: 2, py: 1, bgcolor: '#fff3e0' }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HourglassEmptyIcon fontSize="small" color="warning" />
                선 업로드 알림
                {totalPreUploadCount > 0 && (
                  <Chip label={`${totalPreUploadCount}건`} size="small" color="warning" />
                )}
              </Typography>
            </Box>
            <Divider />
            {preUploads.length > 0 ? (
              preUploads.map((item, index) => (
                <MenuItem
                  key={`${item.campaignId}-${item.itemId}`}
                  onClick={() => handleNavigateToItem(item.campaignId, item.itemId)}
                  sx={{
                    py: 1.5,
                    borderBottom: index < preUploads.length - 1 ? '1px solid #eee' : 'none'
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {item.itemName}
                        </Typography>
                        <Chip
                          label={`${item.preUploadCount}건`}
                          size="small"
                          color="warning"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {item.campaignName}
                      </Typography>
                    }
                  />
                </MenuItem>
              ))
            ) : (
              <MenuItem disabled>
                <ListItemText
                  primary={
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                      선 업로드된 이미지가 없습니다
                    </Typography>
                  }
                />
              </MenuItem>
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
              {user?.username?.charAt(0)?.toUpperCase() || 'O'}
            </Avatar>
            <Typography variant="subtitle2">{user?.name || '진행자'}</Typography>
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
          borderRight: '1px solid #e0e0e0',
          transition: 'width 0.2s ease-in-out'
        }}
      >
        {!sidebarCollapsed && (
          <Box sx={{ flex: 1, overflow: 'auto', pb: 1 }}>
            <Box sx={{ p: 1.5, bgcolor: showHidden ? '#fff3e0' : '#e8eaf6', borderBottom: '1px solid #e0e0e0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarMonthIcon fontSize="small" />
                  {showHidden ? '숨긴 항목' : '연월브랜드'}
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
                  {showHidden && selectedForBulkDelete.size > 0 && (
                    <Tooltip title="선택 항목 일괄 삭제">
                      <IconButton
                        size="small"
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting}
                        sx={{ p: 0.5 }}
                        color="error"
                      >
                        <DeleteSweepIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {showHidden && selectedForBulkDelete.size > 0 && (
                    <Chip label={`${selectedForBulkDelete.size}개 선택됨`} size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
                  )}
                  <Tooltip title={showHidden ? '일반 목록 보기' : '숨긴 항목 보기'}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setShowHidden(!showHidden);
                        setSelectedForBulkDelete(new Set());
                      }}
                      sx={{ p: 0.5 }}
                      color={showHidden ? 'warning' : 'default'}
                    >
                      {showHidden ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (() => {
              // 숨김 여부에 따라 필터링
              const filteredMonthlyBrands = monthlyBrands.map(mb => {
                // 캠페인 숨김 필터링
                const filteredCampaigns = (mb.campaigns || []).filter(c => {
                  const isHidden = hiddenCampaignIds.includes(c.id);
                  return showHidden ? isHidden : !isHidden;
                });
                return { ...mb, campaigns: filteredCampaigns };
              }).filter(mb => {
                const isMbHidden = hiddenMonthlyBrandIds.includes(mb.id);
                if (showHidden) {
                  return isMbHidden || mb.campaigns.length > 0;
                }
                return !isMbHidden && mb.campaigns.length > 0;
              });

              if (filteredMonthlyBrands.length === 0) {
                return (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {showHidden ? '숨긴 항목이 없습니다' : '배정된 연월브랜드가 없습니다'}
                    </Typography>
                  </Box>
                );
              }

              return (
                <List component="nav" disablePadding dense>
                  {filteredMonthlyBrands.map((monthlyBrand) => {
                    const isMbHidden = hiddenMonthlyBrandIds.includes(monthlyBrand.id);
                    if (!showHidden && isMbHidden) return null;

                    return (
                      <React.Fragment key={monthlyBrand.id}>
                        <ListItemButton
                          onClick={() => handleMonthlyBrandToggle(monthlyBrand.id)}
                          sx={{
                            bgcolor: isMbHidden ? '#fff3e0' : expandedMonthlyBrands[monthlyBrand.id] ? '#e8eaf6' : 'inherit',
                            borderBottom: '1px solid #f0f0f0',
                            py: 0.5
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <CalendarMonthIcon fontSize="small" color={isMbHidden ? 'warning' : 'primary'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="body2" fontWeight="bold" noWrap sx={{ flex: 1, fontSize: '0.85rem', color: isMbHidden ? 'text.secondary' : 'inherit' }}>
                                  {monthlyBrand.name}
                                </Typography>
                                {showHidden && isMbHidden ? (
                                  <>
                                    <IconButton size="small" onClick={(e) => toggleBulkDeleteSelection('mb', monthlyBrand.id, e)} sx={{ p: 0.3 }}>
                                      {selectedForBulkDelete.has(`mb_${monthlyBrand.id}`) ? (
                                        <CheckBoxIcon sx={{ fontSize: 18, color: '#d32f2f' }} />
                                      ) : (
                                        <CheckBoxOutlineBlankIcon sx={{ fontSize: 18, color: '#999' }} />
                                      )}
                                    </IconButton>
                                    <Tooltip title="복구">
                                      <IconButton size="small" color="success" onClick={(e) => handleRestoreMonthlyBrand(monthlyBrand.id, e)} sx={{ p: 0.3 }}>
                                        <RestoreIcon sx={{ fontSize: 18 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                ) : !showHidden ? (
                                  <Tooltip title="숨기기">
                                    <IconButton size="small" color="default" onClick={(e) => handleHideMonthlyBrand(monthlyBrand.id, e)} sx={{ p: 0.3 }}>
                                      <VisibilityOffIcon sx={{ fontSize: 16, color: '#bbb' }} />
                                    </IconButton>
                                  </Tooltip>
                                ) : null}
                                <Chip label={monthlyBrand.campaigns.length} size="small" sx={{ height: 18, minWidth: 20, fontSize: '0.65rem' }} />
                              </Box>
                            }
                          />
                          {expandedMonthlyBrands[monthlyBrand.id] ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                        </ListItemButton>

                        <Collapse in={expandedMonthlyBrands[monthlyBrand.id]} timeout={150}>
                          <List component="div" disablePadding dense>
                            {monthlyBrand.campaigns.length > 0 ? (
                              monthlyBrand.campaigns.map((campaign) => {
                                const stats = getCampaignStats(campaign);
                                const isSelected = selectedCampaign?.id === campaign.id;
                                const isHidden = hiddenCampaignIds.includes(campaign.id);
                                const isNewlyAdded = newlyAddedCampaignIds.has(campaign.id);

                                return (
                                  <ListItemButton
                                    key={campaign.id}
                                    onClick={() => handleCampaignClick(campaign)}
                                    sx={{
                                      pl: 4, py: 0.3,
                                      bgcolor: isNewlyAdded ? '#e8f5e9' : isHidden ? '#fff8e1' : isSelected ? '#c5cae9' : 'inherit',
                                      borderLeft: isNewlyAdded ? '3px solid #4caf50' : isSelected ? '3px solid #2c387e' : '3px solid transparent',
                                      animation: isNewlyAdded ? 'pulse 2s infinite' : 'none',
                                      '@keyframes pulse': {
                                        '0%': { bgcolor: '#e8f5e9' },
                                        '50%': { bgcolor: '#c8e6c9' },
                                        '100%': { bgcolor: '#e8f5e9' }
                                      },
                                      '&:hover': { bgcolor: isNewlyAdded ? '#c8e6c9' : isHidden ? '#fff8e1' : isSelected ? '#c5cae9' : '#f5f5f5' }
                                    }}
                                  >
                                    <ListItemIcon sx={{ minWidth: 24 }}>
                                      <FolderIcon sx={{ fontSize: 16 }} color={isHidden ? 'warning' : isSelected ? 'primary' : 'action'} />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <Typography variant="body2" fontWeight={isSelected ? 'bold' : 'normal'} noWrap sx={{ fontSize: '0.8rem', flex: 1, color: isHidden ? 'text.secondary' : 'inherit' }}>
                                            {campaign.name}
                                          </Typography>
                                          {showHidden ? (
                                            <>
                                              <IconButton size="small" onClick={(e) => toggleBulkDeleteSelection('campaign', campaign.id, e)} sx={{ p: 0.2 }}>
                                                {selectedForBulkDelete.has(`campaign_${campaign.id}`) ? (
                                                  <CheckBoxIcon sx={{ fontSize: 14, color: '#d32f2f' }} />
                                                ) : (
                                                  <CheckBoxOutlineBlankIcon sx={{ fontSize: 14, color: '#999' }} />
                                                )}
                                              </IconButton>
                                              <Tooltip title="복구">
                                                <IconButton size="small" color="success" onClick={(e) => handleRestoreCampaign(campaign.id, e)} sx={{ p: 0.2 }}>
                                                  <RestoreIcon sx={{ fontSize: 14 }} />
                                                </IconButton>
                                              </Tooltip>
                                            </>
                                          ) : (
                                            <>
                                              {isNewlyAdded && (
                                                <Chip
                                                  label="신규 배정"
                                                  size="small"
                                                  color="success"
                                                  sx={{
                                                    height: 18,
                                                    fontSize: '0.65rem',
                                                    fontWeight: 'bold',
                                                    animation: 'pulse-chip 1.5s infinite',
                                                    '@keyframes pulse-chip': {
                                                      '0%': { transform: 'scale(1)' },
                                                      '50%': { transform: 'scale(1.05)' },
                                                      '100%': { transform: 'scale(1)' }
                                                    }
                                                  }}
                                                />
                                              )}
                                              {stats.isCompleted ? (
                                                <Tooltip title={`완료! ${stats.totalReviewCompleted}/${stats.totalPurchaseTarget}`}>
                                                  <CheckCircleIcon sx={{ fontSize: 18, color: '#4caf50' }} />
                                                </Tooltip>
                                              ) : stats.totalPurchaseTarget > 0 ? (
                                                <Tooltip title={`진행률: ${stats.totalReviewCompleted}/${stats.totalPurchaseTarget}`}>
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
                                                <Chip label={stats.totalItems} size="small" sx={{ height: 14, fontSize: '0.6rem', minWidth: 16 }} />
                                              )}
                                              {stats.newCount > 0 && (
                                                <Chip icon={<FiberNewIcon sx={{ fontSize: '0.7rem !important' }} />} label={stats.newCount} size="small" color="warning" sx={{ height: 16, fontSize: '0.6rem' }} />
                                              )}
                                              {stats.courierCount > 0 && (
                                                <Tooltip title={`택배대행 ${stats.courierCount}건`}>
                                                  <Chip
                                                    icon={<LocalShippingIcon sx={{ fontSize: '0.7rem !important' }} />}
                                                    label={stats.courierCount}
                                                    size="small"
                                                    sx={{
                                                      height: 16,
                                                      fontSize: '0.6rem',
                                                      bgcolor: '#e3f2fd',
                                                      color: '#1565c0',
                                                      '& .MuiChip-icon': { color: '#1565c0' }
                                                    }}
                                                  />
                                                </Tooltip>
                                              )}
                                              {stats.warningCount > 0 && <WarningIcon color="error" sx={{ fontSize: 14 }} />}
                                              <Tooltip title="숨기기">
                                                <IconButton size="small" color="default" onClick={(e) => handleHideCampaign(campaign.id, e)} sx={{ p: 0.2 }}>
                                                  <VisibilityOffIcon sx={{ fontSize: 14, color: '#ccc' }} />
                                                </IconButton>
                                              </Tooltip>
                                            </>
                                          )}
                                        </Box>
                                      }
                                    />
                                  </ListItemButton>
                                );
                              })
                            ) : (
                              <Box sx={{ pl: 4, py: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {showHidden ? '숨긴 캠페인 없음' : '캠페인 없음'}
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
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: '#fafafa',
          minHeight: 0
        }}
      >
        {/* 기본 라우트일 때 탭 + 시트 표시 */}
        {isDefaultRoute ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {/* 탭 헤더 */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, bgcolor: 'white' }}>
              <Tabs
                value={sheetTab}
                onChange={(e, newValue) => setSheetTab(newValue)}
                sx={{
                  minHeight: 40,
                  '& .MuiTab-root': { minHeight: 40, py: 0.5 }
                }}
              >
                <Tab
                  icon={<AssignmentIcon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  label="캠페인 시트"
                  sx={{ fontSize: '0.85rem' }}
                />
                <Tab
                  icon={<CalendarMonthIcon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  label="날짜별 작업"
                  sx={{ fontSize: '0.85rem' }}
                />
              </Tabs>
            </Box>

            {/* 탭 0: 캠페인 시트 */}
            {sheetTab === 0 && (
              selectedCampaign ? (
                <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                  {/* 캠페인 헤더 - 최소화 */}
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                    px: 1,
                    flexShrink: 0
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {selectedCampaign.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        배정 품목 {selectedCampaign.items?.length || 0}개
                      </Typography>
                    </Box>
                  </Box>

                  {/* 신규 품목 배정 알림 배너 */}
                  {hasNewItemsInCurrentCampaign && (
                    <Alert
                      severity="info"
                      icon={<FiberNewIcon />}
                      action={
                        <Button
                          color="inherit"
                          size="small"
                          startIcon={<RefreshIcon />}
                          onClick={handleRefreshSheet}
                        >
                          새로고침
                        </Button>
                      }
                      sx={{
                        mb: 1,
                        mx: 1,
                        flexShrink: 0,
                        '& .MuiAlert-message': { display: 'flex', alignItems: 'center' }
                      }}
                    >
                      현재 캠페인에 새로운 품목이 배정되었습니다.
                    </Alert>
                  )}

                  {/* 품목 시트 (DB 슬롯 기반 엑셀 형식) */}
                  <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    {USE_UNIFIED_SHEET ? (
                      <UnifiedItemSheet
                        campaignId={selectedCampaign.id}
                        items={selectedCampaign.items || []}
                        onRefresh={() => loadMonthlyBrands(selectedCampaign?.id)}
                        userRole="operator"
                        viewAsUserId={viewAsUserId}
                      />
                    ) : (
                      <OperatorItemSheet
                        ref={sheetRef}
                        campaignId={selectedCampaign.id}
                        campaignName={selectedCampaign.name}
                        items={selectedCampaign.items || []}
                        onRefresh={() => loadMonthlyBrands(selectedCampaign?.id)}
                        viewAsUserId={viewAsUserId}
                      />
                    )}
                  </Box>
                </Box>
              ) : (
                // 캠페인이 선택되지 않았을 때 안내 메시지
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  color: 'text.secondary'
                }}>
                  <FolderIcon sx={{ fontSize: 80, mb: 2, opacity: 0.3 }} />
                  <Typography variant="h6" color="text.secondary">
                    왼쪽에서 캠페인을 선택하세요
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    연월브랜드를 펼쳐 캠페인을 클릭하면 배정된 품목 시트가 표시됩니다
                  </Typography>
                </Box>
              )
            )}

            {/* 탭 1: 날짜별 작업 */}
            {sheetTab === 1 && (
              <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                <DailyWorkSheet userRole="operator" viewAsUserId={viewAsUserId} />
              </Box>
            )}
          </Box>
        ) : (
          // 다른 라우트일 때 Outlet 표시
          <Box sx={{ p: 3 }}>
            <Outlet />
          </Box>
        )}
      </Box>
      </Box>

      {/* 프로필 수정 다이얼로그 */}
      <ProfileEditDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
      />

      {/* 메모장 다이얼로그 */}
      <OperatorMemoDialog
        open={memoDialogOpen}
        onClose={() => setMemoDialogOpen(false)}
      />
    </Box>
  );
}

export default OperatorLayout;
