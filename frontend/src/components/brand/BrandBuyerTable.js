import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Link, Breadcrumbs, Chip, Divider, Dialog, DialogContent, IconButton
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ImageIcon from '@mui/icons-material/Image';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { imageService } from '../../services';

const initialBuyers = [
  { 
    id: 1001, itemId: 101, 
    orderNum: '20230607-001', 
    buyer: '홍길동', 
    recipient: '홍길동', 
    userId: 'hong123', 
    contact: '010-1234-5678', 
    address: '서울 강남구 테헤란로 123, 역삼동 멀티캠퍼스 10층 1004호', 
    bankAccount: '국민은행 123-45-67890 홍길동', 
    amount: '50,000', 
    isDepositConfirmed: true, 
    reviewImage: 'sample.jpg' 
  },
];

function BrandBuyerTable() {
  const { campaignId, itemId } = useParams();
  const navigate = useNavigate();

  const [buyers, setBuyers] = useState(initialBuyers);

  // 이미지 관련 state
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  useEffect(() => {
    loadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const loadImages = async () => {
    try {
      const response = await imageService.getImagesByItem(itemId);
      setImages(response.data || []);
    } catch (err) {
      console.error('Failed to load images:', err);
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

  const filteredBuyers = buyers.filter(b => b.itemId === parseInt(itemId));

  // 다이얼로그 열기 (추가 모드) - 현재 다이얼로그 미구현
  const handleOpenAdd = () => {
    alert('구매자 추가 다이얼로그는 준비 중입니다.');
  };

  // 다이얼로그 열기 (수정 모드) - 현재 다이얼로그 미구현
  const handleOpenEdit = () => {
    alert('구매자 수정 다이얼로그는 준비 중입니다.');
  };

  const handleDelete = (id) => {
      if(window.confirm("정말 삭제하시겠습니까?")) {
          setBuyers(prev => prev.filter(b => b.id !== id));
      }
  };

  const totalAmount = filteredBuyers.reduce((acc, curr) => {
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
    { id: 'deposit', label: '입금확인', width: 90 },
    { id: 'image', label: '리뷰샷', width: 80 },
    { id: 'action', label: '관리', width: 140 }, // [수정] 버튼 2개가 들어가야 하므로 너비 확보
  ];

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
          <Typography color="text.primary">리뷰 관리</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
           <Button startIcon={<ArrowBackIcon/>} onClick={() => navigate(-1)} sx={{ mb:1 }}>뒤로가기</Button>
           <Typography variant="h5" fontWeight="bold">구매자 리뷰 리스트</Typography>
           <Typography variant="body2" color="text.secondary">
             Item ID: {itemId} | 총 {filteredBuyers.length}명
           </Typography>
        </Box>
        <Button 
          variant="contained" 
          color="success" 
          startIcon={<AddCircleIcon />} 
          onClick={handleOpenAdd} 
          sx={{ px: 3, py: 1.5, fontWeight: 'bold' }}
        >
          구매자 추가 (붙여넣기)
        </Button>
      </Box>

      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 3 }}>
        <TableContainer sx={{ maxHeight: '75vh' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1600 }}>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell 
                    key={col.id} 
                    align={col.id === 'image' || col.id === 'action' || col.id === 'deposit' ? 'center' : 'left'}
                    sx={{ 
                        fontWeight: 'bold', 
                        bgcolor: '#fafafa', 
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
              {filteredBuyers.length > 0 ? (
                filteredBuyers.map((buyer) => (
                  <TableRow key={buyer.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.orderNum}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.buyer}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.recipient}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.userId}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.contact}</TableCell>
                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'keep-all', minWidth: 300, lineHeight: 1.5 }}>
                        {buyer.address}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'keep-all', minWidth: 250, lineHeight: 1.5 }}>
                        {buyer.bankAccount}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1b5e20' }}>
                        {buyer.amount}
                    </TableCell>

                    <TableCell align="center">
                        {buyer.isDepositConfirmed ? (
                            <Chip label="입금완료" color="primary" size="small" sx={{ fontWeight: 'bold' }} />
                        ) : (
                            <Chip label="대기중" size="small" variant="outlined" sx={{ color: '#999', borderColor: '#ddd' }} />
                        )}
                    </TableCell>
                    
                    <TableCell align="center">
                        {buyer.reviewImage ? (
                            <Link 
                                href={typeof buyer.reviewImage === 'string' ? buyer.reviewImage : URL.createObjectURL(buyer.reviewImage)} 
                                target="_blank"
                            >
                                <ImageIcon color="primary" />
                            </Link>
                        ) : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    
                    {/* [수정] 관리 컬럼: 수정 및 삭제 버튼 */}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Button 
                              size="small" 
                              variant="outlined" 
                              onClick={() => handleOpenEdit(buyer)}
                              sx={{ minWidth: 50, padding: '2px 8px' }}
                          >
                              수정
                          </Button>
                          <Button 
                              size="small" 
                              color="error" 
                              variant="outlined"
                              onClick={() => handleDelete(buyer.id)}
                              sx={{ minWidth: 50, padding: '2px 8px' }}
                          >
                              삭제
                          </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 6, color: '#999' }}>
                    등록된 데이터가 없습니다. 우측 상단 버튼을 눌러 추가하세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 업로드된 이미지 */}
      {images.length > 0 && (
        <Paper sx={{ p: 3, mt: 4, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ImageIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              업로드된 이미지 ({images.length}개)
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {images.map((image) => (
              <Box
                key={image.id}
                onClick={() => handleImageClick(image)}
                sx={{
                  width: 120,
                  cursor: 'pointer',
                  '&:hover': { opacity: 0.8 }
                }}
              >
                <Box
                  component="img"
                  src={image.s3_url}
                  alt={image.file_name}
                  sx={{
                    width: 120,
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 1,
                    border: '1px solid #eee'
                  }}
                />
                {image.order_number && (
                  <Typography variant="caption" display="block" align="center" color="text.secondary" noWrap>
                    {image.order_number}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Paper>
      )}

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
                  maxWidth: '90vw',
                  maxHeight: '80vh',
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