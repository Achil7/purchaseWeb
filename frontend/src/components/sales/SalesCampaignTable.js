import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Button, CircularProgress, Alert
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import FolderIcon from '@mui/icons-material/Folder';
import { campaignService } from '../../services';
import { useAuth } from '../../context/AuthContext';

// 캠페인 생성 다이얼로그
import SalesAddCampaignDialog from './SalesAddCampaignDialog';

function SalesCampaignTable() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleOpenAddDialog = () => {
    setIsModalOpen(true);
  };

  const handleCloseDialog = () => {
    setIsModalOpen(false);
  };

  const handleSaveCampaign = async (campaignData) => {
    try {
      await campaignService.createCampaign(campaignData);
      await loadCampaigns();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to create campaign:', err);
      const errorMessage = err.response?.data?.message || err.message || '캠페인 생성에 실패했습니다.';
      alert(`캠페인 생성 실패: ${errorMessage}`);
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
          <Table hover>
            <TableHead sx={{ bgcolor: '#e3f2fd' }}>
              <TableRow>
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
                    <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FolderIcon color="primary" /> {campaign.name}
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
                      <Button variant="contained" size="small" color="primary">
                        품목 관리
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: '#999' }}>
                    등록된 캠페인이 없습니다. 우측 상단 버튼을 눌러 추가하세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <SalesAddCampaignDialog
        open={isModalOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveCampaign}
      />
    </>
  );
}

export default SalesCampaignTable;
