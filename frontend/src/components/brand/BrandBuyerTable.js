import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Link, Breadcrumbs, Dialog, DialogContent, IconButton, CircularProgress, Alert
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { Button } from '@mui/material';
import { buyerService, itemService } from '../../services';

function BrandBuyerTable() {
  const { campaignId, itemId } = useParams();
  const navigate = useNavigate();

  const [buyers, setBuyers] = useState([]);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 이미지 확대 다이얼로그 state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

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

  // 브랜드사는 제한된 컬럼만 조회 가능
  // 주문번호, 구매자, 수취인, 아이디, 리뷰샷만 표시
  const columns = [
    { id: 'orderNum', label: '주문번호', width: 150 },
    { id: 'buyer', label: '구매자', width: 100 },
    { id: 'recipient', label: '수취인', width: 100 },
    { id: 'userId', label: '아이디', width: 200 },
    { id: 'image', label: '리뷰샷', width: 100 },
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
          <Link underline="hover" color="inherit" onClick={() => navigate('/brand')} sx={{ cursor: 'pointer' }}>
            캠페인 목록
          </Link>
          <Link underline="hover" color="inherit" onClick={() => navigate(`/brand/campaign/${campaignId}`)} sx={{ cursor: 'pointer' }}>
            품목 목록
          </Link>
          <Typography color="text.primary">리뷰 현황</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon/>} onClick={() => navigate(-1)} sx={{ mb:1 }}>뒤로가기</Button>
        <Typography variant="h5" fontWeight="bold">구매자 리뷰 현황</Typography>
        <Typography variant="body2" color="text.secondary">
          품목: {item?.product_name || itemId} | 총 {buyers.length}명
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 3 }}>
        <TableContainer sx={{ maxHeight: '75vh' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.id === 'image' ? 'center' : 'left'}
                    sx={{
                        fontWeight: 'bold',
                        bgcolor: '#fff8e1',
                        whiteSpace: 'nowrap',
                        minWidth: col.width
                    }}
                  >
                    {col.label}
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
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: '#999' }}>
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

export default BrandBuyerTable;
