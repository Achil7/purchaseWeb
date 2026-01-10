import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, CircularProgress, Alert, Button, IconButton, Tooltip, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Select, MenuItem, FormControl, TableSortLabel, TextField
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FiberNewIcon from '@mui/icons-material/FiberNew';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import InventoryIcon from '@mui/icons-material/Inventory';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckIcon from '@mui/icons-material/Check';
import CancelIcon from '@mui/icons-material/Cancel';
import { campaignService, userService, itemService } from '../../services';
import SalesAddCampaignDialog from '../sales/SalesAddCampaignDialog';
import AdminEditDialog from './AdminEditDialog';

function AdminCampaignTable() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialog states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null); // { campaign, item }
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState(null);

  // 탭 상태: 0 = 신규건, 1 = 진행건, 2 = 보류건, 3 = 완료건
  const [activeTab, setActiveTab] = useState(0);

  // 정렬 상태
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'asc' });

  // 배정 중인 제품 ID
  const [assigningItemId, setAssigningItemId] = useState(null);

  // 입금명 인라인 편집 state
  const [editingDepositId, setEditingDepositId] = useState(null);
  const [editingDepositValue, setEditingDepositValue] = useState('');

  // 제품 상태 판단 함수
  const getItemStatus = (campaign, item) => {
    if (!item) return 'no_item';

    // 제품 자체의 상태가 보류인 경우
    if (item.status === 'pending' || item.status === 'hold') {
      return 'hold';
    }

    const assignments = campaign.operatorAssignments || [];
    const isAssigned = assignments.some(a => a.item_id === item.id);

    // 완료 체크: 목표 리뷰 수 달성
    const targetCount = item.total_purchase_count || 0;
    const currentCount = item.buyers?.length || 0;
    if (targetCount > 0 && currentCount >= targetCount) {
      return 'completed';
    }

    // 미배정
    if (!isAssigned) {
      return 'new';
    }

    // 진행 중
    return 'in_progress';
  };

  // 전체 제품 목록 생성 (모든 캠페인의 제품을 펼쳐서 표시, day_group별 분리)
  const allItemsList = useMemo(() => {
    const items = [];
    campaigns.forEach(campaign => {
      const campaignItems = campaign.items || [];
      const assignments = campaign.operatorAssignments || [];

      // 제품이 없는 캠페인도 표시
      if (campaignItems.length === 0) {
        items.push({
          campaign,
          item: null,
          status: 'no_item',
          assignedOperator: null,
          dayGroup: null,
          dayGroups: []
        });
      } else {
        // 각 제품별로 표시
        campaignItems.forEach(item => {
          const dayGroups = item.dayGroups || []; // API에서 받은 day_group 목록

          if (dayGroups.length <= 1) {
            // day_group이 1개 이하면 기존처럼 하나의 행으로 표시
            const dayGroup = dayGroups[0] || null;
            const assignment = assignments.find(a =>
              a.item_id === item.id && (a.day_group === dayGroup || a.day_group === null)
            );
            const status = getItemStatus(campaign, item);

            items.push({
              campaign,
              item,
              status,
              assignedOperator: assignment ? operators.find(op => op.id === assignment.operator_id) : null,
              assignmentId: assignment?.id,
              dayGroup,
              dayGroups
            });
          } else {
            // day_group이 여러 개면 각각의 행으로 표시
            dayGroups.forEach((dayGroup, idx) => {
              const assignment = assignments.find(a =>
                a.item_id === item.id && a.day_group === dayGroup
              );
              const status = getItemStatus(campaign, item);

              items.push({
                campaign,
                item,
                status,
                assignedOperator: assignment ? operators.find(op => op.id === assignment.operator_id) : null,
                assignmentId: assignment?.id,
                dayGroup,
                dayGroups,
                dayGroupIndex: idx // 첫 번째 그룹만 품목명 표시용
              });
            });
          }
        });
      }
    });
    return items;
  }, [campaigns, operators]);

  // 탭별 필터링된 제품 목록
  const filteredItemsList = useMemo(() => {
    switch (activeTab) {
      case 0: // 신규건: 제품 없음 또는 미배정
        return allItemsList.filter(entry => entry.status === 'no_item' || entry.status === 'new');
      case 1: // 진행건: 배정되었지만 미완료
        return allItemsList.filter(entry => entry.status === 'in_progress');
      case 2: // 보류건: 보류 상태
        return allItemsList.filter(entry => entry.status === 'hold');
      case 3: // 완료건
        return allItemsList.filter(entry => entry.status === 'completed');
      default:
        return allItemsList;
    }
  }, [activeTab, allItemsList]);

  // 정렬된 목록
  const sortedItemsList = useMemo(() => {
    const sorted = [...filteredItemsList];

    sorted.sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'created_at':
          aValue = new Date(a.campaign.created_at || 0).getTime();
          bValue = new Date(b.campaign.created_at || 0).getTime();
          break;
        case 'brand':
          aValue = a.campaign.brand?.name || '';
          bValue = b.campaign.brand?.name || '';
          break;
        case 'campaign':
          aValue = a.campaign.name || '';
          bValue = b.campaign.name || '';
          break;
        case 'item':
          aValue = a.item?.product_name || '';
          bValue = b.item?.product_name || '';
          break;
        case 'creator':
          aValue = a.campaign.creator?.name || '';
          bValue = b.campaign.creator?.name || '';
          break;
        case 'status':
          const statusOrder = { 'no_item': 0, 'new': 1, 'in_progress': 2, 'hold': 3, 'completed': 4 };
          aValue = statusOrder[a.status] || 0;
          bValue = statusOrder[b.status] || 0;
          break;
        case 'progress':
          const aTarget = a.item?.total_purchase_count || 0;
          const aCurrent = a.item?.buyers?.length || 0;
          const bTarget = b.item?.total_purchase_count || 0;
          const bCurrent = b.item?.buyers?.length || 0;
          aValue = aTarget > 0 ? aCurrent / aTarget : 0;
          bValue = bTarget > 0 ? bCurrent / bTarget : 0;
          break;
        case 'operator':
          aValue = a.assignedOperator?.name || '';
          bValue = b.assignedOperator?.name || '';
          break;
        case 'deposit_name':
          aValue = a.item?.deposit_name || '';
          bValue = b.item?.deposit_name || '';
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredItemsList, sortConfig]);

  // 탭별 개수
  const tabCounts = useMemo(() => {
    const newCount = allItemsList.filter(e => e.status === 'no_item' || e.status === 'new').length;
    const inProgressCount = allItemsList.filter(e => e.status === 'in_progress').length;
    const holdCount = allItemsList.filter(e => e.status === 'hold').length;
    const completedCount = allItemsList.filter(e => e.status === 'completed').length;
    return { newCount, inProgressCount, holdCount, completedCount };
  }, [allItemsList]);

  useEffect(() => {
    loadCampaigns();
    loadOperators();
  }, []);

  const loadOperators = async () => {
    try {
      const response = await userService.getUsers('operator');
      setOperators(response.data || []);
    } catch (err) {
      console.error('Failed to load operators:', err);
    }
  };

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await campaignService.getCampaigns();
      setCampaigns(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
      setError('캠페인 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  // 정렬 핸들러
  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // 캠페인 추가 다이얼로그
  const handleOpenAddDialog = () => {
    setIsAddModalOpen(true);
  };

  const handleCloseAddDialog = () => {
    setIsAddModalOpen(false);
  };

  // 통합 수정 다이얼로그
  const handleOpenEditDialog = (entry, e) => {
    e.stopPropagation();
    setSelectedEntry(entry);
    setIsEditModalOpen(true);
  };

  const handleCloseEditDialog = () => {
    setIsEditModalOpen(false);
    setSelectedEntry(null);
  };

  const handleSaveAdd = async (campaignData) => {
    try {
      await campaignService.createCampaign(campaignData);
      await loadCampaigns();
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Failed to save campaign:', err);
      alert(err.response?.data?.message || '캠페인 저장에 실패했습니다.');
    }
  };

  const handleSaveEdit = async (campaignData) => {
    try {
      if (selectedEntry?.campaign?.id) {
        await campaignService.updateCampaign(selectedEntry.campaign.id, campaignData);
      }
      await loadCampaigns();
      setIsEditModalOpen(false);
      setSelectedEntry(null);
    } catch (err) {
      console.error('Failed to update:', err);
      throw err;
    }
  };

  const handleOpenDeleteDialog = (campaign, e) => {
    e.stopPropagation();
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setCampaignToDelete(null);
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    try {
      await campaignService.deleteCampaign(campaignToDelete.id);
      await loadCampaigns();
      handleCloseDeleteDialog();
    } catch (err) {
      console.error('Failed to delete campaign:', err);
      alert('캠페인 삭제에 실패했습니다.');
    }
  };

  // 진행자 배정/재배정 핸들러 (day_group 단위 지원)
  const handleAssignOperator = async (itemId, operatorId, currentOperatorId = null, dayGroup = null) => {
    if (!operatorId || !itemId) return;

    try {
      setAssigningItemId(`${itemId}_${dayGroup}`);
      if (currentOperatorId) {
        // 이미 배정된 진행자가 있으면 재배정
        await itemService.reassignOperator(itemId, operatorId, dayGroup);
      } else {
        // 신규 배정
        await itemService.assignOperator(itemId, operatorId, dayGroup);
      }
      await loadCampaigns();
    } catch (err) {
      console.error('Failed to assign operator:', err);
      alert(err.response?.data?.message || '진행자 배정에 실패했습니다.');
    } finally {
      setAssigningItemId(null);
    }
  };

  // 입금명 편집 관련 핸들러
  const handleDepositEdit = (item, e) => {
    e.stopPropagation();
    setEditingDepositId(item.id);
    setEditingDepositValue(item.deposit_name || '');
  };

  const handleDepositCancel = (e) => {
    e.stopPropagation();
    setEditingDepositId(null);
    setEditingDepositValue('');
  };

  const handleDepositSave = async (itemId, e) => {
    e.stopPropagation();
    try {
      await itemService.updateDepositName(itemId, editingDepositValue);
      await loadCampaigns();
      setEditingDepositId(null);
      setEditingDepositValue('');
    } catch (err) {
      console.error('입금명 저장 실패:', err);
      alert('입금명 저장에 실패했습니다.');
    }
  };

  // 상태 칩 렌더링
  const renderStatusChip = (status) => {
    switch (status) {
      case 'no_item':
        return <Chip label="제품 없음" size="small" color="default" variant="outlined" />;
      case 'new':
        return <Chip label="신규" size="small" color="warning" />;
      case 'in_progress':
        return <Chip label="진행 중" size="small" color="primary" />;
      case 'hold':
        return <Chip label="보류" size="small" color="secondary" />;
      case 'completed':
        return <Chip label="완료" size="small" color="success" />;
      default:
        return null;
    }
  };

  // 진행률 계산
  const getProgress = (item) => {
    if (!item) return '-';
    const target = item.total_purchase_count || 0;
    const current = item.buyers?.length || 0;
    if (target === 0) return `${current}/미설정`;
    return `${current}/${target}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mb: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const getTabLabel = (tab) => {
    switch (tab) {
      case 0:
        return `신규건 (${tabCounts.newCount})`;
      case 1:
        return `진행건 (${tabCounts.inProgressCount})`;
      case 2:
        return `보류건 (${tabCounts.holdCount})`;
      case 3:
        return `완료건 (${tabCounts.completedCount})`;
      default:
        return '';
    }
  };

  // 테이블 헤더 배경색
  const getHeaderBgColor = () => {
    switch (activeTab) {
      case 0: return '#fff3e0';  // 신규: 주황
      case 1: return '#e3f2fd';  // 진행: 파랑
      case 2: return '#f3e5f5';  // 보류: 보라
      case 3: return '#e8f5e9';  // 완료: 초록
      default: return '#e8eaf6';
    }
  };

  // 빈 목록 메시지
  const getEmptyMessage = () => {
    switch (activeTab) {
      case 0: return '배정이 필요한 신규 제품이 없습니다.';
      case 1: return '진행 중인 제품이 없습니다.';
      case 2: return '보류 중인 제품이 없습니다.';
      case 3: return '완료된 제품이 없습니다.';
      default: return '제품이 없습니다.';
    }
  };

  return (
    <>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">캠페인 관리</Typography>
          <Typography variant="body2" color="text.secondary">
            제품별로 진행자를 배정하고 진행 상황을 관리하세요. (전체 {allItemsList.length}건)
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleIcon />}
          onClick={handleOpenAddDialog}
          sx={{ px: 3, py: 1.5, fontWeight: 'bold' }}
        >
          캠페인 추가
        </Button>
      </Box>

      {/* 탭 메뉴 */}
      <Paper sx={{ borderRadius: 2, mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': { py: 2 },
            '& .Mui-selected': { fontWeight: 'bold' }
          }}
        >
          <Tab
            icon={<FiberNewIcon />}
            iconPosition="start"
            label={getTabLabel(0)}
            sx={{ color: activeTab === 0 ? '#ed6c02' : 'inherit' }}
          />
          <Tab
            icon={<PlayCircleIcon />}
            iconPosition="start"
            label={getTabLabel(1)}
            sx={{ color: activeTab === 1 ? '#1976d2' : 'inherit' }}
          />
          <Tab
            icon={<PauseCircleIcon />}
            iconPosition="start"
            label={getTabLabel(2)}
            sx={{ color: activeTab === 2 ? '#9c27b0' : 'inherit' }}
          />
          <Tab
            icon={<CheckCircleIcon />}
            iconPosition="start"
            label={getTabLabel(3)}
            sx={{ color: activeTab === 3 ? '#2e7d32' : 'inherit' }}
          />
        </Tabs>
      </Paper>

      {/* 제품 테이블 */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: getHeaderBgColor() }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'created_at'}
                    direction={sortConfig.key === 'created_at' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('created_at')}
                  >
                    등록일
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'brand'}
                    direction={sortConfig.key === 'brand' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('brand')}
                  >
                    브랜드
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'campaign'}
                    direction={sortConfig.key === 'campaign' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('campaign')}
                  >
                    캠페인명
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'item'}
                    direction={sortConfig.key === 'item' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('item')}
                  >
                    제품명
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'creator'}
                    direction={sortConfig.key === 'creator' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('creator')}
                  >
                    영업사
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'status'}
                    direction={sortConfig.key === 'status' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('status')}
                  >
                    상태
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={sortConfig.key === 'progress'}
                    direction={sortConfig.key === 'progress' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('progress')}
                  >
                    진행률
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: 180 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'operator'}
                    direction={sortConfig.key === 'operator' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('operator')}
                  >
                    진행자
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: 150 }}>
                  <TableSortLabel
                    active={sortConfig.key === 'deposit_name'}
                    direction={sortConfig.key === 'deposit_name' ? sortConfig.direction : 'asc'}
                    onClick={() => handleSort('deposit_name')}
                  >
                    입금명
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedItemsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 5, color: '#999' }}>
                    {getEmptyMessage()}
                  </TableCell>
                </TableRow>
              ) : (
                sortedItemsList.map((entry, idx) => (
                  <TableRow
                    key={`${entry.campaign.id}-${entry.item?.id || 'no-item'}-${idx}`}
                    hover
                    sx={{
                      bgcolor: entry.status === 'no_item' ? '#ffebee' : 'inherit',
                      '&:hover': { bgcolor: entry.status === 'no_item' ? '#ffcdd2' : undefined }
                    }}
                  >
                    {/* 등록일 */}
                    <TableCell>{formatDate(entry.campaign.created_at)}</TableCell>
                    {/* 브랜드 */}
                    <TableCell>{entry.campaign.brand?.name || '-'}</TableCell>
                    {/* 캠페인명 */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FolderIcon color="primary" fontSize="small" />
                        <Typography variant="body2" fontWeight="bold">
                          {entry.campaign.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    {/* 제품명 */}
                    <TableCell>
                      {entry.status === 'no_item' ? (
                        <Chip
                          label="제품 없음"
                          size="small"
                          color="error"
                          variant="outlined"
                          icon={<InventoryIcon />}
                        />
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InventoryIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {entry.item.product_name}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    {/* 영업사 */}
                    <TableCell>{entry.campaign.creator?.name || '-'}</TableCell>
                    {/* 상태 */}
                    <TableCell align="center">
                      {renderStatusChip(entry.status)}
                    </TableCell>
                    {/* 진행률 */}
                    <TableCell align="center">
                      {entry.item ? (
                        <Typography variant="body2" fontWeight="medium">
                          {getProgress(entry.item)}
                        </Typography>
                      ) : '-'}
                    </TableCell>
                    {/* 진행자 */}
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      {entry.status === 'no_item' ? (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      ) : (
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <Select
                            value={entry.assignedOperator?.id || ''}
                            displayEmpty
                            disabled={assigningItemId === `${entry.item?.id}_${entry.dayGroup}`}
                            onChange={(e) => handleAssignOperator(
                              entry.item.id,
                              e.target.value,
                              entry.assignedOperator?.id || null,
                              entry.dayGroup
                            )}
                            sx={{
                              bgcolor: 'white',
                              '& .MuiSelect-select': {
                                color: entry.assignedOperator ? 'success.main' : 'text.secondary'
                              }
                            }}
                          >
                            <MenuItem value="" disabled>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PersonAddIcon fontSize="small" />
                                선택
                              </Box>
                            </MenuItem>
                            {operators.map(op => (
                              <MenuItem key={op.id} value={op.id}>
                                {op.name}
                                {entry.assignedOperator?.id === op.id && ' (현재)'}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    </TableCell>
                    {/* 입금명 */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {entry.status === 'no_item' ? (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      ) : editingDepositId === entry.item?.id ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TextField
                            size="small"
                            value={editingDepositValue}
                            onChange={(e) => setEditingDepositValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleDepositSave(entry.item.id, e);
                              if (e.key === 'Escape') handleDepositCancel(e);
                            }}
                            autoFocus
                            placeholder="입금명 입력"
                            sx={{ width: 100 }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <IconButton size="small" color="primary" onClick={(e) => handleDepositSave(entry.item.id, e)}>
                            <CheckIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={handleDepositCancel}>
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ) : (
                        <Box
                          onClick={(e) => handleDepositEdit(entry.item, e)}
                          sx={{
                            cursor: 'pointer',
                            border: '1px solid #e0e0e0',
                            bgcolor: '#fafafa',
                            '&:hover': { bgcolor: '#f0f0f0', borderColor: '#bdbdbd' },
                            p: 0.5,
                            borderRadius: 1,
                            minHeight: 28,
                            minWidth: 80
                          }}
                        >
                          {entry.item?.deposit_name || <Typography variant="caption" color="text.disabled">클릭하여 입력</Typography>}
                        </Box>
                      )}
                    </TableCell>
                    {/* 관리 */}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        {entry.item ? (
                          <Tooltip title="제품 상세 (구매자/리뷰)">
                            <Button
                              variant="contained"
                              size="small"
                              color="info"
                              startIcon={<VisibilityIcon />}
                              onClick={() => navigate(`/admin/campaign/${entry.campaign.id}/item/${entry.item.id}`)}
                            >
                              상세보기
                            </Button>
                          </Tooltip>
                        ) : (
                          <Tooltip title="통합 수정에서 제품 추가">
                            <Button
                              variant="outlined"
                              size="small"
                              color="primary"
                              onClick={(e) => handleOpenEditDialog(entry, e)}
                            >
                              제품 추가
                            </Button>
                          </Tooltip>
                        )}
                        <Tooltip title="통합 수정 (캠페인 + 제품)">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={(e) => handleOpenEditDialog(entry, e)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="캠페인 삭제">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => handleOpenDeleteDialog(entry.campaign, e)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 캠페인 추가 Dialog */}
      <SalesAddCampaignDialog
        open={isAddModalOpen}
        onClose={handleCloseAddDialog}
        onSave={handleSaveAdd}
        mode="create"
      />

      {/* 통합 수정 Dialog */}
      <AdminEditDialog
        open={isEditModalOpen}
        onClose={handleCloseEditDialog}
        onSave={handleSaveEdit}
        campaign={selectedEntry?.campaign}
        item={selectedEntry?.item}
      />

      {/* 삭제 확인 Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>캠페인 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText>
            "{campaignToDelete?.name}" 캠페인을 삭제하시겠습니까?
            <br />
            삭제 시 해당 캠페인의 모든 제품도 함께 삭제됩니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color="inherit">
            취소
          </Button>
          <Button onClick={handleDeleteCampaign} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default AdminCampaignTable;
