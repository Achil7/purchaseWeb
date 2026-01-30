import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, Button, IconButton, Avatar,
  Badge, Menu, MenuItem, ListItemText, Divider, Chip, Alert,
  Tabs, Tab
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FolderIcon from '@mui/icons-material/Folder';
import FiberNewIcon from '@mui/icons-material/FiberNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAuth } from '../../context/AuthContext';
import ProfileEditDialog from '../common/ProfileEditDialog';
import OperatorMemoDialog from './OperatorMemoDialog';
import OperatorSidebar from './OperatorSidebar';
import OperatorItemSheet from './OperatorItemSheet';
import UnifiedItemSheet from '../common/UnifiedItemSheet';
import DailyWorkSheet from '../common/DailyWorkSheet';
import { itemService } from '../../services';

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

  // 선택된 캠페인 (오른쪽에 시트 표시)
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // 시트 탭 상태 (0: 기본 시트, 1: 날짜별 작업)
  const [sheetTab, setSheetTab] = useState(0);

  // 선 업로드 알림 관련 상태
  const [preUploads, setPreUploads] = useState([]);
  const [totalPreUploadCount, setTotalPreUploadCount] = useState(0);
  const [notificationAnchor, setNotificationAnchor] = useState(null);

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
          // 새로운 배정이 포함된 연월브랜드 자동 펼치기는 OperatorSidebar에서 처리
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

  // 캠페인 클릭 - 오른쪽에 시트 표시 (useCallback으로 함수 재생성 방지)
  const handleCampaignClick = useCallback((campaign) => {
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
    // basePath/basePathOnly를 함수 내부에서 계산 (정의 순서 문제 방지)
    const localBasePathOnly = isAdminMode ? '/admin/view-operator' : '/operator';
    const localBasePath = isAdminMode && viewAsUserId ? `${localBasePathOnly}?userId=${viewAsUserId}` : localBasePathOnly;
    if (!isEmbedded && location.pathname !== localBasePathOnly && location.pathname !== `${localBasePathOnly}/`) {
      navigate(localBasePath);
    }
  }, [newlyAddedCampaignIds, isEmbedded, location.pathname, isAdminMode, viewAsUserId, navigate]);

  const handleNotificationClick = useCallback((event) => {
    setNotificationAnchor(event.currentTarget);
  }, []);

  const handleNotificationClose = useCallback(() => {
    setNotificationAnchor(null);
  }, []);

  const handleNavigateToItem = useCallback((campaignId, itemId) => {
    setNotificationAnchor(null);
    navigate(`/operator/campaign/${campaignId}/item/${itemId}`);
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    if (isAdminMode) {
      navigate('/admin');
    } else {
      await logout();
      navigate('/login', { replace: true });
    }
  }, [isAdminMode, navigate, logout]);

  // 시트 새로고침 (신규 품목 배정 배너 클릭 시)
  const handleRefreshSheet = useCallback(() => {
    setHasNewItemsInCurrentCampaign(false);
    // 시트 ref가 있으면 loadSlots 호출, 아니면 전체 새로고침
    if (sheetRef.current?.loadSlots) {
      sheetRef.current.loadSlots();
    }
    // 캠페인 데이터도 새로고침
    loadMonthlyBrands(selectedCampaign?.id);
  }, [loadMonthlyBrands, selectedCampaign?.id]);

  // 시트 컴포넌트 메모이제이션 - 사이드바 토글 시 리렌더링 방지
  // selectedCampaign.id, viewAsUserId가 변경될 때만 시트가 다시 렌더링됨
  const memoizedSheet = useMemo(() => {
    if (!selectedCampaign) return null;
    return (
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
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaign?.id, selectedCampaign?.name, viewAsUserId]);

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
        {/* 왼쪽 사이드바 - 완전 독립 컴포넌트 (상태 분리로 시트 리렌더링 방지) */}
        <OperatorSidebar
          monthlyBrands={monthlyBrands}
          loading={loading}
          selectedCampaignId={selectedCampaign?.id}
          onCampaignSelect={handleCampaignClick}
          newlyAddedCampaignIds={newlyAddedCampaignIds}
          campaignStatsMap={campaignStatsMap}
          isEmbedded={isEmbedded}
          viewAsUserId={viewAsUserId}
          onMonthlyBrandsReorder={(reorderedBrands) => {
            if (reorderedBrands === null) {
              // 실패 시 새로고침
              loadMonthlyBrands();
            } else {
              // 낙관적 업데이트
              setMonthlyBrands(reorderedBrands);
            }
          }}
        />

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

                  {/* 품목 시트 (DB 슬롯 기반 엑셀 형식) - useMemo로 메모이제이션하여 사이드바 토글 시 리렌더링 방지 */}
                  {memoizedSheet}
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
