import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Breadcrumbs, Link, CircularProgress, Alert,
  Grid, Chip, Divider, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogContent, IconButton
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InventoryIcon from '@mui/icons-material/Inventory';
import CloseIcon from '@mui/icons-material/Close';
import { itemService, buyerService } from '../../services';

function SalesItemDetail() {
  const { campaignId, itemId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 구매자 관련 state
  const [buyers, setBuyers] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  useEffect(() => {
    loadItemDetail();
    loadBuyers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const loadItemDetail = async () => {
    try {
      setLoading(true);
      const response = await itemService.getItem(itemId);
      setItem(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load item:', err);
      setError('제품 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadBuyers = async () => {
    try {
      const response = await buyerService.getBuyersByItem(itemId);
      setBuyers(response.data || []);
    } catch (err) {
      console.error('Failed to load buyers:', err);
    }
  };

  // 금액 합산 계산
  const totalAmount = buyers.reduce((acc, curr) => {
    const value = curr.amount ? parseFloat(curr.amount) : 0;
    return acc + (isNaN(value) ? 0 : value);
  }, 0);

  const handleImageClick = (image) => {
    setSelectedImage(image);
    setImageDialogOpen(true);
  };

  const handleCloseImageDialog = () => {
    setImageDialogOpen(false);
    setSelectedImage(null);
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

  const getPaymentStatusLabel = (status) => {
    return status === 'completed' ? '입금완료' : '입금대기';
  };

  const getPaymentStatusColor = (status) => {
    return status === 'completed' ? 'success' : 'warning';
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

  if (!item) {
    return (
      <Box sx={{ mb: 4 }}>
        <Alert severity="warning">제품을 찾을 수 없습니다.</Alert>
      </Box>
    );
  }

  return (
    <>
      {/* Breadcrumb */}
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          <Link underline="hover" color="inherit" onClick={() => navigate('/sales')} sx={{ cursor: 'pointer' }}>
            캠페인 목록
          </Link>
          <Link underline="hover" color="inherit" onClick={() => navigate(`/sales/campaign/${campaignId}`)} sx={{ cursor: 'pointer' }}>
            제품 관리
          </Link>
          <Typography color="text.primary">{item.product_name}</Typography>
        </Breadcrumbs>
      </Box>

      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <InventoryIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">{item.product_name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {item.description || '설명 없음'}
            </Typography>
          </Box>
          <Chip
            label={getStatusLabel(item.status)}
            color={getStatusColor(item.status)}
            size="small"
          />
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/sales/campaign/${campaignId}`)}
        >
          목록으로
        </Button>
      </Box>

      {/* 제품 정보 */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>제품 정보</Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Typography color="text.secondary" sx={{ minWidth: 120 }}>출고 타입:</Typography>
              <Chip label={item.shipping_type || '-'} size="small" variant="outlined" />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Typography color="text.secondary" sx={{ minWidth: 120 }}>제품 가격:</Typography>
              <Typography fontWeight="bold">
                {item.product_price ? `${Number(item.product_price).toLocaleString()}원` : '-'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Typography color="text.secondary" sx={{ minWidth: 120 }}>출고 마감:</Typography>
              <Typography>{item.shipping_deadline || '-'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Typography color="text.secondary" sx={{ minWidth: 120 }}>구매 옵션:</Typography>
              <Typography>{item.purchase_option || '-'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Typography color="text.secondary" sx={{ minWidth: 120 }}>택배대행:</Typography>
              <Typography>{item.courier_service_yn || '-'}</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Typography color="text.secondary" sx={{ minWidth: 120 }}>희망 키워드:</Typography>
              <Typography>{item.keyword || '-'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Typography color="text.secondary" sx={{ minWidth: 120 }}>총 구매 건수:</Typography>
              <Typography fontWeight="bold">{item.total_purchase_count || 0}건</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Typography color="text.secondary" sx={{ minWidth: 120 }}>일 구매 건수:</Typography>
              <Typography>{item.daily_purchase_count || 0}건</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Typography color="text.secondary" sx={{ minWidth: 120 }}>상품 URL:</Typography>
              {item.product_url ? (
                <Link href={item.product_url} target="_blank" rel="noopener noreferrer">
                  제품 url
                </Link>
              ) : (
                <Typography>-</Typography>
              )}
            </Box>
          </Grid>
          {item.review_guide && (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Typography color="text.secondary" sx={{ minWidth: 120 }}>리뷰 가이드:</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.review_guide}</Typography>
              </Box>
            </Grid>
          )}
          {item.notes && (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Typography color="text.secondary" sx={{ minWidth: 120 }}>비고:</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.notes}</Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* 이미지 확대 Dialog */}
      <Dialog
        open={imageDialogOpen}
        onClose={handleCloseImageDialog}
        maxWidth="lg"
      >
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <IconButton
            onClick={handleCloseImageDialog}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: 'white',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
            }}
          >
            <CloseIcon />
          </IconButton>
          {selectedImage && (
            <Box>
              <Box
                component="img"
                src={selectedImage.s3_url}
                alt={selectedImage.file_name}
                sx={{
                  maxWidth: '95vw',
                  maxHeight: '90vh',
                  objectFit: 'contain'
                }}
              />
              {selectedImage.order_number && (
                <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                  <Typography variant="body2">
                    <strong>주문번호:</strong> {selectedImage.order_number}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* 구매자 목록 */}
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            구매자 목록 ({buyers.length}명)
          </Typography>
          <Typography variant="h6" color="success.main" fontWeight="bold">
            총 금액: {totalAmount.toLocaleString()}원
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />

        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>주문번호</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>구매자명</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>수령인</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>금액</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>입금상태</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>리뷰샷</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {buyers.length > 0 ? (
                buyers.map((buyer) => (
                  <TableRow key={buyer.id} hover>
                    <TableCell>{buyer.order_number}</TableCell>
                    <TableCell>{buyer.buyer_name}</TableCell>
                    <TableCell>{buyer.recipient_name}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1b5e20' }}>
                      {buyer.amount ? `${Number(buyer.amount).toLocaleString()}원` : '-'}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getPaymentStatusLabel(buyer.payment_status)}
                        color={getPaymentStatusColor(buyer.payment_status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {buyer.images && buyer.images.length > 0 ? (
                        <Box
                          onClick={() => handleImageClick(buyer.images[0])}
                          sx={{ cursor: 'pointer', display: 'inline-block' }}
                        >
                          <Box
                            component="img"
                            src={buyer.images[0].s3_url}
                            alt="리뷰이미지"
                            sx={{
                              width: 40,
                              height: 40,
                              objectFit: 'cover',
                              borderRadius: 1,
                              border: '1px solid #eee'
                            }}
                          />
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.disabled">-</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: '#999' }}>
                    등록된 구매자가 없습니다.
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

export default SalesItemDetail;
