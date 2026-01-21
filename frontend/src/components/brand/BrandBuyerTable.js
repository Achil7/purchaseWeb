import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Link, Breadcrumbs, Dialog, DialogContent, IconButton, CircularProgress, Alert, TableSortLabel,
  Card, CardContent, Grid, Chip, ToggleButton, ToggleButtonGroup, ImageList, ImageListItem
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import PaidIcon from '@mui/icons-material/Paid';
import ImageIcon from '@mui/icons-material/Image';
import PeopleIcon from '@mui/icons-material/People';
import { Button } from '@mui/material';
import { buyerService, itemService } from '../../services';

function BrandBuyerTable({ isAdminMode = false, viewAsUserId = null }) {
  const { campaignId, itemId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = viewAsUserId || searchParams.get('userId');
  const basePath = isAdminMode && userId ? `/admin/view-brand?userId=${userId}` : '/brand';

  const [buyers, setBuyers] = useState([]);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 뷰 모드: 'table' 또는 'gallery'
  const [viewMode, setViewMode] = useState('gallery');

  // 이미지 확대 다이얼로그 state
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

  const handleImageClick = (image, buyer) => {
    setSelectedImage({ ...image, buyer });
    setImageDialogOpen(true);
  };

  const handleCloseImageDialog = () => {
    setImageDialogOpen(false);
    setSelectedImage(null);
  };

  // 정렬 핸들러
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // 필터링된 구매자 (임시 구매자 제외)
  const filteredBuyers = buyers.filter(b => !b.is_temporary);

  // 통계 계산
  const stats = useMemo(() => {
    let totalImages = 0;
    let totalAmount = 0;

    filteredBuyers.forEach(buyer => {
      if (buyer.images && buyer.images.length > 0) {
        totalImages += buyer.images.length;
      }
      if (buyer.amount) {
        totalAmount += Number(buyer.amount) || 0;
      }
    });

    return { totalBuyers: filteredBuyers.length, totalImages, totalAmount };
  }, [filteredBuyers]);

  // 정렬된 구매자 목록
  const sortedBuyers = useMemo(() => {
    return [...filteredBuyers].sort((a, b) => {
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
        case 'tracking_number':
          aValue = a.tracking_number || '';
          bValue = b.tracking_number || '';
          break;
        case 'amount':
          aValue = Number(a.amount) || 0;
          bValue = Number(b.amount) || 0;
          if (order === 'asc') return aValue - bValue;
          return bValue - aValue;
        default:
          aValue = a[orderBy] || '';
          bValue = b[orderBy] || '';
      }

      const comparison = String(aValue).localeCompare(String(bValue), 'ko');
      return order === 'asc' ? comparison : -comparison;
    });
  }, [filteredBuyers, orderBy, order]);

  // 이미지가 있는 구매자만 필터 (갤러리 뷰용)
  const buyersWithImages = sortedBuyers.filter(b => b.images && b.images.length > 0);

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
          <Link underline="hover" color="inherit" onClick={() => navigate(basePath)} sx={{ cursor: 'pointer' }}>
            캠페인 목록
          </Link>
          <Link underline="hover" color="inherit" onClick={() => navigate(`${basePath}/campaign/${campaignId}`)} sx={{ cursor: 'pointer' }}>
            제품 목록
          </Link>
          <Typography color="text.primary">{item?.product_name || '리뷰 현황'}</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon/>} onClick={() => navigate(-1)} sx={{ mb:1 }}>뒤로가기</Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h5" fontWeight="bold">{item?.product_name}</Typography>
          {item?.platform && (
            <Chip label={item.platform} color="info" size="small" />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary">
          리뷰 현황
        </Typography>
      </Box>

      {/* 통계 카드 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#e3f2fd', borderRadius: 2 }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon color="info" />
                <Box>
                  <Typography variant="caption" color="text.secondary">구매자</Typography>
                  <Typography variant="h5" fontWeight="bold">{stats.totalBuyers}명</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#fff3e0', borderRadius: 2 }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ImageIcon color="warning" />
                <Box>
                  <Typography variant="caption" color="text.secondary">리뷰 이미지</Typography>
                  <Typography variant="h5" fontWeight="bold">{stats.totalImages}개</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#fce4ec', borderRadius: 2 }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PaidIcon sx={{ color: '#c2185b' }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">총 금액</Typography>
                  <Typography variant="h5" fontWeight="bold" color="#c2185b">
                    {stats.totalAmount.toLocaleString()}원
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 뷰 모드 토글 */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, newMode) => newMode && setViewMode(newMode)}
          size="small"
        >
          <ToggleButton value="gallery">
            <ViewModuleIcon sx={{ mr: 0.5 }} /> 갤러리
          </ToggleButton>
          <ToggleButton value="table">
            <ViewListIcon sx={{ mr: 0.5 }} /> 테이블
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {viewMode === 'gallery' ? (
        /* 갤러리 뷰 */
        <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3 }}>
          {buyersWithImages.length > 0 ? (
            <ImageList cols={4} gap={16}>
              {buyersWithImages.map((buyer) => (
                buyer.images.map((image, idx) => (
                  <ImageListItem
                    key={`${buyer.id}-${idx}`}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: '2px solid transparent',
                      transition: 'all 0.2s',
                      '&:hover': {
                        border: '2px solid #9c27b0',
                        transform: 'scale(1.02)'
                      }
                    }}
                    onClick={() => handleImageClick(image, buyer)}
                  >
                    <Box
                      component="img"
                      src={image.s3_url}
                      alt={`리뷰 - ${buyer.buyer_name}`}
                      loading="lazy"
                      sx={{
                        width: '100%',
                        height: 200,
                        objectFit: 'cover'
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        p: 1
                      }}
                    >
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>
                        {buyer.buyer_name}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                        {buyer.order_number}
                      </Typography>
                    </Box>
                  </ImageListItem>
                ))
              ))}
            </ImageList>
          ) : (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <ImageIcon sx={{ fontSize: 60, color: '#ccc', mb: 2 }} />
              <Typography color="text.secondary">
                등록된 리뷰 이미지가 없습니다.
              </Typography>
            </Box>
          )}
        </Paper>
      ) : (
        /* 테이블 뷰 */
        <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 3 }}>
          <TableContainer sx={{ maxHeight: '65vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ede7f6', whiteSpace: 'nowrap', minWidth: 120 }}>
                    <TableSortLabel
                      active={orderBy === 'order_number'}
                      direction={orderBy === 'order_number' ? order : 'asc'}
                      onClick={() => handleRequestSort('order_number')}
                    >
                      주문번호
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ede7f6', whiteSpace: 'nowrap', minWidth: 80 }}>
                    <TableSortLabel
                      active={orderBy === 'buyer_name'}
                      direction={orderBy === 'buyer_name' ? order : 'asc'}
                      onClick={() => handleRequestSort('buyer_name')}
                    >
                      구매자
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ede7f6', whiteSpace: 'nowrap', minWidth: 80 }}>
                    <TableSortLabel
                      active={orderBy === 'recipient_name'}
                      direction={orderBy === 'recipient_name' ? order : 'asc'}
                      onClick={() => handleRequestSort('recipient_name')}
                    >
                      수취인
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ede7f6', whiteSpace: 'nowrap', minWidth: 150 }}>
                    <TableSortLabel
                      active={orderBy === 'user_id'}
                      direction={orderBy === 'user_id' ? order : 'asc'}
                      onClick={() => handleRequestSort('user_id')}
                    >
                      아이디
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#ede7f6', whiteSpace: 'nowrap', minWidth: 100 }}>
                    <TableSortLabel
                      active={orderBy === 'amount'}
                      direction={orderBy === 'amount' ? order : 'asc'}
                      onClick={() => handleRequestSort('amount')}
                    >
                      금액
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ede7f6', whiteSpace: 'nowrap', minWidth: 80 }}>
                    택배대행
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ede7f6', whiteSpace: 'nowrap', minWidth: 120 }}>
                    <TableSortLabel
                      active={orderBy === 'tracking_number'}
                      direction={orderBy === 'tracking_number' ? order : 'asc'}
                      onClick={() => handleRequestSort('tracking_number')}
                    >
                      송장번호
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ede7f6', whiteSpace: 'nowrap', minWidth: 80 }}>
                    택배사
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#ede7f6', whiteSpace: 'nowrap', minWidth: 100 }}>
                    리뷰샷
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedBuyers.length > 0 ? (
                  sortedBuyers.map((buyer) => (
                    <TableRow key={buyer.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.order_number}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>{buyer.buyer_name}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.recipient_name}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.user_id}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 'bold', color: '#c2185b' }}>
                        {buyer.amount ? `${Number(buyer.amount).toLocaleString()}원` : '-'}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {item?.courier_service_yn || '-'}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {buyer.tracking_number || '-'}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {buyer.courier_company || '-'}
                      </TableCell>
                      {/* 이미지 - 구매자당 1개만 표시 (1:1 매칭) */}
                      <TableCell align="center">
                        {buyer.images && buyer.images.length > 0 ? (
                          <Box
                            onClick={() => handleImageClick(buyer.images[0], buyer)}
                            sx={{ cursor: 'pointer', display: 'inline-block' }}
                          >
                            <Box
                              component="img"
                              src={buyer.images[0].s3_url}
                              alt="리뷰이미지"
                              sx={{
                                width: 50,
                                height: 50,
                                objectFit: 'cover',
                                borderRadius: 1,
                                border: '2px solid #9c27b0',
                                transition: 'transform 0.2s',
                                '&:hover': { transform: 'scale(1.1)' }
                              }}
                            />
                          </Box>
                        ) : <Typography variant="caption" color="text.disabled">-</Typography>}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6, color: '#999' }}>
                      등록된 데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* 이미지 확대 Dialog */}
      <Dialog
        open={imageDialogOpen}
        onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseImageDialog(); }}
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
                  maxHeight: '80vh',
                  objectFit: 'contain'
                }}
              />
              <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>구매자:</strong> {selectedImage.buyer?.buyer_name}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>수취인:</strong> {selectedImage.buyer?.recipient_name}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>주문번호:</strong> {selectedImage.buyer?.order_number}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>아이디:</strong> {selectedImage.buyer?.user_id}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>택배대행:</strong> {item?.courier_service_yn || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>송장번호:</strong> {selectedImage.buyer?.tracking_number || '-'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>택배사:</strong> {selectedImage.buyer?.courier_company || '-'}
                    </Typography>
                  </Grid>
                  {selectedImage.buyer?.amount && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="#c2185b" fontWeight="bold">
                        <strong>금액:</strong> {Number(selectedImage.buyer.amount).toLocaleString()}원
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BrandBuyerTable;
