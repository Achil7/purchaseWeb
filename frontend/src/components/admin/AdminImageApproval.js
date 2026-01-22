import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  Card,
  CardMedia,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  CompareArrows as CompareIcon
} from '@mui/icons-material';
import imageService from '../../services/imageService';

/**
 * Admin 이미지 재제출 승인 페이지
 * - 대기 중인 재제출 이미지 목록 표시
 * - 이전 이미지 vs 새 이미지 비교
 * - 승인/거절 기능
 */
const AdminImageApproval = () => {
  const [pendingImages, setPendingImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // 비교 다이얼로그 상태
  const [compareDialog, setCompareDialog] = useState({
    open: false,
    image: null
  });

  // 이미지 확대 다이얼로그 상태
  const [imagePreview, setImagePreview] = useState({
    open: false,
    url: '',
    title: ''
  });

  // 대기 중인 이미지 목록 조회
  const fetchPendingImages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await imageService.getPendingImages();
      if (response.success) {
        setPendingImages(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch pending images:', error);
      setSnackbar({
        open: true,
        message: '대기 중인 이미지 목록 조회 실패',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingImages();
  }, [fetchPendingImages]);

  // 이미지 승인
  const handleApprove = async (imageId) => {
    try {
      const response = await imageService.approveImage(imageId);
      if (response.success) {
        setSnackbar({
          open: true,
          message: '이미지가 승인되었습니다',
          severity: 'success'
        });
        // 목록에서 제거
        setPendingImages(prev => prev.filter(img => img.id !== imageId));
        setCompareDialog({ open: false, image: null });
      }
    } catch (error) {
      console.error('Failed to approve image:', error);
      setSnackbar({
        open: true,
        message: '이미지 승인 실패',
        severity: 'error'
      });
    }
  };

  // 이미지 거절
  const handleReject = async (imageId) => {
    if (!window.confirm('이 이미지를 거절하시겠습니까? 새로 업로드된 이미지가 삭제되고 기존 이미지가 유지됩니다.')) {
      return;
    }

    try {
      const response = await imageService.rejectImage(imageId);
      if (response.success) {
        setSnackbar({
          open: true,
          message: '이미지가 거절되었습니다',
          severity: 'info'
        });
        // 목록에서 제거
        setPendingImages(prev => prev.filter(img => img.id !== imageId));
        setCompareDialog({ open: false, image: null });
      }
    } catch (error) {
      console.error('Failed to reject image:', error);
      setSnackbar({
        open: true,
        message: '이미지 거절 실패',
        severity: 'error'
      });
    }
  };

  // 비교 다이얼로그 열기
  const openCompareDialog = (image) => {
    setCompareDialog({
      open: true,
      image
    });
  };

  // 이미지 미리보기
  const openImagePreview = (url, title) => {
    setImagePreview({
      open: true,
      url,
      title
    });
  };

  // 날짜 포맷
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          리뷰 이미지 재제출 승인
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchPendingImages}
          disabled={loading}
        >
          새로고침
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : pendingImages.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            대기 중인 재제출 이미지가 없습니다.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell>캠페인</TableCell>
                <TableCell>제품명</TableCell>
                <TableCell>구매자</TableCell>
                <TableCell>주문번호</TableCell>
                <TableCell>재제출 시간</TableCell>
                <TableCell align="center">미리보기</TableCell>
                <TableCell align="center">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingImages.map((image) => (
                <TableRow key={image.id} hover>
                  <TableCell>
                    {image.item?.campaign?.name || '-'}
                  </TableCell>
                  <TableCell>
                    {image.item?.product_name || '-'}
                  </TableCell>
                  <TableCell>
                    {image.buyer?.buyer_name || image.buyer?.recipient_name || '-'}
                  </TableCell>
                  <TableCell>
                    {image.buyer?.order_number || '-'}
                  </TableCell>
                  <TableCell>
                    {formatDate(image.resubmitted_at)}
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Tooltip title="새 이미지 보기">
                        <IconButton
                          size="small"
                          onClick={() => openImagePreview(image.s3_url, '새 이미지')}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="비교하기">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => openCompareDialog(image)}
                        >
                          <CompareIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Tooltip title="승인">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleApprove(image.id)}
                        >
                          <ApproveIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="거절">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleReject(image.id)}
                        >
                          <RejectIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 비교 다이얼로그 */}
      <Dialog
        open={compareDialog.open}
        onClose={() => setCompareDialog({ open: false, image: null })}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#1976d2', color: 'white' }}>
          이미지 비교
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {compareDialog.image && (
            <Grid container spacing={3}>
              {/* 이전 이미지 */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  기존 이미지
                </Typography>
                {compareDialog.image.previousImage ? (
                  <Card
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openImagePreview(
                      compareDialog.image.previousImage.s3_url,
                      '기존 이미지'
                    )}
                  >
                    <CardMedia
                      component="img"
                      image={compareDialog.image.previousImage.s3_url}
                      alt="기존 이미지"
                      sx={{ maxHeight: 400, objectFit: 'contain' }}
                    />
                    <Box sx={{ p: 1, bgcolor: '#f5f5f5' }}>
                      <Typography variant="caption" color="text.secondary">
                        업로드: {formatDate(compareDialog.image.previousImage.created_at)}
                      </Typography>
                    </Box>
                  </Card>
                ) : (
                  <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f5f5f5' }}>
                    <Typography color="text.secondary">
                      이전 이미지 없음
                    </Typography>
                  </Paper>
                )}
              </Grid>

              {/* 새 이미지 */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  새 이미지 (재제출)
                  <Chip
                    label="승인 대기"
                    size="small"
                    color="warning"
                    sx={{ ml: 1 }}
                  />
                </Typography>
                <Card
                  sx={{ cursor: 'pointer' }}
                  onClick={() => openImagePreview(
                    compareDialog.image.s3_url,
                    '새 이미지'
                  )}
                >
                  <CardMedia
                    component="img"
                    image={compareDialog.image.s3_url}
                    alt="새 이미지"
                    sx={{ maxHeight: 400, objectFit: 'contain' }}
                  />
                  <Box sx={{ p: 1, bgcolor: '#fff8e1' }}>
                    <Typography variant="caption" color="text.secondary">
                      재제출: {formatDate(compareDialog.image.resubmitted_at)}
                    </Typography>
                  </Box>
                </Card>
              </Grid>

              {/* 구매자 정보 */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    구매자 정보
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Typography variant="caption" color="text.secondary">캠페인</Typography>
                      <Typography variant="body2">
                        {compareDialog.image.item?.campaign?.name || '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="caption" color="text.secondary">제품명</Typography>
                      <Typography variant="body2">
                        {compareDialog.image.item?.product_name || '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="caption" color="text.secondary">구매자</Typography>
                      <Typography variant="body2">
                        {compareDialog.image.buyer?.buyer_name || '-'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="caption" color="text.secondary">주문번호</Typography>
                      <Typography variant="body2">
                        {compareDialog.image.buyer?.order_number || '-'}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setCompareDialog({ open: false, image: null })}
          >
            닫기
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<RejectIcon />}
            onClick={() => compareDialog.image && handleReject(compareDialog.image.id)}
          >
            거절
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<ApproveIcon />}
            onClick={() => compareDialog.image && handleApprove(compareDialog.image.id)}
          >
            승인
          </Button>
        </DialogActions>
      </Dialog>

      {/* 이미지 미리보기 다이얼로그 */}
      <Dialog
        open={imagePreview.open}
        onClose={() => setImagePreview({ open: false, url: '', title: '' })}
        maxWidth="lg"
      >
        <DialogTitle>{imagePreview.title}</DialogTitle>
        <DialogContent>
          <img
            src={imagePreview.url}
            alt={imagePreview.title}
            style={{ maxWidth: '100%', maxHeight: '80vh' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImagePreview({ open: false, url: '', title: '' })}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminImageApproval;
