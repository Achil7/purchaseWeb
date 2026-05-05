import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Button, CircularProgress, Alert, Divider,
  Table, TableHead, TableBody, TableRow, TableCell, TableFooter,
  FormControl, InputLabel, Select, MenuItem, Tooltip, Chip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import * as brandSettlementService from '../../services/brandSettlementService';

const fmt = (n) => `₩${Number(n || 0).toLocaleString('ko-KR')}`;
const ALL = '__ALL__';

function HeaderWithTooltip({ label, formula, sx }) {
  return (
    <TableCell align="right" sx={sx}>
      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
        <span>{label}</span>
        <Tooltip
          title={formula}
          arrow
          placement="top"
          componentsProps={{
            tooltip: {
              sx: { fontSize: '0.85rem', maxWidth: 320, py: 1, px: 1.25, lineHeight: 1.5 },
            },
          }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', cursor: 'help' }} />
        </Tooltip>
      </Stack>
    </TableCell>
  );
}

function SummaryCard({ subtotal }) {
  const total = subtotal?.total || {};
  const submitted = subtotal?.submitted || {};
  const totalSum = total.sum || 0;
  const submittedSum = submitted.sum || 0;
  const remaining = Math.max(totalSum - submittedSum, 0);
  const rate = totalSum > 0 ? ((submittedSum / totalSum) * 100).toFixed(1) : '0.0';

  return (
    <Paper variant="outlined" sx={{ p: 2.5, bgcolor: '#eef4ff' }}>
      <Stack
        direction="row"
        spacing={4}
        divider={<Divider orientation="vertical" flexItem />}
        alignItems="stretch"
      >
        <Box sx={{ flex: 1, pr: 1 }}>
          <Typography variant="caption" color="text.secondary">전체 합계</Typography>
          <Typography variant="h6" fontWeight="bold" sx={{ mt: 0.5 }}>{fmt(totalSum)}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            금액 {fmt(total.amount)} · 리뷰비 {fmt(total.reviewCost)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            결제 금액 (VAT 포함) {fmt(total.paymentAmount)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            전체 수수료 단가 {fmt(total.unitPrice)} · 구매자 {Number(total.buyerCount || 0).toLocaleString('ko-KR')}명
          </Typography>
        </Box>
        <Box sx={{ flex: 1, pl: 1 }}>
          <Typography variant="caption" color="text.secondary">제출 합계 ({rate}%)</Typography>
          <Typography variant="h6" fontWeight="bold" color="success.main" sx={{ mt: 0.5 }}>
            {fmt(submittedSum)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            금액 {fmt(submitted.amount)} · 리뷰비 {fmt(submitted.reviewCost)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            제출 결제 금액 (VAT 포함) {fmt(submitted.paymentAmount)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            제출 구매자 {Number(submitted.buyerCount || 0).toLocaleString('ko-KR')}명
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #d0d7e2' }}>
        <Typography variant="caption" color="text.secondary">
          남은 금액 (미제출): <strong>{fmt(remaining)}</strong>
        </Typography>
      </Box>
    </Paper>
  );
}

// 빈 합계 객체 (서버 응답 형태와 동일)
const emptyBuckets = () => ({
  total: { amount: 0, reviewCost: 0, sum: 0, paymentAmount: 0, unitPrice: 0, buyerCount: 0 },
  submitted: { amount: 0, reviewCost: 0, sum: 0, paymentAmount: 0, buyerCount: 0 },
});

function reduceProducts(products) {
  const acc = emptyBuckets();
  for (const p of products) {
    for (const k of Object.keys(acc.total)) acc.total[k] += p.total?.[k] || 0;
    for (const k of Object.keys(acc.submitted)) acc.submitted[k] += p.submitted?.[k] || 0;
  }
  return acc;
}

function SalesBrandSettlement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({ brands: [] });

  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState(ALL);
  const [selectedYearMonth, setSelectedYearMonth] = useState(ALL);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await brandSettlementService.getSalesProductSummary();
      setData(res?.data || { brands: [] });
    } catch (e) {
      console.error(e);
      setError('정산 요약을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 브랜드 첫 로드 시 첫 항목 자동 선택
  useEffect(() => {
    if (!selectedBrandId && data.brands?.length > 0) {
      setSelectedBrandId(String(data.brands[0].brandId));
    }
  }, [data, selectedBrandId]);

  // 브랜드 변경 시 플랫폼/월별 초기화
  useEffect(() => {
    setSelectedPlatform(ALL);
    setSelectedYearMonth(ALL);
  }, [selectedBrandId]);

  const selectedBrand = useMemo(
    () => data.brands?.find((b) => String(b.brandId) === String(selectedBrandId)) || null,
    [data, selectedBrandId]
  );

  const filteredProducts = useMemo(() => {
    if (!selectedBrand) return [];
    return selectedBrand.products.filter((p) => {
      if (selectedPlatform !== ALL && p.platform !== selectedPlatform) return false;
      if (selectedYearMonth !== ALL && p.yearMonth !== selectedYearMonth) return false;
      return true;
    });
  }, [selectedBrand, selectedPlatform, selectedYearMonth]);

  const subtotal = useMemo(() => reduceProducts(filteredProducts), [filteredProducts]);

  const headStyle = { fontWeight: 'bold', bgcolor: '#f3f6fb' };
  const totalEmphasis = { ...headStyle, bgcolor: '#e3efff' };
  const submittedEmphasis = { ...headStyle, bgcolor: '#e8f5e9' };

  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ReceiptLongIcon color="primary" />
          <Typography variant="h5" fontWeight="bold">브랜드 정산</Typography>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          데이터 갱신
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        본인이 담당하는 캠페인의 제품 단위 정산입니다. 브랜드사 → 플랫폼 → 월별을 선택해 조합별 정산을 확인하세요.
        각 컬럼 헤더의 <InfoOutlinedIcon sx={{ fontSize: 14, verticalAlign: 'text-bottom' }} /> 아이콘 위에 마우스를 올리면 계산 수식이 표시됩니다.
      </Typography>

      {/* 드롭다운 3단 */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>브랜드사</InputLabel>
            <Select
              label="브랜드사"
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              disabled={!data.brands?.length}
            >
              {data.brands?.map((b) => (
                <MenuItem key={b.brandId} value={String(b.brandId)}>{b.brandName}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>플랫폼</InputLabel>
            <Select
              label="플랫폼"
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              disabled={!selectedBrand}
            >
              <MenuItem value={ALL}>전체</MenuItem>
              {selectedBrand?.platforms?.map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>월별 (year_month)</InputLabel>
            <Select
              label="월별 (year_month)"
              value={selectedYearMonth}
              onChange={(e) => setSelectedYearMonth(e.target.value)}
              disabled={!selectedBrand}
            >
              <MenuItem value={ALL}>전체</MenuItem>
              {selectedBrand?.yearMonths?.map((ym) => (
                <MenuItem key={ym} value={ym}>{ym}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              label={`${filteredProducts.length}개 제품`}
              sx={{ bgcolor: '#e3efff', fontWeight: 'bold' }}
            />
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && (data.brands?.length || 0) === 0 && !error && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">담당 중인 캠페인의 제품 정산 데이터가 없습니다.</Typography>
        </Paper>
      )}

      {!loading && selectedBrand && (
        <>
          <Box sx={{ mb: 2 }}>
            <SummaryCard subtotal={subtotal} />
          </Box>

          <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={headStyle}>제품명</TableCell>
                  <TableCell sx={headStyle}>플랫폼</TableCell>
                  <TableCell sx={headStyle}>캠페인</TableCell>
                  <TableCell sx={headStyle}>연월브랜드</TableCell>
                  <HeaderWithTooltip label="전체 금액" formula="모든 구매자의 금액을 합산한 값" sx={headStyle} />
                  <HeaderWithTooltip label="결제 금액" formula="전체 금액에 부가세(VAT 10%)를 더한 값 (전체 금액 × 1.1)" sx={headStyle} />
                  <HeaderWithTooltip label="전체 리뷰비" formula="모든 슬롯의 리뷰비를 합산한 값" sx={headStyle} />
                  <HeaderWithTooltip label="전체 수수료 단가" formula="구매자별 수수료 단가를 모두 더한 값 (구매자에 값이 없으면 슬롯, 그것도 없으면 품목 단가를 사용)" sx={headStyle} />
                  <HeaderWithTooltip label="전체 합계" formula="전체 금액과 전체 리뷰비를 더한 값" sx={totalEmphasis} />
                  <HeaderWithTooltip label="제출 금액" formula="리뷰샷이 승인된 구매자의 금액만 합산한 값" sx={headStyle} />
                  <HeaderWithTooltip label="제출 결제 금액" formula="제출 금액에 부가세(VAT 10%)를 더한 값 (제출 금액 × 1.1)" sx={headStyle} />
                  <HeaderWithTooltip label="제출 리뷰비" formula="리뷰샷이 승인된 구매자의 슬롯 리뷰비만 합산한 값" sx={headStyle} />
                  <HeaderWithTooltip label="제출 합계" formula="제출 금액과 제출 리뷰비를 더한 값" sx={submittedEmphasis} />
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      선택한 조합에 해당하는 제품이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((p) => (
                    <TableRow key={p.productId} hover>
                      <TableCell>{p.productName}</TableCell>
                      <TableCell>{p.platform || '-'}</TableCell>
                      <TableCell>{p.campaignName}</TableCell>
                      <TableCell>{p.monthlyBrandName}</TableCell>
                      <TableCell align="right">{fmt(p.total.amount)}</TableCell>
                      <TableCell align="right">{fmt(p.total.paymentAmount)}</TableCell>
                      <TableCell align="right">{fmt(p.total.reviewCost)}</TableCell>
                      <TableCell align="right">{fmt(p.total.unitPrice)}</TableCell>
                      <TableCell align="right" sx={{ bgcolor: '#f5f9ff', fontWeight: 'bold' }}>
                        {fmt(p.total.sum)}
                      </TableCell>
                      <TableCell align="right">{fmt(p.submitted.amount)}</TableCell>
                      <TableCell align="right">{fmt(p.submitted.paymentAmount)}</TableCell>
                      <TableCell align="right">{fmt(p.submitted.reviewCost)}</TableCell>
                      <TableCell align="right" sx={{ bgcolor: '#f1f8e9', fontWeight: 'bold', color: 'success.main' }}>
                        {fmt(p.submitted.sum)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {filteredProducts.length > 0 && (
                <TableFooter>
                  <TableRow sx={{ '& td': { fontWeight: 'bold', bgcolor: '#fafafa' } }}>
                    <TableCell colSpan={4}>소계</TableCell>
                    <TableCell align="right">{fmt(subtotal.total.amount)}</TableCell>
                    <TableCell align="right">{fmt(subtotal.total.paymentAmount)}</TableCell>
                    <TableCell align="right">{fmt(subtotal.total.reviewCost)}</TableCell>
                    <TableCell align="right">{fmt(subtotal.total.unitPrice)}</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#e3efff' }}>{fmt(subtotal.total.sum)}</TableCell>
                    <TableCell align="right">{fmt(subtotal.submitted.amount)}</TableCell>
                    <TableCell align="right">{fmt(subtotal.submitted.paymentAmount)}</TableCell>
                    <TableCell align="right">{fmt(subtotal.submitted.reviewCost)}</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#e8f5e9', color: 'success.main' }}>
                      {fmt(subtotal.submitted.sum)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}

export default SalesBrandSettlement;
