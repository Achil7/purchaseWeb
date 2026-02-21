import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, CircularProgress, TextField, Button, Snackbar, Alert, Divider
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import * as settlementService from '../../../services/settlementService';

const fmt = (v) => {
  const n = Number(v);
  return isNaN(n) ? '0' : Math.round(n).toLocaleString();
};

function SummaryTab({ selectedMonth }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deliveryCostInput, setDeliveryCostInput] = useState('2750');
  const [savingSettings, setSavingSettings] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadData = useCallback(async () => {
    if (!selectedMonth) return;
    setLoading(true);
    try {
      const data = await settlementService.getSummary({ month: selectedMonth });
      setSummary(data);
      setDeliveryCostInput(String(data.settings?.deliveryCostWithVat || 2750));
    } catch (error) {
      console.error('총정리 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await settlementService.updateSettings({
        delivery_cost_with_vat: deliveryCostInput
      });
      setSnackbar({ open: true, message: '설정 저장 완료', severity: 'success' });
      await loadData(); // 재계산
    } catch (error) {
      setSnackbar({ open: true, message: '설정 저장 실패', severity: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  if (!selectedMonth) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5' }}>
        <Typography color="text.secondary">월을 선택해주세요.</Typography>
      </Paper>
    );
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
  }

  if (!summary) return null;

  const { overview, bySettlementId } = summary;

  return (
    <Box>
      {/* 전체 요약 카드 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>전체 요약</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">총 매출 공급가</Typography>
            <Typography variant="h6" fontWeight="bold" color="primary">{fmt(overview.totalRevenueSupply)}원</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">총 매출 입금액(+VAT)</Typography>
            <Typography variant="h6" fontWeight="bold">{fmt(overview.totalRevenueWithVat)}원</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">부가세</Typography>
            <Typography variant="h6" fontWeight="bold" color="text.secondary">{fmt(overview.totalVat)}원</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">총 지출</Typography>
            <Typography variant="h6" fontWeight="bold" color="error">{fmt(overview.totalExpense)}원</Typography>
          </Paper>
          <Paper variant="outlined" sx={{
            p: 2, textAlign: 'center',
            bgcolor: overview.netMargin >= 0 ? '#e8f5e9' : '#ffebee'
          }}>
            <Typography variant="body2" color="text.secondary">순 마진</Typography>
            <Typography variant="h6" fontWeight="bold" color={overview.netMargin >= 0 ? 'success.main' : 'error.main'}>
              {fmt(overview.netMargin)}원
            </Typography>
            {overview.totalRevenueSupply > 0 && (
              <Typography variant="caption" color="text.secondary">
                마진율: {((overview.netMargin / overview.totalRevenueSupply) * 100).toFixed(1)}%
              </Typography>
            )}
          </Paper>
        </Box>
      </Paper>

      {/* 정산ID별 요약 테이블 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          정산ID별 요약 ({bySettlementId.length}건)
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#e0e0e0' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>정산ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>업체명</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>매출 공급가</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>매출 입금액(+VAT)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>총 지출</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>순 마진</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>마진율</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bySettlementId.map((row) => {
                const marginRate = row.revenueSupply > 0
                  ? ((row.netMargin / row.revenueSupply) * 100).toFixed(1)
                  : '0.0';
                return (
                  <TableRow key={row.settlementId} hover>
                    <TableCell sx={{ py: 0.5 }}>{row.settlementId}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>{row.companyName}</TableCell>
                    <TableCell align="right" sx={{ py: 0.5 }}>{fmt(row.revenueSupply)}</TableCell>
                    <TableCell align="right" sx={{ py: 0.5 }}>{fmt(row.revenueWithVat)}</TableCell>
                    <TableCell align="right" sx={{ py: 0.5, color: '#d32f2f' }}>{fmt(row.totalExpense)}</TableCell>
                    <TableCell align="right" sx={{
                      py: 0.5, fontWeight: 'bold',
                      color: row.netMargin >= 0 ? '#2e7d32' : '#d32f2f'
                    }}>
                      {fmt(row.netMargin)}
                    </TableCell>
                    <TableCell align="right" sx={{
                      py: 0.5,
                      color: parseFloat(marginRate) >= 0 ? '#2e7d32' : '#d32f2f'
                    }}>
                      {marginRate}%
                    </TableCell>
                  </TableRow>
                );
              })}
              {bySettlementId.length > 0 && (
                <TableRow sx={{ bgcolor: '#fff3e0' }}>
                  <TableCell sx={{ fontWeight: 'bold', py: 0.5 }} colSpan={2}>합계</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>{fmt(overview.totalRevenueSupply)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>{fmt(overview.totalRevenueWithVat)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5, color: '#d32f2f' }}>{fmt(overview.totalExpense)}</TableCell>
                  <TableCell align="right" sx={{
                    fontWeight: 'bold', py: 0.5,
                    color: overview.netMargin >= 0 ? '#2e7d32' : '#d32f2f'
                  }}>
                    {fmt(overview.netMargin)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>
                    {overview.totalRevenueSupply > 0
                      ? ((overview.netMargin / overview.totalRevenueSupply) * 100).toFixed(1) + '%'
                      : '-'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 설정값 */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <SettingsIcon fontSize="small" color="action" />
          <Typography variant="subtitle1" fontWeight="bold">설정값</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            size="small"
            label="택배대행(실비)+VAT 단가"
            type="number"
            value={deliveryCostInput}
            onChange={(e) => setDeliveryCostInput(e.target.value)}
            sx={{ width: 200 }}
            inputProps={{ style: { textAlign: 'right' } }}
          />
          <Button
            size="small" variant="outlined"
            onClick={handleSaveSettings}
            disabled={savingSettings}
          >
            {savingSettings ? '저장 중...' : '설정 저장'}
          </Button>
          <Typography variant="body2" color="text.secondary">
            지출 탭의 택배대행 실비 계산에 사용됩니다.
          </Typography>
        </Box>
      </Paper>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default SummaryTab;
