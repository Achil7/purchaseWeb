import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Alert, CircularProgress,
  Container
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import imageService from '../../services/imageService';

function UploadPage() {
  const { token } = useParams();
  const [itemInfo, setItemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [orderNumber, setOrderNumber] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const fileInputRef = useRef(null);

  // 품목 정보 조회
  useEffect(() => {
    const fetchItemInfo = async () => {
      try {
        setLoading(true);
        const response = await imageService.getItemByToken(token);
        setItemInfo(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch item info:', err);
        setError('유효하지 않은 업로드 링크입니다.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchItemInfo();
    }
  }, [token]);

  // 파일 선택 처리
  const handleFileSelect = (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('파일 크기는 10MB 이하여야 합니다.');
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    setUploadSuccess(false);

    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // input 파일 선택
  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    handleFileSelect(file);
  };

  // Ctrl+V 붙여넣기
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        handleFileSelect(file);
        break;
      }
    }
  }, []);

  // 붙여넣기 이벤트 리스너
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  // 드롭 영역 클릭
  const handleDropAreaClick = () => {
    fileInputRef.current?.click();
  };

  // 업로드 처리
  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('이미지를 선택해주세요.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      await imageService.uploadImage(token, selectedFile, orderNumber);

      setUploadSuccess(true);
      setSelectedFile(null);
      setPreviewUrl(null);
      setOrderNumber('');
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError('이미지 업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setUploading(false);
    }
  };

  // 로딩 중
  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: '#f5f5f5'
      }}>
        <CircularProgress />
      </Box>
    );
  }

  // 에러 (잘못된 토큰)
  if (error) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: '#f5f5f5'
      }}>
        <Paper sx={{ p: 4, maxWidth: 400, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          <Typography color="text.secondary">
            링크가 올바른지 확인해주세요.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: '#f5f5f5',
      py: 4
    }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          {/* 제목 */}
          <Typography variant="h5" fontWeight="bold" align="center" gutterBottom>
            {itemInfo?.campaign_name} / {itemInfo?.product_name}
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>
            이미지 업로드
          </Typography>

          {/* 주문번호 입력 */}
          <TextField
            label="주문번호"
            fullWidth
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="주문번호를 입력하세요"
            sx={{ mb: 3 }}
          />

          {/* 이미지 업로드 영역 */}
          <Box
            onClick={handleDropAreaClick}
            sx={{
              border: '2px dashed #ccc',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: '#fafafa',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: '#1976d2',
                bgcolor: '#e3f2fd'
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              style={{ display: 'none' }}
            />
            <CloudUploadIcon sx={{ fontSize: 48, color: '#999', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              클릭하여 이미지 선택
            </Typography>
            <Typography variant="body2" color="text.secondary">
              또는 Ctrl+V로 붙여넣기
            </Typography>
          </Box>

          {/* 미리보기 */}
          {previewUrl && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                선택된 이미지:
              </Typography>
              <Box
                component="img"
                src={previewUrl}
                alt="Preview"
                sx={{
                  width: '100%',
                  maxHeight: 300,
                  objectFit: 'contain',
                  borderRadius: 2,
                  border: '1px solid #eee'
                }}
              />
            </Box>
          )}

          {/* 에러 메시지 */}
          {uploadError && (
            <Alert severity="error" sx={{ mt: 3 }}>
              {uploadError}
            </Alert>
          )}

          {/* 성공 메시지 */}
          {uploadSuccess && (
            <Alert
              severity="success"
              icon={<CheckCircleIcon />}
              sx={{ mt: 3 }}
            >
              이미지가 성공적으로 업로드되었습니다!
            </Alert>
          )}

          {/* 업로드 버튼 */}
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
            sx={{ mt: 3, py: 1.5 }}
          >
            {uploading ? '업로드 중...' : '업로드 완료'}
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}

export default UploadPage;
