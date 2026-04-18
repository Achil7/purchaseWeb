import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Accordion, AccordionSummary, AccordionDetails,
  Table, TableHead, TableBody, TableRow, TableCell, TableFooter,
  Chip, Stack, Button, CircularProgress, Alert, Divider,
  TextField, InputAdornment, Pagination
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SearchIcon from '@mui/icons-material/Search';
import * as brandSettlementService from '../../services/brandSettlementService';

const BRANDS_PER_PAGE = 10;
const fmt = (n) => `₩${Number(n || 0).toLocaleString('ko-KR')}`;

// 합계 카드 (전체 / 제출 2열, 가운데 세로 Divider)
function SummaryCard({ title, subtotal, dense = false }) {
  const total = subtotal?.total || { amount: 0, reviewCost: 0, sum: 0 };
  const submitted = subtotal?.submitted || { amount: 0, reviewCost: 0, sum: 0 };
  const remaining = Math.max(total.sum - submitted.sum, 0);
  const rate = total.sum > 0 ? ((submitted.sum / total.sum) * 100).toFixed(1) : '0.0';

  return (
    <Paper
      variant="outlined"
      sx={{ p: dense ? 2 : 2.5, bgcolor: dense ? '#f9fafb' : '#eef4ff' }}
    >
      {title && (
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5 }}>
          {title}
        </Typography>
      )}
      <Stack
        direction="row"
        spacing={4}
        divider={<Divider orientation="vertical" flexItem />}
        alignItems="stretch"
      >
        <Box sx={{ flex: 1, pr: 1 }}>
          <Typography variant="caption" color="text.secondary">전체 합계</Typography>
          <Typography variant="h6" fontWeight="bold" sx={{ mt: 0.5 }}>
            {fmt(total.sum)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            금액 {fmt(total.amount)} · 리뷰비 {fmt(total.reviewCost)}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, pl: 1 }}>
          <Typography variant="caption" color="text.secondary">
            제출 합계 ({rate}%)
          </Typography>
          <Typography variant="h6" fontWeight="bold" color="success.main" sx={{ mt: 0.5 }}>
            {fmt(submitted.sum)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            금액 {fmt(submitted.amount)} · 리뷰비 {fmt(submitted.reviewCost)}
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

// 아코디언 요약 라인 (펼치지 않아도 보이는 요약 Chip)
function AccordionHeadline({ name, subtotal }) {
  const total = subtotal?.total?.sum || 0;
  const submitted = subtotal?.submitted?.sum || 0;
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{ width: '100%', flexWrap: 'wrap' }}
    >
      <Typography variant="subtitle1" fontWeight="bold" sx={{ minWidth: 160 }}>
        {name}
      </Typography>
      <Box sx={{ flexGrow: 1 }} />
      <Chip
        size="small"
        label={`전체 ${fmt(total)}`}
        sx={{ bgcolor: '#e3efff', fontWeight: 'bold' }}
      />
      <Chip
        size="small"
        color="success"
        label={`제출 ${fmt(submitted)}`}
        sx={{ fontWeight: 'bold' }}
      />
    </Stack>
  );
}

