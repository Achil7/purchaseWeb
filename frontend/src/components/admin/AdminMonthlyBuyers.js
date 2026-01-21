import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, CircularProgress, Alert, TextField, TablePagination, InputAdornment, TableSortLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider, Grid
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import { itemService } from '../../services';

function AdminMonthlyBuyers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 검색 필터
  const [searchProduct, setSearchProduct] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // 페이지네이션
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // 정렬 상태
  const [orderBy, setOrderBy] = useState('registered_at');
  const [order, setOrder] = useState('desc');

  // 제품 상세 다이얼로그
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await itemService.getAllItems();
      setItems(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load items:', err);
      setError('제품 목록을 불러오는데 실패했습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // 정렬 핸들러
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // 필터링 및 정렬된 제품 목록
  const filteredItems = useMemo(() => {
    const filtered = items.filter(item => {
      // 제품명 검색
      const matchesProduct = !searchProduct ||
        item.product_name?.toLowerCase().includes(searchProduct.toLowerCase()) ||
        item.campaign?.name?.toLowerCase().includes(searchProduct.toLowerCase());

      // 날짜 필터 (캠페인 등록일 기준)
      const matchesDate = !filterDate ||
        (item.campaign?.registered_at && item.campaign.registered_at.startsWith(filterDate));

      return matchesProduct && matchesDate;
    });

    // 정렬
    return [...filtered].sort((a, b) => {
      let aValue, bValue;

      switch (orderBy) {
        case 'registered_at':
          aValue = a.campaign?.registered_at || a.created_at || '';
          bValue = b.campaign?.registered_at || b.created_at || '';
          break;
        case 'brand':
          aValue = a.campaign?.brand?.name || '';
          bValue = b.campaign?.brand?.name || '';
          break;
        case 'campaign':
          aValue = a.campaign?.name || '';
          bValue = b.campaign?.name || '';
          break;
        case 'product_name':
          aValue = a.product_name || '';
          bValue = b.product_name || '';
          break;
        case 'creator':
          aValue = a.campaign?.creator?.name || '';
          bValue = b.campaign?.creator?.name || '';
          break;
        case 'operator':
          aValue = a.operatorAssignments?.[0]?.operator?.name || '';
          bValue = b.operatorAssignments?.[0]?.operator?.name || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        default:
          aValue = a[orderBy] || '';
          bValue = b[orderBy] || '';
      }

      const comparison = String(aValue).localeCompare(String(bValue), 'ko');
      return order === 'asc' ? comparison : -comparison;
    });
  }, [items, searchProduct, filterDate, orderBy, order]);

  // 현재 페이지에 표시할 데이터
  const paginatedItems = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredItems.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  // 날짜 포맷팅
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return dateString.split('T')[0];
  };

  // 제품명 클릭 시 상세 다이얼로그 열기
  const handleItemClick = (item, e) => {
    e.stopPropagation();
    setSelectedItem(item);
    setDetailDialogOpen(true);
  };

  // 다이얼로그 닫기
  const handleCloseDetail = () => {
    setDetailDialogOpen(false);
    setSelectedItem(null);
  };

  // 페이지 변경
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // 페이지당 행 수 변경
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 진행자 이름 추출
  const getOperatorName = (item) => {
    if (item.operatorAssignments && item.operatorAssignments.length > 0) {
      return item.operatorAssignments.map(a => a.operator?.name).filter(Boolean).join(', ') || '-';
    }
    return '-';
  };

  // 검색 시 페이지 리셋
  useEffect(() => {
    setPage(0);
  }, [searchProduct, filterDate]);

  return (
    <>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CalendarMonthIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">전체 제품 조회</Typography>
            <Typography variant="body2" color="text.secondary">
              등록된 모든 제품을 조회합니다. 제품명을 클릭하면 상세 정보를 확인할 수 있습니다.
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="제품/캠페인명 검색..."
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            sx={{ minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              )
            }}
          />
          <TextField
            type="date"
            size="small"
            label="등록일"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            sx={{ minWidth: 160 }}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </Box>

      {/* 요약 정보 */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#e3f2fd', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="body1">
            {filterDate ? <strong>{filterDate}</strong> : '전체'} 제품 현황
          </Typography>
          <Chip
            label={`총 ${filteredItems.length}개 제품`}
            color="primary"
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: '60vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                    <TableSortLabel
                      active={orderBy === 'registered_at'}
                      direction={orderBy === 'registered_at' ? order : 'asc'}
                      onClick={() => handleRequestSort('registered_at')}
                    >
                      등록일
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                    <TableSortLabel
                      active={orderBy === 'brand'}
                      direction={orderBy === 'brand' ? order : 'asc'}
                      onClick={() => handleRequestSort('brand')}
                    >
                      브랜드
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                    <TableSortLabel
                      active={orderBy === 'campaign'}
                      direction={orderBy === 'campaign' ? order : 'asc'}
                      onClick={() => handleRequestSort('campaign')}
                    >
                      캠페인
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                    <TableSortLabel
                      active={orderBy === 'product_name'}
                      direction={orderBy === 'product_name' ? order : 'asc'}
                      onClick={() => handleRequestSort('product_name')}
                    >
                      제품명
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                    <TableSortLabel
                      active={orderBy === 'creator'}
                      direction={orderBy === 'creator' ? order : 'asc'}
                      onClick={() => handleRequestSort('creator')}
                    >
                      영업사
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                    <TableSortLabel
                      active={orderBy === 'operator'}
                      direction={orderBy === 'operator' ? order : 'asc'}
                      onClick={() => handleRequestSort('operator')}
                    >
                      진행자
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                    <TableSortLabel
                      active={orderBy === 'status'}
                      direction={orderBy === 'status' ? order : 'asc'}
                      onClick={() => handleRequestSort('status')}
                    >
                      상태
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((item) => (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{ '&:hover': { bgcolor: '#f5f5f5' } }}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap', color: '#666' }}>
                        {formatDate(item.campaign?.registered_at)}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {item.campaign?.brand?.name || '-'}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {item.campaign?.name || '-'}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 'bold',
                          color: 'primary.main',
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                        onClick={(e) => handleItemClick(item, e)}
                      >
                        {item.product_name || '-'}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {item.campaign?.creator?.name || '-'}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {getOperatorName(item)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={item.status === 'active' ? '진행중' : item.status === 'completed' ? '완료' : '취소'}
                          color={item.status === 'active' ? 'success' : item.status === 'completed' ? 'default' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#999' }}>
                      {searchProduct || filterDate ? '검색 결과가 없습니다.' : '등록된 제품이 없습니다.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 페이지네이션 */}
          <TablePagination
            component="div"
            count={filteredItems.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 20, 50, 100]}
            labelRowsPerPage="페이지당 행:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
          />
        </Paper>
      )}

      {/* 제품 상세 정보 다이얼로그 */}
      <Dialog
        open={detailDialogOpen}
        onClose={(event, reason) => { if (reason !== 'backdropClick') handleCloseDetail(); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#e3f2fd' }}>
          <InfoIcon color="primary" />
          제품 상세 정보
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedItem && (
            <Box>
              {/* 기본 정보 */}
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'primary.main' }}>
                기본 정보
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">제품명</Typography>
                  <Typography variant="body1" fontWeight="bold">{selectedItem.product_name || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">캠페인</Typography>
                  <Typography variant="body1">{selectedItem.campaign?.name || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">브랜드</Typography>
                  <Typography variant="body1">{selectedItem.campaign?.brand?.name || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">영업사</Typography>
                  <Typography variant="body1">{selectedItem.campaign?.creator?.name || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">진행자</Typography>
                  <Typography variant="body1">{getOperatorName(selectedItem)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">플랫폼</Typography>
                  <Typography variant="body1">{selectedItem.platform || '-'}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* 구매 정보 */}
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'primary.main' }}>
                구매 정보
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">총 구매건수</Typography>
                  <Typography variant="body1" fontWeight="bold">{selectedItem.total_purchase_count || 0}건</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">일 구매건수</Typography>
                  <Typography variant="body1">{selectedItem.daily_purchase_count || 0}건</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">출고 마감</Typography>
                  <Typography variant="body1">{selectedItem.shipping_deadline || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">제품 가격</Typography>
                  <Typography variant="body1">{selectedItem.product_price ? `${Number(selectedItem.product_price).toLocaleString()}원` : '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">택배대행</Typography>
                  <Typography variant="body1">{selectedItem.courier_service_yn || '-'}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* 상품 정보 */}
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'primary.main' }}>
                상품 정보
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">상품 URL</Typography>
                  {selectedItem.product_url ? (
                    <Typography
                      variant="body2"
                      component="a"
                      href={selectedItem.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'primary.main', display: 'block', wordBreak: 'break-all' }}
                    >
                      {selectedItem.product_url}
                    </Typography>
                  ) : (
                    <Typography variant="body1">-</Typography>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">구매 옵션</Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{selectedItem.purchase_option || '-'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">희망 유입 키워드</Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{selectedItem.keywords || '-'}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* 리뷰 가이드 */}
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'primary.main' }}>
                리뷰 가이드
              </Typography>
              <Paper sx={{ p: 2, bgcolor: '#f5f5f5', mb: 2 }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedItem.review_guide || '등록된 리뷰 가이드가 없습니다.'}
                </Typography>
              </Paper>

              {/* 비고 */}
              {selectedItem.notes && (
                <>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'primary.main' }}>
                    비고
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: '#fff3e0' }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedItem.notes}
                    </Typography>
                  </Paper>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDetail} variant="contained">
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default AdminMonthlyBuyers;
