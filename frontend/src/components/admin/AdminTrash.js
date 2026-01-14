import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Chip, Button, Alert, CircularProgress, Tabs, Tab, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import FolderIcon from '@mui/icons-material/Folder';
import CampaignIcon from '@mui/icons-material/Campaign';
import InventoryIcon from '@mui/icons-material/Inventory';
import PersonIcon from '@mui/icons-material/Person';
import { trashService } from '../../services';
import { useAuth } from '../../context/AuthContext';

function AdminTrash() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [trashData, setTrashData] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const isAdmin = user?.role === 'admin';

  const loadTrash = async () => {
    try {
      setLoading(true);
      const result = await trashService.getTrash();
      if (result.success) {
        setTrashData(result);
      }
    } catch (err) {
      console.error('Load trash error:', err);
      setError('휴지통 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (type, id, name) => {
    try {
      const result = await trashService.restore(type, id);
      if (result.success) {
        setSuccess(`"${name}" 복원 완료`);
        loadTrash();
      }
    } catch (err) {
      console.error('Restore error:', err);
      setError(err.response?.data?.message || '복원 실패');
    }
  };

  const handlePermanentDelete = async () => {
    if (!itemToDelete) return;
    try {
      const result = await trashService.permanentDelete(itemToDelete.type, itemToDelete.id);
      if (result.success) {
        setSuccess('영구 삭제 완료');
        loadTrash();
      }
    } catch (err) {
      console.error('Permanent delete error:', err);
      setError(err.response?.data?.message || '삭제 실패');
    } finally {
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      const result = await trashService.emptyTrash();
      if (result.success) {
        setSuccess(result.message);
        loadTrash();
      }
    } catch (err) {
      console.error('Empty trash error:', err);
      setError(err.response?.data?.message || '휴지통 비우기 실패');
    } finally {
      setEmptyConfirmOpen(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysRemaining = (expiresAt) => {
    const days = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const renderTable = (items, type, nameField = 'name') => {
    if (!items || items.length === 0) {
      return (
        <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
          삭제된 항목이 없습니다
        </Typography>
      );
    }

    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell width={50}>#</TableCell>
              <TableCell>이름</TableCell>
              {type !== 'user' && <TableCell>생성자</TableCell>}
              {type === 'user' && <TableCell>역할</TableCell>}
              <TableCell>삭제일</TableCell>
              <TableCell>남은 기간</TableCell>
              <TableCell width={120} align="center">작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, index) => {
              const daysRemaining = getDaysRemaining(item.expires_at);
              const name = item[nameField] || item.product_name || item.username || '(이름 없음)';
              return (
                <TableRow key={item.id} hover>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {name}
                    </Typography>
                  </TableCell>
                  {type !== 'user' && (
                    <TableCell>
                      {item.creator?.name || item.campaign?.creator?.name || '-'}
                    </TableCell>
                  )}
                  {type === 'user' && (
                    <TableCell>
                      <Chip
                        label={item.role}
                        size="small"
                        color={
                          item.role === 'admin' ? 'error' :
                          item.role === 'sales' ? 'primary' :
                          item.role === 'operator' ? 'success' : 'default'
                        }
                      />
                    </TableCell>
                  )}
                  <TableCell>{formatDate(item.deleted_at)}</TableCell>
                  <TableCell>
                    <Chip
                      label={`${daysRemaining}일`}
                      size="small"
                      color={daysRemaining <= 7 ? 'error' : daysRemaining <= 14 ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="복원">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleRestore(type, item.id, name)}
                      >
                        <RestoreIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isAdmin && (
                      <Tooltip title="영구 삭제">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setItemToDelete({ type, id: item.id, name });
                            setDeleteConfirmOpen(true);
                          }}
                        >
                          <DeleteForeverIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const tabData = [
    { label: '연월브랜드', icon: <FolderIcon />, count: trashData?.counts?.monthlyBrands || 0 },
    { label: '캠페인', icon: <CampaignIcon />, count: trashData?.counts?.campaigns || 0 },
    { label: '품목', icon: <InventoryIcon />, count: trashData?.counts?.items || 0 },
  ];

  if (isAdmin) {
    tabData.push({ label: '사용자', icon: <PersonIcon />, count: trashData?.counts?.users || 0 });
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          🗑️ 휴지통
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={`총 ${trashData?.counts?.total || 0}개`}
            color="default"
          />
          {isAdmin && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={() => setEmptyConfirmOpen(true)}
              disabled={!trashData?.counts?.total}
            >
              30일 지난 항목 비우기
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        삭제된 항목은 30일 후 자동으로 영구 삭제됩니다. 복원하면 하위 항목(캠페인, 품목, 구매자 등)도 함께 복원됩니다.
      </Alert>

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={(e, newValue) => setTabIndex(newValue)}
          variant="fullWidth"
        >
          {tabData.map((tab, idx) => (
            <Tab
              key={idx}
              icon={tab.icon}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {tab.label}
                  {tab.count > 0 && (
                    <Chip label={tab.count} size="small" color="error" sx={{ height: 20 }} />
                  )}
                </Box>
              }
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>

      <Paper>
        {tabIndex === 0 && renderTable(trashData?.data?.monthlyBrands, 'monthlyBrand')}
        {tabIndex === 1 && renderTable(trashData?.data?.campaigns, 'campaign')}
        {tabIndex === 2 && renderTable(trashData?.data?.items, 'item', 'product_name')}
        {tabIndex === 3 && isAdmin && renderTable(trashData?.data?.users, 'user', 'username')}
      </Paper>

      {/* 영구 삭제 확인 다이얼로그 */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>⚠️ 영구 삭제 확인</DialogTitle>
        <DialogContent>
          <Typography>
            "{itemToDelete?.name}"을(를) 영구 삭제하시겠습니까?
          </Typography>
          <Typography color="error" sx={{ mt: 1 }}>
            이 작업은 되돌릴 수 없으며, 모든 하위 데이터도 함께 삭제됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>취소</Button>
          <Button onClick={handlePermanentDelete} color="error" variant="contained">
            영구 삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 휴지통 비우기 확인 다이얼로그 */}
      <Dialog open={emptyConfirmOpen} onClose={() => setEmptyConfirmOpen(false)}>
        <DialogTitle>⚠️ 휴지통 비우기</DialogTitle>
        <DialogContent>
          <Typography>
            30일이 지난 모든 항목을 영구 삭제하시겠습니까?
          </Typography>
          <Typography color="error" sx={{ mt: 1 }}>
            이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmptyConfirmOpen(false)}>취소</Button>
          <Button onClick={handleEmptyTrash} color="error" variant="contained">
            비우기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminTrash;