// 캠페인 테이블
function CampaignTable({ campaigns, subtotal }) {
  const headStyle = { fontWeight: 'bold', bgcolor: '#f3f6fb' };
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={headStyle}>캠페인</TableCell>
          <TableCell align="right" sx={headStyle}>전체 금액</TableCell>
          <TableCell align="right" sx={headStyle}>전체 리뷰비</TableCell>
          <TableCell align="right" sx={{ ...headStyle, bgcolor: '#e3efff' }}>전체 합계</TableCell>
          <TableCell align="right" sx={headStyle}>제출 금액</TableCell>
          <TableCell align="right" sx={headStyle}>제출 리뷰비</TableCell>
          <TableCell align="right" sx={{ ...headStyle, bgcolor: '#e8f5e9' }}>제출 합계</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {campaigns.map((c) => (
          <TableRow key={c.campaignId} hover>
            <TableCell>{c.campaignName}</TableCell>
            <TableCell align="right">{fmt(c.total.amount)}</TableCell>
            <TableCell align="right">{fmt(c.total.reviewCost)}</TableCell>
            <TableCell align="right" sx={{ bgcolor: '#f5f9ff', fontWeight: 'bold' }}>
              {fmt(c.total.sum)}
            </TableCell>
            <TableCell align="right">{fmt(c.submitted.amount)}</TableCell>
            <TableCell align="right">{fmt(c.submitted.reviewCost)}</TableCell>
            <TableCell align="right" sx={{ bgcolor: '#f1f8e9', fontWeight: 'bold', color: 'success.main' }}>
              {fmt(c.submitted.sum)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow sx={{ '& td': { fontWeight: 'bold', bgcolor: '#fafafa' } }}>
          <TableCell>소계</TableCell>
          <TableCell align="right">{fmt(subtotal.total.amount)}</TableCell>
          <TableCell align="right">{fmt(subtotal.total.reviewCost)}</TableCell>
          <TableCell align="right" sx={{ bgcolor: '#e3efff' }}>{fmt(subtotal.total.sum)}</TableCell>
          <TableCell align="right">{fmt(subtotal.submitted.amount)}</TableCell>
          <TableCell align="right">{fmt(subtotal.submitted.reviewCost)}</TableCell>
          <TableCell align="right" sx={{ bgcolor: '#e8f5e9', color: 'success.main' }}>
            {fmt(subtotal.submitted.sum)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function AdminBrandCampaignSettlement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // 검색 + 페이지네이션 상태
  const [brandQuery, setBrandQuery] = useState('');
  const [monthlyBrandQuery, setMonthlyBrandQuery] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await brandSettlementService.getSummary();
      setData(res?.data || { brands: [], grandTotal: null });
    } catch (e) {
      console.error(e);
      setError('정산 요약을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 검색어 변경 시 1페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [brandQuery, monthlyBrandQuery]);

  const grandTotal = data?.grandTotal;

  // 필터링된 브랜드 목록
  const filteredBrands = useMemo(() => {
    const bq = brandQuery.trim().toLowerCase();
    const mq = monthlyBrandQuery.trim().toLowerCase();
    return (data?.brands || [])
      .map((b) => {
        if (!mq) return b;
        const filteredMBs = b.monthlyBrands.filter((mb) =>
          (mb.monthlyBrandName || '').toLowerCase().includes(mq)
        );
        return { ...b, monthlyBrands: filteredMBs };
      })
      .filter((b) => !bq || (b.brandName || '').toLowerCase().includes(bq))
      .filter((b) => !mq || b.monthlyBrands.length > 0);
  }, [data, brandQuery, monthlyBrandQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / BRANDS_PER_PAGE));
  const pagedBrands = filteredBrands.slice(
    (page - 1) * BRANDS_PER_PAGE,
    page * BRANDS_PER_PAGE
  );

  const isSearching = brandQuery.trim() !== '' || monthlyBrandQuery.trim() !== '';
  const hasAnyData = (data?.brands?.length || 0) > 0;

  return (
    <Box>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ReceiptLongIcon color="primary" />
          <Typography variant="h5" fontWeight="bold">브랜드/캠페인별 정산</Typography>
        </Stack>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={load}
          disabled={loading}
        >
          데이터 갱신
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        브랜드사 &gt; 연월브랜드 &gt; 캠페인 순서로 금액과 리뷰비를 합산합니다.
        <strong> 제출</strong>은 리뷰샷(승인 상태)이 업로드된 구매자만 포함됩니다.
      </Typography>

      {/* 총합 카드 */}
      {grandTotal && (
        <Box sx={{ mb: 3 }}>
          <SummaryCard title="전체 총합" subtotal={grandTotal} />
        </Box>
      )}

      {/* 검색 + 카운터 */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            placeholder="브랜드사 검색"
            value={brandQuery}
            onChange={(e) => setBrandQuery(e.target.value)}
            sx={{ minWidth: 240 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            size="small"
            placeholder="연월브랜드 검색"
            value={monthlyBrandQuery}
            onChange={(e) => setMonthlyBrandQuery(e.target.value)}
            sx={{ minWidth: 240 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {filteredBrands.length}개 브랜드사
            {totalPages > 1 && ` · ${page} / ${totalPages} 페이지`}
          </Typography>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && !hasAnyData && !error && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">표시할 브랜드/캠페인이 없습니다.</Typography>
        </Paper>
      )}

      {!loading && hasAnyData && filteredBrands.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">검색 결과가 없습니다.</Typography>
        </Paper>
      )}

      {/* 브랜드사 아코디언 (페이지 단위) */}
      {pagedBrands.map((brand) => (
        <Accordion
          key={brand.brandId}
          defaultExpanded={false}
          sx={{ mb: 1, '&:before': { display: 'none' } }}
          disableGutters
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{ bgcolor: '#e8eefa', '& .MuiAccordionSummary-content': { my: 1 } }}
          >
            <AccordionHeadline name={brand.brandName} subtotal={brand.subtotal} />
          </AccordionSummary>
          <AccordionDetails sx={{ bgcolor: '#fafbfd', p: 2 }}>
            <Box sx={{ mb: 2 }}>
              <SummaryCard
                title={`${brand.brandName} 소계${isSearching ? ' (원본 기준)' : ''}`}
                subtotal={brand.subtotal}
                dense
              />
            </Box>

            {brand.monthlyBrands.map((mb) => (
              <Accordion
                key={mb.monthlyBrandId}
                defaultExpanded={false}
                sx={{ mb: 1, '&:before': { display: 'none' } }}
                disableGutters
                variant="outlined"
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ bgcolor: '#f3f6fb' }}
                >
                  <AccordionHeadline
                    name={mb.monthlyBrandName}
                    subtotal={mb.subtotal}
                  />
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <Divider />
                  <CampaignTable campaigns={mb.campaigns} subtotal={mb.subtotal} />
                </AccordionDetails>
              </Accordion>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
            size="medium"
          />
        </Box>
      )}
    </Box>
  );
}

export default AdminBrandCampaignSettlement;
