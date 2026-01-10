import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Link, Breadcrumbs, Chip, CircularProgress, Alert, Dialog, DialogContent, IconButton, TableSortLabel
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { buyerService, itemService } from '../../services';

import OperatorAddBuyerDialog from './OperatorAddBuyerDialog';

function OperatorBuyerTable() {
  const { campaignId, itemId } = useParams();
  const navigate = useNavigate();

  const [buyers, setBuyers] = useState([]);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  // 정렬 상태
  const [orderBy, setOrderBy] = useState('order_number');
  const [order, setOrder] = useState('asc');

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

  const handleOpenAdd = () => {
    setEditingBuyer(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (buyer) => {
    setEditingBuyer(buyer);
    setIsModalOpen(true);
  };

  // 단일 저장
  const handleSaveBuyer = async (formData) => {
    try {
      if (editingBuyer) {
        await buyerService.updateBuyer(editingBuyer.id, formData);
      } else {
        await buyerService.createBuyer(itemId, formData);
      }
      await loadBuyers();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save buyer:', err);
      alert('구매자 정보 저장에 실패했습니다.');
    }
  };

  // 다중 저장 (bulk)
  const handleSaveBuyersBulk = async (buyersData) => {
    try {
      const response = await buyerService.createBuyersBulk(itemId, buyersData);
      await loadBuyers();
      setIsModalOpen(false);
      alert(`${response.count}명의 구매자가 추가되었습니다.`);
    } catch (err) {
      console.error('Failed to save buyers bulk:', err);
      alert('구매자 일괄 추가에 실패했습니다.');
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

  // 정상 구매자만 금액 합계
  const totalAmount = buyers
    .filter(b => !b.is_temporary)
    .reduce((acc, curr) => {
      const value = curr.amount ? parseInt(curr.amount.toString().replace(/,/g, ''), 10) : 0;
      return acc + (isNaN(value) ? 0 : value);
    }, 0);

  // 임시 구매자 수
  const tempBuyerCount = buyers.filter(b => b.is_temporary).length;

  // 정렬 핸들러
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // 정렬된 구매자 목록
  const sortedBuyers = useMemo(() => {
    return [...buyers].sort((a, b) => {
      // 임시 구매자는 항상 아래로
      if (a.is_temporary && !b.is_temporary) return 1;
      if (!a.is_temporary && b.is_temporary) return -1;
      if (a.is_temporary && b.is_temporary) return 0;

      let aValue, bValue;

      switch (orderBy) {
        case 'order_number':
          aValue = a.order_number || '';
          bValue = b.order_number || '';
          break;
        case 'buyer_name':
          aValue = a.buyer_name || '';
          bValue = b.buyer_name || '';
          break;
        case 'recipient_name':
          aValue = a.recipient_name || '';
          bValue = b.recipient_name || '';
          break;
        case 'user_id':
          aValue = a.user_id || '';
          bValue = b.user_id || '';
          break;
        case 'contact':
          aValue = a.contact || '';
          bValue = b.contact || '';
          break;
        case 'address':
          aValue = a.address || '';
          bValue = b.address || '';
          break;
        case 'account_info':
          aValue = a.account_info || '';
          bValue = b.account_info || '';
          break;
        case 'amount':
          aValue = parseInt(String(a.amount || '0').replace(/,/g, ''), 10) || 0;
          bValue = parseInt(String(b.amount || '0').replace(/,/g, ''), 10) || 0;
          break;
        case 'tracking_number':
          aValue = a.tracking_number || '';
          bValue = b.tracking_number || '';
          break;
        case 'payment_status':
          aValue = a.payment_status || '';
          bValue = b.payment_status || '';
          break;
        default:
          aValue = a[orderBy] || '';
          bValue = b[orderBy] || '';
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return order === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const comparison = String(aValue).localeCompare(String(bValue), 'ko');
      return order === 'asc' ? comparison : -comparison;
    });
  }, [buyers, orderBy, order]);

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
            제품 상세
          </Link>
          <Typography color="text.primary">리뷰 관리</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 1 }}>뒤로가기</Button>
          <Typography variant="h5" fontWeight="bold">
            {item?.product_name || '구매자 리뷰 리스트'}
            {item?.deposit_name && (
              <Chip
                label={`입금명: ${item.deposit_name}`}
                color="info"
                size="small"
                sx={{ ml: 2, verticalAlign: 'middle' }}
              />
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            총 {buyers.length}명
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
          {item?.upload_link_token && (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              bgcolor: '#fff3e0',
              border: '2px solid #ff9800',
              borderRadius: 2,
              px: 2,
              py: 1
            }}>
              <Typography variant="body2" sx={{ color: '#e65100', fontWeight: 'bold' }}>
                구매자에게 이 링크를 전달하세요!
              </Typography>
              <Button
                variant="contained"
                color="warning"
                startIcon={<ContentCopyIcon />}
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/upload/${item.upload_link_token}`);
                  alert('이미지 업로드 링크가 클립보드에 복사되었습니다!');
                }}
                sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}
              >
                이미지 업로드 링크 복사
              </Button>
            </Box>
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
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fafafa', whiteSpace: 'nowrap', minWidth: 120 }}>
                  <TableSortLabel
                    active={orderBy === 'order_number'}
                    direction={orderBy === 'order_number' ? order : 'asc'}
                    onClick={() => handleRequestSort('order_number')}
                  >
                    주문번호
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fafafa', whiteSpace: 'nowrap', minWidth: 80 }}>
                  <TableSortLabel
                    active={orderBy === 'buyer_name'}
                    direction={orderBy === 'buyer_name' ? order : 'asc'}
                    onClick={() => handleRequestSort('buyer_name')}
                  >
                    구매자
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fafafa', whiteSpace: 'nowrap', minWidth: 80 }}>
                  <TableSortLabel
                    active={orderBy === 'recipient_name'}
                    direction={orderBy === 'recipient_name' ? order : 'asc'}
                    onClick={() => handleRequestSort('recipient_name')}
                  >
                    수취인
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fafafa', whiteSpace: 'nowrap', minWidth: 100 }}>
                  <TableSortLabel
                    active={orderBy === 'user_id'}
                    direction={orderBy === 'user_id' ? order : 'asc'}
                    onClick={() => handleRequestSort('user_id')}
                  >
                    아이디
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fafafa', whiteSpace: 'nowrap', minWidth: 130 }}>
                  <TableSortLabel
                    active={orderBy === 'contact'}
                    direction={orderBy === 'contact' ? order : 'asc'}
                    onClick={() => handleRequestSort('contact')}
                  >
                    연락처
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fafafa', whiteSpace: 'nowrap', minWidth: 300 }}>
                  <TableSortLabel
                    active={orderBy === 'address'}
                    direction={orderBy === 'address' ? order : 'asc'}
                    onClick={() => handleRequestSort('address')}
                  >
                    주소
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fafafa', whiteSpace: 'nowrap', minWidth: 250 }}>
                  <TableSortLabel
                    active={orderBy === 'account_info'}
                    direction={orderBy === 'account_info' ? order : 'asc'}
                    onClick={() => handleRequestSort('account_info')}
                  >
                    계좌정보
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fafafa', whiteSpace: 'nowrap', minWidth: 100, verticalAlign: 'bottom' }}>
                  <Box sx={{ lineHeight: 1 }}>
                    <Typography variant="subtitle2" display="block" color="success.main" fontWeight="bold" sx={{ mb: 0.5 }}>
                      Total: {totalAmount.toLocaleString()}
                    </Typography>
                    <TableSortLabel
                      active={orderBy === 'amount'}
                      direction={orderBy === 'amount' ? order : 'asc'}
                      onClick={() => handleRequestSort('amount')}
                    >
                      금액
                    </TableSortLabel>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fafafa', whiteSpace: 'nowrap', minWidth: 120 }}>
                  <TableSortLabel
                    active={orderBy === 'tracking_number'}
                    direction={orderBy === 'tracking_number' ? order : 'asc'}
                    onClick={() => handleRequestSort('tracking_number')}
                  >
                    송장번호
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fafafa', whiteSpace: 'nowrap', minWidth: 90 }}>
                  <TableSortLabel
                    active={orderBy === 'payment_status'}
                    direction={orderBy === 'payment_status' ? order : 'asc'}
                    onClick={() => handleRequestSort('payment_status')}
                  >
                    입금확인
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fafafa', whiteSpace: 'nowrap', minWidth: 150 }}>
                  리뷰샷
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fafafa', whiteSpace: 'nowrap', minWidth: 140 }}>
                  관리
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedBuyers.length > 0 ? (
                sortedBuyers.map((buyer) => (
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
                        <TableCell align="center">
                          <Chip label="대기중" size="small" variant="outlined" sx={{ color: '#999', borderColor: '#ddd' }} />
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
                                      borderRadius: 0.5,
                                      border: '1px solid #eee'
                                    }}
                                  />
                                </Box>
                              ))}
                            </Box>
                          ) : <Typography variant="caption" color="text.disabled">-</Typography>}
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="caption" color="text.disabled">-</Typography>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {buyer.tracking_number || '-'}
                        </TableCell>
                        <TableCell align="center">
                          {buyer.payment_status === 'completed' ? (
                            <Chip label="입금완료" color="primary" size="small" sx={{ fontWeight: 'bold' }} />
                          ) : (
                            <Chip label="대기중" size="small" variant="outlined" sx={{ color: '#999', borderColor: '#ddd' }} />
                          )}
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
                                  borderRadius: 0.5,
                                  border: '1px solid #eee'
                                }}
                              />
                            </Box>
                          ) : <Typography variant="caption" color="text.disabled">-</Typography>}
                        </TableCell>
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
                      </>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 6, color: '#999' }}>
                    등록된 데이터가 없습니다. 우측 상단 버튼을 눌러 추가하세요.
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

      {/* 다이얼로그 호출: editData + onSaveBulk 전달 */}
      <OperatorAddBuyerDialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveBuyer}
        onSaveBulk={handleSaveBuyersBulk}
        editData={editingBuyer}
      />
    </>
  );
}

export default OperatorBuyerTable;
