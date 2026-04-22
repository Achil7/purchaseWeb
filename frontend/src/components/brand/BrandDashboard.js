import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Box, Paper, Typography, Tabs, Tab, LinearProgress, CircularProgress,
  TextField, InputAdornment, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Chip, Divider, Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import * as brandDashboardService from '../../services/brandDashboardService';

const fmtNumber = (n) => {
  const v = Number(n);
  if (!isFinite(v)) return '0';
  return Math.round(v).toLocaleString();
};

const fmtAmount = (n) => `${fmtNumber(n)}원`;

// 요약 카드
function SummaryCard({ label, value, sub, color, progress }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', height: '100%' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h6" fontWeight="bold" color={color || 'primary'}>{value}</Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{sub}</Typography>
      )}
      {typeof progress === 'number' && (
        <LinearProgress
          variant="determinate"
          value={Math.min(100, Math.max(0, progress))}
          sx={{ mt: 1, height: 6, borderRadius: 3 }}
        />
      )}
    </Paper>
  );
}

// 이슈 리스트 (낮은 완료율 / 리뷰 0건 / 금액 상위)
function IssueList({ title, rows, emptyText, renderRight, icon, accentColor, onRowClick }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {icon}
        <Typography variant="subtitle2" fontWeight="bold" color={accentColor || 'text.primary'}>
          {title}
        </Typography>
      </Box>
      <Divider sx={{ mb: 1 }} />
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          {emptyText}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {rows.map((r, idx) => (
            <Box
              key={`${r.campaign_id}-${r.product_name}-${idx}`}
              onClick={() => onRowClick && onRowClick(r)}
              sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                px: 1, py: 0.75, borderRadius: 1,
                cursor: onRowClick ? 'pointer' : 'default',
                '&:hover': onRowClick ? { bgcolor: '#f5f5f5' } : undefined
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1, pr: 1 }}>
                <Typography variant="body2" noWrap title={r.product_name}>
                  {r.product_name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap title={r.campaign_name}>
                  {r.campaign_name}
                </Typography>
              </Box>
              <Box sx={{ flexShrink: 0 }}>
                {renderRight(r)}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}

function BrandDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('userId');
  const isAdminMode = location.pathname.startsWith('/admin/view-brand');

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  // 제품 검색
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rollup, setRollup] = useState(null);
  const [rollupLoading, setRollupLoading] = useState(false);
  const debounceRef = useRef(null);

  const campaignBasePath = isAdminMode ? '/admin/view-brand' : '/brand';
  const campaignUrlSuffix = isAdminMode && viewAsUserId ? `?userId=${viewAsUserId}` : '';

  const loadOverview = useCallback(async (platform) => {
    try {
      setLoading(true);
      const result = await brandDashboardService.getOverview({
        platform,
        viewAsUserId: viewAsUserId ? parseInt(viewAsUserId, 10) : undefined
      });
      if (result?.success) {
        setOverview(result.data);
        setSelectedPlatform(result.data.selectedPlatform);
      }
    } catch (error) {
      console.error('overview load error:', error);
    } finally {
      setLoading(false);
    }
  }, [viewAsUserId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handlePlatformChange = (_e, newPlatform) => {
    if (!newPlatform) return;
    setSelectedPlatform(newPlatform);
    loadOverview(newPlatform);
    // 플랫폼 바꾸면 검색 결과 초기화
    setSearchInput('');
    setSearchQuery('');
    setRollup(null);
  };

  // 검색어 debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // 검색어 적용 시 rollup 호출
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2 || !selectedPlatform) {
      setRollup(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setRollupLoading(true);
        const result = await brandDashboardService.getProductRollup({
          platform: selectedPlatform,
          query: q,
          viewAsUserId: viewAsUserId ? parseInt(viewAsUserId, 10) : undefined
        });
        if (!cancelled && result?.success) {
          setRollup(result.data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('product-rollup error:', error);
          setRollup(null);
        }
      } finally {
        if (!cancelled) setRollupLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [searchQuery, selectedPlatform, viewAsUserId]);

  const goToCampaign = useCallback((campaignId) => {
    navigate(`${campaignBasePath}/campaign/${campaignId}${campaignUrlSuffix}`);
  }, [navigate, campaignBasePath, campaignUrlSuffix]);

  // 렌더
  if (loading && !overview) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const platforms = overview?.platforms || [];
  const summary = overview?.summary || {
    totalAmount: 0, buyerCount: 0, reviewCompletedCount: 0,
    reviewCompletionRate: 0, activeCampaignCount: 0, productCount: 0
  };
  const issues = overview?.issues || { lowCompletionRate: [], noReviewYet: [], topAmount: [] };

  if (platforms.length === 0) {
    return (
      <Box>
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            표시할 데이터가 없습니다
          </Typography>
          <Typography variant="body2" color="text.secondary">
            아직 등록된 구매자 데이터가 없어 대시보드를 표시할 수 없습니다.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      {/* 플랫폼 탭 */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={selectedPlatform || false}
          onChange={handlePlatformChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {platforms.map((p) => (
            <Tab
              key={p.platform}
              value={p.platform}
              label={
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Typography variant="body2" fontWeight="bold">{p.platform}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {fmtNumber(p.buyerCount)}건 · {fmtAmount(p.totalAmount)}
                  </Typography>
                </Box>
              }
            />
          ))}
        </Tabs>
      </Paper>

      {/* 요약 카드 6개 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          {selectedPlatform} 현황 요약
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2 }}>
          <SummaryCard label="총 금액" value={fmtAmount(summary.totalAmount)} color="primary" />
          <SummaryCard label="구매자 수" value={`${fmtNumber(summary.buyerCount)}명`} />
          <SummaryCard label="리뷰 완료" value={`${fmtNumber(summary.reviewCompletedCount)}명`} color="success.main" />
          <SummaryCard
            label="리뷰 완료율"
            value={`${summary.reviewCompletionRate}%`}
            sub={`${fmtNumber(summary.reviewCompletedCount)}/${fmtNumber(summary.buyerCount)}`}
            color={summary.reviewCompletionRate >= 80 ? 'success.main' : summary.reviewCompletionRate >= 50 ? 'warning.main' : 'error.main'}
            progress={summary.reviewCompletionRate}
          />
          <SummaryCard label="진행 중 캠페인" value={`${fmtNumber(summary.activeCampaignCount)}개`} />
          <SummaryCard label="상품 수" value={`${fmtNumber(summary.productCount)}개`} />
        </Box>
      </Paper>

      {/* 이슈 리스트 3개 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 2, mb: 2 }}>
        <IssueList
          title="리뷰 완료율이 낮은 상품"
          icon={<TrendingDownIcon fontSize="small" sx={{ color: '#d32f2f' }} />}
          accentColor="error.main"
          rows={issues.lowCompletionRate}
          emptyText="해당 항목이 없습니다"
          onRowClick={(r) => goToCampaign(r.campaign_id)}
          renderRight={(r) => (
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" fontWeight="bold" color="error.main">{r.rate}%</Typography>
              <Typography variant="caption" color="text.secondary">
                {r.reviewCompletedCount}/{r.buyerCount}
              </Typography>
            </Box>
          )}
        />
        <IssueList
          title="리뷰가 아직 없는 상품"
          icon={<VisibilityOffIcon fontSize="small" sx={{ color: '#ed6c02' }} />}
          accentColor="warning.main"
          rows={issues.noReviewYet}
          emptyText="모든 상품에 리뷰가 진행 중입니다"
          onRowClick={(r) => goToCampaign(r.campaign_id)}
          renderRight={(r) => (
            <Chip size="small" label={`구매자 ${r.buyerCount}`} color="warning" variant="outlined" />
          )}
        />
        <IssueList
          title="금액 상위 상품"
          icon={<MonetizationOnIcon fontSize="small" sx={{ color: '#1565c0' }} />}
          accentColor="primary.main"
          rows={issues.topAmount}
          emptyText="해당 항목이 없습니다"
          onRowClick={(r) => goToCampaign(r.campaign_id)}
          renderRight={(r) => (
            <Typography variant="body2" fontWeight="bold" color="primary">
              {fmtAmount(r.totalAmount)}
            </Typography>
          )}
        />
      </Box>

      {/* 제품 검색 영역 */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          제품명 통합 현황 검색
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          같은 이름/키워드로 등록된 상품들을 한 번에 합산해서 보여줍니다. (2자 이상)
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder={`"${selectedPlatform}" 플랫폼 안에서 제품명 검색`}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: searchInput && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchInput('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
        />

        {searchQuery.length < 2 ? (
          <Alert severity="info" variant="outlined">
            제품명을 검색해 통합 현황을 확인하세요 (2자 이상 입력)
          </Alert>
        ) : rollupLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : !rollup || rollup.rollup.matchedProductCount === 0 ? (
          <Alert severity="warning" variant="outlined">
            "{searchQuery}" 와 일치하는 상품이 없습니다.
          </Alert>
        ) : (
          <>
            {/* 통합 요약 */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#f5f9ff' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                "{searchQuery}" 통합 현황
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1 }}>
                <SummaryCard label="매칭 상품" value={`${fmtNumber(rollup.rollup.matchedProductCount)}개`} />
                <SummaryCard label="캠페인 수" value={`${fmtNumber(rollup.rollup.campaignCount)}개`} />
                <SummaryCard label="구매자" value={`${fmtNumber(rollup.rollup.buyerCount)}명`} />
                <SummaryCard label="리뷰 완료" value={`${fmtNumber(rollup.rollup.reviewCompletedCount)}명`} color="success.main" />
                <SummaryCard
                  label="완료율"
                  value={`${rollup.rollup.reviewCompletionRate}%`}
                  color={rollup.rollup.reviewCompletionRate >= 80 ? 'success.main' : rollup.rollup.reviewCompletionRate >= 50 ? 'warning.main' : 'error.main'}
                  progress={rollup.rollup.reviewCompletionRate}
                />
                <SummaryCard label="총 금액" value={fmtAmount(rollup.rollup.totalAmount)} color="primary" />
                <SummaryCard label="승인 이미지" value={`${fmtNumber(rollup.rollup.imageCount)}장`} />
              </Box>
            </Paper>

            {/* 매칭 원본 목록 */}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#fafafa' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>제품명</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>캠페인</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>구매자</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>리뷰 완료</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>금액</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rollup.rows.map((r) => (
                    <TableRow
                      key={r.item_id}
                      hover
                      onClick={() => goToCampaign(r.campaign_id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Typography variant="body2" noWrap title={r.product_name}>{r.product_name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap title={r.campaign_name}>
                          {r.campaign_name}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{fmtNumber(r.buyerCount)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="success.main">
                          {fmtNumber(r.reviewCompletedCount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{fmtAmount(r.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>
    </Box>
  );
}

export default BrandDashboard;
