import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
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
  Tooltip,
  Divider
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Refresh as RefreshIcon,
  CompareArrows as CompareIcon,
  ArrowForward as ArrowIcon,
  Payment as PaymentIcon
} from '@mui/icons-material';
import imageService from '../../services/imageService';

/**
 * Admin 이미지 재제출 승인 페이지
 * - 그룹별로 묶어서 표시 (같은 구매자가 한번에 재제출한 이미지들)
 * - 기존 이미지들 vs 새 이미지들 비교
 * - 그룹 단위 승인/거절 기능
 */
const AdminImageApproval = () => {
  const [pendingGroups, setPendingGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // 비교 다이얼로그 상태
  const [compareDialog, setCompareDialog] = useState({
    open: false,
    group: null
  });

  // 이미지 확대 다이얼로그 상태
  const [imagePreview, setImagePreview] = useState({
    open: false,
    url: '',
    title: ''
  });

  // 대기 중인 이미지 그룹 목록 조회
  const fetchPendingImages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await imageService.getPendingImages();
      if (response.success) {
        setPendingGroups(response.data || []);
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

  // 그룹 승인 (첫 번째 이미지 ID로 호출하면 그룹 전체가 승인됨)
  const handleApprove = async (group) => {
    if (!group.newImages || group.newImages.length === 0) return;

    try {
      const firstImageId = group.newImages[0].id;
      const response = await imageService.approveImage(firstImageId);
      if (response.success) {
        setSnackbar({
          open: true,
          message: response.message || '이미지가 승인되었습니다',
          severity: 'success'
        });
        // 목록에서 제거
        setPendingGroups(prev => prev.filter(g => g.groupId !== group.groupId));
        setCompareDialog({ open: false, group: null });
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

  // 그룹 거절 (첫 번째 이미지 ID로 호출하면 그룹 전체가 거절됨)
  const handleReject = async (group) => {
    if (!group.newImages || group.newImages.length === 0) return;

    const confirmMsg = group.newImages.length > 1
      ? `${group.newImages.length}개의 새 이미지를 모두 거절하시겠습니까? 기존 이미지가 유지됩니다.`
      : '이 이미지를 거절하시겠습니까? 기존 이미지가 유지됩니다.';

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      const firstImageId = group.newImages[0].id;
      const response = await imageService.rejectImage(firstImageId);
      if (response.success) {
        setSnackbar({
          open: true,
          message: response.message || '이미지가 거절되었습니다',
          severity: 'info'
        });
        // 목록에서 제거
        setPendingGroups(prev => prev.filter(g => g.groupId !== group.groupId));
        setCompareDialog({ open: false, group: null });
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
  const openCompareDialog = (group) => {
    setCompareDialog({
      open: true,
      group
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
      ) : pendingGroups.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            대기 중인 재제출 이미지가 없습니다.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {pendingGroups.map((group) => (
            <Paper key={group.groupId} sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                {/* 좌측: 구매자 정보 */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {group.buyer?.buyer_name || group.buyer?.recipient_name || '이름 없음'}
                    </Typography>
                    {group.isPaymentConfirmed && (
                      <Chip
                        icon={<PaymentIcon />}
                        label="입금완료"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {group.item?.campaign?.name} · {group.item?.product_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    주문번호: {group.buyer?.order_number || '-'} · 재제출: {formatDate(group.resubmittedAt)}
                  </Typography>
                </Box>

                {/* 우측: 버튼들 */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="비교하기">
                    <IconButton
                      color="primary"
                      onClick={() => openCompareDialog(group)}
                    >
                      <CompareIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="거절">
                    <IconButton
                      color="error"
                      onClick={() => handleReject(group)}
                    >
                      <RejectIcon />
                    </IconButton>
                  </Tooltip>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<ApproveIcon />}
                    onClick={() => handleApprove(group)}
                  >
                    승인 ({group.newImages?.length || 0}장)
                  </Button>
                </Box>
              </Box>

              {/* 이미지 비교 미리보기 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto' }}>
                {/* 기존 이미지들 */}
                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                  {group.existingImages && group.existingImages.length > 0 ? (
                    group.existingImages.map((img, idx) => (
                      <Card
                        key={img.id}
                        sx={{ width: 120, cursor: 'pointer', flexShrink: 0 }}
                        onClick={() => openImagePreview(img.s3_url, `기존 이미지 ${idx + 1}`)}
                      >
                        <CardMedia
                          component="img"
                          image={img.s3_url}
                          alt={`기존 ${idx + 1}`}
                          sx={{ height: 90, objectFit: 'cover' }}
                        />
                        <Box sx={{ p: 0.5, bgcolor: '#f5f5f5', textAlign: 'center' }}>
                          <Typography variant="caption">기존 {idx + 1}</Typography>
                        </Box>
                      </Card>
                    ))
                  ) : (
                    <Paper sx={{ width: 120, height: 115, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
                      <Typography variant="caption" color="text.secondary">없음</Typography>
                    </Paper>
                  )}
                </Box>

                {/* 화살표 */}
                <ArrowIcon sx={{ color: '#1976d2', fontSize: 32, flexShrink: 0 }} />

                {/* 새 이미지들 */}
                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                  {group.newImages && group.newImages.map((img, idx) => (
                    <Card
                      key={img.id}
                      sx={{ width: 120, cursor: 'pointer', flexShrink: 0, border: '2px solid #ff9800' }}
                      onClick={() => openImagePreview(img.s3_url, `새 이미지 ${idx + 1}`)}
                    >
                      <CardMedia
                        component="img"
                        image={img.s3_url}
                        alt={`새 ${idx + 1}`}
                        sx={{ height: 90, objectFit: 'cover' }}
                      />
                      <Box sx={{ p: 0.5, bgcolor: '#fff8e1', textAlign: 'center' }}>
                        <Typography variant="caption" color="warning.dark">새 {idx + 1}</Typography>
                      </Box>
                    </Card>
                  ))}
                </Box>
              </Box>

              {/* 입금완료 안내 메시지 */}
              {group.isPaymentConfirmed && (
                <Box sx={{ mt: 1.5, p: 1, bgcolor: '#e8f5e9', borderRadius: 1 }}>
                  <Typography variant="caption" color="success.dark">
                    입금완료된 구매자입니다. 승인 시 리뷰 제출일이 변경되지 않습니다 (날짜별 입금관리에 영향 없음).
                  </Typography>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}

      {/* 비교 다이얼로그 */}
      <Dialog
        open={compareDialog.open}
        onClose={() => setCompareDialog({ open: false, group: null })}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#1976d2', color: 'white' }}>
          이미지 비교
          {compareDialog.group?.isPaymentConfirmed && (
            <Chip
              icon={<PaymentIcon />}
              label="입금완료"
              size="small"
              sx={{ ml: 2, bgcolor: 'white', color: 'success.main' }}
            />
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {compareDialog.group && (
            <Box>
              {/* 구매자 정보 */}
              <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">캠페인</Typography>
                    <Typography variant="body2">
                      {compareDialog.group.item?.campaign?.name || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">제품명</Typography>
                    <Typography variant="body2">
                      {compareDialog.group.item?.product_name || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">구매자</Typography>
                    <Typography variant="body2">
                      {compareDialog.group.buyer?.buyer_name || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">주문번호</Typography>
                    <Typography variant="body2">
                      {compareDialog.group.buyer?.order_number || '-'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              <Grid container spacing={3}>
                {/* 기존 이미지들 */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    기존 이미지 ({compareDialog.group.existingImages?.length || 0}장)
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {compareDialog.group.existingImages && compareDialog.group.existingImages.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {compareDialog.group.existingImages.map((img, idx) => (
                        <Card
                          key={img.id}
                          sx={{ width: 150, cursor: 'pointer' }}
                          onClick={() => openImagePreview(img.s3_url, `기존 이미지 ${idx + 1}`)}
                        >
                          <CardMedia
                            component="img"
                            image={img.s3_url}
                            alt={`기존 ${idx + 1}`}
                            sx={{ height: 120, objectFit: 'cover' }}
                          />
                          <Box sx={{ p: 1, bgcolor: '#f5f5f5' }}>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(img.created_at)}
                            </Typography>
                          </Box>
                        </Card>
                      ))}
                    </Box>
                  ) : (
                    <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f5f5f5' }}>
                      <Typography color="text.secondary">
                        기존 이미지 없음
                      </Typography>
                    </Paper>
                  )}
                </Grid>

                {/* 새 이미지들 */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    새 이미지 ({compareDialog.group.newImages?.length || 0}장)
                    <Chip
                      label="승인 대기"
                      size="small"
                      color="warning"
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {compareDialog.group.newImages?.map((img, idx) => (
                      <Card
                        key={img.id}
                        sx={{ width: 150, cursor: 'pointer', border: '2px solid #ff9800' }}
                        onClick={() => openImagePreview(img.s3_url, `새 이미지 ${idx + 1}`)}
                      >
                        <CardMedia
                          component="img"
                          image={img.s3_url}
                          alt={`새 ${idx + 1}`}
                          sx={{ height: 120, objectFit: 'cover' }}
                        />
                        <Box sx={{ p: 1, bgcolor: '#fff8e1' }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(img.resubmitted_at)}
                          </Typography>
                        </Box>
                      </Card>
                    ))}
                  </Box>
                </Grid>
              </Grid>

              {/* 입금완료 안내 */}
              {compareDialog.group.isPaymentConfirmed && (
                <Box sx={{ mt: 3, p: 2, bgcolor: '#e8f5e9', borderRadius: 1 }}>
                  <Typography variant="body2" color="success.dark">
                    입금완료된 구매자입니다. 승인 시 이미지만 교체되고 리뷰 제출일은 변경되지 않습니다.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setCompareDialog({ open: false, group: null })}
          >
            닫기
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<RejectIcon />}
            onClick={() => compareDialog.group && handleReject(compareDialog.group)}
          >
            거절 ({compareDialog.group?.newImages?.length || 0}장)
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<ApproveIcon />}
            onClick={() => compareDialog.group && handleApprove(compareDialog.group)}
          >
            승인 ({compareDialog.group?.newImages?.length || 0}장)
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
