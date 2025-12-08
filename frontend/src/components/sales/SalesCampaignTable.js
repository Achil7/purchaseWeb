import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Button, CircularProgress, Alert, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import FolderIcon from '@mui/icons-material/Folder';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { campaignService } from '../../services';
import { useAuth } from '../../context/AuthContext';

// 캠페인 생성/수정 다이얼로그
import SalesCampaignDialog from './SalesAddCampaignDialog';

function SalesCampaignTable() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialog states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState(null);

  useEffect(() => {
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      // JWT 토큰에서 사용자 정보를 가져오므로 query 파라미터 불필요
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
      'active': 'success',
      'completed': 'default',
      'cancelled': 'error'
    };
    return colorMap[status] || 'default';
  };

  // 캠페인 추가 Dialog 열기
  const handleOpenAddDialog = () => {
    setModalMode('create');
    setSelectedCampaign(null);
    setIsModalOpen(true);
  };

  // 캠페인 수정 Dialog 열기
  const handleOpenEditDialog = (campaign, e) => {
    e.stopPropagation();
    setModalMode('edit');
    setSelectedCampaign(campaign);
    setIsModalOpen(true);
  };

  // Dialog 닫기
  const handleCloseDialog = () => {
    setIsModalOpen(false);
    setSelectedCampaign(null);
  };

  // 캠페인 저장 (추가/수정)
  const handleSaveCampaign = async (campaignData) => {
    try {
      if (modalMode === 'edit' && selectedCampaign) {
        await campaignService.updateCampaign(selectedCampaign.id, campaignData);
      } else {
        await campaignService.createCampaign(campaignData);
      }
      await loadCampaigns();
      setIsModalOpen(false);
      setSelectedCampaign(null);
    } catch (err) {
      console.error('Failed to save campaign:', err);
      const errorMessage = err.response?.data?.message || err.message || '캠페인 저장에 실패했습니다.';
      alert(`캠페인 저장 실패: ${errorMessage}`);
    }
  };

  // 삭제 Dialog 열기
  const handleOpenDeleteDialog = (campaign, e) => {
    e.stopPropagation();
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  };

  // 삭제 Dialog 닫기
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setCampaignToDelete(null);
  };

  // 캠페인 삭제
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
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">캠페인 관리</Typography>
          <Typography variant="body2" color="text.secondary">
            캠페인을 생성하고 품목을 관리하세요. (총 {campaigns.length}개)
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

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#e3f2fd' }}>
              <TableRow>
                <TableCell>브랜드명</TableCell>
                <TableCell>캠페인명</TableCell>
                <TableCell>설명</TableCell>
                <TableCell align="center">상태</TableCell>
                <TableCell align="center">시작일</TableCell>
                <TableCell align="center">종료일</TableCell>
                <TableCell align="right">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.length > 0 ? (
                campaigns.map((campaign) => (
                  <TableRow
                    key={campaign.id}
                    hover
                    onClick={() => navigate(`/sales/campaign/${campaign.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      {campaign.brand?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FolderIcon color="primary" fontSize="small" /> {campaign.name}
                      </Box>
                    </TableCell>
                    <TableCell>{campaign.description || '-'}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getStatusLabel(campaign.status)}
                        color={getStatusColor(campaign.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {campaign.start_date ? new Date(campaign.start_date).toLocaleDateString('ko-KR') : '-'}
                    </TableCell>
                    <TableCell align="center">
                      {campaign.end_date ? new Date(campaign.end_date).toLocaleDateString('ko-KR') : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        <Tooltip title="수정">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={(e) => handleOpenEditDialog(campaign, e)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="삭제">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => handleOpenDeleteDialog(campaign, e)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Button
                          variant="contained"
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/sales/campaign/${campaign.id}`);
                          }}
                        >
                          품목 관리
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3, color: '#999' }}>
                    등록된 캠페인이 없습니다. 우측 상단 버튼을 눌러 추가하세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 캠페인 추가/수정 Dialog */}
      <SalesCampaignDialog
        open={isModalOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveCampaign}
        mode={modalMode}
        initialData={selectedCampaign}
      />

      {/* 삭제 확인 Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>캠페인 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText>
            "{campaignToDelete?.name}" 캠페인을 삭제하시겠습니까?
            <br />
            삭제 시 해당 캠페인의 모든 품목도 함께 삭제됩니다.
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

export default SalesCampaignTable;
