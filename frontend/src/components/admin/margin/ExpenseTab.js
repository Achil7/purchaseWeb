import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, TextField, CircularProgress, Button, Snackbar, Alert, Collapse,
  IconButton
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import * as settlementService from '../../../services/settlementService';

const fmt = (v) => {
  const n = Number(v);
  return isNaN(n) ? '0' : Math.round(n).toLocaleString();
};

function ExpenseTab({ selectedMonth, onDataChanged }) {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deliveryCostWithVat, setDeliveryCostWithVat] = useState(2750);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [hasChanges, setHasChanges] = useState(false);

  const loadData = useCallback(async () => {
    if (!selectedMonth) return;
    setLoading(true);
    try {
      const [data, settings] = await Promise.all([
        settlementService.getSettlements({ month: selectedMonth }),
        settlementService.getSettings()
      ]);
      setDeliveryCostWithVat(parseFloat(settings.delivery_cost_with_vat) || 2750);

      const local = data.map(s => ({
        id: s.id,
        settlement_id: s.settlement_id || '',
        company_name: s.company_name || '',
        rev_processing_fee: parseFloat(s.rev_processing_fee) || 0,
        rev_processing_qty: parseInt(s.rev_processing_qty) || 0,
        rev_delivery_fee: parseFloat(s.rev_delivery_fee) || 0,
        rev_delivery_qty: parseInt(s.rev_delivery_qty) || 0,
        exp_processing_fee: s.exp_processing_fee ?? '',
        products: (s.products || []).map(p => ({
          product_name: p.product_name || '',
          product_qty: parseInt(p.product_qty) || 0,
          product_unit_price: parseFloat(p.product_unit_price) || 0
        }))
      }));
      setSettlements(local);
      setHasChanges(false);
    } catch (error) {
      console.error('지출 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateExpFee = (idx, value) => {
    setSettlements(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], exp_processing_fee: value };
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const s of settlements) {
        if (s.id) {
          await settlementService.updateSettlement(s.id, {
            exp_processing_fee: s.exp_processing_fee || null
          });
        }
      }
      setSnackbar({ open: true, message: '저장 완료', severity: 'success' });
      setHasChanges(false);
      onDataChanged?.();
    } catch (error) {
      console.error('저장 실패:', error);
      setSnackbar({ open: true, message: '저장 실패', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (idx) => {
    setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const calcExpense = (s) => {
    const epf = parseFloat(s.exp_processing_fee) || 0;
    const expProcessingTotal = epf * s.rev_processing_qty;

    let productTotal = 0;
    s.products.forEach(p => { productTotal += p.product_qty * p.product_unit_price; });

    const expDeliveryTotal = deliveryCostWithVat * s.rev_delivery_qty;
    const totalExpense = expProcessingTotal + productTotal + expDeliveryTotal;

    return { expProcessingTotal, productTotal, expDeliveryTotal, totalExpense };
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          지출 데이터 ({settlements.length}건)
          {hasChanges && <Typography component="span" color="error" sx={{ ml: 1 }}>*수정됨</Typography>}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            택배실비(+VAT): {fmt(deliveryCostWithVat)}원
          </Typography>
          <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={handleSave}
            disabled={saving || !hasChanges}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        지출에서 직접 입력하는 값은 <strong>진행비(실비) 단가</strong>뿐입니다. 나머지는 매출 데이터에서 자동으로 가져옵니다.
      </Alert>

      {settlements.length === 0 && (
        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f5f5f5' }}>
          <Typography color="text.secondary">매출 탭에서 먼저 데이터를 입력해주세요.</Typography>
        </Paper>
      )}

      {settlements.map((s, idx) => {
        const calc = calcExpense(s);
        const isExpanded = expandedGroups[idx] !== false;

        return (
          <Paper key={s.id || idx} variant="outlined" sx={{ mb: 1 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: '#f5f5f5', cursor: 'pointer' }}
              onClick={() => toggleGroup(idx)}
            >
              {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 150 }}>
                {s.settlement_id}
              </Typography>
              <Typography variant="body2" color="text.secondary">{s.company_name}</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography variant="body2" color="error" fontWeight="bold">
                총 지출: {fmt(calc.totalExpense)}원
              </Typography>
            </Box>

            <Collapse in={isExpanded}>
              <Box sx={{ p: 1.5 }}>
                {/* 진행비 지출 */}
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 1.5 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#fce4ec' }}>
                        <TableCell colSpan={4} sx={{ fontWeight: 'bold', py: 0.5 }}>진행비 (지출)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>진행비(실비) 단가</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>수량 (매출)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>매출 진행비 단가</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>진행비 총 지출</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ py: 0.5 }}>
                          <TextField size="small" type="number" value={s.exp_processing_fee}
                            onChange={(e) => updateExpFee(idx, e.target.value)}
                            sx={{ width: 120 }} inputProps={{ style: { textAlign: 'right' } }}
                            placeholder="실비 입력" />
                        </TableCell>
                        <TableCell sx={{ py: 0.5, color: '#666' }}>{s.rev_processing_qty}</TableCell>
                        <TableCell sx={{ py: 0.5, color: '#666' }}>{fmt(s.rev_processing_fee)} (참고)</TableCell>
                        <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>{fmt(calc.expProcessingTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* 제품비 지출 */}
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 1.5 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#e8f5e9' }}>
                        <TableCell colSpan={4} sx={{ fontWeight: 'bold', py: 0.5 }}>제품비 (지출 = 매출 동일)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>제품명</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>수량</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>단가</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>지출액</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {s.products.map((p, pIdx) => (
                        <TableRow key={pIdx}>
                          <TableCell sx={{ py: 0.5, color: '#666' }}>{p.product_name}</TableCell>
                          <TableCell sx={{ py: 0.5, color: '#666' }}>{p.product_qty}</TableCell>
                          <TableCell sx={{ py: 0.5, color: '#666' }}>{fmt(p.product_unit_price)}</TableCell>
                          <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>{fmt(p.product_qty * p.product_unit_price)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                        <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>제품비 총 지출</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>{fmt(calc.productTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* 택배대행 지출 */}
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#fff3e0' }}>
                        <TableCell colSpan={3} sx={{ fontWeight: 'bold', py: 0.5 }}>택배대행 (지출)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>실비+VAT (설정값)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>수량 (매출)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>택배대행 총 지출</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ py: 0.5, color: '#666' }}>{fmt(deliveryCostWithVat)}</TableCell>
                        <TableCell sx={{ py: 0.5, color: '#666' }}>{s.rev_delivery_qty}</TableCell>
                        <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>{fmt(calc.expDeliveryTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* 합계 */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3, mt: 1, p: 1, bgcolor: '#fff8e1', borderRadius: 1 }}>
                  <Typography variant="body2"><strong>진행비 지출:</strong> {fmt(calc.expProcessingTotal)}원</Typography>
                  <Typography variant="body2"><strong>제품비 지출:</strong> {fmt(calc.productTotal)}원</Typography>
                  <Typography variant="body2"><strong>택배 지출:</strong> {fmt(calc.expDeliveryTotal)}원</Typography>
                  <Typography variant="body2" color="error"><strong>총 지출:</strong> {fmt(calc.totalExpense)}원</Typography>
                </Box>
              </Box>
            </Collapse>
          </Paper>
        );
      })}

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ExpenseTab;
