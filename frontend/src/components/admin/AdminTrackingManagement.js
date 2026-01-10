import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, CircularProgress, Alert, TextField, IconButton, Dialog, DialogContent, Button, Tooltip
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import { buyerService } from '../../services';

// UTC+9 (Asia/Seoul) 오늘 날짜 가져오기
const getKoreanToday = () => {
  const koreanDateStr = new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = koreanDateStr.replace(/\./g, '').trim().split(/\s+/);
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  return new Date(year, month, day);
};

function AdminTrackingManagement() {
  const [selectedDate, setSelectedDate] = useState(getKoreanToday());
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 송장번호/택배사 편집 상태
  const [editingValues, setEditingValues] = useState({});
  // 저장 중 상태
  const [savingBuyers, setSavingBuyers] = useState({});

  // 이미지 확대 다이얼로그
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  useEffect(() => {
    loadBuyers();
  }, [selectedDate]);

  const loadBuyers = async () => {
    try {
      setLoading(true);
      setError(null);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      const day = selectedDate.getDate();

      const response = await buyerService.getBuyersByDate(year, month, day);
      const buyersData = response.data || [];
      setBuyers(buyersData);

      // 편집 상태 초기화
      const initialValues = {};
      buyersData.forEach(buyer => {
        initialValues[buyer.id] = {
          tracking_number: buyer.tracking_number || '',
          courier_company: buyer.courier_company || ''
        };
      });
      setEditingValues(initialValues);
    } catch (err) {
      console.error('Failed to load buyers:', err);
      setError('구매자 목록을 불러오는데 실패했습니다.');
      setBuyers([]);
    } finally {
      setLoading(false);
    }
  };

  // 날짜 이동
  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  const handleToday = () => {
    setSelectedDate(getKoreanToday());
  };

  // 편집 값 변경
  const handleEditChange = (buyerId, field, value) => {
    setEditingValues(prev => ({
      ...prev,
      [buyerId]: {
        ...prev[buyerId],
        [field]: value
      }
    }));
  };

  // 개별 저장
  const handleSave = async (buyerId) => {
    const values = editingValues[buyerId];
    if (!values) return;

    setSavingBuyers(prev => ({ ...prev, [buyerId]: true }));
    try {
      await buyerService.updateTrackingInfo(buyerId, {
        tracking_number: values.tracking_number,
        courier_company: values.courier_company
      });
      // 로컬 상태 업데이트
      setBuyers(prev => prev.map(buyer =>
        buyer.id === buyerId
          ? { ...buyer, tracking_number: values.tracking_number, courier_company: values.courier_company }
          : buyer
      ));
    } catch (err) {
      console.error('Failed to save tracking info:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setSavingBuyers(prev => ({ ...prev, [buyerId]: false }));
    }
  };

  // 일괄 저장
  const handleBulkSave = async () => {
    // 변경된 항목만 추출
    const changedBuyers = buyers.filter(buyer => {
      const current = editingValues[buyer.id];
      return current && (
        current.tracking_number !== (buyer.tracking_number || '') ||
        current.courier_company !== (buyer.courier_company || '')
      );
    });

    if (changedBuyers.length === 0) {
      alert('변경된 항목이 없습니다.');
      return;
    }

    if (!window.confirm(`${changedBuyers.length}건의 송장 정보를 저장하시겠습니까?`)) {
      return;
    }

    const savingIds = {};
    changedBuyers.forEach(b => { savingIds[b.id] = true; });
    setSavingBuyers(savingIds);

    try {
      await Promise.all(
        changedBuyers.map(buyer => {
          const values = editingValues[buyer.id];
          return buyerService.updateTrackingInfo(buyer.id, {
            tracking_number: values.tracking_number,
            courier_company: values.courier_company
          });
        })
      );
      // 로컬 상태 업데이트
      setBuyers(prev => prev.map(buyer => {
        const values = editingValues[buyer.id];
        if (values) {
          return { ...buyer, tracking_number: values.tracking_number, courier_company: values.courier_company };
        }
        return buyer;
      }));
      alert('저장 완료');
    } catch (err) {
      console.error('Failed to bulk save:', err);
      alert('일괄 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingBuyers({});
    }
  };

  // 이미지 클릭
  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
    setImageDialogOpen(true);
  };

  // 날짜 포맷
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekday})`;
  };

  // 송장 입력된 수
  const trackingCount = buyers.filter(b => b.tracking_number || editingValues[b.id]?.tracking_number).length;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Box>
        {/* 헤더 */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <LocalShippingIcon sx={{ fontSize: 28, color: '#2c387e' }} />
            <Typography variant="h6" fontWeight="bold">날짜별 송장관리</Typography>
          </Box>

          {/* 날짜 선택 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={handlePrevDay} title="이전 날짜" size="small">
              <ArrowBackIcon />
            </IconButton>

            <DatePicker
              value={selectedDate}
              onChange={(newDate) => newDate && setSelectedDate(newDate)}
              format="yyyy-MM-dd"
              slotProps={{
                textField: {
                  size: 'small',
                  sx: { width: 150 }
                }
              }}
            />

            <IconButton onClick={handleNextDay} title="다음 날짜" size="small">
              <ArrowForwardIcon />
            </IconButton>

            <Chip
              label="오늘"
              onClick={handleToday}
              color="primary"
              variant="outlined"
              size="small"
              sx={{ cursor: 'pointer' }}
            />
          </Box>
        </Box>

        {/* 선택된 날짜 및 통계 */}
        <Paper sx={{ p: 1.5, mb: 2, bgcolor: '#fff3e0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" color="warning.dark">
                {formatDate(selectedDate)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                총 {buyers.length}명 (송장입력: {trackingCount}명)
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="warning"
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleBulkSave}
              disabled={buyers.length === 0}
              sx={{ fontWeight: 'bold' }}
            >
              일괄 저장
            </Button>
          </Box>
        </Paper>

        {/* 에러 표시 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* 로딩 */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 3 }}>
            <TableContainer sx={{ maxHeight: '65vh' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff8e1', minWidth: 120 }}>캠페인</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff8e1', minWidth: 150 }}>제품명</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff8e1', minWidth: 100 }}>주문번호</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff8e1', minWidth: 80 }}>구매자</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff8e1', minWidth: 80 }}>수취인</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff8e1', minWidth: 120 }}>송장번호</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff8e1', minWidth: 100 }}>택배사</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff8e1', minWidth: 60 }}>저장</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff8e1', minWidth: 80 }}>리뷰샷</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {buyers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 4, color: '#999' }}>
                        해당 날짜에 등록된 구매자가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    buyers.map((buyer) => (
                      <TableRow key={buyer.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" fontWeight="medium">
                            {buyer.campaign?.name || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {buyer.item?.product_name || '-'}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {buyer.order_number || '-'}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {buyer.buyer_name || '-'}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {buyer.recipient_name || '-'}
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={editingValues[buyer.id]?.tracking_number || ''}
                            onChange={(e) => handleEditChange(buyer.id, 'tracking_number', e.target.value)}
                            placeholder="송장번호"
                            sx={{ width: 120 }}
                            inputProps={{ style: { fontSize: 13 } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={editingValues[buyer.id]?.courier_company || ''}
                            onChange={(e) => handleEditChange(buyer.id, 'courier_company', e.target.value)}
                            placeholder="택배사"
                            sx={{ width: 90 }}
                            inputProps={{ style: { fontSize: 13 } }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="저장">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleSave(buyer.id)}
                              disabled={savingBuyers[buyer.id]}
                            >
                              {savingBuyers[buyer.id] ? (
                                <CircularProgress size={18} />
                              ) : (
                                <SaveIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center">
                          {buyer.image_url ? (
                            <Box
                              onClick={() => handleImageClick(buyer.image_url)}
                              sx={{ cursor: 'pointer', display: 'inline-block' }}
                            >
                              <Box
                                component="img"
                                src={buyer.image_url}
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
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* 이미지 확대 다이얼로그 */}
        <Dialog
          open={imageDialogOpen}
          onClose={() => setImageDialogOpen(false)}
          maxWidth="lg"
        >
          <DialogContent sx={{ p: 0, position: 'relative' }}>
            <IconButton
              onClick={() => setImageDialogOpen(false)}
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
              <Box
                component="img"
                src={selectedImage}
                alt="리뷰이미지"
                sx={{
                  maxWidth: '95vw',
                  maxHeight: '90vh',
                  objectFit: 'contain'
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}

export default AdminTrackingManagement;
