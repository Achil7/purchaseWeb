import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Link, Breadcrumbs, Chip, CircularProgress, Alert, Divider, Dialog, DialogContent, IconButton
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ImageIcon from '@mui/icons-material/Image';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { buyerService, imageService, itemService } from '../../services';

// 파일명: OperatorAddBuyerDialog
import OperatorAddBuyerDialog from './OperatorAddBuyerDialog';

function OperatorBuyerTable() {
  const { campaignId, itemId } = useParams();
  const navigate = useNavigate();

  const [buyers, setBuyers] = useState([]);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // [수정] 수정할 대상을 저장하는 state (null이면 추가 모드)
  const [editingBuyer, setEditingBuyer] = useState(null);

  // 이미지 관련 state
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  useEffect(() => {
    loadItem();
    loadBuyers();
    loadImages();
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

  // [수정] 다이얼로그 열기 (추가 모드)
  const handleOpenAdd = () => {
    setEditingBuyer(null); // 수정 상태 초기화
    setIsModalOpen(true);
  };

  // [수정] 다이얼로그 열기 (수정 모드)
  const handleOpenEdit = (buyer) => {
    setEditingBuyer(buyer); // 수정할 데이터 세팅
    setIsModalOpen(true);
  };

  // [수정] 저장 핸들러 (추가/수정 분기 처리)
  const handleSaveBuyer = async (formData) => {
    try {
      if (editingBuyer) {
        // [수정 로직] API 호출
        await buyerService.updateBuyer(editingBuyer.id, formData);
      } else {
        // [추가 로직] API 호출
        await buyerService.createBuyer(itemId, formData);
      }
      // 목록 다시 불러오기
      await loadBuyers();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save buyer:', err);
      alert('구매자 정보 저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("정말 삭제하시겠습니까?")) {
      try {
        await buyerService.deleteBuyer(id);
        await loadBuyers();
      } catch (err) {
        console.error('Failed to delete buyer:', err);
        alert('구매자 삭제에 실패했습니다.');
      }
    }
  };

  const totalAmount = buyers.reduce((acc, curr) => {
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
          <Link underline="hover" color="inherit" onClick={() => navigate(`/operator/campaign/${campaignId}`)} sx={{ cursor: 'pointer' }}>
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
             Item ID: {itemId} | 총 {buyers.length}명
           </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {item?.upload_link_token && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<ContentCopyIcon />}
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/upload/${item.upload_link_token}`);
                alert('이미지 업로드 링크가 클립보드에 복사되었습니다!');
              }}
              sx={{ px: 3, py: 1.5, fontWeight: 'bold' }}
            >
              이미지 업로드 링크 복사
            </Button>
          )}
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
                        {buyer.bank_account}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1b5e20' }}>
                        {buyer.amount ? buyer.amount.toLocaleString() : '0'}
                    </TableCell>

                    <TableCell align="center">
                        {buyer.payment_status === 'completed' ? (
                            <Chip label="입금완료" color="primary" size="small" sx={{ fontWeight: 'bold' }} />
                        ) : (
                            <Chip label="대기중" size="small" variant="outlined" sx={{ color: '#999', borderColor: '#ddd' }} />
                        )}
                    </TableCell>

                    <TableCell align="center">
                        {buyer.review_image_url ? (
                            <Link
                                href={buyer.review_image_url}
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

      {/* 다이얼로그 호출: editData 전달 */}
      <OperatorAddBuyerDialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveBuyer}
        editData={editingBuyer} // 수정할 데이터 (없으면 null)
      />
    </>
  );
}

export default OperatorBuyerTable;