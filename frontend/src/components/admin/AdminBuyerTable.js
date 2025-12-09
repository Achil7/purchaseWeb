import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Link, Breadcrumbs, Chip, CircularProgress, Alert, Dialog, DialogContent, IconButton, Switch
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { buyerService, itemService } from '../../services';

function AdminBuyerTable() {
  const { campaignId, itemId } = useParams();
  const navigate = useNavigate();

  const [buyers, setBuyers] = useState([]);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 이미지 확대 다이얼로그 state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  // 입금확인 처리 중 상태
  const [processingPayment, setProcessingPayment] = useState({});

  useEffect(() => {
    loadItem();
    loadBuyers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const loadItem = async () => {
    try {
      const response = await itemService.getItem(itemId);
      setItem(response.data);
    } catch (err) {
      console.error('Failed to load item:', err);
    }
  };

  const loadBuyers = async () => {
    try {
      setLoading(true);
      const response = await buyerService.getBuyersByItem(itemId);
      setBuyers(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load buyers:', err);
      setError('구매자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (image) => {
    setSelectedImage(image);
    setImageDialogOpen(true);
  };

  const handleCloseImageDialog = () => {
    setImageDialogOpen(false);
    setSelectedImage(null);
  };

  // 입금확인 토글 핸들러
  const handlePaymentToggle = async (buyerId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    setProcessingPayment(prev => ({ ...prev, [buyerId]: true }));

    try {
      await buyerService.confirmPayment(buyerId, newStatus);
      // 목록 새로고침
      await loadBuyers();
    } catch (err) {
      console.error('Failed to update payment status:', err);
      alert('입금 상태 변경에 실패했습니다.');
    } finally {
      setProcessingPayment(prev => ({ ...prev, [buyerId]: false }));
    }
  };

  const totalAmount = buyers.reduce((acc, curr) => {
    const value = curr.amount ? parseInt(curr.amount.toString().replace(/,/g, ''), 10) : 0;
    return acc + (isNaN(value) ? 0 : value);
  }, 0);

  // 입금완료 금액 합계
  const completedAmount = buyers
    .filter(b => b.payment_status === 'completed')
    .reduce((acc, curr) => {
      const value = curr.amount ? parseInt(curr.amount.toString().replace(/,/g, ''), 10) : 0;
      return acc + (isNaN(value) ? 0 : value);
    }, 0);

  const columns = [
    { id: 'orderNum', label: '주문번호', width: 120 },
    { id: 'buyer', label: '구매자', width: 80 },
    { id: 'recipient', label: '수취인', width: 80 },
    { id: 'userId', label: '아이디', width: 100 },
    { id: 'contact', label: '연락처', width: 130 },
    { id: 'address', label: '주소', width: 300 },
    { id: 'bankAccount', label: '계좌정보', width: 250 },
    { id: 'amount', label: '금액', width: 100 },
    { id: 'deposit', label: '입금확인', width: 120 },
    { id: 'image', label: '리뷰샷', width: 80 },
  ];

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
          <Link underline="hover" color="inherit" onClick={() => navigate('/admin/campaigns')} sx={{ cursor: 'pointer' }}>
            캠페인 목록
          </Link>
          <Link underline="hover" color="inherit" onClick={() => navigate(`/admin/campaigns/${campaignId}`)} sx={{ cursor: 'pointer' }}>
            품목 목록
          </Link>
          <Typography color="text.primary">구매자 관리</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
           <Button startIcon={<ArrowBackIcon/>} onClick={() => navigate(-1)} sx={{ mb:1 }}>뒤로가기</Button>
           <Typography variant="h5" fontWeight="bold">구매자 리뷰 리스트 (입금관리)</Typography>
           <Typography variant="body2" color="text.secondary">
             품목: {item?.product_name || itemId} | 총 {buyers.length}명
           </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" color="text.secondary">
            입금완료: <strong style={{ color: '#2e7d32' }}>{completedAmount.toLocaleString()}원</strong> / {totalAmount.toLocaleString()}원
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 3 }}>
        <TableContainer sx={{ maxHeight: '75vh' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1400 }}>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.id === 'image' || col.id === 'deposit' ? 'center' : 'left'}
                    sx={{
                        fontWeight: 'bold',
                        bgcolor: '#e8eaf6',
                        whiteSpace: 'nowrap',
                        minWidth: col.width,
                        verticalAlign: 'bottom'
                    }}
                  >
                    {col.id === 'amount' ? (
                        <Box sx={{ lineHeight: 1 }}>
                            <Typography variant="subtitle2" display="block" color="success.main" fontWeight="bold" sx={{ mb: 0.5 }}>
                                Total: {totalAmount.toLocaleString()}
                            </Typography>
                            {col.label}
                        </Box>
                    ) : (
                        col.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {buyers.length > 0 ? (
                buyers.map((buyer) => (
                  <TableRow key={buyer.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.order_number}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.buyer_name}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.recipient_name}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.user_id}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.contact}</TableCell>
                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'keep-all', minWidth: 300, lineHeight: 1.5 }}>
                        {buyer.address}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'keep-all', minWidth: 250, lineHeight: 1.5 }}>
                        {buyer.account_info}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1b5e20' }}>
                        {buyer.amount ? buyer.amount.toLocaleString() : '0'}
                    </TableCell>

                    {/* 입금확인 토글 (Admin 전용) */}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Switch
                          checked={buyer.payment_status === 'completed'}
                          onChange={() => handlePaymentToggle(buyer.id, buyer.payment_status)}
                          disabled={processingPayment[buyer.id]}
                          color="primary"
                          size="small"
                        />
                        {buyer.payment_status === 'completed' ? (
                            <Chip label="완료" color="primary" size="small" sx={{ fontWeight: 'bold', minWidth: 50 }} />
                        ) : (
                            <Chip label="대기" size="small" variant="outlined" sx={{ color: '#999', borderColor: '#ddd', minWidth: 50 }} />
                        )}
                      </Box>
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
                        ) : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6, color: '#999' }}>
                    등록된 데이터가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
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
    </>
  );
}

export default AdminBuyerTable;
