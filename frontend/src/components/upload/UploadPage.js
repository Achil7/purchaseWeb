import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Alert, CircularProgress,
  Container, IconButton, ImageList, ImageListItem, ImageListItemBar
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import imageService from '../../services/imageService';

function UploadPage({ isSlotUpload = false }) {
  const { token } = useParams();
  const [itemInfo, setItemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [orderNumber, setOrderNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isTemporaryBuyer, setIsTemporaryBuyer] = useState(false);

  const fileInputRef = useRef(null);

  // 제품 정보 조회 (item token 또는 slot token)
  useEffect(() => {
    const fetchItemInfo = async () => {
      try {
        setLoading(true);
        let response;
        if (isSlotUpload) {
          // 슬롯 토큰으로 조회
          response = await imageService.getSlotByToken(token);
        } else {
          // 기존 품목 토큰으로 조회
          response = await imageService.getItemByToken(token);
        }
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
  }, [token, isSlotUpload]);

  // 파일 선택 처리 (다중)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = (files) => {
    const fileArray = Array.from(files);
    const validFiles = [];
    const oversizedFiles = [];
    const invalidTypeFiles = [];

    fileArray.forEach(file => {
      if (!file.type.startsWith('image/')) {
        invalidTypeFiles.push(file.name);
      } else if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        oversizedFiles.push(`${file.name} (${sizeMB}MB)`);
      } else {
        validFiles.push(file);
      }
    });

    // 에러 메시지 생성
    const errorMessages = [];
    if (oversizedFiles.length > 0) {
      errorMessages.push(`파일 크기 초과 (10MB 이하만 가능):\n- ${oversizedFiles.join('\n- ')}`);
    }
    if (invalidTypeFiles.length > 0) {
      errorMessages.push(`이미지 파일이 아님:\n- ${invalidTypeFiles.join('\n- ')}`);
    }

    if (errorMessages.length > 0) {
      setUploadError(errorMessages.join('\n\n'));
    }

    if (validFiles.length === 0 && errorMessages.length > 0) {
      return;
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      if (errorMessages.length === 0) {
        setUploadError(null);
      }
      setUploadSuccess(false);

      // 미리보기 생성
      validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrls(prev => [...prev, e.target.result]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // input 파일 선택
  const handleInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
    e.target.value = '';
  };

  // 파일 삭제
  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Ctrl+V 붙여넣기
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      handleFileSelect(imageFiles);
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
    // 주문번호 또는 계좌번호 중 하나는 필수
    if (!orderNumber.trim() && !accountNumber.trim()) {
      setUploadError('주문번호 또는 계좌번호 중 하나는 입력해주세요.');
      return;
    }

    if (selectedFiles.length === 0) {
      setUploadError('이미지를 선택해주세요.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const response = await imageService.uploadImages(token, selectedFiles, accountNumber, isSlotUpload, orderNumber);

      setUploadSuccess(true);
      setIsTemporaryBuyer(response.isTemporaryBuyer);
      setSelectedFiles([]);
      setPreviewUrls([]);
      setOrderNumber('');
      setAccountNumber('');
    } catch (err) {
      console.error('Upload failed:', err);
      const errorMessage = err.response?.data?.message || '이미지 업로드에 실패했습니다. 다시 시도해주세요.';
      setUploadError(errorMessage);
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
            리뷰 이미지 업로드
          </Typography>

          {/* 주문번호 / 계좌번호 입력 - 둘 중 하나 필수 */}
          <Alert severity="info" sx={{ mb: 2 }}>
            주문번호 또는 계좌번호 중 <strong>하나는 필수</strong>로 입력해주세요.
          </Alert>

          <TextField
            label="주문번호"
            fullWidth
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="예: 8100156654664"
            helperText="구매 시 받은 주문번호를 입력하세요"
            sx={{ mb: 2 }}
          />

          <TextField
            label="계좌번호"
            fullWidth
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="예: 국민 123-456-789012 홍길동"
            helperText="계좌번호를 입력하세요 (주문번호 입력 시 생략 가능)"
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
              multiple
              onChange={handleInputChange}
              style={{ display: 'none' }}
            />
            <CloudUploadIcon sx={{ fontSize: 48, color: '#999', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              클릭하여 이미지 선택 (여러 개 가능)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              또는 Ctrl+V로 붙여넣기
            </Typography>
          </Box>

          {/* 다중 이미지 미리보기 */}
          {previewUrls.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                선택된 이미지 ({selectedFiles.length}개):
              </Typography>
              <ImageList cols={3} gap={8}>
                {previewUrls.map((url, idx) => (
                  <ImageListItem key={idx} sx={{ position: 'relative' }}>
                    <img
                      src={url}
                      alt={`Preview ${idx + 1}`}
                      style={{
                        width: '100%',
                        height: 100,
                        objectFit: 'cover',
                        borderRadius: 8
                      }}
                    />
                    <ImageListItemBar
                      sx={{
                        background: 'transparent',
                        '& .MuiImageListItemBar-actionIcon': {
                          position: 'absolute',
                          top: 4,
                          right: 4
                        }
                      }}
                      position="top"
                      actionIcon={
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(idx);
                          }}
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.9)',
                            '&:hover': { bgcolor: 'white' }
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      }
                    />
                  </ImageListItem>
                ))}
              </ImageList>
            </Box>
          )}

          {/* 에러 메시지 */}
          {uploadError && (
            <Alert severity="error" sx={{ mt: 3, whiteSpace: 'pre-line' }}>
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
              <Typography variant="body1" fontWeight="bold">
                이미지가 성공적으로 업로드되었습니다!
              </Typography>
              {isTemporaryBuyer && (
                <Typography variant="body2" sx={{ mt: 1 }} color="warning.main">
                  아직 등록되지 않은 계좌번호입니다. 진행자가 등록하면 자동으로 연결됩니다.
                </Typography>
              )}
              <Typography variant="body2" sx={{ mt: 1 }}>
                추가 이미지를 업로드하려면 주문번호 또는 계좌번호를 다시 입력하세요.
              </Typography>
            </Alert>
          )}

          {/* 업로드 버튼 */}
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploading}
            startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
            sx={{ mt: 3, py: 1.5 }}
          >
            {uploading ? '업로드 중...' : `${selectedFiles.length}개 이미지 업로드`}
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}

export default UploadPage;
