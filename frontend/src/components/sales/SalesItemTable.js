import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Button, Breadcrumbs, Link, CircularProgress, Alert, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { itemService } from '../../services';
import SalesItemDialog from './SalesAddItemDialog';

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
      setError('품목 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
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

  // 품목 추가 Dialog 열기
  const handleOpenAddDialog = () => {
    setModalMode('create');
    setSelectedItem(null);
    setIsModalOpen(true);
  };

  // 품목 수정 Dialog 열기
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

  // 품목 저장 (추가/수정)
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
      alert(modalMode === 'edit' ? '품목 수정에 실패했습니다.' : '품목 생성에 실패했습니다.');
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

  // 품목 삭제
  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await itemService.deleteItem(itemToDelete.id);
      await loadItems();
      handleCloseDeleteDialog();
    } catch (err) {
      console.error('Failed to delete item:', err);
      alert('품목 삭제에 실패했습니다.');
    }
  };

  // 품목 상세보기
  const handleViewItem = (itemId) => {
    navigate(`/sales/campaign/${campaignId}/item/${itemId}`);
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
          <Typography color="text.primary">품목 관리 (캠페인 ID: {campaignId})</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">품목 관리</Typography>
          <Typography variant="body2" color="text.secondary">
            캠페인의 품목을 추가하고 관리하세요. (총 {items.length}개)
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="success"
          startIcon={<AddCircleIcon />}
          onClick={handleOpenAddDialog}
          sx={{ px: 3, py: 1.5, fontWeight: 'bold' }}
        >
          품목 추가
        </Button>
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#e0f2f1' }}>
              <TableRow>
                <TableCell>품목명</TableCell>
                <TableCell>설명</TableCell>
                <TableCell align="center">출고타입</TableCell>
                <TableCell align="center">가격</TableCell>
                <TableCell align="center">상태</TableCell>
                <TableCell align="center">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length > 0 ? (
                items.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleViewItem(item.id)}
                  >
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
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: '#999' }}>
                    등록된 품목이 없습니다. 우측 상단 버튼을 눌러 추가하세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 품목 추가/수정 Dialog */}
      <SalesItemDialog
        open={isModalOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveItem}
        mode={modalMode}
        initialData={selectedItem}
      />

      {/* 삭제 확인 Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>품목 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText>
            "{itemToDelete?.product_name}" 품목을 삭제하시겠습니까?
            <br />
            삭제된 품목은 복구할 수 없습니다.
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
