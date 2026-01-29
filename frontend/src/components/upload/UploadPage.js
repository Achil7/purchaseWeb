import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Alert, CircularProgress,
  Container, IconButton, Checkbox, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import imageService from '../../services/imageService';

function UploadPage({ isSlotUpload = false }) {
  const { token } = useParams();
  const [itemInfo, setItemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1단계: 이름 검색
  const [searchName, setSearchName] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // 2단계: 구매자 선택
  const [selectedBuyers, setSelectedBuyers] = useState([]);

  // 3단계: 이미지 업로드
  const [buyerFiles, setBuyerFiles] = useState({}); // { buyerId: File[] }
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const fileInputRefs = useRef({});

  // 제품 정보 조회
  useEffect(() => {
    const fetchItemInfo = async () => {
      try {
        setLoading(true);
        let response;
        if (isSlotUpload) {
          response = await imageService.getSlotByToken(token);
        } else {
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

  // 이름으로 검색
  const handleSearch = async () => {
    if (!searchName.trim()) {
      setSearchError('이름을 입력해주세요.');
      return;
    }

    try {
      setSearching(true);
      setSearchError(null);
      setHasSearched(true);
      setSelectedBuyers([]);
      setBuyerFiles({});
      setUploadSuccess(false);

      const response = await imageService.searchBuyersByName(token, searchName.trim());
      setSearchResults(response.data || []);

      if (response.data?.length === 0) {
        setSearchError(`"${searchName}"에 해당하는 주문을 찾을 수 없습니다.`);
      }
    } catch (err) {
      console.error('Search failed:', err);
      setSearchError(err.response?.data?.message || '검색에 실패했습니다.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Enter 키로 검색
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 구매자 선택/해제
  const handleToggleBuyer = (buyer) => {
    setSelectedBuyers(prev => {
      const isSelected = prev.some(b => b.id === buyer.id);
      if (isSelected) {
        // 선택 해제 시 해당 파일도 제거
        setBuyerFiles(prevFiles => {
          const newFiles = { ...prevFiles };
          delete newFiles[buyer.id];
          return newFiles;
        });
        return prev.filter(b => b.id !== buyer.id);
      } else {
        return [...prev, buyer];
      }
    });
    setUploadSuccess(false);
    setUploadError(null);
  };

  // 현재 포커스된 구매자 ID (붙여넣기용)
  const [focusedBuyerId, setFocusedBuyerId] = useState(null);

  // 파일 선택
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = (buyerId, files) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const validFiles = [];

    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) {
        setUploadError(`${file.name}: 이미지 파일만 업로드 가능합니다.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setUploadError(`${file.name} (${sizeMB}MB): 파일 크기가 10MB를 초과합니다.`);
        return;
      }

      validFiles.push(file);
    }

    setBuyerFiles(prev => ({
      ...prev,
      [buyerId]: [...(prev[buyerId] || []), ...validFiles]
    }));
    setUploadError(null);
  };

  // 개별 파일 삭제
  const removeFile = (buyerId, fileIndex) => {
    setBuyerFiles(prev => ({
      ...prev,
      [buyerId]: prev[buyerId].filter((_, idx) => idx !== fileIndex)
    }));
  };

  // 붙여넣기 처리 (Ctrl+V)
  const handlePaste = (buyerId) => (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      handleFileSelect(buyerId, files);
      e.preventDefault();
    }
  };

  // 드래그 앤 드롭 처리
  const handleDrop = (buyerId) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelect(buyerId, files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 업로드 처리
  const handleUpload = async () => {
    // 선택된 구매자 모두에 대해 파일이 있는지 확인
    const missingFiles = selectedBuyers.filter(b => !buyerFiles[b.id] || buyerFiles[b.id].length === 0);
    if (missingFiles.length > 0) {
      setUploadError(`모든 선택한 주문에 이미지를 추가해주세요. (${missingFiles.length}개 누락)`);
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      // buyerId별 파일 배열을 평탄화하여 매핑 정보와 함께 전송
      const uploadData = [];
      selectedBuyers.forEach(buyer => {
        const files = buyerFiles[buyer.id] || [];
        files.forEach(file => {
          uploadData.push({ buyerId: buyer.id, file });
        });
      });

      const buyerIds = uploadData.map(d => d.buyerId);  // [1, 1, 2, 2, 2] 형태 가능
      const files = uploadData.map(d => d.file);

      await imageService.uploadImages(token, buyerIds, files);

      setUploadSuccess(true);
      // 성공 후 초기화
      const uploadedBuyerIds = selectedBuyers.map(b => b.id);
      setSelectedBuyers([]);
      setBuyerFiles({});
      // 검색 결과에서 업로드된 구매자를 hasImage로 표시 (재검색하면 재제출 가능 상태로)
      setSearchResults(prev => prev.map(b =>
        uploadedBuyerIds.includes(b.id) ? { ...b, hasImage: true } : b
      ));
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError(err.response?.data?.message || '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // 총 업로드 파일 수 계산
  const getTotalFileCount = () => {
    return Object.values(buyerFiles).reduce((sum, files) => sum + (files?.length || 0), 0);
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
      <Container maxWidth="md">
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          {/* 제목 */}
          <Typography variant="h5" fontWeight="bold" align="center" gutterBottom>
            {itemInfo?.campaign_name} / {itemInfo?.product_name}
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>
            리뷰 이미지 업로드
          </Typography>

          {/* 1단계: 이름 검색 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              1. 페이백 예금주 명으로 주문 검색
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="페이백 예금주 명을 입력하세요 (예: 홍길동)"
                disabled={searching}
              />
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={searching || !searchName.trim()}
                startIcon={searching ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                sx={{ minWidth: 100 }}
              >
                검색
              </Button>
            </Box>
            {searchError && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {searchError}
              </Alert>
            )}
          </Box>

          {/* 2단계: 검색 결과 및 선택 */}
          {hasSearched && searchResults.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                2. 주문 선택 ({searchResults.filter(b => !b.hasImage).length}건 선택 가능 / {searchResults.length}건 검색됨)
              </Typography>
              <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell padding="checkbox" />
                      <TableCell>주문번호</TableCell>
                      <TableCell>입금명</TableCell>
                      <TableCell>구매자</TableCell>
                      <TableCell>수취인</TableCell>
                      <TableCell>아이디</TableCell>
                      <TableCell>상태</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {searchResults.map((buyer) => {
                      const isSelected = selectedBuyers.some(b => b.id === buyer.id);
                      const hasImage = buyer.hasImage;
                      return (
                        <TableRow
                          key={buyer.id}
                          hover
                          onClick={() => handleToggleBuyer(buyer)}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: hasImage
                              ? (isSelected ? '#fff3e0' : '#fff8e1')
                              : (isSelected ? '#e3f2fd' : 'inherit')
                          }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox checked={isSelected} />
                          </TableCell>
                          <TableCell>
                            {buyer.order_number || '-'}
                          </TableCell>
                          <TableCell>
                            {buyer.deposit_name || ''}
                          </TableCell>
                          <TableCell>
                            {buyer.buyer_name || '-'}
                          </TableCell>
                          <TableCell>
                            {buyer.recipient_name || '-'}
                          </TableCell>
                          <TableCell>
                            {buyer.user_id || '-'}
                          </TableCell>
                          <TableCell>
                            {hasImage ? (
                              <Chip label="재제출 가능" size="small" color="warning" />
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                대기중
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {selectedBuyers.length > 0 && (
                <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                  {selectedBuyers.length}개 주문 선택됨
                </Typography>
              )}
            </Box>
          )}

          {/* 3단계: 이미지 업로드 */}
          {selectedBuyers.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                3. 각 주문별 이미지 선택 ({selectedBuyers.length}개)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                각 주문 영역을 클릭 후 이미지를 선택하거나, Ctrl+V로 붙여넣기, 또는 드래그 앤 드롭하세요.
              </Typography>
              {selectedBuyers.some(b => b.hasImage) && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  재제출된 이미지는 관리자 승인 후 기존 이미지를 대체합니다.
                </Alert>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedBuyers.map((buyer, index) => {
                  const files = buyerFiles[buyer.id] || [];
                  const isFocused = focusedBuyerId === buyer.id;
                  return (
                    <Paper
                      key={buyer.id}
                      variant="outlined"
                      tabIndex={0}
                      onFocus={() => setFocusedBuyerId(buyer.id)}
                      onPaste={handlePaste(buyer.id)}
                      onDrop={handleDrop(buyer.id)}
                      onDragOver={handleDragOver}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        border: isFocused ? '2px solid #1976d2' : '1px solid #e0e0e0',
                        bgcolor: isFocused ? '#e3f2fd' : 'inherit',
                        '&:hover': { bgcolor: '#f5f5f5' },
                        outline: 'none'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          주문 {index + 1}: {buyer.order_number} ({buyer.buyer_name})
                          {files.length > 0 && (
                            <Chip label={`${files.length}장`} size="small" color="primary" sx={{ ml: 1 }} />
                          )}
                        </Typography>
                        {isFocused && (
                          <Typography variant="caption" color="primary">
                            Ctrl+V 또는 드래그로 이미지 추가
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <input
                          ref={el => fileInputRefs.current[buyer.id] = el}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleFileSelect(buyer.id, e.target.files)}
                          style={{ display: 'none' }}
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => fileInputRefs.current[buyer.id]?.click()}
                          startIcon={<CloudUploadIcon />}
                          sx={{ flexShrink: 0 }}
                        >
                          파일 선택
                        </Button>
                        {files.length > 0 ? (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {files.map((file, fileIdx) => (
                              <Box
                                key={fileIdx}
                                sx={{
                                  position: 'relative',
                                  display: 'inline-block'
                                }}
                              >
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={`미리보기 ${fileIdx + 1}`}
                                  style={{
                                    width: 60,
                                    height: 60,
                                    objectFit: 'cover',
                                    borderRadius: 4,
                                    border: '1px solid #e0e0e0'
                                  }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFile(buyer.id, fileIdx);
                                  }}
                                  sx={{
                                    position: 'absolute',
                                    top: -8,
                                    right: -8,
                                    bgcolor: 'white',
                                    boxShadow: 1,
                                    '&:hover': { bgcolor: '#ffebee' },
                                    p: 0.25
                                  }}
                                >
                                  <CloseIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Box>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="error">
                            이미지를 선택해주세요
                          </Typography>
                        )}
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* 에러 메시지 */}
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {uploadError}
            </Alert>
          )}

          {/* 성공 메시지 */}
          {uploadSuccess && (
            <Alert
              severity="success"
              icon={<CheckCircleIcon />}
              sx={{ mb: 2 }}
            >
              <Typography variant="body1" fontWeight="bold">
                이미지가 성공적으로 업로드되었습니다!
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                추가 이미지를 업로드하려면 페이백 예금주 명을 다시 검색하세요.
              </Typography>
            </Alert>
          )}

          {/* 업로드 버튼 */}
          {selectedBuyers.length > 0 && (
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleUpload}
              disabled={uploading || selectedBuyers.some(b => !buyerFiles[b.id] || buyerFiles[b.id].length === 0)}
              startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
              sx={{ py: 1.5 }}
            >
              {uploading ? '업로드 중...' : `${getTotalFileCount()}개 이미지 업로드 (${selectedBuyers.length}개 주문)`}
            </Button>
          )}
        </Paper>
      </Container>
    </Box>
  );
}

export default UploadPage;
