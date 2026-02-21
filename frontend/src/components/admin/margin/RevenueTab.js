import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Button, IconButton, TextField, Tooltip, Collapse,
  CircularProgress, Snackbar, Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import * as settlementService from '../../../services/settlementService';

const fmt = (v) => {
  const n = Number(v);
  return isNaN(n) ? '0' : Math.round(n).toLocaleString();
};

function RevenueTab({ selectedMonth, onDataChanged }) {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [hasChanges, setHasChanges] = useState(false);

  const loadData = useCallback(async () => {
    if (!selectedMonth) return;
    setLoading(true);
    try {
      const data = await settlementService.getSettlements({ month: selectedMonth });
      // DB 데이터를 편집용 로컬 상태로 변환
      const local = data.map(s => ({
        id: s.id,
        settlement_id: s.settlement_id || '',
        company_name: s.company_name || '',
        month: s.month || selectedMonth,
        rev_processing_fee: s.rev_processing_fee ?? '',
        rev_processing_qty: s.rev_processing_qty ?? '',
        rev_delivery_fee: s.rev_delivery_fee ?? '',
        rev_delivery_qty: s.rev_delivery_qty ?? '',
        exp_processing_fee: s.exp_processing_fee ?? '',
        memo: s.memo || '',
        products: (s.products || []).map(p => ({
          id: p.id,
          product_name: p.product_name || '',
          product_qty: p.product_qty ?? '',
          product_unit_price: p.product_unit_price ?? '',
          sort_order: p.sort_order || 0
        }))
      }));
      setSettlements(local);
      setHasChanges(false);
    } catch (error) {
      console.error('매출 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 정산 필드 수정
  const updateField = (idx, field, value) => {
    setSettlements(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setHasChanges(true);
  };

  // 제품 필드 수정
  const updateProduct = (sIdx, pIdx, field, value) => {
    setSettlements(prev => {
      const next = [...prev];
      const products = [...next[sIdx].products];
      products[pIdx] = { ...products[pIdx], [field]: value };
      next[sIdx] = { ...next[sIdx], products };
      return next;
    });
    setHasChanges(true);
  };

  // 새 정산 행 추가
  const addSettlement = () => {
    setSettlements(prev => [...prev, {
      id: null,
      settlement_id: '',
      company_name: '',
      month: selectedMonth,
      rev_processing_fee: '',
      rev_processing_qty: '',
      rev_delivery_fee: '',
      rev_delivery_qty: '',
      exp_processing_fee: '',
      memo: '',
      products: [{ id: null, product_name: '', product_qty: '', product_unit_price: '', sort_order: 0 }]
    }]);
    setHasChanges(true);
  };

  // 제품 행 추가
  const addProduct = (sIdx) => {
    setSettlements(prev => {
      const next = [...prev];
      const products = [...next[sIdx].products, {
        id: null, product_name: '', product_qty: '', product_unit_price: '',
        sort_order: next[sIdx].products.length
      }];
      next[sIdx] = { ...next[sIdx], products };
      return next;
    });
    setHasChanges(true);
  };

  // 제품 행 삭제
  const removeProduct = (sIdx, pIdx) => {
    setSettlements(prev => {
      const next = [...prev];
      const products = next[sIdx].products.filter((_, i) => i !== pIdx);
      next[sIdx] = { ...next[sIdx], products };
      return next;
    });
    setHasChanges(true);
  };

  // 정산 행 삭제
  const removeSettlement = async (idx) => {
    const s = settlements[idx];
    if (s.id) {
      if (!window.confirm(`"${s.settlement_id}" 정산 데이터를 삭제하시겠습니까?`)) return;
      try {
        await settlementService.deleteSettlement(s.id);
      } catch (error) {
        console.error('삭제 실패:', error);
        setSnackbar({ open: true, message: '삭제 실패', severity: 'error' });
        return;
      }
    }
    setSettlements(prev => prev.filter((_, i) => i !== idx));
    setHasChanges(true);
    onDataChanged?.();
  };

  // 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      for (const s of settlements) {
        const payload = {
          settlement_id: s.settlement_id,
          company_name: s.company_name,
          month: s.month || selectedMonth,
          rev_processing_fee: s.rev_processing_fee || null,
          rev_processing_qty: s.rev_processing_qty || null,
          rev_delivery_fee: s.rev_delivery_fee || null,
          rev_delivery_qty: s.rev_delivery_qty || null,
          exp_processing_fee: s.exp_processing_fee || null,
          memo: s.memo || null,
          products: s.products.map((p, i) => ({
            product_name: p.product_name,
            product_qty: p.product_qty || null,
            product_unit_price: p.product_unit_price || null,
            sort_order: i
          }))
        };

        if (s.id) {
          await settlementService.updateSettlement(s.id, payload);
        } else {
          await settlementService.createSettlement(payload);
        }
      }
      setSnackbar({ open: true, message: '저장 완료', severity: 'success' });
      setHasChanges(false);
      await loadData();
      onDataChanged?.();
    } catch (error) {
      console.error('저장 실패:', error);
      setSnackbar({ open: true, message: '저장 실패: ' + error.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (sid) => {
    setExpandedGroups(prev => ({ ...prev, [sid]: !prev[sid] }));
  };

  // 자동 계산 값
  const calcRevenue = (s) => {
    const pf = parseFloat(s.rev_processing_fee) || 0;
    const pq = parseInt(s.rev_processing_qty) || 0;
    const df = parseFloat(s.rev_delivery_fee) || 0;
    const dq = parseInt(s.rev_delivery_qty) || 0;

    const processingSupply = pf * pq;
    const deliverySupply = df * dq;

    let productTotalSupply = 0;
    (s.products || []).forEach(p => {
      productTotalSupply += (parseInt(p.product_qty) || 0) * (parseFloat(p.product_unit_price) || 0);
    });

    const totalSupply = processingSupply + productTotalSupply + deliverySupply;
    return {
      processingFeeVat: pf * 1.1,
      processingSupply,
      processingTotal: processingSupply * 1.1,
      deliveryFeeVat: df * 1.1,
      deliverySupply,
      deliveryTotal: deliverySupply * 1.1,
      productTotalSupply,
      productTotalWithVat: productTotalSupply * 1.1,
      totalSupply,
      totalWithVat: totalSupply * 1.1
    };
  };

  if (!selectedMonth) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5' }}>
        <Typography color="text.secondary">월을 선택해주세요.</Typography>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          매출 데이터 ({settlements.length}건)
          {hasChanges && <Typography component="span" color="error" sx={{ ml: 1 }}>*수정됨</Typography>}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addSettlement}>
            정산 추가
          </Button>
          <Button
            size="small" variant="contained" startIcon={<SaveIcon />}
            onClick={handleSave} disabled={saving || !hasChanges}
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </Box>
      </Box>

      {settlements.length === 0 && (
        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f5f5f5' }}>
          <Typography color="text.secondary">데이터가 없습니다. "정산 추가" 버튼으로 데이터를 입력하세요.</Typography>
        </Paper>
      )}

      {settlements.map((s, sIdx) => {
        const calc = calcRevenue(s);
        const isExpanded = expandedGroups[sIdx] !== false; // 기본 펼침

        return (
          <Paper key={s.id || `new-${sIdx}`} variant="outlined" sx={{ mb: 1 }}>
            {/* 정산 헤더 */}
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, p: 1,
                bgcolor: '#f5f5f5', cursor: 'pointer'
              }}
              onClick={() => toggleGroup(sIdx)}
            >
              {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 150 }}>
                {s.settlement_id || '(정산ID 미입력)'}
              </Typography>
              <Typography variant="body2" color="text.secondary">{s.company_name}</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography variant="body2" color="primary" fontWeight="bold">
                공급가: {fmt(calc.totalSupply)}원
              </Typography>
              <Typography variant="body2" color="error" fontWeight="bold">
                입금액: {fmt(calc.totalWithVat)}원
              </Typography>
              <Tooltip title="정산 삭제">
                <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); removeSettlement(sIdx); }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Collapse in={isExpanded}>
              <Box sx={{ p: 1.5 }}>
                {/* 기본 정보 */}
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <TextField size="small" label="정산ID" value={s.settlement_id}
                    onChange={(e) => updateField(sIdx, 'settlement_id', e.target.value)}
                    sx={{ width: 200 }} />
                  <TextField size="small" label="업체명" value={s.company_name}
                    onChange={(e) => updateField(sIdx, 'company_name', e.target.value)}
                    sx={{ width: 120 }} />
                  <TextField size="small" label="메모" value={s.memo}
                    onChange={(e) => updateField(sIdx, 'memo', e.target.value)}
                    sx={{ flex: 1, minWidth: 150 }} />
                </Box>

                {/* 진행비 */}
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 1.5 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                        <TableCell colSpan={6} sx={{ fontWeight: 'bold', py: 0.5 }}>진행비 (매출)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>진행비 단가</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>수량</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>단가+VAT</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>총 공급가</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>총 입금액(+VAT)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ py: 0.5 }}>
                          <TextField size="small" type="number" value={s.rev_processing_fee}
                            onChange={(e) => updateField(sIdx, 'rev_processing_fee', e.target.value)}
                            sx={{ width: 120 }} inputProps={{ style: { textAlign: 'right' } }} />
                        </TableCell>
                        <TableCell sx={{ py: 0.5 }}>
                          <TextField size="small" type="number" value={s.rev_processing_qty}
                            onChange={(e) => updateField(sIdx, 'rev_processing_qty', e.target.value)}
                            sx={{ width: 80 }} inputProps={{ style: { textAlign: 'right' } }} />
                        </TableCell>
                        <TableCell align="right" sx={{ py: 0.5, color: '#666' }}>{fmt(calc.processingFeeVat)}</TableCell>
                        <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>{fmt(calc.processingSupply)}</TableCell>
                        <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold', color: '#1976d2' }}>{fmt(calc.processingTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* 제품비 */}
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 1.5 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#e8f5e9' }}>
                        <TableCell colSpan={7} sx={{ fontWeight: 'bold', py: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>제품비 (매출)</span>
                            <Tooltip title="제품 추가">
                              <IconButton size="small" onClick={() => addProduct(sIdx)}>
                                <AddCircleOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>제품명</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>수량</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>단가</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>단가+VAT</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>공급가</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>입금액(+VAT)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5, width: 40 }}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {s.products.map((p, pIdx) => {
                        const pSupply = (parseInt(p.product_qty) || 0) * (parseFloat(p.product_unit_price) || 0);
                        return (
                          <TableRow key={p.id || `np-${pIdx}`}>
                            <TableCell sx={{ py: 0.5 }}>
                              <TextField size="small" value={p.product_name}
                                onChange={(e) => updateProduct(sIdx, pIdx, 'product_name', e.target.value)}
                                sx={{ width: 200 }} />
                            </TableCell>
                            <TableCell sx={{ py: 0.5 }}>
                              <TextField size="small" type="number" value={p.product_qty}
                                onChange={(e) => updateProduct(sIdx, pIdx, 'product_qty', e.target.value)}
                                sx={{ width: 70 }} inputProps={{ style: { textAlign: 'right' } }} />
                            </TableCell>
                            <TableCell sx={{ py: 0.5 }}>
                              <TextField size="small" type="number" value={p.product_unit_price}
                                onChange={(e) => updateProduct(sIdx, pIdx, 'product_unit_price', e.target.value)}
                                sx={{ width: 100 }} inputProps={{ style: { textAlign: 'right' } }} />
                            </TableCell>
                            <TableCell align="right" sx={{ py: 0.5, color: '#666' }}>
                              {fmt((parseFloat(p.product_unit_price) || 0) * 1.1)}
                            </TableCell>
                            <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>{fmt(pSupply)}</TableCell>
                            <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold', color: '#2e7d32' }}>{fmt(pSupply * 1.1)}</TableCell>
                            <TableCell sx={{ py: 0.5 }}>
                              {s.products.length > 1 && (
                                <IconButton size="small" onClick={() => removeProduct(sIdx, pIdx)}>
                                  <DeleteIcon fontSize="inherit" />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                        <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>제품비 합계</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5 }}>{fmt(calc.productTotalSupply)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', py: 0.5, color: '#2e7d32' }}>{fmt(calc.productTotalWithVat)}</TableCell>
                        <TableCell sx={{ py: 0.5 }}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* 택배대행 */}
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#fff3e0' }}>
                        <TableCell colSpan={5} sx={{ fontWeight: 'bold', py: 0.5 }}>택배대행 (매출)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>택배 단가</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>수량</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>단가+VAT</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>총 공급가</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', py: 0.5 }}>총 입금액(+VAT)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ py: 0.5 }}>
                          <TextField size="small" type="number" value={s.rev_delivery_fee}
                            onChange={(e) => updateField(sIdx, 'rev_delivery_fee', e.target.value)}
                            sx={{ width: 120 }} inputProps={{ style: { textAlign: 'right' } }} />
                        </TableCell>
                        <TableCell sx={{ py: 0.5 }}>
                          <TextField size="small" type="number" value={s.rev_delivery_qty}
                            onChange={(e) => updateField(sIdx, 'rev_delivery_qty', e.target.value)}
                            sx={{ width: 80 }} inputProps={{ style: { textAlign: 'right' } }} />
                        </TableCell>
                        <TableCell align="right" sx={{ py: 0.5, color: '#666' }}>{fmt(calc.deliveryFeeVat)}</TableCell>
                        <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>{fmt(calc.deliverySupply)}</TableCell>
                        <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold', color: '#ed6c02' }}>{fmt(calc.deliveryTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* 합계 */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3, mt: 1, p: 1, bgcolor: '#fafafa', borderRadius: 1 }}>
                  <Typography variant="body2"><strong>매출 공급가:</strong> {fmt(calc.totalSupply)}원</Typography>
                  <Typography variant="body2" color="primary"><strong>매출 입금액(+VAT):</strong> {fmt(calc.totalWithVat)}원</Typography>
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

export default RevenueTab;
