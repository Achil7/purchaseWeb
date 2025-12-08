import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Button, Breadcrumbs, Link, CircularProgress, Alert
} from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { itemService, campaignService } from '../../services';

function BrandItemTable() {
  const { campaignId } = useParams();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 캠페인 정보와 품목 목록 동시 조회
      const [campaignRes, itemsRes] = await Promise.all([
        campaignService.getCampaign(campaignId),
        itemService.getItemsByCampaign(campaignId)
      ]);

      setCampaign(campaignRes.data);
      setItems(itemsRes.data || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 상태에 따른 Chip 색상
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'default';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return '진행 중';
      case 'completed': return '완료';
      case 'cancelled': return '취소';
      default: return status;
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
          <Link underline="hover" color="inherit" onClick={() => navigate('/brand')} sx={{ cursor: 'pointer' }}>
            캠페인 목록
          </Link>
          <Typography color="text.primary">{campaign?.name || '품목 목록'}</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 1 }}>
          뒤로가기
        </Button>
        <Typography variant="h5" fontWeight="bold">품목 목록</Typography>
        <Typography variant="body2" color="text.secondary">
          캠페인: {campaign?.name} | 총 {items.length}개 품목
        </Typography>
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: 3 }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#e0f2f1' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>품목명</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>키워드</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>구매자 수</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>상태</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>리뷰 현황</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length > 0 ? (
                items.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <InsertDriveFileIcon color="action" />
                        <Typography variant="body2" fontWeight="bold">
                          {item.product_name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {item.keyword || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${item.buyers?.length || 0}명`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getStatusLabel(item.status)}
                        size="small"
                        color={getStatusColor(item.status)}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        onClick={() => navigate(`/brand/campaign/${campaignId}/item/${item.id}`)}
                      >
                        보기
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: '#999' }}>
                    등록된 품목이 없습니다.
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

export default BrandItemTable;
