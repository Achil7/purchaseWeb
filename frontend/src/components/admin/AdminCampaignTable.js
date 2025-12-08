import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Chip, CircularProgress, Alert } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { campaignService } from '../../services';

function AdminCampaignTable() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR');
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
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold">전체 캠페인 목록</Typography>
        <Typography variant="body2" color="text.secondary">모든 캠페인을 조회하고 입금 확인을 관리합니다.</Typography>
      </Box>
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#e8eaf6' }}>
              <TableRow>
                <TableCell>캠페인명</TableCell>
                <TableCell>브랜드</TableCell>
                <TableCell>영업사</TableCell>
                <TableCell>등록일</TableCell>
                <TableCell align="center">상태</TableCell>
                <TableCell align="right">이동</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5, color: '#999' }}>
                    등록된 캠페인이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((camp) => (
                  <TableRow
                    key={camp.id}
                    hover
                    onClick={() => navigate(`/admin/campaigns/${camp.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FolderIcon color="action" /> {camp.name}
                    </TableCell>
                    <TableCell>{camp.brand?.name || '-'}</TableCell>
                    <TableCell>{camp.creator?.name || '-'}</TableCell>
                    <TableCell>{formatDate(camp.created_at)}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getStatusLabel(camp.status)}
                        size="small"
                        color={getStatusColor(camp.status)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right"><NavigateNextIcon color="disabled" /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
}

export default AdminCampaignTable;
