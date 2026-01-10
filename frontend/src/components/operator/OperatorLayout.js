import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, Button, IconButton, Avatar,
  Badge, Menu, MenuItem, ListItemText, Divider, Chip, Paper,
  List, ListItemButton, ListItemIcon, CircularProgress, Collapse, Tooltip
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import DateRangeIcon from '@mui/icons-material/DateRange';
import FolderIcon from '@mui/icons-material/Folder';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FiberNewIcon from '@mui/icons-material/FiberNew';
import WarningIcon from '@mui/icons-material/Warning';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RestoreIcon from '@mui/icons-material/Restore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from '../../context/AuthContext';
import ProfileEditDialog from '../common/ProfileEditDialog';
import OperatorMemoDialog from './OperatorMemoDialog';
import OperatorItemSheet from './OperatorItemSheet';
import UnifiedItemSheet from '../common/UnifiedItemSheet';
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

  // 확장된 연월브랜드 상태
  const [expandedMonthlyBrands, setExpandedMonthlyBrands] = useState({});

  // 선택된 캠페인 (오른쪽에 시트 표시)
  const [selectedCampaign, setSelectedCampaign] = useState(null);

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

  // 연월브랜드별 캠페인 데이터 로드
  const loadMonthlyBrands = useCallback(async (selectedCampaignId = null) => {
    try {
      setLoading(true);
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
      setLoading(false);
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

  // 캠페인의 신규/진행/경고/완료 품목 개수 계산
  const getCampaignStats = (campaign) => {
    const items = campaign.items || [];
    let newCount = 0;
    let warningCount = 0;
    let totalReviewCompleted = 0;
    let totalPurchaseTarget = 0;

    for (const item of items) {
      const status = getAssignmentStatus(item.assigned_at);
      if (status === 'new') {
        newCount++;
      } else {
        if ((item.normalBuyerCount || 0) === 0) {
          warningCount++;
        }
      }
      // 리뷰 완료 수 합산
      totalReviewCompleted += item.reviewCompletedCount || 0;
      totalPurchaseTarget += item.totalPurchaseCount || 0;
    }

    // 캠페인 완료 여부: 총 구매 목표 대비 리뷰 완료 비율
    const isCompleted = totalPurchaseTarget > 0 && totalReviewCompleted >= totalPurchaseTarget;
    const completionRate = totalPurchaseTarget > 0 ? Math.round((totalReviewCompleted / totalPurchaseTarget) * 100) : 0;

    return {
      newCount,
      warningCount,
      totalItems: items.length,
      totalReviewCompleted,
      totalPurchaseTarget,
      isCompleted,
      completionRate
    };
  };

  // 연월브랜드 확장/축소 토글
  const handleMonthlyBrandToggle = (monthlyBrandId) => {
    setExpandedMonthlyBrands(prev => ({
      ...prev,
      [monthlyBrandId]: !prev[monthlyBrandId]
    }));
  };

  // 캠페인 클릭 - 오른쪽에 시트 표시
  const handleCampaignClick = (campaign) => {
    setSelectedCampaign(campaign);
    // 다른 페이지에 있을 때 기본 라우트로 이동
    if (location.pathname !== basePathOnly && location.pathname !== `${basePathOnly}/`) {
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

  // Outlet을 사용할지 시트를 표시할지 결정
  const basePathOnly = isAdminMode ? '/admin/view-operator' : '/operator';
  // Admin 모드에서 userId 쿼리 파라미터 유지
  const basePath = isAdminMode && viewAsUserId ? `${basePathOnly}?userId=${viewAsUserId}` : basePathOnly;
  const isDefaultRoute = isEmbedded ? true : (location.pathname === basePathOnly || location.pathname === `${basePathOnly}/`);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>

      {/* 헤더 - isEmbedded일 때는 relative 포지션 */}
      <AppBar position={isEmbedded ? "relative" : "fixed"} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: isAdminMode ? '#2c387e' : '#00897b', flexShrink: 0 }}>
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
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'teal' }}>
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
      <Box sx={{ display: 'flex', flex: 1, pt: isEmbedded ? 0 : 8 }}>
      {/* 왼쪽 사이드바 - 연월브랜드/캠페인 목록 */}
      <Paper
        sx={{
          width: sidebarCollapsed ? 40 : DRAWER_WIDTH,
          flexShrink: 0,
          height: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0,
          borderRight: '1px solid #e0e0e0',
          transition: 'width 0.2s ease-in-out'
        }}
      >
        {!sidebarCollapsed && (
          <Box sx={{ flex: 1, overflow: 'auto', pb: 1 }}>
            <Box sx={{ p: 1.5, bgcolor: showHidden ? '#fff3e0' : '#e0f2f1', borderBottom: '1px solid #e0e0e0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DateRangeIcon fontSize="small" />
                  {showHidden ? '숨긴 항목' : '연월브랜드'}
                </Typography>
                <Tooltip title={showHidden ? '일반 목록 보기' : '숨긴 항목 보기'}>
                  <IconButton
                    size="small"
                    onClick={() => setShowHidden(!showHidden)}
                    sx={{ p: 0.5 }}
                    color={showHidden ? 'warning' : 'default'}
                  >
                    {showHidden ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
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
                            bgcolor: isMbHidden ? '#fff3e0' : expandedMonthlyBrands[monthlyBrand.id] ? '#e0f2f1' : 'inherit',
                            borderBottom: '1px solid #f0f0f0',
                            py: 0.5
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <DateRangeIcon fontSize="small" color={isMbHidden ? 'warning' : 'primary'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="body2" fontWeight="bold" noWrap sx={{ flex: 1, fontSize: '0.85rem', color: isMbHidden ? 'text.secondary' : 'inherit' }}>
                                  {monthlyBrand.name}
                                </Typography>
                                {showHidden && isMbHidden ? (
                                  <Tooltip title="복구">
                                    <IconButton size="small" color="success" onClick={(e) => handleRestoreMonthlyBrand(monthlyBrand.id, e)} sx={{ p: 0.3 }}>
                                      <RestoreIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Tooltip>
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

                        <Collapse in={expandedMonthlyBrands[monthlyBrand.id]} timeout="auto" unmountOnExit>
                          <List component="div" disablePadding dense>
                            {monthlyBrand.campaigns.length > 0 ? (
                              monthlyBrand.campaigns.map((campaign) => {
                                const stats = getCampaignStats(campaign);
                                const isSelected = selectedCampaign?.id === campaign.id;
                                const isHidden = hiddenCampaignIds.includes(campaign.id);

                                return (
                                  <ListItemButton
                                    key={campaign.id}
                                    onClick={() => handleCampaignClick(campaign)}
                                    sx={{
                                      pl: 4, py: 0.3,
                                      bgcolor: isHidden ? '#fff8e1' : isSelected ? '#b2dfdb' : 'inherit',
                                      borderLeft: isSelected ? '3px solid #00897b' : '3px solid transparent',
                                      '&:hover': { bgcolor: isHidden ? '#fff8e1' : isSelected ? '#b2dfdb' : '#f5f5f5' }
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
                                            <Tooltip title="복구">
                                              <IconButton size="small" color="success" onClick={(e) => handleRestoreCampaign(campaign.id, e)} sx={{ p: 0.2 }}>
                                                <RestoreIcon sx={{ fontSize: 14 }} />
                                              </IconButton>
                                            </Tooltip>
                                          ) : (
                                            <>
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
            bgcolor: '#00897b',
            color: 'white',
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: '#00796b' }
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
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: '#fafafa',
          height: isEmbedded ? 'calc(100vh - 64px)' : 'calc(100vh - 64px)'
        }}
      >
        {/* 캠페인이 선택되었고 기본 라우트일 때 시트 표시 */}
        {selectedCampaign && isDefaultRoute ? (
          <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
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

            {/* 품목 시트 (DB 슬롯 기반 엑셀 형식) */}
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
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
                  campaignId={selectedCampaign.id}
                  items={selectedCampaign.items || []}
                  onRefresh={() => loadMonthlyBrands(selectedCampaign?.id)}
                  viewAsUserId={viewAsUserId}
                />
              )}
            </Box>
          </Box>
        ) : isDefaultRoute ? (
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
