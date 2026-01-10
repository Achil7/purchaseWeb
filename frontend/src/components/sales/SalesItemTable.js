import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Button, Breadcrumbs, Link, CircularProgress, Alert, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, TableSortLabel,
  Select, MenuItem, FormControl
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { itemService } from '../../services';
import SalesItemDialog from './SalesAddItemDialog';

// 플랫폼 옵션
const PLATFORM_OPTIONS = ['쿠팡', '네이버', '11번가', '옥션', 'G마켓', '위메프', '티몬', '인터파크', '카카오', '기타'];

function SalesItemTable() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialog states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // 정렬 상태
  const [orderBy, setOrderBy] = useState('registered_at');
  const [order, setOrder] = useState('desc');

  // 플랫폼 인라인 편집 상태
  const [editingPlatformId, setEditingPlatformId] = useState(null);
  const [editingPlatformValue, setEditingPlatformValue] = useState('');

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await itemService.getItemsByCampaign(campaignId);
      setItems(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load items:', err);
      setError('제품 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 정렬 핸들러
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // 정렬된 제품 목록
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let aValue, bValue;

      switch (orderBy) {
        case 'registered_at':
          aValue = a.registered_at || a.created_at || '';
          bValue = b.registered_at || b.created_at || '';
          break;
        case 'product_name':
          aValue = a.product_name || '';
          bValue = b.product_name || '';
          break;
        case 'description':
          aValue = a.description || '';
          bValue = b.description || '';
          break;
        case 'shipping_type':
          aValue = a.shipping_type || '';
          bValue = b.shipping_type || '';
          break;
        case 'product_price':
          aValue = Number(a.product_price) || 0;
          bValue = Number(b.product_price) || 0;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'platform':
          aValue = a.platform || '';
          bValue = b.platform || '';
          break;
        default:
          aValue = a[orderBy] || '';
          bValue = b[orderBy] || '';
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return order === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const comparison = String(aValue).localeCompare(String(bValue), 'ko');
      return order === 'asc' ? comparison : -comparison;
    });
  }, [items, orderBy, order]);

  // 등록시간 포맷팅 함수
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'active': '진행 중',
      'completed': '완료',
      'cancelled': '취소'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'active': 'primary',
      'completed': 'success',
      'cancelled': 'error'
    };
    return colorMap[status] || 'default';
  };

  // 제품 추가 Dialog 열기
  const handleOpenAddDialog = () => {
    setModalMode('create');
    setSelectedItem(null);
    setIsModalOpen(true);
  };

  // 제품 수정 Dialog 열기
  const handleOpenEditDialog = (item, e) => {
    e.stopPropagation();
    setModalMode('edit');
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  // Dialog 닫기
  const handleCloseDialog = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  // 제품 저장 (추가/수정)
  const handleSaveItem = async (itemData) => {
    try {
      if (modalMode === 'edit' && selectedItem) {
        await itemService.updateItem(selectedItem.id, itemData);
      } else {
        await itemService.createItem(campaignId, itemData);
      }
      await loadItems();
      setIsModalOpen(false);
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to save item:', err);
      alert(modalMode === 'edit' ? '제품 수정에 실패했습니다.' : '제품 생성에 실패했습니다.');
    }
  };

  // 삭제 Dialog 열기
  const handleOpenDeleteDialog = (item, e) => {
    e.stopPropagation();
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  // 삭제 Dialog 닫기
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  // 제품 삭제
  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await itemService.deleteItem(itemToDelete.id);
      await loadItems();
      handleCloseDeleteDialog();
    } catch (err) {
      console.error('Failed to delete item:', err);
      alert('제품 삭제에 실패했습니다.');
    }
  };

  // 제품 상세보기
  const handleViewItem = (itemId) => {
    navigate(`/sales/campaign/${campaignId}/item/${itemId}`);
  };

  // 플랫폼 인라인 편집 시작
  const handleStartEditPlatform = (item, e) => {
    e.stopPropagation();
    setEditingPlatformId(item.id);
    setEditingPlatformValue(item.platform || '');
  };

  // 플랫폼 인라인 편집 취소
  const handleCancelEditPlatform = (e) => {
    e.stopPropagation();
    setEditingPlatformId(null);
    setEditingPlatformValue('');
  };

  // 플랫폼 인라인 편집 저장
  const handleSavePlatform = async (itemId, e) => {
    e.stopPropagation();
    try {
      await itemService.updateItem(itemId, { platform: editingPlatformValue || null });
      // 로컬 상태 업데이트
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, platform: editingPlatformValue || null } : item
      ));
      setEditingPlatformId(null);
      setEditingPlatformValue('');
    } catch (err) {
      console.error('Failed to update platform:', err);
      alert('플랫폼 수정에 실패했습니다.');
    }
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

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          <Link underline="hover" color="inherit" onClick={() => navigate('/sales')} sx={{ cursor: 'pointer' }}>
            캠페인 목록
          </Link>
          <Typography color="text.primary">제품 관리 (캠페인 ID: {campaignId})</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">제품 관리</Typography>
          <Typography variant="body2" color="text.secondary">
            캠페인의 제품을 추가하고 관리하세요. (총 {items.length}개)
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="success"
          startIcon={<AddCircleIcon />}
          onClick={handleOpenAddDialog}
          sx={{ px: 3, py: 1.5, fontWeight: 'bold' }}
        >
          제품 추가
        </Button>
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#e0f2f1' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'registered_at'}
                    direction={orderBy === 'registered_at' ? order : 'asc'}
                    onClick={() => handleRequestSort('registered_at')}
                  >
                    등록시간
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'product_name'}
                    direction={orderBy === 'product_name' ? order : 'asc'}
                    onClick={() => handleRequestSort('product_name')}
                  >
                    제품명
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'description'}
                    direction={orderBy === 'description' ? order : 'asc'}
                    onClick={() => handleRequestSort('description')}
                  >
                    설명
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'shipping_type'}
                    direction={orderBy === 'shipping_type' ? order : 'asc'}
                    onClick={() => handleRequestSort('shipping_type')}
                  >
                    출고타입
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'product_price'}
                    direction={orderBy === 'product_price' ? order : 'asc'}
                    onClick={() => handleRequestSort('product_price')}
                  >
                    가격
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'platform'}
                    direction={orderBy === 'platform' ? order : 'asc'}
                    onClick={() => handleRequestSort('platform')}
                  >
                    플랫폼
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'status'}
                    direction={orderBy === 'status' ? order : 'asc'}
                    onClick={() => handleRequestSort('status')}
                  >
                    상태
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedItems.length > 0 ? (
                sortedItems.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleViewItem(item.id)}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', color: '#666' }}>
                      {formatDateTime(item.registered_at || item.created_at)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <InsertDriveFileIcon color="action" /> {item.product_name}
                      </Box>
                    </TableCell>
                    <TableCell>{item.description || '-'}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={item.shipping_type || '-'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {item.product_price ? `${Number(item.product_price).toLocaleString()}원` : '-'}
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      {editingPlatformId === item.id ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center' }}>
                          <FormControl size="small" sx={{ minWidth: 100 }}>
                            <Select
                              value={editingPlatformValue}
                              onChange={(e) => setEditingPlatformValue(e.target.value)}
                              displayEmpty
                              sx={{ fontSize: '0.875rem' }}
                            >
                              <MenuItem value="">
                                <em>선택 안 함</em>
                              </MenuItem>
                              {PLATFORM_OPTIONS.map((platform) => (
                                <MenuItem key={platform} value={platform}>
                                  {platform}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <IconButton
                            size="small"
                            color="success"
                            onClick={(e) => handleSavePlatform(item.id, e)}
                          >
                            <CheckIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={handleCancelEditPlatform}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ) : (
                        <Chip
                          label={item.platform || '미지정'}
                          size="small"
                          variant={item.platform ? 'filled' : 'outlined'}
                          color={item.platform ? 'info' : 'default'}
                          onClick={(e) => handleStartEditPlatform(item, e)}
                          sx={{ cursor: 'pointer' }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getStatusLabel(item.status)}
                        color={getStatusColor(item.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        <Tooltip title="상세보기">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewItem(item.id);
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="수정">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={(e) => handleOpenEditDialog(item, e)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="삭제">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => handleOpenDeleteDialog(item, e)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3, color: '#999' }}>
                    등록된 제품이 없습니다. 우측 상단 버튼을 눌러 추가하세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 제품 추가/수정 Dialog */}
      <SalesItemDialog
        open={isModalOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveItem}
        mode={modalMode}
        initialData={selectedItem}
      />

      {/* 삭제 확인 Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>제품 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText>
            "{itemToDelete?.product_name}" 제품을 삭제하시겠습니까?
            <br />
            삭제된 제품은 복구할 수 없습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color="inherit">
            취소
          </Button>
          <Button onClick={handleDeleteItem} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default SalesItemTable;
