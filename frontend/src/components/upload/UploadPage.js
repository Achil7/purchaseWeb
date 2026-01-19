import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Alert, CircularProgress,
  Container, IconButton, Checkbox, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow
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
  const [buyerFiles, setBuyerFiles] = useState({}); // { buyerId: File }
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

  const handleFileSelect = (buyerId, file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError(`${file.name}: 이미지 파일만 업로드 가능합니다.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setUploadError(`${file.name} (${sizeMB}MB): 파일 크기가 10MB를 초과합니다.`);
      return;
    }

    setBuyerFiles(prev => ({
      ...prev,
      [buyerId]: file
    }));
    setUploadError(null);
  };

  // 붙여넣기 처리 (Ctrl+V)
  const handlePaste = (buyerId) => (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleFileSelect(buyerId, file);
          e.preventDefault();
          return;
        }
      }
    }
  };

  // 드래그 앤 드롭 처리
  const handleDrop = (buyerId) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFileSelect(buyerId, file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 업로드 처리
  const handleUpload = async () => {
    // 선택된 구매자 모두에 대해 파일이 있는지 확인
    const missingFiles = selectedBuyers.filter(b => !buyerFiles[b.id]);
    if (missingFiles.length > 0) {
      setUploadError(`모든 선택한 주문에 이미지를 추가해주세요. (${missingFiles.length}개 누락)`);
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      // 선택 순서대로 buyerIds와 files 배열 생성
      const buyerIds = selectedBuyers.map(b => b.id);
      const files = selectedBuyers.map(b => buyerFiles[b.id]);

      await imageService.uploadImages(token, buyerIds, files);

      setUploadSuccess(true);
      // 성공 후 초기화
      setSelectedBuyers([]);
      setBuyerFiles({});
      // 검색 결과에서 업로드된 구매자 제거
      setSearchResults(prev => prev.filter(b => !buyerIds.includes(b.id)));
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError(err.response?.data?.message || '이미지 업로드에 실패했습니다.');
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
              1. 이름으로 주문 검색
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="이름을 입력하세요 (예: 홍길동)"
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
                          hover={!hasImage}
                          onClick={() => !hasImage && handleToggleBuyer(buyer)}
                          sx={{
                            cursor: hasImage ? 'not-allowed' : 'pointer',
                            bgcolor: hasImage ? '#f5f5f5' : (isSelected ? '#e3f2fd' : 'inherit'),
                            opacity: hasImage ? 0.6 : 1
                          }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox checked={isSelected} disabled={hasImage} />
                          </TableCell>
                          <TableCell sx={{ color: hasImage ? 'text.disabled' : 'inherit' }}>
                            {buyer.order_number || '-'}
                          </TableCell>
                          <TableCell sx={{ color: hasImage ? 'text.disabled' : 'inherit' }}>
                            {buyer.buyer_name || '-'}
                          </TableCell>
                          <TableCell sx={{ color: hasImage ? 'text.disabled' : 'inherit' }}>
                            {buyer.recipient_name || '-'}
                          </TableCell>
                          <TableCell sx={{ color: hasImage ? 'text.disabled' : 'inherit' }}>
                            {buyer.user_id || '-'}
                          </TableCell>
                          <TableCell>
                            {hasImage ? (
                              <Typography variant="caption" color="success.main" fontWeight="bold">
                                업로드 완료
                              </Typography>
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
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedBuyers.map((buyer, index) => {
                  const file = buyerFiles[buyer.id];
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
                        </Typography>
                        {isFocused && (
                          <Typography variant="caption" color="primary">
                            Ctrl+V 또는 드래그로 이미지 추가
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <input
                          ref={el => fileInputRefs.current[buyer.id] = el}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileSelect(buyer.id, e.target.files[0])}
                          style={{ display: 'none' }}
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => fileInputRefs.current[buyer.id]?.click()}
                          startIcon={<CloudUploadIcon />}
                        >
                          파일 선택
                        </Button>
                        {file ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <img
                              src={URL.createObjectURL(file)}
                              alt="preview"
                              style={{
                                width: 50,
                                height: 50,
                                objectFit: 'cover',
                                borderRadius: 4
                              }}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {file.name}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBuyerFiles(prev => {
                                  const newFiles = { ...prev };
                                  delete newFiles[buyer.id];
                                  return newFiles;
                                });
                              }}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
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
                추가 이미지를 업로드하려면 이름을 다시 검색하세요.
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
              disabled={uploading || selectedBuyers.some(b => !buyerFiles[b.id])}
              startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
              sx={{ py: 1.5 }}
            >
              {uploading ? '업로드 중...' : `${selectedBuyers.length}개 이미지 업로드`}
            </Button>
          )}
        </Paper>
      </Container>
    </Box>
  );
}

export default UploadPage;
