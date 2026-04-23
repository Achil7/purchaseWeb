import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Box, Paper, Typography, Tabs, Tab, LinearProgress, CircularProgress,
  TextField, InputAdornment, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TableSortLabel,
  Chip, Divider, Alert, Collapse, Pagination
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import StorefrontIcon from '@mui/icons-material/Storefront';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, Tooltip as RTooltip, CartesianGrid
} from 'recharts';
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

// 확장 영역 내부 캠페인 테이블 — 자체 정렬 state (상위 테이블 정렬과 독립)
function CampaignSubTable({ campaigns, onCampaignClick }) {
  const [subSortKey, setSubSortKey] = useState('totalAmount');
  const [subSortDir, setSubSortDir] = useState('desc');

  const handleSubSort = (key) => {
    if (subSortKey === key) {
      setSubSortDir(subSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSubSortKey(key);
      setSubSortDir(key === 'campaign_name' ? 'asc' : 'desc');
    }
  };

  const sortedCampaigns = useMemo(() => {
    const arr = [...campaigns];
    const cmp = (a, b) => {
      const av = a[subSortKey];
      const bv = b[subSortKey];
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av || '').localeCompare(String(bv || ''), 'ko');
      }
      return (Number(av) || 0) - (Number(bv) || 0);
    };
    arr.sort((a, b) => subSortDir === 'asc' ? cmp(a, b) : -cmp(a, b));
    return arr;
  }, [campaigns, subSortKey, subSortDir]);

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 'bold' }} sortDirection={subSortKey === 'campaign_name' ? subSortDir : false}>
            <TableSortLabel
              active={subSortKey === 'campaign_name'}
              direction={subSortKey === 'campaign_name' ? subSortDir : 'asc'}
              onClick={() => handleSubSort('campaign_name')}
            >
              캠페인명
            </TableSortLabel>
          </TableCell>
          <TableCell align="right" sx={{ fontWeight: 'bold' }} sortDirection={subSortKey === 'buyerCount' ? subSortDir : false}>
            <TableSortLabel
              active={subSortKey === 'buyerCount'}
              direction={subSortKey === 'buyerCount' ? subSortDir : 'desc'}
              onClick={() => handleSubSort('buyerCount')}
            >
              구매자
            </TableSortLabel>
          </TableCell>
          <TableCell align="right" sx={{ fontWeight: 'bold' }} sortDirection={subSortKey === 'reviewCompletedCount' ? subSortDir : false}>
            <TableSortLabel
              active={subSortKey === 'reviewCompletedCount'}
              direction={subSortKey === 'reviewCompletedCount' ? subSortDir : 'desc'}
              onClick={() => handleSubSort('reviewCompletedCount')}
            >
              리뷰 완료
            </TableSortLabel>
          </TableCell>
          <TableCell align="right" sx={{ fontWeight: 'bold' }} sortDirection={subSortKey === 'totalAmount' ? subSortDir : false}>
            <TableSortLabel
              active={subSortKey === 'totalAmount'}
              direction={subSortKey === 'totalAmount' ? subSortDir : 'desc'}
              onClick={() => handleSubSort('totalAmount')}
            >
              금액
            </TableSortLabel>
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sortedCampaigns.map((c) => (
          <TableRow
            key={c.campaign_id}
            hover
            onClick={(e) => { e.stopPropagation(); onCampaignClick(c.campaign_id); }}
            sx={{ cursor: 'pointer' }}
          >
            <TableCell>
              <Typography variant="body2" noWrap title={c.campaign_name}>
                {c.campaign_name}
              </Typography>
            </TableCell>
            <TableCell align="right">{fmtNumber(c.buyerCount)}</TableCell>
            <TableCell align="right">
              <Typography variant="body2" color="success.main">
                {fmtNumber(c.reviewCompletedCount)}
              </Typography>
            </TableCell>
            <TableCell align="right">{fmtAmount(c.totalAmount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// 이슈 리스트 (낮은 완료율 / 리뷰 0건 / 금액 상위)
// 고정 높이 + TOP 3 표시 — 280px 안에서 스크롤 없이 3행 모두 보이도록 설계
function IssueList({ title, description, rows, emptyText, renderRight, icon, accentColor, onRowClick }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: 280, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon}
          <Typography variant="subtitle2" fontWeight="bold" color={accentColor || 'text.primary'}>
            {title}
          </Typography>
        </Box>
        {description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
            {description}
          </Typography>
        )}
      </Box>
      <Divider sx={{ mb: 1, flexShrink: 0 }} />
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          {emptyText}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, minHeight: 0 }}>
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
                  {r.campaignCount > 1 && ` 외 ${r.campaignCount - 1}개 캠페인`}
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

  // 제품별 현황 리스트 (선택 플랫폼/전체 기준)
  const [productList, setProductList] = useState([]);
  const [productLoading, setProductLoading] = useState(false);

  // 제품 테이블 UX state
  const [filterText, setFilterText] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [expandedProduct, setExpandedProduct] = useState(null); // 펼친 제품명
  // 정렬: 기본 정렬은 금액 내림차순 (백엔드에서도 동일)
  const [sortKey, setSortKey] = useState('totalAmount');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // 텍스트 컬럼 기본 오름차순, 숫자 컬럼 기본 내림차순
      setSortDir(key === 'product_name' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const campaignBasePath = isAdminMode ? '/admin/view-brand' : '/brand';

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

  const loadProductList = useCallback(async (platform) => {
    if (!platform) return;
    try {
      setProductLoading(true);
      const result = await brandDashboardService.getProductList({
        platform,
        viewAsUserId: viewAsUserId ? parseInt(viewAsUserId, 10) : undefined
      });
      if (result?.success) {
        setProductList(result.data.rows || []);
      }
    } catch (error) {
      console.error('product-list load error:', error);
      setProductList([]);
    } finally {
      setProductLoading(false);
    }
  }, [viewAsUserId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // selectedPlatform 이 정해지면 product-list 자동 로드
  useEffect(() => {
    if (selectedPlatform) {
      loadProductList(selectedPlatform);
    }
  }, [selectedPlatform, loadProductList]);

  const handlePlatformChange = (_e, newPlatform) => {
    if (!newPlatform) return;
    setSelectedPlatform(newPlatform);
    loadOverview(newPlatform);
    // 플랫폼 바꾸면 테이블 state 초기화
    setFilterText('');
    setPage(1);
    setExpandedProduct(null);
  };

  // client-side 필터 (제품명 contains, 대소문자 무시)
  const filteredProducts = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return productList;
    return productList.filter(p => (p.product_name || '').toLowerCase().includes(q));
  }, [productList, filterText]);

  // 정렬 적용
  const sortedProducts = useMemo(() => {
    const arr = [...filteredProducts];
    const cmp = (a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av || '').localeCompare(String(bv || ''), 'ko');
      }
      return (Number(av) || 0) - (Number(bv) || 0);
    };
    arr.sort((a, b) => sortDir === 'asc' ? cmp(a, b) : -cmp(a, b));
    return arr;
  }, [filteredProducts, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE));
  const pagedProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedProducts.slice(start, start + PAGE_SIZE);
  }, [sortedProducts, page]);

  // 필터 변경 시 페이지 초기화
  useEffect(() => { setPage(1); }, [filterText]);

  // 캠페인 클릭 → 대시보드 루트로 가되 ?openCampaign= 쿼리로 전달
  // BrandLayout 이 쿼리를 읽어 viewMode='campaigns' + selectedCampaign 자동 설정
  // (기존 BrandItemTable 중간 경유지 스킵)
  const goToCampaign = useCallback((campaignId) => {
    const params = new URLSearchParams();
    if (isAdminMode && viewAsUserId) params.set('userId', viewAsUserId);
    params.set('openCampaign', String(campaignId));
    navigate(`${campaignBasePath}?${params.toString()}`);
  }, [navigate, campaignBasePath, isAdminMode, viewAsUserId]);

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
      {/* 플랫폼 탭 - 전체 탭은 보라색 강조 + 구분선으로 시각적으로 분리 */}
      <Paper sx={{ mb: 2, overflow: 'hidden' }}>
        <Tabs
          value={selectedPlatform || false}
          onChange={handlePlatformChange}
          variant="scrollable"
          scrollButtons="auto"
          TabIndicatorProps={{ sx: { height: 3, bgcolor: '#2c387e' } }}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            minHeight: 72,
            '& .MuiTab-root': {
              minHeight: 72,
              textTransform: 'none',
              px: 2.5
            }
          }}
        >
          {platforms.map((p, idx) => {
            const isAllTab = p.platform === '__ALL__';
            const isSelected = selectedPlatform === p.platform;
            return (
              <Tab
                key={p.platform}
                value={p.platform}
                disableRipple
                sx={{
                  // 전체 탭 시각 강조 + 플랫폼 탭들과 경계 분리
                  ...(isAllTab
                    ? {
                        bgcolor: isSelected ? 'rgba(44,56,126,0.08)' : '#f5f6fb',
                        borderRight: '2px solid #c5cae9',
                        mr: 0.5,
                        color: '#2c387e',
                        '&.Mui-selected': { color: '#2c387e' }
                      }
                    : {
                        // 플랫폼 탭들 사이의 얇은 구분선
                        borderLeft: idx > 1 ? '1px solid #eee' : 'none'
                      })
                }}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isAllTab ? (
                      <AllInclusiveIcon fontSize="small" sx={{ color: isSelected ? '#2c387e' : '#5c6bc0' }} />
                    ) : (
                      <StorefrontIcon fontSize="small" sx={{ color: isSelected ? '#2c387e' : '#9e9e9e' }} />
                    )}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
                      <Typography variant="body2" fontWeight="bold" sx={{ color: isSelected ? '#2c387e' : 'text.primary' }}>
                        {isAllTab ? '전체' : p.platform}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3 }}>
                        {fmtNumber(p.buyerCount)}건 · {fmtAmount(p.totalAmount)}
                      </Typography>
                    </Box>
                  </Box>
                }
              />
            );
          })}
        </Tabs>
      </Paper>

      {/* 요약 카드 6개 - 1920에서 과도하게 넓어지지 않도록 개수 고정 균등 분할 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          {selectedPlatform === '__ALL__' ? '전체' : selectedPlatform} 현황 요약
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 2 }}>
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

      {/* 일별 추이 차트 행 (최근 14일) - 리뷰 완료 라인 + 구매자 등록 막대 좌우 배치 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, height: 260, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0 }}>
            <ShowChartIcon fontSize="small" sx={{ color: '#2e7d32' }} />
            <Typography variant="subtitle2" fontWeight="bold" color="success.main">
              최근 14일 리뷰 완료 추이
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              (승인된 리뷰샷이 업로드된 날짜 기준 · KST)
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            {(overview?.dailyTrend?.length || 0) === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                데이터 없음
              </Typography>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overview.dailyTrend} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d?.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <RTooltip contentStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="reviewCompleted"
                    name="리뷰 완료"
                    stroke="#2e7d32"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, height: 260, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0 }}>
            <BarChartIcon fontSize="small" sx={{ color: '#1565c0' }} />
            <Typography variant="subtitle2" fontWeight="bold" color="primary">
              최근 14일 구매자 등록 추이
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              (진행자가 구매자 정보를 저장한 날짜 기준 · KST)
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            {(overview?.dailyTrend?.length || 0) === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                데이터 없음
              </Typography>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview.dailyTrend} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d?.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <RTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="buyersAdded" name="구매자 등록" fill="#1565c0" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>
        </Paper>
      </Box>

      {/*
        후속 추가 가능한 차트/지표 (데이터 활용 계획):
        - 누적 완료율 진행 곡선 (AreaChart): dailyTrend 를 reduce 해 누적 구매자/리뷰 계산 후 (reviewAccum / buyerAccum) 그래프
        - 캠페인별 완료율 비교 수평 막대: 현재 issues 데이터로 구성 가능 (TOP N 캠페인)
        - 리뷰 대기 일수 분포: 백엔드에 buyers.created_at - images.created_at 평균/분포 쿼리 추가 후 요약 카드 1개로 표시
        - 주간/월간 스냅샷 비교: 지난주 대비 이번주 완료건수 증감율 (백엔드 range 파라미터 추가 필요)
      */}

      {/* 이슈 리스트 3개 (3단 고정) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2, mb: 2 }}>
        <IssueList
          title="리뷰 완료율이 낮은 상품"
          description="구매자 · 리뷰 완료 모두 1건 이상, 완료율 낮은 순 TOP 3"
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
          description="구매자는 있지만 리뷰 완료 0건인 제품, 구매자 많은 순 TOP 3"
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
          description="제품별 구매자 금액 합계 내림차순 TOP 3"
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

      {/* 제품별 현황 - 선택 플랫폼(또는 전체) 내 제품명 단위 합산 */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              제품별 현황
            </Typography>
            <Typography variant="caption" color="text.secondary">
              같은 제품명은 캠페인이 달라도 하나로 합산됩니다. 행을 클릭하면 포함된 캠페인 목록이 펼쳐집니다.
            </Typography>
          </Box>
          <TextField
            size="small"
            placeholder="제품명으로 필터링"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            sx={{ minWidth: 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: filterText && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setFilterText('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>

        {productLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : filteredProducts.length === 0 ? (
          <Alert severity="info" variant="outlined">
            {productList.length === 0
              ? '해당 플랫폼에 등록된 제품이 없습니다.'
              : `"${filterText}" 로 필터된 제품이 없습니다.`}
          </Alert>
        ) : (
          <>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#fafafa' }}>
                    <TableCell sx={{ width: 40 }} />
                    <TableCell sx={{ fontWeight: 'bold' }} sortDirection={sortKey === 'product_name' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'product_name'}
                        direction={sortKey === 'product_name' ? sortDir : 'asc'}
                        onClick={() => handleSort('product_name')}
                      >
                        제품명
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }} sortDirection={sortKey === 'campaignCount' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'campaignCount'}
                        direction={sortKey === 'campaignCount' ? sortDir : 'desc'}
                        onClick={() => handleSort('campaignCount')}
                      >
                        캠페인
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }} sortDirection={sortKey === 'buyerCount' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'buyerCount'}
                        direction={sortKey === 'buyerCount' ? sortDir : 'desc'}
                        onClick={() => handleSort('buyerCount')}
                      >
                        구매자
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }} sortDirection={sortKey === 'reviewCompletedCount' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'reviewCompletedCount'}
                        direction={sortKey === 'reviewCompletedCount' ? sortDir : 'desc'}
                        onClick={() => handleSort('reviewCompletedCount')}
                      >
                        리뷰 완료
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 160 }} sortDirection={sortKey === 'reviewCompletionRate' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'reviewCompletionRate'}
                        direction={sortKey === 'reviewCompletionRate' ? sortDir : 'desc'}
                        onClick={() => handleSort('reviewCompletionRate')}
                      >
                        완료율
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }} sortDirection={sortKey === 'totalAmount' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'totalAmount'}
                        direction={sortKey === 'totalAmount' ? sortDir : 'desc'}
                        onClick={() => handleSort('totalAmount')}
                      >
                        금액
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }} sortDirection={sortKey === 'imageCount' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'imageCount'}
                        direction={sortKey === 'imageCount' ? sortDir : 'desc'}
                        onClick={() => handleSort('imageCount')}
                      >
                        승인 이미지
                      </TableSortLabel>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedProducts.map((p) => {
                    const isExpanded = expandedProduct === p.product_name;
                    const rateColor = p.reviewCompletionRate >= 80
                      ? 'success.main'
                      : p.reviewCompletionRate >= 50 ? 'warning.main' : 'error.main';
                    return (
                      <React.Fragment key={p.product_name}>
                        <TableRow
                          hover
                          onClick={() => setExpandedProduct(isExpanded ? null : p.product_name)}
                          sx={{ cursor: 'pointer', '& > *': { borderBottom: 'unset' } }}
                        >
                          <TableCell>
                            <IconButton size="small">
                              {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                            </IconButton>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold" noWrap title={p.product_name}>
                              {p.product_name}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{fmtNumber(p.campaignCount)}개</TableCell>
                          <TableCell align="right">{fmtNumber(p.buyerCount)}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="success.main">
                              {fmtNumber(p.reviewCompletedCount)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ flex: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(100, p.reviewCompletionRate)}
                                  sx={{ height: 6, borderRadius: 3 }}
                                />
                              </Box>
                              <Typography variant="caption" fontWeight="bold" sx={{ minWidth: 36, textAlign: 'right', color: rateColor }}>
                                {p.reviewCompletionRate}%
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold" color="primary">
                              {fmtAmount(p.totalAmount)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{fmtNumber(p.imageCount)}장</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={8} sx={{ p: 0, borderBottom: isExpanded ? '1px solid #eee' : 'none' }}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ bgcolor: '#f9fafc', p: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                  포함된 캠페인 ({p.campaignCount}개) — 행 클릭 시 해당 캠페인 상세로 이동
                                </Typography>
                                <CampaignSubTable
                                  campaigns={p.campaigns}
                                  onCampaignClick={goToCampaign}
                                />
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {pageCount > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination
                  count={pageCount}
                  page={page}
                  onChange={(_e, v) => setPage(v)}
                  size="small"
                  color="primary"
                />
              </Box>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'right' }}>
              전체 {fmtNumber(filteredProducts.length)}개 제품
              {filteredProducts.length !== productList.length && ` (필터 적용 전 ${fmtNumber(productList.length)}개)`}
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
}

export default BrandDashboard;
