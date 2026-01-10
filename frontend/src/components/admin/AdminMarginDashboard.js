import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, CircularProgress, Alert, Chip, TextField, MenuItem,
  Button, IconButton, Tooltip
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import itemService from '../../services/itemService';
import AdminItemExpenseDialog from './AdminItemExpenseDialog';

function AdminMarginDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // 월 옵션 생성 (최근 12개월)
  const monthOptions = React.useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
      options.push({ value, label });
    }
    return options;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (selectedMonth) {
        params.month = selectedMonth;
      }
      const result = await itemService.getMarginSummary(params);
      // API 응답: { success, data, summary, count }
      // 백엔드 snake_case -> 프론트엔드 camelCase 변환
      const items = (result.data || []).map(item => ({
        id: item.id,
        campaignName: item.campaign_name,
        productName: item.product_name,
        totalCount: item.total_count,
        salePrice: item.sale_price_per_unit,
        courierPrice: item.courier_price_per_unit,
        courierServiceYn: item.courier_service_yn,
        totalRevenue: item.total_revenue,
        totalRevenueVat: item.total_revenue_vat,
        totalExpense: item.total_expense,
        margin: item.margin,
        marginRate: item.margin_rate,
        // 지출 다이얼로그용 원본 데이터
        expense_product: item.expense_product,
        expense_courier: item.expense_courier,
        expense_review: item.expense_review,
        expense_other: item.expense_other,
        expense_note: item.expense_note,
        total_purchase_count: item.total_count,
        sale_price_per_unit: item.sale_price_per_unit,
        courier_price_per_unit: item.courier_price_per_unit,
        courier_service_yn: item.courier_service_yn,
        product_name: item.product_name
      }));
      const summary = result.summary ? {
        totalRevenue: result.summary.total_revenue,
        totalRevenueVat: result.summary.total_revenue_vat,
        totalExpense: result.summary.total_expense,
        totalMargin: result.summary.total_margin,
        totalMarginRate: result.summary.margin_rate
      } : {};
      setData({ items, summary });
    } catch (err) {
      setError(err.response?.data?.message || '마진 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExpenseClick = (item) => {
    setSelectedItem(item);
    setExpenseDialogOpen(true);
  };

  const handleExpenseDialogClose = () => {
    setExpenseDialogOpen(false);
    setSelectedItem(null);
  };

  const handleExpenseSaved = () => {
    fetchData();
  };

  const handleExportCSV = () => {
    if (!data?.items) return;

    const headers = ['캠페인명', '품목명', '총건수', '판매단가', '택배단가', '총매출(공급가)', '총매출(VAT)', '총지출', '마진', '마진율'];
    const rows = data.items.map(item => [
      item.campaignName,
      item.productName,
      item.totalCount,
      item.salePrice,
      item.courierPrice,
      item.totalRevenue,
      item.totalRevenueVat,
      item.totalExpense,
      item.margin,
      `${item.marginRate}%`
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `마진현황_${selectedMonth || 'all'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const summary = data?.summary || {};
  const items = data?.items || [];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          마진 현황
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            select
            size="small"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            sx={{ minWidth: 150 }}
            label="기간"
          >
            <MenuItem value="">전체</MenuItem>
            {monthOptions.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
          <Tooltip title="새로고침">
            <IconButton onClick={fetchData}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportCSV}
            disabled={items.length === 0}
          >
            CSV 다운로드
          </Button>
        </Box>
      </Box>

      {/* 요약 카드 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, flex: 1, minWidth: 200, bgcolor: '#e3f2fd' }}>
          <Typography variant="caption" color="text.secondary">총 매출 (공급가)</Typography>
          <Typography variant="h5" fontWeight="bold">
            {(summary.totalRevenue || 0).toLocaleString()}원
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, minWidth: 200, bgcolor: '#e3f2fd' }}>
          <Typography variant="caption" color="text.secondary">총 매출 (VAT 포함)</Typography>
          <Typography variant="h5" fontWeight="bold" color="primary">
            {(summary.totalRevenueVat || 0).toLocaleString()}원
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, minWidth: 200, bgcolor: '#fff3e0' }}>
          <Typography variant="caption" color="text.secondary">총 지출</Typography>
          <Typography variant="h5" fontWeight="bold" color="warning.main">
            {(summary.totalExpense || 0).toLocaleString()}원
          </Typography>
        </Paper>
        <Paper sx={{
          p: 2,
          flex: 1,
          minWidth: 200,
          bgcolor: (summary.totalMargin || 0) >= 0 ? '#e8f5e9' : '#ffebee'
        }}>
          <Typography variant="caption" color="text.secondary">순 마진</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {(summary.totalMargin || 0) >= 0 ?
              <TrendingUpIcon color="success" /> :
              <TrendingDownIcon color="error" />
            }
            <Typography
              variant="h5"
              fontWeight="bold"
              color={(summary.totalMargin || 0) >= 0 ? 'success.main' : 'error.main'}
            >
              {(summary.totalMargin || 0) >= 0 ? '+' : ''}{(summary.totalMargin || 0).toLocaleString()}원
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            마진율: {summary.totalMarginRate || 0}%
          </Typography>
        </Paper>
      </Box>

      {/* 품목별 테이블 */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>캠페인명</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>품목명</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>총건수</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>판매단가</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>택배단가</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>총매출(공급가)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>총매출(VAT)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>총지출</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>마진</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>마진율</TableCell>
              <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>지출입력</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">데이터가 없습니다.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.campaignName}</TableCell>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell align="right">{item.totalCount}</TableCell>
                  <TableCell align="right">{item.salePrice?.toLocaleString() || '-'}</TableCell>
                  <TableCell align="right">{item.courierPrice?.toLocaleString() || '-'}</TableCell>
                  <TableCell align="right">{item.totalRevenue?.toLocaleString() || 0}</TableCell>
                  <TableCell align="right">{item.totalRevenueVat?.toLocaleString() || 0}</TableCell>
                  <TableCell align="right">{item.totalExpense?.toLocaleString() || 0}</TableCell>
                  <TableCell align="right">
                    <Typography
                      component="span"
                      fontWeight="bold"
                      color={item.margin >= 0 ? 'success.main' : 'error.main'}
                    >
                      {item.margin >= 0 ? '+' : ''}{item.margin?.toLocaleString() || 0}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${item.marginRate || 0}%`}
                      size="small"
                      color={item.margin >= 0 ? 'success' : 'error'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="지출 입력/수정">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleExpenseClick(item)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 지출 입력 다이얼로그 */}
      <AdminItemExpenseDialog
        open={expenseDialogOpen}
        onClose={handleExpenseDialogClose}
        item={selectedItem}
        onSave={handleExpenseSaved}
      />
    </Box>
  );
}

export default AdminMarginDashboard;
