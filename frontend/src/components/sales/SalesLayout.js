import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, Button, IconButton, Avatar, Paper,
  List, ListItemButton, ListItemIcon, ListItemText, CircularProgress, Collapse, Chip, Tooltip
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DateRangeIcon from '@mui/icons-material/DateRange';
import FolderIcon from '@mui/icons-material/Folder';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteIcon from '@mui/icons-material/Delete';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { useAuth } from '../../context/AuthContext';
import ProfileEditDialog from '../common/ProfileEditDialog';
import SalesBrandCreateDialog from './SalesBrandCreateDialog';
import SalesMonthlyBrandDialog from './SalesMonthlyBrandDialog';
import SalesAddItemDialog from './SalesAddItemDialog';
import SalesAddCampaignDialog from './SalesAddCampaignDialog';
import SalesItemSheet from './SalesItemSheet';
import UnifiedItemSheet from '../common/UnifiedItemSheet';
import { monthlyBrandService, itemService, campaignService } from '../../services';

const DRAWER_WIDTH = 280;

// 통합 시트 사용 여부 (true: UnifiedItemSheet 사용, false: 기존 SalesItemSheet 사용)
const USE_UNIFIED_SHEET = false;

function SalesLayout({ isAdminMode = false, viewAsUserId = null, isEmbedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [monthlyBrandDialogOpen, setMonthlyBrandDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [selectedMonthlyBrandForCampaign, setSelectedMonthlyBrandForCampaign] = useState(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState(null);

  // 연월브랜드 데이터
  const [monthlyBrands, setMonthlyBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  // 확장된 연월브랜드 상태
  const [expandedMonthlyBrands, setExpandedMonthlyBrands] = useState({});

  // 선택된 캠페인 (오른쪽에 시트 표시)
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // 숨김 항목 표시 모드
  const [showHidden, setShowHidden] = useState(false);

  // 사이드바 접기/펼치기 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 연월브랜드 데이터 로드
  const loadMonthlyBrands = useCallback(async (selectedCampaignId = null) => {
    try {
      setLoading(true);
      // viewAsUserId가 있으면 해당 사용자의 데이터 조회 (Admin용)
      const response = await monthlyBrandService.getMonthlyBrands(viewAsUserId);
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

      // 선택된 캠페인 업데이트 (품목 추가/수정/삭제 후)
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

  useEffect(() => {
    loadMonthlyBrands();
  }, [loadMonthlyBrands]);

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

  // 품목 클릭 - 품목 상세로 이동
  const handleItemClick = (campaignId, itemId) => {
    navigate(`/sales/campaign/${campaignId}/item/${itemId}`);
  };

  // 품목 추가
  const handleAddItem = () => {
    setSelectedItemForEdit(null);
    setItemDialogOpen(true);
  };

  // 품목 수정
  const handleEditItem = (item, e) => {
    e.stopPropagation();
    setSelectedItemForEdit(item);
    setItemDialogOpen(true);
  };

  // 품목 삭제
  const handleDeleteItem = async (item, e) => {
    e.stopPropagation();
    if (window.confirm(`"${item.product_name}" 품목을 삭제하시겠습니까?`)) {
      try {
        await itemService.deleteItem(item.id);
        // 선택된 캠페인의 items 즉시 업데이트
        if (selectedCampaign) {
          setSelectedCampaign(prev => ({
            ...prev,
            items: prev.items.filter(i => i.id !== item.id)
          }));
        }
        loadMonthlyBrands(selectedCampaign?.id);
      } catch (err) {
        console.error('Failed to delete item:', err);
        alert('품목 삭제에 실패했습니다.');
      }
    }
  };

  // 품목 저장 (추가/수정)
  const handleSaveItem = async (itemData) => {
    try {
      if (selectedItemForEdit) {
        await itemService.updateItem(selectedItemForEdit.id, itemData);
      } else {
        await itemService.createItem(selectedCampaign.id, itemData);
      }
      setItemDialogOpen(false);
      setSelectedItemForEdit(null);
      loadMonthlyBrands(selectedCampaign?.id);
    } catch (err) {
      console.error('Failed to save item:', err);
      alert('품목 저장에 실패했습니다.');
    }
  };

  // 품목 일괄 저장 (여러 품목 동시 추가)
  const handleSaveBulkItems = async (itemsData) => {
    try {
      await itemService.createItemsBulk(selectedCampaign.id, itemsData);
      setItemDialogOpen(false);
      setSelectedItemForEdit(null);
      loadMonthlyBrands(selectedCampaign?.id);
    } catch (err) {
      console.error('Failed to save items:', err);
      alert('품목 일괄 저장에 실패했습니다.');
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

  // 브랜드 추가 성공 시 목록 새로고침
  const handleBrandSuccess = () => {
    setBrandDialogOpen(false);
  };

  // 연월브랜드 추가 성공 시 목록 새로고침
  const handleMonthlyBrandSuccess = () => {
    setMonthlyBrandDialogOpen(false);
    loadMonthlyBrands();
  };

  // 캠페인 추가 버튼 클릭 (연월브랜드 ID 전달)
  const handleAddCampaign = (monthlyBrandId, e) => {
    e.stopPropagation();
    setSelectedMonthlyBrandForCampaign(monthlyBrandId);
    setCampaignDialogOpen(true);
  };

  // 캠페인 저장
  const handleSaveCampaign = async (campaignData) => {
    try {
      await campaignService.createCampaign(campaignData);
      setCampaignDialogOpen(false);
      setSelectedMonthlyBrandForCampaign(null);
      loadMonthlyBrands();
    } catch (err) {
      console.error('Failed to create campaign:', err);
      alert('캠페인 생성에 실패했습니다.');
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

  // 캠페인 숨기기
  const handleHideCampaign = async (campaign, e) => {
    e.stopPropagation();
    if (window.confirm(`"${campaign.name}" 캠페인을 숨기시겠습니까?`)) {
      try {
        await campaignService.hideCampaign(campaign.id);
        if (selectedCampaign?.id === campaign.id) {
          setSelectedCampaign(null);
        }
        loadMonthlyBrands();
      } catch (err) {
        console.error('Failed to hide campaign:', err);
        alert('숨기기에 실패했습니다.');
      }
    }
  };

  // 캠페인 복구
  const handleRestoreCampaign = async (campaign, e) => {
    e.stopPropagation();
    try {
      await campaignService.restoreCampaign(campaign.id);
      loadMonthlyBrands();
    } catch (err) {
      console.error('Failed to restore campaign:', err);
      alert('복구에 실패했습니다.');
    }
  };

  // 연월브랜드 삭제
  const handleDeleteMonthlyBrand = async (monthlyBrand, e) => {
    e.stopPropagation();
    const campaignCount = monthlyBrand.campaigns?.length || 0;
    const confirmMsg = campaignCount > 0
      ? `"${monthlyBrand.name}" 연월브랜드에 ${campaignCount}개의 캠페인이 있습니다.\n정말 삭제하시겠습니까? (캠페인은 삭제되지 않습니다)`
      : `"${monthlyBrand.name}" 연월브랜드를 삭제하시겠습니까?`;

    if (window.confirm(confirmMsg)) {
      try {
        await monthlyBrandService.deleteMonthlyBrand(monthlyBrand.id);
        loadMonthlyBrands();
      } catch (err) {
        console.error('Failed to delete monthly brand:', err);
        alert('삭제에 실패했습니다.');
      }
    }
  };

  // 캠페인 삭제
  const handleDeleteCampaign = async (campaign, e) => {
    e.stopPropagation();
    const itemCount = campaign.items?.length || 0;
    const confirmMsg = itemCount > 0
      ? `"${campaign.name}" 캠페인에 ${itemCount}개의 품목이 있습니다.\n정말 삭제하시겠습니까? (모든 품목과 구매자 데이터가 삭제됩니다)`
      : `"${campaign.name}" 캠페인을 삭제하시겠습니까?`;

    if (window.confirm(confirmMsg)) {
      try {
        await campaignService.deleteCampaign(campaign.id);
        if (selectedCampaign?.id === campaign.id) {
          setSelectedCampaign(null);
        }
        loadMonthlyBrands();
      } catch (err) {
        console.error('Failed to delete campaign:', err);
        alert('삭제에 실패했습니다.');
      }
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

  // Outlet을 사용할지 시트를 표시할지 결정
  const basePathOnly = isAdminMode ? '/admin/view-sales' : '/sales';
  // Admin 모드에서 userId 쿼리 파라미터 유지
  const basePath = isAdminMode && viewAsUserId ? `${basePathOnly}?userId=${viewAsUserId}` : basePathOnly;
  const isDefaultRoute = isEmbedded ? true : (location.pathname === basePathOnly || location.pathname === `${basePathOnly}/`);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>

      {/* 헤더 - isEmbedded일 때는 relative 포지션 */}
      <AppBar position={isEmbedded ? "relative" : "fixed"} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: isAdminMode ? '#2c387e' : '#1976d2', flexShrink: 0 }}>
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
            {isAdminMode ? '영업사 보기 (Admin)' : 'Campaign Manager'}
          </Typography>

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* 브랜드 추가 버튼 */}
          <Button
            color="inherit"
            variant="outlined"
            startIcon={<PersonAddIcon />}
            onClick={() => setBrandDialogOpen(true)}
            sx={{ mr: 1, borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            브랜드 추가
          </Button>

          {/* 연월브랜드 추가 버튼 */}
          <Button
            color="inherit"
            variant="outlined"
            startIcon={<AddCircleIcon />}
            onClick={() => setMonthlyBrandDialogOpen(true)}
            sx={{ mr: 1, borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            연월브랜드 추가
          </Button>

          {/* 마진 현황 버튼 */}
          <Button
            color="inherit"
            startIcon={<TrendingUpIcon />}
            onClick={() => {
              setSelectedCampaign(null);
              navigate(`${basePath}/margin`);
            }}
            sx={{ mr: 2 }}
          >
            마진 현황
          </Button>

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
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'orange' }}>
              {user?.username?.charAt(0)?.toUpperCase() || 'S'}
            </Avatar>
            <Typography variant="subtitle2">{user?.name || '영업사'}</Typography>
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
            <Box sx={{ p: 1.5, bgcolor: showHidden ? '#fff3e0' : '#e3f2fd', borderBottom: '1px solid #e0e0e0' }}>
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
              const filteredMonthlyBrands = monthlyBrands.filter(mb => {
                if (showHidden) {
                  return mb.is_hidden || (mb.campaigns && mb.campaigns.some(c => c.is_hidden));
                }
                return !mb.is_hidden;
              });

              if (filteredMonthlyBrands.length === 0) {
                return (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {showHidden ? '숨긴 항목이 없습니다' : '등록된 연월브랜드가 없습니다'}
                    </Typography>
                    {!showHidden && (
                      <Button variant="outlined" size="small" startIcon={<AddCircleIcon />} onClick={() => setMonthlyBrandDialogOpen(true)}>
                        연월브랜드 추가
                      </Button>
                    )}
                  </Box>
                );
              }

              return (
                <List component="nav" disablePadding dense>
                  {filteredMonthlyBrands.map((monthlyBrand) => {
                    const filteredCampaigns = (monthlyBrand.campaigns || []).filter(c => showHidden ? c.is_hidden : !c.is_hidden);
                    if (!showHidden && monthlyBrand.is_hidden) return null;

                    return (
                      <React.Fragment key={monthlyBrand.id}>
                        <ListItemButton
                          onClick={() => handleMonthlyBrandToggle(monthlyBrand.id)}
                          sx={{
                            bgcolor: monthlyBrand.is_hidden ? '#fff3e0' : expandedMonthlyBrands[monthlyBrand.id] ? '#e3f2fd' : 'inherit',
                            borderBottom: '1px solid #f0f0f0',
                            py: 0.5
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <DateRangeIcon fontSize="small" color={monthlyBrand.is_hidden ? 'warning' : 'primary'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="body2" fontWeight="bold" noWrap sx={{ flex: 1, fontSize: '0.85rem', color: monthlyBrand.is_hidden ? 'text.secondary' : 'inherit' }}>
                                  {monthlyBrand.name}
                                </Typography>
                                {showHidden && monthlyBrand.is_hidden ? (
                                  <>
                                    <Tooltip title="복구">
                                      <IconButton size="small" color="success" onClick={(e) => handleRestoreMonthlyBrand(monthlyBrand, e)} sx={{ p: 0.3 }}>
                                        <RestoreIcon sx={{ fontSize: 18 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="삭제">
                                      <IconButton size="small" color="error" onClick={(e) => handleDeleteMonthlyBrand(monthlyBrand, e)} sx={{ p: 0.3 }}>
                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                ) : !showHidden ? (
                                  <>
                                    <Tooltip title="캠페인 추가">
                                      <IconButton size="small" color="success" onClick={(e) => handleAddCampaign(monthlyBrand.id, e)} sx={{ p: 0.3 }}>
                                        <PlaylistAddIcon sx={{ fontSize: 18 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="숨기기">
                                      <IconButton size="small" color="default" onClick={(e) => handleHideMonthlyBrand(monthlyBrand, e)} sx={{ p: 0.3 }}>
                                        <VisibilityOffIcon sx={{ fontSize: 16, color: '#bbb' }} />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                ) : null}
                                <Chip label={filteredCampaigns.length} size="small" sx={{ height: 18, minWidth: 20, fontSize: '0.65rem' }} />
                              </Box>
                            }
                          />
                          {expandedMonthlyBrands[monthlyBrand.id] ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                        </ListItemButton>

                        <Collapse in={expandedMonthlyBrands[monthlyBrand.id]} timeout="auto" unmountOnExit>
                          <List component="div" disablePadding dense>
                            {filteredCampaigns.length > 0 ? (
                              filteredCampaigns.map((campaign) => {
                                const isSelected = selectedCampaign?.id === campaign.id;
                                return (
                                  <ListItemButton
                                    key={campaign.id}
                                    onClick={() => handleCampaignClick(campaign)}
                                    sx={{
                                      pl: 4, py: 0.3,
                                      bgcolor: campaign.is_hidden ? '#fff8e1' : isSelected ? '#bbdefb' : 'inherit',
                                      borderLeft: isSelected ? '3px solid #1976d2' : '3px solid transparent',
                                      '&:hover': { bgcolor: campaign.is_hidden ? '#fff8e1' : isSelected ? '#bbdefb' : '#f5f5f5' }
                                    }}
                                  >
                                    <ListItemIcon sx={{ minWidth: 24 }}>
                                      <FolderIcon sx={{ fontSize: 16 }} color={campaign.is_hidden ? 'warning' : isSelected ? 'primary' : 'action'} />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <Typography variant="body2" fontWeight={isSelected ? 'bold' : 'normal'} noWrap sx={{ fontSize: '0.8rem', flex: 1, color: campaign.is_hidden ? 'text.secondary' : 'inherit' }}>
                                            {campaign.name}
                                          </Typography>
                                          {showHidden && campaign.is_hidden ? (
                                            <>
                                              <Tooltip title="복구">
                                                <IconButton size="small" color="success" onClick={(e) => handleRestoreCampaign(campaign, e)} sx={{ p: 0.2 }}>
                                                  <RestoreIcon sx={{ fontSize: 14 }} />
                                                </IconButton>
                                              </Tooltip>
                                              <Tooltip title="삭제">
                                                <IconButton size="small" color="error" onClick={(e) => handleDeleteCampaign(campaign, e)} sx={{ p: 0.2 }}>
                                                  <DeleteIcon sx={{ fontSize: 14 }} />
                                                </IconButton>
                                              </Tooltip>
                                            </>
                                          ) : !showHidden ? (
                                            <Tooltip title="숨기기">
                                              <IconButton size="small" color="default" onClick={(e) => handleHideCampaign(campaign, e)} sx={{ p: 0.2 }}>
                                                <VisibilityOffIcon sx={{ fontSize: 14, color: '#ccc' }} />
                                              </IconButton>
                                            </Tooltip>
                                          ) : null}
                                          <Chip label={campaign.items?.length || 0} size="small" sx={{ height: 14, fontSize: '0.6rem', minWidth: 16 }} />
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
            bgcolor: '#1976d2',
            color: 'white',
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: '#1565c0' }
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
                <Chip
                  label={getStatusLabel(selectedCampaign.status)}
                  size="small"
                  color={getStatusColor(selectedCampaign.status)}
                  sx={{ height: 22 }}
                />
                <Typography variant="body2" color="text.secondary">
                  품목 {selectedCampaign.items?.length || 0}개
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<AddCircleIcon />}
                onClick={handleAddItem}
              >
                품목 추가
              </Button>
            </Box>

            {/* 품목 시트 (DB 슬롯 기반 엑셀 형식) */}
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              {USE_UNIFIED_SHEET ? (
                <UnifiedItemSheet
                  campaignId={selectedCampaign.id}
                  items={selectedCampaign.items || []}
                  onRefresh={() => loadMonthlyBrands(selectedCampaign?.id)}
                  userRole="sales"
                  viewAsUserId={viewAsUserId}
                />
              ) : (
                <SalesItemSheet
                  campaignId={selectedCampaign.id}
                  items={selectedCampaign.items || []}
                  onDeleteItem={handleDeleteItem}
                  onRefresh={() => loadMonthlyBrands(selectedCampaign?.id)}
                  getStatusColor={getStatusColor}
                  getStatusLabel={getStatusLabel}
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
              연월브랜드를 펼쳐 캠페인을 클릭하면 품목 시트가 표시됩니다
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

      {/* 브랜드 추가 다이얼로그 */}
      <SalesBrandCreateDialog
        open={brandDialogOpen}
        onClose={() => setBrandDialogOpen(false)}
        onSuccess={handleBrandSuccess}
        viewAsUserId={viewAsUserId}
      />

      {/* 연월브랜드 추가 다이얼로그 */}
      <SalesMonthlyBrandDialog
        open={monthlyBrandDialogOpen}
        onClose={() => setMonthlyBrandDialogOpen(false)}
        onSuccess={handleMonthlyBrandSuccess}
        viewAsUserId={viewAsUserId}
      />

      {/* 캠페인 추가 다이얼로그 */}
      <SalesAddCampaignDialog
        open={campaignDialogOpen}
        onClose={() => {
          setCampaignDialogOpen(false);
          setSelectedMonthlyBrandForCampaign(null);
        }}
        onSave={handleSaveCampaign}
        mode="create"
        preSelectedMonthlyBrandId={selectedMonthlyBrandForCampaign}
      />

      {/* 품목 추가/수정 다이얼로그 */}
      {selectedCampaign && (
        <SalesAddItemDialog
          open={itemDialogOpen}
          onClose={() => setItemDialogOpen(false)}
          onSave={handleSaveItem}
          onSaveBulk={handleSaveBulkItems}
          mode={selectedItemForEdit ? 'edit' : 'create'}
          initialData={selectedItemForEdit}
        />
      )}
    </Box>
  );
}

export default SalesLayout;
