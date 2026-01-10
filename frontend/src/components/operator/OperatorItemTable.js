import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Button, Breadcrumbs, Link, CircularProgress, Alert, Tooltip,
  TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem, IconButton, TableSortLabel
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SearchIcon from '@mui/icons-material/Search';
import CheckIcon from '@mui/icons-material/Check';
import CancelIcon from '@mui/icons-material/Cancel';
import FiberNewIcon from '@mui/icons-material/FiberNew';
import WarningIcon from '@mui/icons-material/Warning';
import { itemService } from '../../services';

function OperatorItemTable() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 검색/필터 상태
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // 입금명 인라인 편집 state
  const [editingDepositId, setEditingDepositId] = useState(null);
  const [editingDepositValue, setEditingDepositValue] = useState('');

  // 정렬 상태
  const [orderBy, setOrderBy] = useState('registered_at');
  const [order, setOrder] = useState('desc');

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // 정렬 핸들러
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // 필터링 및 정렬된 제품 목록
  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      // 제품명 검색
      const matchesSearch = searchKeyword === '' ||
        item.product_name?.toLowerCase().includes(searchKeyword.toLowerCase());

      // 상태 필터
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // 정렬
    return [...filtered].sort((a, b) => {
      let aValue, bValue;

      switch (orderBy) {
        case 'registered_at':
          aValue = a.registered_at || a.created_at || '';
          bValue = b.registered_at || b.created_at || '';
          break;
        case 'product_name':
          aValue = a.product_name || '';
          bValue = b.product_name || '';
          break;
        case 'deposit_name':
          aValue = a.deposit_name || '';
          bValue = b.deposit_name || '';
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
  }, [items, searchKeyword, statusFilter, orderBy, order]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await itemService.getItemsByCampaign(campaignId);
      setItems(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load items:', err);
      setError('제품 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 등록시간 포맷팅 함수
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'active': '진행 중',
      'completed': '완료',
      'cancelled': '취소'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'active': 'primary',
      'completed': 'success',
      'cancelled': 'error'
    };
    return colorMap[status] || 'default';
  };

  // 한국 시간(UTC+9) 기준 날짜 가져오기
  const getKoreanDateString = (date) => {
    const kstOffset = 9 * 60 * 60 * 1000; // UTC+9
    const kstDate = new Date(date.getTime() + kstOffset);
    return kstDate.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  // 신규/진행 상태 판단 함수 (배정받은 당일=신규, 다음날부터=진행) - UTC+9 기준
  const getAssignmentStatus = (item) => {
    // operatorAssignments에서 assigned_at 가져오기
    const assignment = item.operatorAssignments?.[0];
    if (!assignment || !assignment.assigned_at) {
      return 'in_progress'; // 배정 정보 없으면 진행으로 처리
    }

    const assignedDate = new Date(assignment.assigned_at);
    const today = new Date();

    // 한국 시간 기준으로 날짜 비교
    const assignedDateKST = getKoreanDateString(assignedDate);
    const todayKST = getKoreanDateString(today);

    if (assignedDateKST === todayKST) {
      return 'new'; // 오늘 배정받음 = 신규
    }
    return 'in_progress'; // 어제 이전에 배정받음 = 진행
  };

  // 구매자 없음 경고 체크 (진행중인데 구매자가 없으면 경고)
  const needsWarning = (item) => {
    const status = getAssignmentStatus(item);
    const buyerCount = item.buyers?.filter(b => !b.is_temporary).length || 0;
    return status === 'in_progress' && buyerCount === 0;
  };

  // 입금명 편집 관련 핸들러
  const handleDepositEdit = (item, e) => {
    e.stopPropagation();
    setEditingDepositId(item.id);
    setEditingDepositValue(item.deposit_name || '');
  };

  const handleDepositCancel = (e) => {
    e.stopPropagation();
    setEditingDepositId(null);
    setEditingDepositValue('');
  };

  const handleDepositSave = async (itemId, e) => {
    e.stopPropagation();
    try {
      await itemService.updateDepositName(itemId, editingDepositValue);
      await loadItems();
      setEditingDepositId(null);
      setEditingDepositValue('');
    } catch (err) {
      console.error('입금명 저장 실패:', err);
      alert('입금명 저장에 실패했습니다.');
    }
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
          <Link underline="hover" color="inherit" onClick={() => navigate('/operator')} sx={{ cursor: 'pointer' }}>
            캠페인 목록
          </Link>
          <Typography color="text.primary">캠페인 상세 (ID: {campaignId})</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">제품 선택</Typography>
          <Typography variant="body2" color="text.secondary">
            작업할 제품을 선택하여 리뷰를 관리하세요. (총 {items.length}개 중 {filteredItems.length}개 표시)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* 제품명 검색 */}
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
          {/* 상태 필터 */}
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>상태</InputLabel>
            <Select
              value={statusFilter}
              label="상태"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="active">진행 중</MenuItem>
              <MenuItem value="completed">완료</MenuItem>
              <MenuItem value="cancelled">취소</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table hover>
            <TableHead sx={{ bgcolor: '#e0f2f1' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'registered_at'}
                    direction={orderBy === 'registered_at' ? order : 'asc'}
                    onClick={() => handleRequestSort('registered_at')}
                  >
                    등록시간
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
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'deposit_name'}
                    direction={orderBy === 'deposit_name' ? order : 'asc'}
                    onClick={() => handleRequestSort('deposit_name')}
                  >
                    입금명
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>배정상태</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                  <TableSortLabel
                    active={orderBy === 'status'}
                    direction={orderBy === 'status' ? order : 'asc'}
                    onClick={() => handleRequestSort('status')}
                  >
                    상태
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>작업하기</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    onClick={() => navigate(`/operator/campaign/${campaignId}/item/${item.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', color: '#666' }}>
                      {formatDateTime(item.registered_at || item.created_at)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      {item.product_name}
                    </TableCell>
                    {/* 입금명 - 인라인 편집 가능 */}
                    <TableCell onClick={(e) => e.stopPropagation()} sx={{ minWidth: 150 }}>
                      {editingDepositId === item.id ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TextField
                            size="small"
                            value={editingDepositValue}
                            onChange={(e) => setEditingDepositValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleDepositSave(item.id, e);
                              if (e.key === 'Escape') handleDepositCancel(e);
                            }}
                            autoFocus
                            placeholder="입금명 입력"
                            sx={{ width: 120 }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <IconButton size="small" color="primary" onClick={(e) => handleDepositSave(item.id, e)}>
                            <CheckIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={handleDepositCancel}>
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ) : (
                        <Box
                          onClick={(e) => handleDepositEdit(item, e)}
                          sx={{
                            cursor: 'pointer',
                            border: '1px solid #e0e0e0',
                            bgcolor: '#fafafa',
                            '&:hover': { bgcolor: '#f0f0f0', borderColor: '#bdbdbd' },
                            p: 0.5,
                            borderRadius: 1,
                            minHeight: 28,
                            minWidth: 80
                          }}
                        >
                          {item.deposit_name || <Typography variant="caption" color="text.disabled">클릭하여 입력</Typography>}
                        </Box>
                      )}
                    </TableCell>
                    {/* 배정상태: 신규/진행 + 경고 */}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        {getAssignmentStatus(item) === 'new' ? (
                          <Chip
                            icon={<FiberNewIcon />}
                            label="신규"
                            color="warning"
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                          />
                        ) : (
                          <Chip
                            label="진행"
                            color="info"
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {needsWarning(item) && (
                          <Tooltip title="구매자 정보가 없습니다. 등록해주세요!">
                            <WarningIcon color="error" sx={{ fontSize: 20 }} />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getStatusLabel(item.status)}
                        color={getStatusColor(item.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button variant="contained" size="small" color="primary">
                        선택
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: '#999' }}>
                    {items.length === 0
                      ? '등록된 제품이 없습니다.'
                      : '검색 조건에 맞는 제품이 없습니다.'}
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

export default OperatorItemTable;