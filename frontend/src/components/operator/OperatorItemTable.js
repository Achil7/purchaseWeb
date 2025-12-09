import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Chip, Button, Breadcrumbs, Link, CircularProgress, Alert } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { itemService } from '../../services';

function OperatorItemTable() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await itemService.getItemsByCampaign(campaignId);
      // 등록시간(registered_at) 순으로 정렬 (최신순)
      const sortedItems = (response.data || []).sort((a, b) => {
        const dateA = new Date(a.registered_at || a.created_at);
        const dateB = new Date(b.registered_at || b.created_at);
        return dateB - dateA; // 최신순
      });
      setItems(sortedItems);
      setError(null);
    } catch (err) {
      console.error('Failed to load items:', err);
      setError('품목 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

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
          <Link underline="hover" color="inherit" onClick={() => navigate('/operator')} sx={{ cursor: 'pointer' }}>
            캠페인 목록
          </Link>
          <Typography color="text.primary">캠페인 상세 (ID: {campaignId})</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold">품목 선택</Typography>
        <Typography variant="body2" color="text.secondary">작업할 품목을 선택하여 리뷰를 관리하세요.</Typography>
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table hover>
            <TableHead sx={{ bgcolor: '#e0f2f1' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>등록시간</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>품목명</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>상태</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>작업하기</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length > 0 ? (
                items.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    onClick={() => navigate(`/operator/campaign/${campaignId}/item/${item.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', color: '#666' }}>
                      {formatDateTime(item.registered_at || item.created_at)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <InsertDriveFileIcon color="action" /> {item.product_name}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getStatusLabel(item.status)}
                        color={getStatusColor(item.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button variant="contained" size="small" color="primary">
                        선택
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3, color: '#999' }}>
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

export default OperatorItemTable;