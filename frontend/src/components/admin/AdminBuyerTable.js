import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, CircularProgress, Alert, Dialog, DialogContent, DialogTitle, DialogActions,
  IconButton, Switch, TextField
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { buyerService, itemService, itemSlotService } from '../../services';
import OperatorAddBuyerDialog from '../operator/OperatorAddBuyerDialog';

function AdminBuyerTable() {
  const { campaignId, itemId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dayGroup = searchParams.get('dayGroup'); // 일차별 필터링 파라미터

  const [buyers, setBuyers] = useState([]);
  const [slots, setSlots] = useState([]); // 슬롯 데이터 (day_group 필터용)
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 이미지 확대 다이얼로그 state
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  // 입금확인 처리 중 상태
  const [processingPayment, setProcessingPayment] = useState({});

  // 구매자 추가/수정 다이얼로그 상태
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, dayGroup]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 품목 정보, 구매자, 슬롯 동시 조회
      const [itemRes, buyersRes, slotsRes] = await Promise.all([
        itemService.getItem(itemId),
        buyerService.getBuyersByItem(itemId),
        itemSlotService.getSlotsByItem(itemId)
      ]);

      setItem(itemRes.data);
      setBuyers(buyersRes.data || []);
      setSlots(slotsRes.data || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('데이터를 불러오는데 실패했습니다.');
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

  // dayGroup 필터링된 구매자 목록
  const filteredBuyers = useMemo(() => {
    if (!dayGroup) {
      // dayGroup이 없으면 전체 구매자 표시
      return buyers;
    }

    // 해당 day_group의 슬롯에서 buyer_id 목록 추출
    const dayGroupNum = parseInt(dayGroup, 10);
    const slotBuyerIds = slots
      .filter(slot => slot.day_group === dayGroupNum && slot.buyer_id)
      .map(slot => slot.buyer_id);

    // 해당 buyer_id만 필터링
    return buyers.filter(buyer => slotBuyerIds.includes(buyer.id));
  }, [buyers, slots, dayGroup]);

  const handleImageClick = (image) => {
    setSelectedImage(image);
    setImageDialogOpen(true);
  };

  const handleCloseImageDialog = () => {
    setImageDialogOpen(false);
    setSelectedImage(null);
  };

  // 구매자 추가 다이얼로그 열기
  const handleOpenAdd = () => {
    setEditingBuyer(null);
    setAddDialogOpen(true);
  };

  // 구매자 수정 다이얼로그 열기
  const handleOpenEdit = (buyer) => {
    setEditingBuyer(buyer);
    setAddDialogOpen(true);
  };

  // 단일 구매자 저장
  const handleSaveBuyer = async (formData) => {
    try {
      if (editingBuyer) {
        await buyerService.updateBuyer(editingBuyer.id, formData);
      } else {
        await buyerService.createBuyer(itemId, formData);
      }
      await loadBuyers();
      setAddDialogOpen(false);
    } catch (err) {
      console.error('Failed to save buyer:', err);
      alert('구매자 정보 저장에 실패했습니다.');
    }
  };

  // 다중 구매자 일괄 저장
  const handleSaveBuyersBulk = async (buyersData) => {
    try {
      const response = await buyerService.createBuyersBulk(itemId, buyersData);
      await loadBuyers();
      setAddDialogOpen(false);
      alert(`${response.count}명의 구매자가 추가되었습니다.`);
    } catch (err) {
      console.error('Failed to save buyers bulk:', err);
      alert('구매자 일괄 추가에 실패했습니다.');
    }
  };

  // 구매자 삭제
  const handleDelete = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        await buyerService.deleteBuyer(id);
        await loadBuyers();
      } catch (err) {
        console.error('Failed to delete buyer:', err);
        alert('구매자 삭제에 실패했습니다.');
      }
    }
  };

  // 입금확인 토글 핸들러 (로컬 상태만 업데이트하여 스크롤 위치 유지)
  const handlePaymentToggle = async (buyerId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    setProcessingPayment(prev => ({ ...prev, [buyerId]: true }));

    try {
      await buyerService.confirmPayment(buyerId, newStatus);
      // 로컬 상태만 업데이트 (전체 새로고침 X - 스크롤 위치 유지)
      setBuyers(prev => prev.map(buyer =>
        buyer.id === buyerId
          ? { ...buyer, payment_status: newStatus }
          : buyer
      ));
    } catch (err) {
      console.error('Failed to update payment status:', err);
      alert('입금 상태 변경에 실패했습니다.');
    } finally {
      setProcessingPayment(prev => ({ ...prev, [buyerId]: false }));
    }
  };

  // 정상 구매자만 금액 합계 (필터링된 목록 기준)
  const totalAmount = filteredBuyers
    .filter(b => !b.is_temporary)
    .reduce((acc, curr) => {
      const value = curr.amount ? parseInt(curr.amount.toString().replace(/,/g, ''), 10) : 0;
      return acc + (isNaN(value) ? 0 : value);
    }, 0);

  // 입금완료 금액 합계 (필터링된 목록 기준)
  const completedAmount = filteredBuyers
    .filter(b => b.payment_status === 'completed' && !b.is_temporary)
    .reduce((acc, curr) => {
      const value = curr.amount ? parseInt(curr.amount.toString().replace(/,/g, ''), 10) : 0;
      return acc + (isNaN(value) ? 0 : value);
    }, 0);

  // 임시 구매자(선 업로드) 수 (필터링된 목록 기준)
  const tempBuyerCount = filteredBuyers.filter(b => b.is_temporary).length;

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
    { id: 'image', label: '리뷰샷', width: 150 },
    { id: 'action', label: '관리', width: 140 },
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
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
           <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
             <Button startIcon={<ArrowBackIcon/>} onClick={() => navigate(-1)} size="small">뒤로</Button>
             <Typography variant="h5" fontWeight="bold">구매자 리뷰 리스트 (입금관리)</Typography>
           </Box>
           <Typography variant="body2" color="text.secondary">
             제품: {item?.product_name || itemId} | 총 {filteredBuyers.filter(b => !b.is_temporary).length}명
             {dayGroup && buyers.length !== filteredBuyers.length && (
               <Typography component="span" variant="caption" sx={{ ml: 1, color: '#666' }}>
                 (전체 {buyers.filter(b => !b.is_temporary).length}명 중)
               </Typography>
             )}
             {tempBuyerCount > 0 && (
               <Chip
                 label={`선 업로드 ${tempBuyerCount}건`}
                 color="warning"
                 size="small"
                 sx={{ ml: 1 }}
                 icon={<HourglassEmptyIcon />}
               />
             )}
           </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" color="text.secondary">
              입금완료: <strong style={{ color: '#2e7d32' }}>{completedAmount.toLocaleString()}원</strong> / {totalAmount.toLocaleString()}원
            </Typography>
          </Box>
          {item?.upload_link_token && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<ContentCopyIcon />}
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/upload/${item.upload_link_token}`);
                alert('이미지 업로드 링크가 클립보드에 복사되었습니다!');
              }}
              sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}
            >
              업로드 링크 복사
            </Button>
          )}
          <Button
            variant="contained"
            color="success"
            startIcon={<AddCircleIcon />}
            onClick={handleOpenAdd}
            sx={{ px: 3, py: 1.5, fontWeight: 'bold' }}
          >
            구매자 추가
          </Button>
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
                    align={col.id === 'image' || col.id === 'deposit' || col.id === 'action' ? 'center' : 'left'}
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
              {filteredBuyers.length > 0 ? (
                filteredBuyers.map((buyer) => (
                  <TableRow
                    key={buyer.id}
                    hover
                    sx={{
                      bgcolor: buyer.is_temporary ? '#fff8e1' : 'inherit',
                      '&:last-child td, &:last-child th': { border: 0 }
                    }}
                  >
                    {buyer.is_temporary ? (
                      // 임시 Buyer: 선 업로드 케이스
                      <>
                        <TableCell colSpan={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label="선 업로드"
                              color="warning"
                              size="small"
                              icon={<HourglassEmptyIcon />}
                            />
                            <Typography variant="body2" color="text.secondary">
                              구매자 정보 대기 중
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'keep-all' }}>
                          {buyer.account_info || '-'}
                        </TableCell>
                        <TableCell sx={{ color: '#999' }}>-</TableCell>
                        <TableCell sx={{ color: '#999' }}>-</TableCell>
                        <TableCell align="center">
                          <Chip label="대기" size="small" variant="outlined" sx={{ color: '#999', borderColor: '#ddd' }} />
                        </TableCell>
                        <TableCell align="center">
                          {buyer.images && buyer.images.length > 0 ? (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                              {buyer.images.map((img) => (
                                <Box
                                  key={img.id}
                                  onClick={() => handleImageClick(img)}
                                  sx={{ cursor: 'pointer', display: 'inline-block' }}
                                >
                                  <Box
                                    component="img"
                                    src={img.s3_url}
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
                              ))}
                            </Box>
                          ) : <Typography variant="caption" color="text.disabled">-</Typography>}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(buyer.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </>
                    ) : (
                      // 정상 Buyer
                      <>
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

                        {/* 이미지 - 구매자당 1개만 표시 (1:1 매칭) */}
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

                        {/* 관리 버튼 */}
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenEdit(buyer)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(buyer.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 6, color: '#999' }}>
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

      {/* 구매자 추가/수정 다이얼로그 */}
      <OperatorAddBuyerDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSave={handleSaveBuyer}
        onSaveBulk={handleSaveBuyersBulk}
        editData={editingBuyer}
      />
    </>
  );
}

export default AdminBuyerTable;
