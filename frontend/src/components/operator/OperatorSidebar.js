import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Box, Typography, IconButton, Chip, Paper,
  List, ListItemButton, ListItemIcon, ListItemText, CircularProgress, Collapse, Tooltip,
  TextField, InputAdornment, Pagination
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import { monthlyBrandService } from '../../services';

const DEFAULT_DRAWER_WIDTH = 280;
const MIN_DRAWER_WIDTH = 200;
const MAX_DRAWER_WIDTH = 500;
const SIDEBAR_WIDTH_KEY = 'operator_sidebar_width';
const EXPANDED_MB_KEY = 'operator_expanded_monthly_brands';

// 캠페인 아이템 컴포넌트 - React.memo로 불필요한 리렌더링 방지
const CampaignItem = React.memo(({
  campaign, stats, isSelected, isHidden, isNewlyAdded, showHidden,
  isSelectedForBulkDelete, onCampaignClick, onToggleBulkDelete,
  onRestoreCampaign, onHideCampaign
}) => {
  return (
    <ListItemButton
      onClick={() => onCampaignClick(campaign)}
      sx={{
        pl: 4, py: 0.3,
        bgcolor: isNewlyAdded ? '#e8f5e9' : isHidden ? '#fff8e1' : isSelected ? '#c5cae9' : 'inherit',
        borderLeft: isNewlyAdded ? '3px solid #4caf50' : isSelected ? '3px solid #2c387e' : '3px solid transparent',
        animation: isNewlyAdded ? 'pulse-bg 2s infinite' : 'none',
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
                <IconButton size="small" onClick={(e) => onToggleBulkDelete('campaign', campaign.id, e)} sx={{ p: 0.2 }}>
                  {isSelectedForBulkDelete ? (
                    <CheckBoxIcon sx={{ fontSize: 14, color: '#d32f2f' }} />
                  ) : (
                    <CheckBoxOutlineBlankIcon sx={{ fontSize: 14, color: '#999' }} />
                  )}
                </IconButton>
                <Tooltip title="복구">
                  <IconButton size="small" color="success" onClick={(e) => onRestoreCampaign(campaign.id, e)} sx={{ p: 0.2 }}>
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
                    sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold', animation: 'pulse-chip 1.5s infinite' }}
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
                      sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#e3f2fd', color: '#1565c0', '& .MuiChip-icon': { color: '#1565c0' } }}
                    />
                  </Tooltip>
                )}
                {stats.emptyDateCount > 0 && (
                  <Tooltip title={`날짜 미입력 ${stats.emptyDateCount}건`}>
                    <Chip
                      icon={<EventBusyIcon sx={{ fontSize: '0.7rem !important' }} />}
                      label={stats.emptyDateCount}
                      size="small"
                      sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#fff3e0', color: '#e65100', '& .MuiChip-icon': { color: '#e65100' } }}
                    />
                  </Tooltip>
                )}
                {stats.warningCount > 0 && <WarningIcon color="error" sx={{ fontSize: 14 }} />}
                <Tooltip title="숨기기">
                  <IconButton size="small" color="default" onClick={(e) => onHideCampaign(campaign.id, e)} sx={{ p: 0.2 }}>
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
});

// 기본 통계 객체 (상수)
const DEFAULT_CAMPAIGN_STATS = {
  newCount: 0,
  warningCount: 0,
  totalItems: 0,
  totalReviewCompleted: 0,
  totalPurchaseTarget: 0,
  isCompleted: false,
  completionRate: 0,
  courierCount: 0,
  emptyDateCount: 0
};

/**
 * OperatorSidebar - 완전히 독립된 사이드바 컴포넌트
 * expandedMonthlyBrands 상태를 내부에서 관리하여 부모(OperatorLayout) 리렌더링 방지
 */
function OperatorSidebar({
  monthlyBrands,
  loading,
  selectedCampaignId,
  onCampaignSelect,
  newlyAddedCampaignIds,
  campaignStatsMap,
  isEmbedded,
  getAssignmentStatus,
  viewAsUserId,
  onMonthlyBrandsReorder
}) {
  // ========== 사이드바 내부 상태 (부모에 영향 없음) ==========

  // 확장된 연월브랜드 상태 - localStorage에서 복원
  const [expandedMonthlyBrands, setExpandedMonthlyBrands] = useState(() => {
    try {
      const saved = localStorage.getItem(EXPANDED_MB_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 숨김 항목 표시 모드
  const [showHidden, setShowHidden] = useState(false);

  // 숨겨진 캠페인 ID 목록
  const [hiddenCampaignIds, setHiddenCampaignIds] = useState(() => {
    const saved = localStorage.getItem('operator_hidden_campaigns');
    return saved ? JSON.parse(saved) : [];
  });

  // 숨겨진 연월브랜드 ID 목록
  const [hiddenMonthlyBrandIds, setHiddenMonthlyBrandIds] = useState(() => {
    const saved = localStorage.getItem('operator_hidden_monthly_brands');
    return saved ? JSON.parse(saved) : [];
  });

  // 사이드바 접기/펼치기 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 사이드바 너비 리사이즈 상태
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_DRAWER_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef({
    startX: 0,
    startWidth: sidebarWidth
  });

  // 일괄 삭제용 선택 상태
  const [selectedForBulkDelete, setSelectedForBulkDelete] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // 연월브랜드 검색 상태
  const [searchQuery, setSearchQuery] = useState('');

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // 디바운스용 ref
  const saveExpandedTimeoutRef = useRef(null);

  // ========== 리사이즈 핸들러 (DOM 직접 조작으로 리렌더 방지) ==========

  const sidebarRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth
    };
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.min(MAX_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, resizeRef.current.startWidth + delta));
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
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // ========== 성능 최적화 ==========

  // Set 변환 (O(1) 조회)
  const hiddenCampaignIdsSet = useMemo(() => new Set(hiddenCampaignIds), [hiddenCampaignIds]);
  const hiddenMonthlyBrandIdsSet = useMemo(() => new Set(hiddenMonthlyBrandIds), [hiddenMonthlyBrandIds]);

  // 필터링된 연월브랜드 (검색 포함)
  const filteredMonthlyBrands = useMemo(() => {
    const searchLower = searchQuery.trim().toLowerCase();

    return monthlyBrands.map(mb => {
      const filteredCampaigns = (mb.campaigns || []).filter(c => {
        const isHidden = hiddenCampaignIdsSet.has(c.id);
        const hiddenFilter = showHidden ? isHidden : !isHidden;
        return hiddenFilter;
      });
      return { ...mb, campaigns: filteredCampaigns };
    }).filter(mb => {
      const isMbHidden = hiddenMonthlyBrandIdsSet.has(mb.id);
      if (showHidden) {
        return isMbHidden || mb.campaigns.length > 0;
      }
      // 연월브랜드 이름으로 검색
      if (searchLower && !mb.name.toLowerCase().includes(searchLower)) {
        return false;
      }
      return !isMbHidden;
    });
  }, [monthlyBrands, hiddenCampaignIdsSet, hiddenMonthlyBrandIdsSet, showHidden, searchQuery]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredMonthlyBrands.length / ITEMS_PER_PAGE);
  const paginatedMonthlyBrands = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMonthlyBrands.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMonthlyBrands, currentPage]);

  // 검색어 변경 시 페이지 초기화
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // 캐싱된 통계 조회
  const getCampaignStats = useCallback((campaign) => {
    return campaignStatsMap?.get(campaign.id) || DEFAULT_CAMPAIGN_STATS;
  }, [campaignStatsMap]);

  // ========== 핸들러 ==========

  // 연월브랜드 토글 (디바운스 localStorage 저장)
  const handleMonthlyBrandToggle = useCallback((monthlyBrandId) => {
    setExpandedMonthlyBrands(prev => {
      const newState = { ...prev, [monthlyBrandId]: !prev[monthlyBrandId] };

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
  const handleExpandAll = useCallback(() => {
    const newState = {};
    monthlyBrands.forEach(mb => { newState[mb.id] = true; });
    setExpandedMonthlyBrands(newState);

    if (saveExpandedTimeoutRef.current) clearTimeout(saveExpandedTimeoutRef.current);
    saveExpandedTimeoutRef.current = setTimeout(() => {
      try { localStorage.setItem(EXPANDED_MB_KEY, JSON.stringify(newState)); }
      catch (e) { console.error('Failed to save expanded state:', e); }
    }, 300);
  }, [monthlyBrands]);

  // 모든 연월브랜드 접기
  const handleCollapseAll = useCallback(() => {
    const newState = {};
    monthlyBrands.forEach(mb => { newState[mb.id] = false; });
    setExpandedMonthlyBrands(newState);

    if (saveExpandedTimeoutRef.current) clearTimeout(saveExpandedTimeoutRef.current);
    saveExpandedTimeoutRef.current = setTimeout(() => {
      try { localStorage.setItem(EXPANDED_MB_KEY, JSON.stringify(newState)); }
      catch (e) { console.error('Failed to save expanded state:', e); }
    }, 300);
  }, [monthlyBrands]);

  // 캠페인 클릭
  const handleCampaignClick = useCallback((campaign) => {
    onCampaignSelect(campaign);
  }, [onCampaignSelect]);

  // 연월브랜드 숨기기
  const handleHideMonthlyBrand = useCallback((monthlyBrandId, e) => {
    e.stopPropagation();
    setHiddenMonthlyBrandIds(prev => {
      const newHidden = [...prev, monthlyBrandId];
      localStorage.setItem('operator_hidden_monthly_brands', JSON.stringify(newHidden));
      return newHidden;
    });
  }, []);

  // 연월브랜드 복구
  const handleRestoreMonthlyBrand = useCallback((monthlyBrandId, e) => {
    e.stopPropagation();
    setHiddenMonthlyBrandIds(prev => {
      const newHidden = prev.filter(id => id !== monthlyBrandId);
      localStorage.setItem('operator_hidden_monthly_brands', JSON.stringify(newHidden));
      return newHidden;
    });
  }, []);

  // 캠페인 숨기기
  const handleHideCampaign = useCallback((campaignId, e) => {
    e.stopPropagation();
    setHiddenCampaignIds(prev => {
      const newHidden = [...prev, campaignId];
      localStorage.setItem('operator_hidden_campaigns', JSON.stringify(newHidden));
      return newHidden;
    });
  }, []);

  // 캠페인 복구
  const handleRestoreCampaign = useCallback((campaignId, e) => {
    e.stopPropagation();
    setHiddenCampaignIds(prev => {
      const newHidden = prev.filter(id => id !== campaignId);
      localStorage.setItem('operator_hidden_campaigns', JSON.stringify(newHidden));
      return newHidden;
    });
  }, []);

  // 일괄 삭제용 선택 토글
  const toggleBulkDeleteSelection = useCallback((type, id, e) => {
    e.stopPropagation();
    const key = `${type}_${id}`;
    setSelectedForBulkDelete(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // 일괄 삭제 실행
  const handleBulkDelete = async () => {
    if (selectedForBulkDelete.size === 0) return;
    if (!window.confirm(`선택한 ${selectedForBulkDelete.size}개 항목을 숨김 목록에서 영구 삭제하시겠습니까?`)) return;

    try {
      setBulkDeleting(true);
      const mbIdsToRemove = [];
      const campaignIdsToRemove = [];

      selectedForBulkDelete.forEach(key => {
        const [type, id] = key.split('_');
        if (type === 'mb') mbIdsToRemove.push(parseInt(id));
        else if (type === 'campaign') campaignIdsToRemove.push(parseInt(id));
      });

      if (mbIdsToRemove.length > 0) {
        const newHiddenMb = hiddenMonthlyBrandIds.filter(id => !mbIdsToRemove.includes(id));
        setHiddenMonthlyBrandIds(newHiddenMb);
        localStorage.setItem('operator_hidden_monthly_brands', JSON.stringify(newHiddenMb));
      }

      if (campaignIdsToRemove.length > 0) {
        const newHiddenCampaigns = hiddenCampaignIds.filter(id => !campaignIdsToRemove.includes(id));
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

  // 드래그 앤 드롭 핸들러 (연월브랜드 순서 변경)
  const handleDragEnd = useCallback(async (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    // 숨김 항목 모드에서는 드래그 불가
    if (showHidden) return;

    const items = Array.from(filteredMonthlyBrands);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // 새 순서의 ID 배열
    const orderedIds = items.map(mb => mb.id);

    // 부모에게 낙관적 업데이트 요청
    if (onMonthlyBrandsReorder) {
      onMonthlyBrandsReorder(items);
    }

    try {
      await monthlyBrandService.reorderMonthlyBrandsOperator(orderedIds, viewAsUserId);
    } catch (err) {
      console.error('Failed to reorder monthly brands:', err);
      alert('순서 변경에 실패했습니다.');
      // 실패 시 원래 상태로 복원 - 부모에게 원래 목록 전달
      if (onMonthlyBrandsReorder) {
        onMonthlyBrandsReorder(null); // null은 새로고침 필요 신호
      }
    }
  }, [filteredMonthlyBrands, showHidden, viewAsUserId, onMonthlyBrandsReorder]);

  // ========== 렌더링 ==========

  return (
    <Box sx={{ display: 'flex', flexShrink: 0, position: 'relative' }}>
    <Paper
      ref={sidebarRef}
      sx={{
        width: sidebarCollapsed ? 40 : sidebarWidth,
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
          {/* 헤더 */}
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
                      <IconButton size="small" onClick={handleExpandAll} sx={{ p: 0.5 }}>
                        <UnfoldMoreIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="모두 접기">
                      <IconButton size="small" onClick={handleCollapseAll} sx={{ p: 0.5 }}>
                        <UnfoldLessIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
                {showHidden && selectedForBulkDelete.size > 0 && (
                  <>
                    <Tooltip title="선택 항목 일괄 삭제">
                      <IconButton size="small" onClick={handleBulkDelete} disabled={bulkDeleting} sx={{ p: 0.5 }} color="error">
                        <DeleteSweepIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Chip label={`${selectedForBulkDelete.size}개 선택됨`} size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
                  </>
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

          {/* 목록 */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : paginatedMonthlyBrands.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {showHidden
                  ? '숨긴 항목이 없습니다'
                  : searchQuery
                    ? `"${searchQuery}" 연월브랜드 검색 결과 없음`
                    : '배정된 연월브랜드가 없습니다'}
              </Typography>
            </Box>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="monthly-brands-operator" isDropDisabled={showHidden}>
                {(provided) => (
                  <List
                    component="nav"
                    disablePadding
                    dense
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {paginatedMonthlyBrands.map((monthlyBrand, index) => {
                      const isMbHidden = hiddenMonthlyBrandIdsSet.has(monthlyBrand.id);
                      if (!showHidden && isMbHidden) return null;

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
                                    bgcolor: snapshot.isDragging ? '#bbdefb' : isMbHidden ? '#fff3e0' : expandedMonthlyBrands[monthlyBrand.id] ? '#e8eaf6' : 'inherit',
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
                                    <CalendarMonthIcon fontSize="small" color={isMbHidden ? 'warning' : 'primary'} />
                                  </ListItemIcon>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
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
                                  {expandedMonthlyBrands[monthlyBrand.id] ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                                </ListItemButton>

                                <Collapse in={expandedMonthlyBrands[monthlyBrand.id]} timeout={0}>
                                  <List component="div" disablePadding dense>
                                    {monthlyBrand.campaigns.length > 0 ? (
                                      monthlyBrand.campaigns.map((campaign) => (
                                        <CampaignItem
                                          key={campaign.id}
                                          campaign={campaign}
                                          stats={getCampaignStats(campaign)}
                                          isSelected={selectedCampaignId === campaign.id}
                                          isHidden={hiddenCampaignIdsSet.has(campaign.id)}
                                          isNewlyAdded={newlyAddedCampaignIds?.has(campaign.id)}
                                          showHidden={showHidden}
                                          isSelectedForBulkDelete={selectedForBulkDelete.has(`campaign_${campaign.id}`)}
                                          onCampaignClick={handleCampaignClick}
                                          onToggleBulkDelete={toggleBulkDeleteSelection}
                                          onRestoreCampaign={handleRestoreCampaign}
                                          onHideCampaign={handleHideCampaign}
                                        />
                                      ))
                                    ) : (
                                      <Box sx={{ pl: 4, py: 1 }}>
                                        <Typography variant="caption" color="text.secondary">
                                          {showHidden ? '숨긴 캠페인 없음' : '캠페인 없음'}
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
          )}

          {/* 페이지네이션 */}
          {!loading && totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1, borderTop: '1px solid #e0e0e0' }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={(e, page) => setCurrentPage(page)}
                color="primary"
                size="small"
                siblingCount={0}
              />
            </Box>
          )}
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
  );
}

export default React.memo(OperatorSidebar);
