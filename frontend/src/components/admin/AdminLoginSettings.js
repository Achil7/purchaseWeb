import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, Alert, CircularProgress,
  IconButton, Paper, Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import { settingService } from '../../services';

function AdminLoginSettings({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // 설정 상태 - 로그인 폼
  const [title, setTitle] = useState('CampManager');
  const [subtitle, setSubtitle] = useState('캠페인 관리 시스템');
  // 설정 상태 - 배너
  const [bannerTitle, setBannerTitle] = useState('CampManager');
  const [bannerSubtitle, setBannerSubtitle] = useState('캠페인 관리 시스템');
  const [bannerImage, setBannerImage] = useState('');
  const [announcement, setAnnouncement] = useState('');

  // 이미지 업로드 상태
  const [uploading, setUploading] = useState(false);

  // 설정 로드
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await settingService.getLoginSettings();
      if (response.data) {
        setTitle(response.data.login_title || 'CampManager');
        setSubtitle(response.data.login_subtitle || '캠페인 관리 시스템');
        setBannerTitle(response.data.banner_title || 'CampManager');
        setBannerSubtitle(response.data.banner_subtitle || '캠페인 관리 시스템');
        setBannerImage(response.data.login_banner_image || '');
        setAnnouncement(response.data.login_announcement || '');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 설정 저장
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await settingService.updateLoginSettings({
        login_title: title,
        login_subtitle: subtitle,
        banner_title: bannerTitle,
        banner_subtitle: bannerSubtitle,
        login_announcement: announcement
      });

      setSuccess('로그인 페이지 설정이 저장되었습니다.');
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 이미지 업로드
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 파일 크기 체크 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      setError('이미지 크기는 5MB 이하여야 합니다.');
      return;
    }

    // 파일 타입 체크
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const response = await settingService.uploadLoginBanner(file);
      if (response.data?.url) {
        setBannerImage(response.data.url);
        setSuccess('배너 이미지가 업로드되었습니다.');
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      setError('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // 이미지 삭제
  const handleImageDelete = async () => {
    if (!bannerImage) return;

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      await settingService.deleteLoginBanner();
      setBannerImage('');
      setSuccess('배너 이미지가 삭제되었습니다.');
    } catch (err) {
      console.error('Failed to delete image:', err);
      setError('이미지 삭제에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight="bold">로그인 페이지 설정</Typography>
        <IconButton onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 3 }}>
            {/* 왼쪽: 설정 폼 */}
            <Box sx={{ flex: 1 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
              {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                  {success}
                </Alert>
              )}

              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                로그인 폼 (오른쪽)
              </Typography>

              <TextField
                fullWidth
                label="로그인 타이틀"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                sx={{ mb: 2 }}
                size="small"
                helperText="로그인 폼에 표시될 메인 타이틀"
              />

              <TextField
                fullWidth
                label="로그인 서브타이틀"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                sx={{ mb: 2 }}
                size="small"
                helperText="로그인 폼에 표시될 설명 문구"
              />

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                배너 영역 (왼쪽)
              </Typography>

              <TextField
                fullWidth
                label="배너 타이틀"
                value={bannerTitle}
                onChange={(e) => setBannerTitle(e.target.value)}
                sx={{ mb: 2 }}
                size="small"
                helperText="왼쪽 배너에 표시될 메인 타이틀"
              />

              <TextField
                fullWidth
                label="배너 서브타이틀"
                value={bannerSubtitle}
                onChange={(e) => setBannerSubtitle(e.target.value)}
                sx={{ mb: 2 }}
                size="small"
                helperText="왼쪽 배너에 표시될 설명 문구"
              />

              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt: 1 }}>
                배너 이미지
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                로그인 페이지 왼쪽에 표시됩니다. 권장 크기: 400x300px
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="contained"
                  component="label"
                  startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
                  disabled={uploading}
                  size="small"
                >
                  이미지 업로드
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </Button>
                {bannerImage && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleImageDelete}
                    disabled={uploading}
                    size="small"
                  >
                    삭제
                  </Button>
                )}
              </Box>

              {bannerImage && (
                <Box sx={{ mb: 2 }}>
                  <Box
                    component="img"
                    src={bannerImage}
                    alt="Banner Preview"
                    sx={{
                      width: '100%',
                      maxHeight: 150,
                      objectFit: 'contain',
                      borderRadius: 1,
                      border: '1px solid #ddd'
                    }}
                  />
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                공지사항
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                직원 및 브랜드사에게 전달할 공지사항을 작성하세요. 작성된 그대로 로그인 페이지에 표시됩니다.
              </Typography>

              <TextField
                fullWidth
                multiline
                rows={6}
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="공지사항을 입력하세요...&#10;&#10;예시:&#10;- 12월 20일 시스템 점검 예정&#10;- 신규 기능 안내"
                sx={{ mb: 2 }}
              />
            </Box>

            {/* 오른쪽: 미리보기 */}
            <Paper sx={{ flex: 1, p: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                미리보기
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  height: 450,
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: 2
                }}
              >
                {/* 왼쪽 배너 미리보기 */}
                <Box
                  sx={{
                    flex: 1,
                    bgcolor: 'primary.main',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'white',
                    p: 2,
                    overflow: 'auto'
                  }}
                >
                  <Box sx={{ textAlign: 'center', width: '90%' }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      {bannerTitle || 'CampManager'}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mb: 1 }}>
                      {bannerSubtitle || '캠페인 관리 시스템'}
                    </Typography>

                    {bannerImage && (
                      <Box
                        component="img"
                        src={bannerImage}
                        alt="Preview"
                        sx={{
                          width: '100%',
                          maxHeight: 100,
                          objectFit: 'contain',
                          mb: 1,
                          borderRadius: 1
                        }}
                      />
                    )}

                    {announcement && (
                      <Box
                        sx={{
                          mt: 1,
                          p: 1.5,
                          bgcolor: 'rgba(255,255,255,0.15)',
                          borderRadius: 1,
                          textAlign: 'left',
                          maxHeight: 180,
                          overflowY: 'auto'
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.6,
                            display: 'block'
                          }}
                        >
                          {announcement}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* 오른쪽 로그인 폼 미리보기 */}
                <Box
                  sx={{
                    flex: 1,
                    bgcolor: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    p: 2
                  }}
                >
                  <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>
                    {title || 'CampManager'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    {subtitle || '캠페인 관리 시스템'}
                  </Typography>
                  <Box sx={{ mt: 1, width: '80%' }}>
                    <Box sx={{ height: 24, bgcolor: '#f0f0f0', borderRadius: 1, mb: 1 }} />
                    <Box sx={{ height: 24, bgcolor: '#f0f0f0', borderRadius: 1, mb: 1 }} />
                    <Box sx={{ height: 28, bgcolor: 'primary.main', borderRadius: 1 }} />
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose}>닫기</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || loading}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {saving ? '저장 중...' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AdminLoginSettings;
