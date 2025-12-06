import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Button, CircularProgress, Alert
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { campaignService } from '../../services';
import { useAuth } from '../../context/AuthContext';

function BrandCampaignTable() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        <Typography variant="h5" fontWeight="bold">내 캠페인 목록</Typography>
        <Typography variant="body2" color="text.secondary">
          참여 중인 캠페인의 리뷰어 정보를 조회할 수 있습니다. (총 {campaigns.length}개)
        </Typography>
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table hover>
            <TableHead sx={{ bgcolor: '#fff3e0' }}>
              <TableRow>
                <TableCell>캠페인명</TableCell>
                <TableCell>설명</TableCell>
                <TableCell align="center">상태</TableCell>
                <TableCell align="center">시작일</TableCell>
                <TableCell align="center">종료일</TableCell>
                <TableCell align="right">리뷰어 조회</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.length > 0 ? (
                campaigns.map((campaign) => (
                  <TableRow
                    key={campaign.id}
                    hover
                    onClick={() => navigate(`/brand/campaign/${campaign.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FolderIcon color="warning" /> {campaign.name}
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
                      <Button variant="outlined" size="small" color="warning">
                        품목 보기
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: '#999' }}>
                    참여 중인 캠페인이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
}

export default BrandCampaignTable;