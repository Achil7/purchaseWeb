import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Button, Breadcrumbs, Link, CircularProgress, Alert
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { itemService } from '../../services';
import SalesAddItemDialog from './SalesAddItemDialog';

function SalesItemTable() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleOpenAddDialog = () => {
    setIsModalOpen(true);
  };

  const handleCloseDialog = () => {
    setIsModalOpen(false);
  };

  const handleSaveItem = async (itemData) => {
    try {
      await itemService.createItem(campaignId, itemData);
      await loadItems();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to create item:', err);
      alert('품목 생성에 실패했습니다.');
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
          <Table hover>
            <TableHead sx={{ bgcolor: '#e0f2f1' }}>
              <TableRow>
                <TableCell>품목명</TableCell>
                <TableCell>설명</TableCell>
                <TableCell align="center">출고타입</TableCell>
                <TableCell align="center">가격</TableCell>
                <TableCell align="center">상태</TableCell>
                <TableCell align="right">이미지 업로드 링크</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length > 0 ? (
                items.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InsertDriveFileIcon color="action" /> {item.name}
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
                      {item.product_price ? `${item.product_price.toLocaleString()}원` : '-'}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getStatusLabel(item.status)}
                        color={getStatusColor(item.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {item.upload_link_token ? (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(`/upload/${item.upload_link_token}`);
                            alert('업로드 링크가 클립보드에 복사되었습니다!');
                          }}
                        >
                          링크 복사
                        </Button>
                      ) : '-'}
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

      <SalesAddItemDialog
        open={isModalOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveItem}
        campaignId={campaignId}
      />
    </>
  );
}

export default SalesItemTable;
