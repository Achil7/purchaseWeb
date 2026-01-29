import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Alert, Button, IconButton, Tooltip, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Chip, TableContainer, Divider
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockResetIcon from '@mui/icons-material/LockReset';
import CircleIcon from '@mui/icons-material/Circle';
import SearchIcon from '@mui/icons-material/Search';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import InfoIcon from '@mui/icons-material/Info';
import SaveIcon from '@mui/icons-material/Save';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CampaignIcon from '@mui/icons-material/Campaign';
import FolderIcon from '@mui/icons-material/Folder';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import {
  getControlTowerUsers,
  resetPassword,
  getUsers,
  deleteUser,
  deactivateUser,
  activateUser,
  getBrandSales,
  addBrandSales,
  removeBrandSales,
  updateUser
} from '../../services/userService';
import { campaignService } from '../../services';
import monthlyBrandService from '../../services/monthlyBrandService';
import UserDashboardViewer from './UserDashboardViewer';
import SalesMonthlyBrandDialog from '../sales/SalesMonthlyBrandDialog';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import EditIcon from '@mui/icons-material/Edit';

function AdminControlTower() {
  const navigate = useNavigate();

  // 탭 상태 (0: 진행자 배정, 1: 진행자, 2: 영업사, 3: 브랜드사)
  const [tabValue, setTabValue] = useState(0);
  const roleLabels = { operator: '진행자', sales: '영업사', brand: '브랜드사' };

  // === 진행자 배정 탭 상태 ===
  const [monthlyBrands, setMonthlyBrands] = useState([]);
  const EXPANDED_MB_KEY = 'admin_expanded_monthly_brands';
  const [expandedMonthlyBrands, setExpandedMonthlyBrands] = useState(() => {
    try {
      const saved = localStorage.getItem(EXPANDED_MB_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  // === 사용자 관리 탭 상태 ===
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [userToReset, setUserToReset] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [userDetail, setUserDetail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 연월브랜드 펼치기/접기 토글
  const toggleMonthlyBrand = (monthlyBrandId) => {
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
  const expandAllMonthlyBrands = useCallback(() => {
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
  }, [monthlyBrands]);

  // 모든 연월브랜드 접기
  const collapseAllMonthlyBrands = useCallback(() => {
    setExpandedMonthlyBrands({});
    try {
      localStorage.setItem(EXPANDED_MB_KEY, JSON.stringify({}));
    } catch (e) {
      console.error('Failed to save expanded state:', e);
    }
  }, []);

  // 영업사 변경 다이얼로그 상태
  const [salesChangeDialogOpen, setSalesChangeDialogOpen] = useState(false);
  const [selectedCampaignForSalesChange, setSelectedCampaignForSalesChange] = useState(null);
  const [salesUsers, setSalesUsers] = useState([]);
  const [newSalesId, setNewSalesId] = useState('');
  const [salesChangeSaving, setSalesChangeSaving] = useState(false);

  // 삭제 다이얼로그 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'campaign' | 'monthlyBrand', data: {...} }
  const [deleting, setDeleting] = useState(false);

  // 브랜드-영업사 매핑 상태 (브랜드사 탭 전용)
  const [brandSalesList, setBrandSalesList] = useState([]);
  const [brandSalesLoading, setBrandSalesLoading] = useState(false);
  const [allSalesUsers, setAllSalesUsers] = useState([]);
  const [selectedSalesToAdd, setSelectedSalesToAdd] = useState('');
  const [addingSales, setAddingSales] = useState(false);

  // 사용자 삭제 다이얼로그 상태
  const [userDeleteDialogOpen, setUserDeleteDialogOpen] = useState(false);
  const [userDeleteData, setUserDeleteData] = useState(null); // { user, relatedData }
  const [userDeleteLoading, setUserDeleteLoading] = useState(false);
  const [delegateUserId, setDelegateUserId] = useState('');
  const [delegateUsers, setDelegateUsers] = useState([]);

  // 사용자 수정 상태
  const [editingUser, setEditingUser] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editName, setEditName] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  // 연월브랜드 수정 다이얼로그 상태
  const [monthlyBrandDialogOpen, setMonthlyBrandDialogOpen] = useState(false);
  const [selectedMonthlyBrandForEdit, setSelectedMonthlyBrandForEdit] = useState(null);

  // 영업사 변경 다이얼로그 열기
  const handleOpenSalesChangeDialog = async (campaign) => {
    setSelectedCampaignForSalesChange(campaign);
    setNewSalesId('');
    setSalesChangeDialogOpen(true);

    // 영업사 목록 로드
    try {
      const response = await getUsers('sales');
      setSalesUsers(response.data || []);
    } catch (err) {
      console.error('Failed to load sales users:', err);
    }
  };

  // 영업사 변경 다이얼로그 닫기
  const handleCloseSalesChangeDialog = () => {
    setSalesChangeDialogOpen(false);
    setSelectedCampaignForSalesChange(null);
    setNewSalesId('');
  };

  // 연월브랜드 수정 다이얼로그 열기
  const handleEditMonthlyBrand = (monthlyBrand, e) => {
    if (e) e.stopPropagation();
    setSelectedMonthlyBrandForEdit(monthlyBrand);
    setMonthlyBrandDialogOpen(true);
  };

  // 연월브랜드 수정 성공 시 목록 새로고침
  const handleMonthlyBrandEditSuccess = () => {
    setMonthlyBrandDialogOpen(false);
    setSelectedMonthlyBrandForEdit(null);
    loadAssignmentData();
  };

  // 영업사 변경 저장
  const handleSaveSalesChange = async () => {
    if (!newSalesId || !selectedCampaignForSalesChange) {
      alert('새 영업사를 선택해주세요.');
      return;
    }

    const newSales = salesUsers.find(s => s.id === newSalesId);
    const confirmed = window.confirm(
      `⚠️ 영업사 변경 확인\n\n` +
      `캠페인: ${selectedCampaignForSalesChange.name}\n` +
      `현재 영업사: ${selectedCampaignForSalesChange.creator?.name || '-'}\n` +
      `새 영업사: ${newSales?.name || '-'}\n\n` +
      `영업사를 변경하면 해당 캠페인의 담당자가 변경됩니다.\n` +
      `계속하시겠습니까?`
    );

    if (!confirmed) return;

    try {
      setSalesChangeSaving(true);
      await campaignService.changeSales(selectedCampaignForSalesChange.id, newSalesId);
      alert('영업사가 변경되었습니다.');
      handleCloseSalesChangeDialog();
      await loadAssignmentData();
    } catch (err) {
      console.error('Failed to change sales:', err);
      alert('영업사 변경에 실패했습니다.');
    } finally {
      setSalesChangeSaving(false);
    }
  };

  // 삭제 다이얼로그 열기
  const handleOpenDeleteDialog = (type, data) => {
    setDeleteTarget({ type, data });
    setDeleteDialogOpen(true);
  };

  // 삭제 다이얼로그 닫기
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  // 삭제 실행
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);

      if (deleteTarget.type === 'campaign') {
        await campaignService.deleteCampaignCascade(deleteTarget.data.id);
        alert(`캠페인 "${deleteTarget.data.name}"이(가) 삭제되었습니다.`);
      } else if (deleteTarget.type === 'monthlyBrand') {
        await monthlyBrandService.deleteMonthlyBrandCascade(deleteTarget.data.id);
        alert(`연월브랜드 "${deleteTarget.data.name}"이(가) 삭제되었습니다.`);
      }

      handleCloseDeleteDialog();
      await loadAssignmentData();
    } catch (err) {
      console.error('Failed to delete:', err);
      alert(err.response?.data?.message || '삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };


  // 진행자 배정용 연월브랜드 데이터 로드
  const loadAssignmentData = useCallback(async () => {
    try {
      setAssignmentLoading(true);
      setError(null);

      const response = await monthlyBrandService.getAllMonthlyBrands();
      const data = response.data || [];

      // 캠페인 이름으로 Natural Sort (숫자를 올바르게 정렬: 1, 2, 3, ... 10, 11, 12)
      const naturalSort = (a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';

        // 숫자와 문자를 분리하여 비교
        const regex = /(\d+)|(\D+)/g;
        const partsA = nameA.match(regex) || [];
        const partsB = nameB.match(regex) || [];

        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
          const partA = partsA[i] || '';
          const partB = partsB[i] || '';

          const numA = parseInt(partA, 10);
          const numB = parseInt(partB, 10);

          // 둘 다 숫자면 숫자로 비교
          if (!isNaN(numA) && !isNaN(numB)) {
            if (numA !== numB) return numA - numB;
          } else {
            // 문자열 비교
            const cmp = partA.localeCompare(partB, 'ko');
            if (cmp !== 0) return cmp;
          }
        }
        return 0;
      };

      // 각 연월브랜드의 캠페인들을 먼저 정렬
      data.forEach(mb => {
        if (mb.campaigns) {
          mb.campaigns.sort((a, b) => {
            // 미배정(incomplete)을 먼저 표시
            const aComplete = a.isFullyAssigned || a.assignmentStatus === 'no_items';
            const bComplete = b.isFullyAssigned || b.assignmentStatus === 'no_items';

            if (aComplete !== bComplete) {
              return aComplete ? 1 : -1; // 미배정이 먼저
            }

            // 같은 배정 상태 내에서는 이름순
            return naturalSort(a, b);
          });
        }
      });

      // 연월브랜드 자체를 정렬: 미완료 연월브랜드가 위로
      data.sort((mbA, mbB) => {
        // 숨겨진 캠페인 제외한 리스트로 완료 여부 계산
        const campaignsA = (mbA.campaigns || []).filter(c => !c.is_hidden);
        const campaignsB = (mbB.campaigns || []).filter(c => !c.is_hidden);

        // 연월브랜드의 모든 캠페인이 배정 완료되었는지 확인
        const isAComplete = campaignsA.length === 0 || campaignsA.every(c =>
          c.isFullyAssigned || c.assignmentStatus === 'no_items' || (c.items?.length || 0) === 0
        );
        const isBComplete = campaignsB.length === 0 || campaignsB.every(c =>
          c.isFullyAssigned || c.assignmentStatus === 'no_items' || (c.items?.length || 0) === 0
        );

        // 미완료가 먼저
        if (isAComplete !== isBComplete) {
          return isAComplete ? 1 : -1;
        }

        // 같은 상태 내에서는 영업사 이름 → 연월브랜드 이름순
        const salesNameA = mbA.creator?.name || '';
        const salesNameB = mbB.creator?.name || '';
        const salesCmp = salesNameA.localeCompare(salesNameB, 'ko');
        if (salesCmp !== 0) return salesCmp;

        return naturalSort(mbA, mbB);
      });

      setMonthlyBrands(data);
      // 모든 연월브랜드는 기본적으로 접힌 상태로 시작
    } catch (err) {
      console.error('Failed to load assignment data:', err);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setAssignmentLoading(false);
    }
  }, []);

  // 사용자 목록 로드
  const loadUsers = useCallback(async () => {
    const roleMap = ['', 'operator', 'sales', 'brand'];
    const role = roleMap[tabValue];
    if (!role) return;

    try {
      setLoading(true);
      setError(null);
      const response = await getControlTowerUsers(role);
      if (response.success) {
        setUsers(response.data || []);
      } else {
        setError(response.message || '사용자 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [tabValue]);

  useEffect(() => {
    if (tabValue === 0) {
      loadAssignmentData();
    } else {
      loadUsers();
      setSelectedUser(null);
    }
  }, [tabValue, loadAssignmentData, loadUsers]);

  // === 사용자 관리 핸들러 ===
  const handleUserSelect = async (user) => {
    setSelectedUser(user);

    // 브랜드사 탭에서 브랜드 선택 시 담당 영업사 목록 로드
    if (tabValue === 3 && user) {
      await loadBrandSales(user.id);
    }
  };

  // 브랜드의 담당 영업사 목록 로드
  const loadBrandSales = async (brandId) => {
    try {
      setBrandSalesLoading(true);
      const response = await getBrandSales(brandId);
      setBrandSalesList(response.data || []);

      // 영업사 목록도 함께 로드 (영업사 추가용)
      const salesResponse = await getUsers('sales');
      setAllSalesUsers(salesResponse.data || []);
    } catch (err) {
      console.error('Failed to load brand sales:', err);
      setBrandSalesList([]);
    } finally {
      setBrandSalesLoading(false);
    }
  };

  // 브랜드에 영업사 추가
  const handleAddSalesToBrand = async () => {
    if (!selectedUser || !selectedSalesToAdd) return;

    try {
      setAddingSales(true);
      await addBrandSales(selectedUser.id, selectedSalesToAdd);
      await loadBrandSales(selectedUser.id);
      setSelectedSalesToAdd('');
    } catch (err) {
      console.error('Failed to add sales to brand:', err);
      alert(err.response?.data?.message || '영업사 추가에 실패했습니다.');
    } finally {
      setAddingSales(false);
    }
  };

  // 브랜드에서 영업사 제거
  const handleRemoveSalesFromBrand = async (salesId) => {
    if (!selectedUser) return;

    const confirmed = window.confirm('이 영업사를 브랜드 담당에서 제거하시겠습니까?');
    if (!confirmed) return;

    try {
      await removeBrandSales(selectedUser.id, salesId);
      await loadBrandSales(selectedUser.id);
    } catch (err) {
      console.error('Failed to remove sales from brand:', err);
      alert(err.response?.data?.message || '영업사 제거에 실패했습니다.');
    }
  };

  const togglePassword = (userId) => {
    setShowPasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleOpenDetailDialog = (user, e) => {
    e.stopPropagation();
    setUserDetail(user);
    setDetailDialogOpen(true);
  };

  const copyPassword = (password) => {
    navigator.clipboard.writeText(password);
  };

  const handleResetPasswordClick = (user) => {
    setUserToReset(user);
    setResetResult(null);
    setResetDialogOpen(true);
  };

  const handleResetPasswordConfirm = async () => {
    try {
      const response = await resetPassword(userToReset.id);
      if (response.success) {
        setResetResult({
          success: true,
          newPassword: response.data.new_password
        });
        loadUsers();
      } else {
        setResetResult({
          success: false,
          message: response.message || '비밀번호 초기화에 실패했습니다.'
        });
      }
    } catch (err) {
      console.error('Failed to reset password:', err);
      setResetResult({
        success: false,
        message: '비밀번호 초기화 중 오류가 발생했습니다.'
      });
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 진행자 배정 탭 렌더링 - 연월브랜드 > 캠페인 목록
  const renderAssignmentTab = () => {
    // 숨겨지지 않은 연월브랜드만 표시
    const filteredMonthlyBrands = monthlyBrands.filter(mb => !mb.is_hidden);

    return (
      <Box>
        {/* 타이틀 영역 */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
              연월브랜드 및 캠페인 관리
            </Typography>
            <Typography variant="body2" color="text.secondary">
              연월브랜드를 선택하고 캠페인을 클릭하여 진행자를 배정하세요.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={expandAllMonthlyBrands}
              sx={{ fontSize: '0.75rem', py: 0.5, px: 1.5 }}
            >
              모두 펼치기
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={collapseAllMonthlyBrands}
              sx={{ fontSize: '0.75rem', py: 0.5, px: 1.5 }}
            >
              모두 접기
            </Button>
          </Box>
        </Box>

        {assignmentLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'scroll' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa', width: '50px' }}></TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>영업사</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>연월브랜드</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd' }}>캠페인</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0', width: '100px' }}>날짜</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa', width: '80px' }}>제품 수</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa', width: '150px' }}>진행자 배정</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#ffebee', width: '60px' }}>삭제</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredMonthlyBrands.length > 0 ? (
                    filteredMonthlyBrands.map((mb) => {
                      const isExpanded = expandedMonthlyBrands[mb.id] || false;
                      const campaigns = mb.campaigns || [];

                      // 숨겨지지 않은 캠페인만 표시
                      const filteredCampaigns = campaigns.filter(c => !c.is_hidden);
                      const displayCampaignCount = filteredCampaigns.length;

                      // 연월브랜드 전체 배정 완료 여부 계산
                      const isMbFullyAssigned = displayCampaignCount === 0 || filteredCampaigns.every(c =>
                        c.isFullyAssigned || c.assignmentStatus === 'no_items' || (c.items?.length || 0) === 0
                      );
                      // 품목이 있는 캠페인이 하나라도 있는지 (배정 상태 표시 여부)
                      const hasAnyItemsInMb = filteredCampaigns.some(c => (c.items?.length || 0) > 0);

                      return (
                        <React.Fragment key={mb.id}>
                          {/* 연월브랜드 행 */}
                          <TableRow
                            hover
                            sx={{
                              bgcolor: '#f5f5f5',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: '#e8e8e8' }
                            }}
                            onClick={() => toggleMonthlyBrand(mb.id)}
                          >
                            <TableCell sx={{ textAlign: 'center' }}>
                              <IconButton size="small">
                                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">
                                {mb.creator?.name || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <FolderIcon color="primary" fontSize="small" />
                                <Typography variant="body2" fontWeight="bold">
                                  {mb.name}
                                </Typography>
                                {mb.brand?.name && (
                                  <Chip
                                    label={mb.brand.name}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  {displayCampaignCount}개 캠페인
                                </Typography>
                                {/* 배정 상태 칩 - 품목이 있는 캠페인이 있을 때만 표시 */}
                                {hasAnyItemsInMb && (
                                  isMbFullyAssigned ? (
                                    <Chip
                                      icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                                      label="배정완료"
                                      size="small"
                                      color="success"
                                      variant="outlined"
                                      sx={{ fontSize: '0.65rem', height: 18, '& .MuiChip-icon': { ml: 0.3 } }}
                                    />
                                  ) : (
                                    <Chip
                                      label="배정 미완료"
                                      size="small"
                                      color="error"
                                      variant="filled"
                                      sx={{ fontSize: '0.65rem', height: 18, fontWeight: 'bold' }}
                                    />
                                  )
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" color="text.secondary">-</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" color="text.secondary">-</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" color="text.secondary">-</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                <Tooltip title="연월브랜드 수정">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={(e) => handleEditMonthlyBrand(mb, e)}
                                    sx={{ p: 0.3 }}
                                  >
                                    <EditIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="연월브랜드 삭제 (모든 캠페인/품목/구매자 포함)">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDeleteDialog('monthlyBrand', mb);
                                    }}
                                    sx={{ p: 0.3 }}
                                  >
                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>

                          {/* 캠페인 행들 (펼쳐졌을 때만 표시) */}
                          {isExpanded && filteredCampaigns.map((campaign) => {
                            const itemCount = campaign.items?.length || 0;
                            const isFullyAssigned = campaign.isFullyAssigned || campaign.assignmentStatus === 'no_items';
                            const isIncomplete = !isFullyAssigned && itemCount > 0;

                            return (
                              <TableRow
                                hover
                                key={campaign.id}
                                sx={{
                                  bgcolor: isIncomplete ? '#fff3f3' : '#fafafa',
                                  '&:hover': { bgcolor: isIncomplete ? '#ffe0e0' : '#f0f0f0' },
                                  borderLeft: isIncomplete ? '3px solid #f44336' : 'none'
                                }}
                              >
                                <TableCell />
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                      {campaign.creator?.name || mb.creator?.name || '-'}
                                    </Typography>
                                    <Tooltip title="영업사 변경">
                                      <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenSalesChangeDialog(campaign);
                                        }}
                                        sx={{ p: 0.3 }}
                                      >
                                        <SwapHorizIcon sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                                    └
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CampaignIcon color={isIncomplete ? 'error' : 'action'} fontSize="small" />
                                    <Typography
                                      variant="body2"
                                      fontWeight="medium"
                                      sx={{ color: isIncomplete ? 'error.main' : 'inherit' }}
                                    >
                                      {campaign.name}
                                    </Typography>
                                    {/* 배정완료 칩 */}
                                    {isFullyAssigned && itemCount > 0 && (
                                      <Chip
                                        icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                                        label="배정완료"
                                        size="small"
                                        color="success"
                                        sx={{ fontSize: '0.65rem', height: 20 }}
                                      />
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell align="center">
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#e65100' }}>
                                    {campaign.registered_at
                                      ? new Date(campaign.registered_at).toLocaleDateString('ko-KR', {
                                          month: '2-digit',
                                          day: '2-digit'
                                        })
                                      : '-'}
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    label={`${itemCount}개`}
                                    size="small"
                                    color={itemCount > 0 ? 'primary' : 'default'}
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Button
                                    variant="contained"
                                    size="small"
                                    color="primary"
                                    startIcon={<AssignmentIcon />}
                                    onClick={() => navigate(`/admin/campaigns/${campaign.id}/assignment`)}
                                    disabled={itemCount === 0}
                                    sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
                                  >
                                    배정하기
                                  </Button>
                                </TableCell>
                                <TableCell align="center">
                                  <Tooltip title="캠페인 삭제 (모든 품목/구매자 포함)">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenDeleteDialog('campaign', campaign);
                                      }}
                                      sx={{ p: 0.3 }}
                                    >
                                      <DeleteIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 5, color: '#999' }}>
                        등록된 연월브랜드가 없습니다. 영업사가 연월브랜드를 등록하면 여기에 표시됩니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Box>
    );
  };

  // 사용자 관리 탭 렌더링
  const renderUserManagementTab = () => (
    <Box sx={{ display: 'flex', gap: 0, flex: 1, overflow: 'hidden', position: 'relative' }}>
      {/* 왼쪽: 사용자 목록 (접기 가능) */}
      <Paper
        sx={{
          width: sidebarCollapsed ? 40 : '25%',
          minWidth: sidebarCollapsed ? 40 : 200,
          p: sidebarCollapsed ? 0 : 2,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '4px 0 0 4px',
          position: 'relative'
        }}
      >
        {/* 사이드바 접기/펼치기 버튼 */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-end',
            mb: sidebarCollapsed ? 0 : 1,
            py: sidebarCollapsed ? 1 : 0
          }}
        >
          <Tooltip title={sidebarCollapsed ? '사용자 목록 펼치기' : '사용자 목록 접기'}>
            <IconButton
              size="small"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              sx={{
                bgcolor: 'grey.100',
                '&:hover': { bgcolor: 'grey.200' }
              }}
            >
              {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* 펼쳐졌을 때 내용 표시 */}
        {!sidebarCollapsed && (
          <>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="검색 (ID, 이름)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
              />
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : filteredUsers.length === 0 ? (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  사용자가 없습니다
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>상태</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>이름</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>접속</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.map(user => (
                      <TableRow
                        key={user.id}
                        hover
                        selected={selectedUser?.id === user.id}
                        onClick={() => handleUserSelect(user)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ py: 0.5 }}>
                          <Tooltip title={
                            !user.is_active ? '비활성화됨' :
                            user.is_online ? '온라인' : '오프라인'
                          }>
                            {!user.is_active ? (
                              <BlockIcon
                                sx={{
                                  fontSize: 14,
                                  color: 'error.main'
                                }}
                              />
                            ) : (
                              <CircleIcon
                                sx={{
                                  fontSize: 12,
                                  color: user.is_online ? 'success.main' : 'grey.400'
                                }}
                              />
                            )}
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{
                          py: 0.5,
                          fontSize: '0.75rem',
                          textDecoration: !user.is_active ? 'line-through' : 'none',
                          color: !user.is_active ? 'text.disabled' : 'inherit'
                        }}>
                          {user.name}
                          {!user.is_active && (
                            <Chip
                              label="비활성"
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ ml: 0.5, height: 16, fontSize: '0.6rem' }}
                            />
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>{user.today_login_count}</TableCell>
                        <TableCell sx={{ py: 0.5 }}>
                          <Tooltip title="상세보기">
                            <IconButton
                              size="small"
                              onClick={(e) => handleOpenDetailDialog(user, e)}
                              sx={{ p: 0.2 }}
                            >
                              <InfoIcon sx={{ fontSize: 16 }} color="info" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </>
        )}
      </Paper>

      {/* 오른쪽: 대시보드 (나머지 공간) */}
      <Paper sx={{ flex: 1, p: 0, overflow: 'hidden', ml: 1, borderRadius: '0 4px 4px 0', display: 'flex', flexDirection: 'column' }}>
        {/* 브랜드사 탭일 때 담당 영업사 관리 패널 - 한 줄로 컴팩트하게 */}
        {tabValue === 3 && selectedUser && (
          <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #eee', bgcolor: '#fafafa', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight="bold" sx={{ whiteSpace: 'nowrap' }}>
              담당 영업사 관리
            </Typography>

            {brandSalesLoading ? (
              <CircularProgress size={18} />
            ) : (
              <>
                {/* 현재 담당 영업사 목록 */}
                {brandSalesList.map((sales) => (
                  <Chip
                    key={sales.id}
                    label={sales.name}
                    onDelete={() => handleRemoveSalesFromBrand(sales.id)}
                    deleteIcon={
                      <Tooltip title="담당 해제">
                        <PersonRemoveIcon sx={{ fontSize: 14 }} />
                      </Tooltip>
                    }
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{ height: 24 }}
                  />
                ))}

                {/* 영업사 추가 */}
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="add-sales-select-label">영업사 추가</InputLabel>
                  <Select
                    labelId="add-sales-select-label"
                    value={selectedSalesToAdd}
                    label="영업사 추가"
                    onChange={(e) => setSelectedSalesToAdd(e.target.value)}
                    sx={{ height: 32 }}
                  >
                    {allSalesUsers
                      .filter((s) => !brandSalesList.some((bs) => bs.id === s.id))
                      .map((sales) => (
                        <MenuItem key={sales.id} value={sales.id}>
                          {sales.name} ({sales.username})
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={addingSales ? <CircularProgress size={14} /> : <PersonAddIcon />}
                  onClick={handleAddSalesToBrand}
                  disabled={!selectedSalesToAdd || addingSales}
                  sx={{ height: 32 }}
                >
                  추가
                </Button>
              </>
            )}
          </Box>
        )}

        <UserDashboardViewer user={selectedUser} roleLabels={roleLabels} />
      </Paper>
    </Box>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 탭 */}
      <Paper sx={{ mb: 1 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="fullWidth"
          sx={{
            minHeight: 48,
            '& .MuiTab-root': {
              minHeight: 48,
              fontSize: '0.95rem',
              fontWeight: 500
            }
          }}
        >
          <Tab label="진행자 배정" sx={{ fontWeight: tabValue === 0 ? 'bold' : 'normal' }} />
          <Tab label="진행자 (OPERATOR)" />
          <Tab label="영업사 (SALES)" />
          <Tab label="브랜드사 (BRAND)" />
        </Tabs>
      </Paper>

      {/* 탭 내용 - 남은 공간 모두 사용 */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {tabValue === 0 ? renderAssignmentTab() : renderUserManagementTab()}
      </Box>

      {/* 비밀번호 초기화 확인 다이얼로그 */}
      <Dialog open={resetDialogOpen} onClose={(event, reason) => { if (reason !== 'backdropClick') setResetDialogOpen(false); }}>
        <DialogTitle>비밀번호 초기화</DialogTitle>
        <DialogContent>
          {resetResult ? (
            resetResult.success ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  비밀번호가 초기화되었습니다.
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Typography variant="body2" fontWeight="bold">
                    새 비밀번호:
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, borderRadius: 1 }}
                  >
                    {resetResult.newPassword}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => copyPassword(resetResult.newPassword)}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Alert>
            ) : (
              <Alert severity="error">{resetResult.message}</Alert>
            )
          ) : (
            <DialogContentText>
              <strong>{userToReset?.name}</strong> ({userToReset?.username}) 사용자의 비밀번호를 초기화하시겠습니까?
              <br /><br />
              <Typography variant="body2" color="warning.main">
                ⚠️ 기존 비밀번호는 사용할 수 없게 되며, 새로운 임시 비밀번호가 발급됩니다.
              </Typography>
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>
            {resetResult ? '닫기' : '취소'}
          </Button>
          {!resetResult && (
            <Button
              variant="contained"
              color="warning"
              onClick={handleResetPasswordConfirm}
            >
              초기화
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 사용자 상세 다이얼로그 */}
      <Dialog open={detailDialogOpen} onClose={(event, reason) => { if (reason !== 'backdropClick') { setDetailDialogOpen(false); setEditingUser(false); } }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          사용자 상세 정보
          {userDetail && !editingUser && (
            <Tooltip title="정보 수정">
              <IconButton
                size="small"
                onClick={() => {
                  setEditUsername(userDetail.username);
                  setEditName(userDetail.name);
                  setEditingUser(true);
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {userDetail && (
            <Box>
              {/* ID */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">ID (로그인용)</Typography>
                {editingUser ? (
                  <TextField
                    fullWidth
                    size="small"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    sx={{ mt: 0.5 }}
                  />
                ) : (
                  <Typography variant="body1" fontWeight="medium">{userDetail.username}</Typography>
                )}
              </Box>

              {/* 이름 */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">이름</Typography>
                {editingUser ? (
                  <TextField
                    fullWidth
                    size="small"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    sx={{ mt: 0.5 }}
                  />
                ) : (
                  <Typography variant="body1" fontWeight="medium">{userDetail.name}</Typography>
                )}
              </Box>

              {/* 수정 모드일 때 저장/취소 버튼 */}
              {editingUser && (
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    disabled={savingUser || !editUsername.trim() || !editName.trim()}
                    onClick={async () => {
                      try {
                        setSavingUser(true);
                        await updateUser(userDetail.id, {
                          username: editUsername.trim(),
                          name: editName.trim()
                        });
                        alert('사용자 정보가 수정되었습니다.');
                        setEditingUser(false);
                        loadUsers();
                        // userDetail도 업데이트
                        setUserDetail(prev => ({
                          ...prev,
                          username: editUsername.trim(),
                          name: editName.trim()
                        }));
                      } catch (err) {
                        console.error('Failed to update user:', err);
                        alert('수정 실패: ' + (err.response?.data?.message || err.message));
                      } finally {
                        setSavingUser(false);
                      }
                    }}
                  >
                    {savingUser ? <CircularProgress size={20} /> : '저장'}
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => setEditingUser(false)}
                    disabled={savingUser}
                  >
                    취소
                  </Button>
                </Box>
              )}

              {/* 비밀번호 */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">초기 비밀번호</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Typography
                    variant="body1"
                    sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 1 }}
                  >
                    {showPasswords[userDetail.id] ? (userDetail.initial_password || '없음') : '••••••••'}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => togglePassword(userDetail.id)}
                  >
                    {showPasswords[userDetail.id] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                  {userDetail.initial_password && (
                    <Tooltip title="복사">
                      <IconButton
                        size="small"
                        onClick={() => copyPassword(userDetail.initial_password)}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>

              {/* 비밀번호 초기화 버튼 */}
              <Button
                variant="outlined"
                color="warning"
                startIcon={<LockResetIcon />}
                fullWidth
                onClick={() => {
                  setDetailDialogOpen(false);
                  setEditingUser(false);
                  handleResetPasswordClick(userDetail);
                }}
                sx={{ mt: 1 }}
                disabled={editingUser}
              >
                비밀번호 초기화
              </Button>

              {/* 비활성화/활성화 버튼 */}
              {userDetail.is_active ? (
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<BlockIcon />}
                  fullWidth
                  disabled={editingUser}
                  onClick={async () => {
                    const confirmed = window.confirm(
                      `⚠️ 사용자 비활성화\n\n` +
                      `사용자: ${userDetail.name} (${userDetail.username})\n` +
                      `역할: ${roleLabels[userDetail.role] || userDetail.role}\n\n` +
                      `이 사용자를 비활성화하시겠습니까?\n` +
                      `비활성화된 사용자는 로그인할 수 없지만, 데이터는 유지됩니다.`
                    );
                    if (confirmed) {
                      try {
                        await deactivateUser(userDetail.id);
                        alert('사용자가 비활성화되었습니다.');
                        setDetailDialogOpen(false);
                        setUserDetail(null);
                        loadUsers();
                      } catch (err) {
                        console.error('Failed to deactivate user:', err);
                        alert('비활성화 실패: ' + (err.response?.data?.message || err.message));
                      }
                    }
                  }}
                  sx={{ mt: 1 }}
                >
                  사용자 비활성화
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  fullWidth
                  disabled={editingUser}
                  onClick={async () => {
                    const confirmed = window.confirm(
                      `사용자 활성화\n\n` +
                      `사용자: ${userDetail.name} (${userDetail.username})\n\n` +
                      `이 사용자를 다시 활성화하시겠습니까?\n` +
                      `활성화되면 다시 로그인할 수 있습니다.`
                    );
                    if (confirmed) {
                      try {
                        await activateUser(userDetail.id);
                        alert('사용자가 활성화되었습니다.');
                        setDetailDialogOpen(false);
                        setUserDetail(null);
                        loadUsers();
                      } catch (err) {
                        console.error('Failed to activate user:', err);
                        alert('활성화 실패: ' + (err.response?.data?.message || err.message));
                      }
                    }
                  }}
                  sx={{ mt: 1 }}
                >
                  사용자 활성화
                </Button>
              )}

              {/* 영구 삭제 버튼 */}
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteForeverIcon />}
                fullWidth
                disabled={editingUser}
                onClick={async () => {
                  // 역할별 경고 메시지 생성
                  const roleNames = { admin: '총관리자', sales: '영업사', operator: '진행자', brand: '브랜드사' };
                  const roleName = roleNames[userDetail.role] || '사용자';

                  let warningMessage = `"${userDetail.name} (${userDetail.username})" ${roleName}를 영구 삭제하시겠습니까?\n\n`;

                  if (userDetail.role === 'sales') {
                    warningMessage += `⚠️ 이 영업사가 생성한 모든 데이터가 삭제됩니다:\n`;
                    warningMessage += `   - 연월브랜드, 캠페인, 품목, 구매자 등\n\n`;
                    warningMessage += `💡 데이터를 유지하려면 "취소" 후 다른 영업사에게 위임하세요.\n\n`;
                  } else if (userDetail.role === 'operator') {
                    warningMessage += `⚠️ 이 진행자의 배정 정보가 삭제됩니다:\n`;
                    warningMessage += `   - 품목별 진행자 배정 해제\n\n`;
                    warningMessage += `💡 배정된 품목이 있다면 다른 진행자에게 재배정하세요.\n\n`;
                  } else if (userDetail.role === 'brand') {
                    warningMessage += `⚠️ 이 브랜드사와 연결된 연월브랜드 정보가 해제됩니다.\n\n`;
                  }

                  warningMessage += `이 작업은 되돌릴 수 없습니다.`;

                  if (!window.confirm(warningMessage)) {
                    return;
                  }

                  try {
                    // 먼저 연관 데이터 체크 (force 없이 호출)
                    const response = await deleteUser(userDetail.id);
                    // 성공하면 (연관 데이터 없음) 바로 삭제됨
                    alert('사용자가 영구 삭제되었습니다.');
                    setDetailDialogOpen(false);
                    setUserDetail(null);
                    loadUsers();
                  } catch (err) {
                    // 409 응답: 연관 데이터 존재
                    if (err.response?.status === 409 && err.response?.data?.requiresAction) {
                      const data = err.response.data;
                      setUserDeleteData({
                        user: data.user,
                        relatedData: data.relatedData
                      });
                      // 위임 대상 사용자 목록 로드 (같은 역할)
                      const targetRole = data.user.role === 'operator' ? 'operator' : 'sales';
                      const usersRes = await getUsers(targetRole);
                      const filtered = (usersRes.users || []).filter(u => u.id !== data.user.id && u.is_active);
                      setDelegateUsers(filtered);
                      setDelegateUserId('');
                      setUserDeleteDialogOpen(true);
                    } else {
                      console.error('Failed to delete user:', err);
                      alert('삭제 실패: ' + (err.response?.data?.message || err.message));
                    }
                  }
                }}
                sx={{ mt: 1 }}
              >
                영구 삭제 (복구 불가)
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 영업사 변경 다이얼로그 */}
      <Dialog
        open={salesChangeDialogOpen}
        onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseSalesChangeDialog(); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1 }}>
          <SwapHorizIcon color="primary" />
          <Typography variant="h6">영업사 변경</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedCampaignForSalesChange && (
            <Box>
              {/* 캠페인 정보 */}
              <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">대상 캠페인</Typography>
                <Typography variant="h6" fontWeight="bold">
                  {selectedCampaignForSalesChange.name}
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                  <Typography variant="body2">
                    <strong>브랜드:</strong> {selectedCampaignForSalesChange.brand?.name || '-'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>현재 영업사:</strong> {selectedCampaignForSalesChange.creator?.name || '-'}
                  </Typography>
                </Box>
              </Box>

              {/* 새 영업사 선택 */}
              <FormControl fullWidth>
                <InputLabel id="new-sales-select-label">새 영업사 선택</InputLabel>
                <Select
                  labelId="new-sales-select-label"
                  value={newSalesId}
                  label="새 영업사 선택"
                  onChange={(e) => setNewSalesId(e.target.value)}
                >
                  {salesUsers.filter(s => s.id !== selectedCampaignForSalesChange.creator?.id).map((sales) => (
                    <MenuItem key={sales.id} value={sales.id}>
                      {sales.name} ({sales.username})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  해당 캠페인만 영업사가 변경됩니다.
                </Typography>
                <Typography variant="body2">
                  연월브랜드는 기존 영업사가 계속 관리하며, 선택한 캠페인만 새 영업사에게 이전됩니다.
                  새 영업사는 해당 캠페인만 볼 수 있게 됩니다.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #eee', p: 2 }}>
          <Button onClick={handleCloseSalesChangeDialog} variant="outlined">
            취소
          </Button>
          <Button
            onClick={handleSaveSalesChange}
            variant="contained"
            color="primary"
            disabled={!newSalesId || salesChangeSaving}
            startIcon={salesChangeSaving ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            {salesChangeSaving ? '변경 중...' : '영업사 변경'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseDeleteDialog(); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <DeleteIcon color="error" />
          <Typography variant="h6">
            {deleteTarget?.type === 'monthlyBrand' ? '연월브랜드 삭제' : '캠페인 삭제'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {deleteTarget && (
            <Box>
              {/* 삭제 대상 정보 */}
              <Box sx={{ mb: 3, p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">삭제 대상</Typography>
                <Typography variant="h6" fontWeight="bold" color="error">
                  {deleteTarget.data.name}
                </Typography>
                {deleteTarget.type === 'monthlyBrand' && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      <strong>영업사:</strong> {deleteTarget.data.creator?.name || '-'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>브랜드:</strong> {deleteTarget.data.brand?.name || '-'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>캠페인 수:</strong> {deleteTarget.data.campaigns?.length || 0}개
                    </Typography>
                  </Box>
                )}
                {deleteTarget.type === 'campaign' && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      <strong>영업사:</strong> {deleteTarget.data.creator?.name || '-'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>품목 수:</strong> {deleteTarget.data.items?.length || 0}개
                    </Typography>
                  </Box>
                )}
              </Box>

              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  이 작업은 되돌릴 수 없습니다!
                </Typography>
                <Typography variant="body2">
                  {deleteTarget.type === 'monthlyBrand'
                    ? '해당 연월브랜드와 관련된 모든 캠페인, 품목, 구매자, 이미지 데이터가 영구적으로 삭제됩니다.'
                    : '해당 캠페인과 관련된 모든 품목, 구매자, 이미지 데이터가 영구적으로 삭제됩니다.'
                  }
                </Typography>
              </Alert>

              <Alert severity="warning">
                삭제 시 모든 역할(영업사, 진행자, 브랜드사)에서 해당 데이터가 제거됩니다.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #eee', p: 2 }}>
          <Button onClick={handleCloseDeleteDialog} variant="outlined">
            취소
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 사용자 삭제 확인 다이얼로그 (연관 데이터 있을 때) */}
      <Dialog
        open={userDeleteDialogOpen}
        onClose={() => !userDeleteLoading && setUserDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #eee', bgcolor: '#ffebee' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteForeverIcon color="error" />
            <Typography variant="h6" color="error">사용자 삭제 - 연관 데이터 존재</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {userDeleteData && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="bold">
                  {userDeleteData.user.name} ({userDeleteData.user.username})
                </Typography>
                <Typography variant="body2">
                  이 사용자가 생성한 데이터가 있습니다.
                </Typography>
              </Alert>

              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
                <Typography variant="subtitle2" gutterBottom>연관 데이터 목록:</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {userDeleteData.relatedData.monthlyBrandsCreated > 0 && (
                    <Typography variant="body2">
                      • 생성한 연월브랜드: <strong>{userDeleteData.relatedData.monthlyBrandsCreated}개</strong>
                    </Typography>
                  )}
                  {userDeleteData.relatedData.campaignsCreated > 0 && (
                    <Typography variant="body2">
                      • 생성한 캠페인: <strong>{userDeleteData.relatedData.campaignsCreated}개</strong>
                    </Typography>
                  )}
                  {userDeleteData.relatedData.operatorAssignments > 0 && (
                    <Typography variant="body2">
                      • 진행자 배정: <strong>{userDeleteData.relatedData.operatorAssignments}건</strong>
                    </Typography>
                  )}
                  {userDeleteData.relatedData.brandMonthlyBrands > 0 && (
                    <Typography variant="body2">
                      • 연결된 연월브랜드 (브랜드사): <strong>{userDeleteData.relatedData.brandMonthlyBrands}개</strong>
                    </Typography>
                  )}
                </Box>
              </Paper>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>처리 방법 선택:</Typography>

              {/* 위임 옵션 */}
              {(userDeleteData.relatedData.monthlyBrandsCreated > 0 || userDeleteData.relatedData.campaignsCreated > 0) && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="body2" gutterBottom fontWeight="bold">
                    옵션 1: 다른 사용자에게 위임
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    연월브랜드와 캠페인을 다른 영업사에게 이전 후 삭제합니다.
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>위임 대상</InputLabel>
                      <Select
                        value={delegateUserId}
                        onChange={(e) => setDelegateUserId(e.target.value)}
                        label="위임 대상"
                        disabled={userDeleteLoading}
                      >
                        {delegateUsers.map(u => (
                          <MenuItem key={u.id} value={u.id}>
                            {u.name} ({u.username})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={!delegateUserId || userDeleteLoading}
                      onClick={async () => {
                        if (!window.confirm(`${delegateUsers.find(u => u.id === delegateUserId)?.name}에게 데이터를 위임하고 사용자를 삭제하시겠습니까?`)) return;
                        setUserDeleteLoading(true);
                        try {
                          await deleteUser(userDeleteData.user.id, { delegateTo: delegateUserId });
                          alert('데이터가 위임되고 사용자가 삭제되었습니다.');
                          setUserDeleteDialogOpen(false);
                          setUserDeleteData(null);
                          setDetailDialogOpen(false);
                          setUserDetail(null);
                          loadUsers();
                        } catch (err) {
                          alert('위임 실패: ' + (err.response?.data?.message || err.message));
                        } finally {
                          setUserDeleteLoading(false);
                        }
                      }}
                    >
                      위임 후 삭제
                    </Button>
                  </Box>
                </Paper>
              )}

              {/* 모두 삭제 옵션 */}
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fff3e0' }}>
                <Typography variant="body2" gutterBottom fontWeight="bold" color="error">
                  옵션 {(userDeleteData.relatedData.monthlyBrandsCreated > 0 || userDeleteData.relatedData.campaignsCreated > 0) ? '2' : '1'}: 모두 삭제
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  사용자가 생성한 모든 데이터(연월브랜드, 캠페인, 품목, 구매자, 이미지)를 함께 삭제합니다.
                </Typography>
                <Alert severity="error" sx={{ mb: 1 }}>
                  이 작업은 되돌릴 수 없습니다!
                </Alert>
                <Button
                  variant="contained"
                  color="error"
                  disabled={userDeleteLoading}
                  startIcon={userDeleteLoading ? <CircularProgress size={16} /> : <DeleteForeverIcon />}
                  onClick={async () => {
                    if (!window.confirm('정말로 모든 연관 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!')) return;
                    if (!window.confirm('⚠️ 최종 확인 ⚠️\n\n삭제를 진행합니다.')) return;
                    setUserDeleteLoading(true);
                    try {
                      await deleteUser(userDeleteData.user.id, { force: 'true' });
                      alert('사용자와 모든 연관 데이터가 삭제되었습니다.');
                      setUserDeleteDialogOpen(false);
                      setUserDeleteData(null);
                      setDetailDialogOpen(false);
                      setUserDetail(null);
                      loadUsers();
                    } catch (err) {
                      alert('삭제 실패: ' + (err.response?.data?.message || err.message));
                    } finally {
                      setUserDeleteLoading(false);
                    }
                  }}
                >
                  모두 삭제
                </Button>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #eee' }}>
          <Button
            onClick={() => setUserDeleteDialogOpen(false)}
            disabled={userDeleteLoading}
          >
            취소
          </Button>
        </DialogActions>
      </Dialog>

      {/* 연월브랜드 수정 다이얼로그 */}
      <SalesMonthlyBrandDialog
        open={monthlyBrandDialogOpen}
        onClose={() => {
          setMonthlyBrandDialogOpen(false);
          setSelectedMonthlyBrandForEdit(null);
        }}
        onSuccess={handleMonthlyBrandEditSuccess}
        mode="edit"
        initialData={selectedMonthlyBrandForEdit}
      />
    </Box>
  );
}

export default AdminControlTower;
