import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Button, Breadcrumbs, Link, CircularProgress, Alert, TextField, InputAdornment,
  TableSortLabel, Card, CardContent, Grid
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import PaidIcon from '@mui/icons-material/Paid';
import ImageIcon from '@mui/icons-material/Image';
import PeopleIcon from '@mui/icons-material/People';
import { itemService, campaignService } from '../../services';

function BrandItemTable({ isAdminMode = false, viewAsUserId = null }) {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = viewAsUserId || searchParams.get('userId');
  const basePath = isAdminMode && userId ? `/admin/view-brand?userId=${userId}` : '/brand';

  const [items, setItems] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 검색/필터 상태
  const [searchKeyword, setSearchKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 정렬 상태
  const [orderBy, setOrderBy] = useState('registered_at');
  const [order, setOrder] = useState('desc');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 캠페인 정보와 제품 목록 동시 조회
      const params = userId ? { viewAsUserId: userId, viewAsRole: 'brand' } : {};
      const [campaignRes, itemsRes] = await Promise.all([
        campaignService.getCampaign(campaignId, params),
        itemService.getItemsByCampaign(campaignId, params)
      ]);

      setCampaign(campaignRes.data);
      setItems(itemsRes.data || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 통계 계산
  const stats = useMemo(() => {
    let totalBuyers = 0;
    let totalImages = 0;
    let totalAmount = 0;

    items.forEach(item => {
      const buyers = item.buyers || [];
      const realBuyers = buyers.filter(b => !b.is_temporary);
      totalBuyers += realBuyers.length;

      realBuyers.forEach(buyer => {
        if (buyer.images && buyer.images.length > 0) {
          totalImages += buyer.images.length;
        }
        if (buyer.amount) {
          totalAmount += Number(buyer.amount) || 0;
        }
      });
    });

    return { totalBuyers, totalImages, totalAmount };
  }, [items]);

  // 정렬 핸들러
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // 필터링 및 정렬된 제품 목록
  const filteredItems = useMemo(() => {
    let result = [...items];

    // 제품명 검색
    if (searchKeyword) {
      result = result.filter((item) =>
        item.product_name?.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    }

    // 날짜 필터
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter((item) => {
        const itemDate = new Date(item.registered_at || item.created_at);
        return itemDate >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter((item) => {
        const itemDate = new Date(item.registered_at || item.created_at);
        return itemDate <= end;
      });
    }

    // 정렬
    result.sort((a, b) => {
      let aValue, bValue;

      if (orderBy === 'registered_at') {
        aValue = new Date(a.registered_at || a.created_at);
        bValue = new Date(b.registered_at || b.created_at);
      } else if (orderBy === 'product_name') {
        aValue = a.product_name?.toLowerCase() || '';
        bValue = b.product_name?.toLowerCase() || '';
      } else if (orderBy === 'buyers_count') {
        aValue = (a.buyers || []).filter(b => !b.is_temporary).length;
        bValue = (b.buyers || []).filter(b => !b.is_temporary).length;
      } else if (orderBy === 'platform') {
        aValue = a.platform || '';
        bValue = b.platform || '';
      } else if (orderBy === 'total_amount') {
        aValue = (a.buyers || []).filter(b => !b.is_temporary).reduce((sum, buyer) => sum + (Number(buyer.amount) || 0), 0);
        bValue = (b.buyers || []).filter(b => !b.is_temporary).reduce((sum, buyer) => sum + (Number(buyer.amount) || 0), 0);
      } else {
        aValue = a[orderBy];
        bValue = b[orderBy];
      }

      if (order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return result;
  }, [items, searchKeyword, startDate, endDate, orderBy, order]);

  // 등록일 포맷팅
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 상태에 따른 Chip 색상
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'default';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return '진행 중';
      case 'completed': return '완료';
      case 'cancelled': return '취소';
      default: return status;
    }
  };

  // 품목별 금액 합계
  const getItemTotalAmount = (item) => {
    const buyers = item.buyers || [];
    return buyers.filter(b => !b.is_temporary).reduce((sum, buyer) => sum + (Number(buyer.amount) || 0), 0);
  };

  // 품목별 이미지 수
  const getItemImageCount = (item) => {
    const buyers = item.buyers || [];
    return buyers.filter(b => !b.is_temporary).reduce((sum, buyer) => sum + (buyer.images?.length || 0), 0);
  };

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
          <Typography color="text.primary">{campaign?.name || '제품 목록'}</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 1 }}>
          뒤로가기
        </Button>
        <Typography variant="h5" fontWeight="bold">{campaign?.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          총 {items.length}개 제품 중 {filteredItems.length}개 표시
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
                  <Typography variant="caption" color="text.secondary">총 구매자</Typography>
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
                  <Typography variant="caption" color="text.secondary">총 리뷰 이미지</Typography>
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

      {/* 검색 및 필터 */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="제품명 검색..."
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 200 }}
        />
        <TextField
          type="date"
          size="small"
          label="시작일"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          type="date"
          size="small"
          label="종료일"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        {(searchKeyword || startDate || endDate) && (
          <Button
            size="small"
            onClick={() => {
              setSearchKeyword('');
              setStartDate('');
              setEndDate('');
            }}
          >
            필터 초기화
          </Button>
        )}
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: 3 }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#ede7f6' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'registered_at'}
                    direction={orderBy === 'registered_at' ? order : 'asc'}
                    onClick={() => handleRequestSort('registered_at')}
                  >
                    등록일
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'product_name'}
                    direction={orderBy === 'product_name' ? order : 'asc'}
                    onClick={() => handleRequestSort('product_name')}
                  >
                    제품명
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'platform'}
                    direction={orderBy === 'platform' ? order : 'asc'}
                    onClick={() => handleRequestSort('platform')}
                  >
                    플랫폼
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'buyers_count'}
                    direction={orderBy === 'buyers_count' ? order : 'asc'}
                    onClick={() => handleRequestSort('buyers_count')}
                  >
                    구매자
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>리뷰</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'total_amount'}
                    direction={orderBy === 'total_amount' ? order : 'asc'}
                    onClick={() => handleRequestSort('total_amount')}
                  >
                    금액
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>상태</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>상세</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const buyerCount = (item.buyers || []).filter(b => !b.is_temporary).length;
                  const imageCount = getItemImageCount(item);
                  const totalAmount = getItemTotalAmount(item);

                  return (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                      onClick={() => navigate(`${basePath}/campaign/${campaignId}/item/${item.id}`)}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap', color: '#666' }}>
                        {formatDateTime(item.registered_at || item.created_at)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {item.product_name}
                        </Typography>
                        {item.keyword && (
                          <Typography variant="caption" color="text.secondary">
                            {item.keyword}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {item.platform ? (
                          <Chip label={item.platform} size="small" color="info" variant="outlined" />
                        ) : (
                          <Typography variant="caption" color="text.disabled">-</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${buyerCount}명`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={<ImageIcon sx={{ fontSize: 14 }} />}
                          label={imageCount}
                          size="small"
                          color={imageCount > 0 ? 'warning' : 'default'}
                          variant={imageCount > 0 ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" color="#c2185b">
                          {totalAmount.toLocaleString()}원
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={getStatusLabel(item.status)}
                          size="small"
                          color={getStatusColor(item.status)}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="contained"
                          size="small"
                          color="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`${basePath}/campaign/${campaignId}/item/${item.id}`);
                          }}
                        >
                          리뷰 보기
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#999' }}>
                    {items.length === 0 ? '등록된 제품이 없습니다.' : '검색 조건에 맞는 제품이 없습니다.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
}

export default BrandItemTable;
