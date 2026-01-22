import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, CircularProgress, Alert, TextField, IconButton, Switch, Dialog, DialogContent, Button, Tooltip
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import PaymentsIcon from '@mui/icons-material/Payments';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import { buyerService } from '../../services';
import { downloadExcel, convertDailyPaymentsToExcelData } from '../../utils/excelExport';

// UTC+9 (Asia/Seoul) 오늘 날짜 가져오기
const getKoreanToday = () => {
  // toLocaleString으로 한국 시간대의 날짜 문자열 얻기
  const koreanDateStr = new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // "2026. 01. 09." 형식을 파싱
  const parts = koreanDateStr.replace(/\./g, '').trim().split(/\s+/);
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // 0-indexed
  const day = parseInt(parts[2]);
  return new Date(year, month, day);
};

function AdminDailyPayments() {
  const [selectedDate, setSelectedDate] = useState(getKoreanToday());
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 입금확인 처리 중 상태
  const [processingPayment, setProcessingPayment] = useState({});
  // 일괄 처리 중 상태
  const [bulkProcessing, setBulkProcessing] = useState(false);

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
      setBuyers(response.data || []);
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

  // 엑셀 다운로드 핸들러
  const handleDownloadExcel = useCallback(() => {
    const excelData = convertDailyPaymentsToExcelData(buyers);
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    downloadExcel(excelData, `daily_payments_${dateStr}`, '일별입금관리');
  }, [buyers, selectedDate]);

  // 한국 시간 포맷 (YYMMDD)
  const formatKoreanDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    // UTC를 KST로 변환
    const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    const yy = String(kstDate.getUTCFullYear()).slice(-2);
    const mm = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kstDate.getUTCDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  };

  // 입금확인 토글
  const handlePaymentToggle = async (buyerId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    setProcessingPayment(prev => ({ ...prev, [buyerId]: true }));

    try {
      await buyerService.confirmPayment(buyerId, newStatus);
      // 로컬 상태만 업데이트 - 입금 완료 시 현재 시간 저장
      const now = newStatus === 'completed' ? new Date().toISOString() : null;
      setBuyers(prev => prev.map(buyer =>
        buyer.id === buyerId
          ? { ...buyer, payment_status: newStatus, payment_confirmed_at: now }
          : buyer
      ));
    } catch (err) {
      console.error('Failed to update payment status:', err);
      alert('입금 상태 변경에 실패했습니다.');
    } finally {
      setProcessingPayment(prev => ({ ...prev, [buyerId]: false }));
    }
  };

  // 이미지 클릭
  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
    setImageDialogOpen(true);
  };

  // 일괄 입금완료 처리
  const handleBulkComplete = async () => {
    const pendingBuyers = buyers.filter(b => b.payment_status !== 'completed');
    if (pendingBuyers.length === 0) {
      alert('이미 모든 구매자가 입금완료 상태입니다.');
      return;
    }

    if (!window.confirm(`${pendingBuyers.length}명의 구매자를 입금완료 처리하시겠습니까?`)) {
      return;
    }

    setBulkProcessing(true);
    try {
      // 병렬로 모든 요청 처리
      await Promise.all(
        pendingBuyers.map(buyer => buyerService.confirmPayment(buyer.id, 'completed'))
      );
      // 로컬 상태 업데이트 - 입금 완료 시 현재 시간 저장
      const now = new Date().toISOString();
      setBuyers(prev => prev.map(buyer => ({
        ...buyer,
        payment_status: 'completed',
        payment_confirmed_at: buyer.payment_status !== 'completed' ? now : buyer.payment_confirmed_at
      })));
    } catch (err) {
      console.error('Failed to bulk update payment status:', err);
      alert('일괄 입금완료 처리 중 오류가 발생했습니다. 새로고침 후 다시 시도해주세요.');
      loadBuyers(); // 오류 시 다시 불러오기
    } finally {
      setBulkProcessing(false);
    }
  };

  // 일괄 입금취소 처리
  const handleBulkCancel = async () => {
    const completedBuyers = buyers.filter(b => b.payment_status === 'completed');
    if (completedBuyers.length === 0) {
      alert('입금완료된 구매자가 없습니다.');
      return;
    }

    if (!window.confirm(`${completedBuyers.length}명의 구매자를 입금대기 상태로 변경하시겠습니까?`)) {
      return;
    }

    setBulkProcessing(true);
    try {
      // 병렬로 모든 요청 처리
      await Promise.all(
        completedBuyers.map(buyer => buyerService.confirmPayment(buyer.id, 'pending'))
      );
      // 로컬 상태 업데이트 - 입금 취소 시 날짜 초기화
      setBuyers(prev => prev.map(buyer => ({
        ...buyer,
        payment_status: 'pending',
        payment_confirmed_at: null
      })));
    } catch (err) {
      console.error('Failed to bulk cancel payment status:', err);
      alert('일괄 입금취소 처리 중 오류가 발생했습니다. 새로고침 후 다시 시도해주세요.');
      loadBuyers(); // 오류 시 다시 불러오기
    } finally {
      setBulkProcessing(false);
    }
  };

  // 금액을 숫자로 파싱하는 헬퍼 함수
  const parseAmount = (amount) => {
    if (!amount) return 0;
    if (typeof amount === 'number') return amount;
    // 문자열에서 숫자만 추출
    const numStr = String(amount).replace(/[^0-9]/g, '');
    return parseInt(numStr, 10) || 0;
  };

  // 금액 합계
  const totalAmount = buyers.reduce((sum, buyer) => sum + parseAmount(buyer.amount), 0);
  const completedAmount = buyers
    .filter(b => b.payment_status === 'completed')
    .reduce((sum, buyer) => sum + parseAmount(buyer.amount), 0);

  // 날짜 포맷
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekday})`;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Box>
        {/* 헤더 - 날짜 선택과 제목을 한 줄에 */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PaymentsIcon sx={{ fontSize: 28, color: '#2c387e' }} />
            <Typography variant="h6" fontWeight="bold">날짜별 입금관리</Typography>
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
        <Paper sx={{ p: 1.5, mb: 2, bgcolor: '#e3f2fd' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" color="primary">
                {formatDate(selectedDate)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                총 {buyers.length}명
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {/* 일괄 처리 버튼 */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={bulkProcessing ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
                  onClick={handleBulkComplete}
                  disabled={bulkProcessing || buyers.length === 0}
                  sx={{ fontWeight: 'bold' }}
                >
                  전체 입금완료
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={bulkProcessing ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
                  onClick={handleBulkCancel}
                  disabled={bulkProcessing || buyers.length === 0}
                  sx={{ fontWeight: 'bold' }}
                >
                  전체 입금취소
                </Button>
                <Tooltip title="엑셀 다운로드">
                  <span>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={handleDownloadExcel}
                      disabled={buyers.length === 0}
                    >
                      엑셀
                    </Button>
                  </span>
                </Tooltip>
              </Box>
              {/* 금액 통계 */}
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary">
                  입금완료: <strong style={{ color: '#2e7d32' }}>{completedAmount.toLocaleString()}원</strong> ({buyers.filter(b => b.payment_status === 'completed').length}명)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  총 금액: <strong>{totalAmount.toLocaleString()}원</strong> ({buyers.length}명)
                </Typography>
              </Box>
            </Box>
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
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e8eaf6', minWidth: 120 }}>캠페인</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e8eaf6', minWidth: 150 }}>제품명</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e8eaf6', minWidth: 100 }}>입금명</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e8eaf6', minWidth: 100 }}>입금예정일</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e8eaf6', minWidth: 100 }}>주문번호</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e8eaf6', minWidth: 80 }}>구매자</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e8eaf6', minWidth: 80 }}>수취인</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e8eaf6', minWidth: 150 }}>계좌</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e8eaf6', minWidth: 90 }}>금액</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e8eaf6', minWidth: 80 }}>리뷰비</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e8eaf6', minWidth: 120 }}>입금확인</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e8eaf6', minWidth: 80 }}>리뷰샷</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {buyers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 4, color: '#999' }}>
                        해당 날짜에 리뷰샷을 업로드한 구매자가 없습니다.
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
                        <TableCell sx={{ whiteSpace: 'nowrap', color: '#1565c0', fontWeight: 'bold' }}>
                          {buyer.deposit_name || buyer.item?.deposit_name || '-'}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: '#e65100' }}>
                          {buyer.expected_payment_date || '-'}
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {buyer.account_info || '-'}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1b5e20' }}>
                          {parseAmount(buyer.amount).toLocaleString()}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: '#7b1fa2' }}>
                          {buyer.review_cost ? parseAmount(buyer.review_cost).toLocaleString() : '-'}
                        </TableCell>
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
                              <Chip
                                label={buyer.payment_confirmed_at ? formatKoreanDate(buyer.payment_confirmed_at) : '완료'}
                                color="primary"
                                size="small"
                                sx={{ fontWeight: 'bold', minWidth: 60 }}
                              />
                            ) : (
                              <Chip label="대기" size="small" variant="outlined" sx={{ color: '#999', minWidth: 50 }} />
                            )}
                          </Box>
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
          onClose={(event, reason) => { if (reason !== 'backdropClick') setImageDialogOpen(false); }}
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

export default AdminDailyPayments;
