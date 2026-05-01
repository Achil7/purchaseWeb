import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Box, Paper, Typography, LinearProgress, CircularProgress,
  TextField, InputAdornment, IconButton,
  Chip, Divider, Alert, Collapse, Pagination,
  Select, MenuItem, FormControl, InputLabel, Button, Tooltip, Autocomplete
} from '@mui/material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
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
import * as salesDashboardService from '../../services/salesDashboardService';
import { CircularGauge, SummaryCard, CampaignSubTable, IssueList } from '../brand/BrandDashboard';

const fmtNumber = (n) => {
  const v = Number(n);
  if (!isFinite(v)) return '0';
  return Math.round(v).toLocaleString();
};
const fmtAmount = (n) => `${fmtNumber(n)}원`;

const ALL = '__ALL__';
const PLATFORM_ORDER_KEY = 'sales_platform_order';

function SalesDashboard({ viewAsUserId: viewAsUserIdProp } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const viewAsUserId = viewAsUserIdProp != null ? viewAsUserIdProp : searchParams.get('userId');
  const isAdminMode = location.pathname.startsWith('/admin/view-sales');

  // 브랜드 / 월 / 플랫폼 선택 state
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(ALL);
  const [selectedPlatform, setSelectedPlatform] = useState(ALL);

  // 데이터 state
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [productList, setProductList] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productTotalCount, setProductTotalCount] = useState(0);

  // 제품 테이블 UX
  const [filterText, setFilterText] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [sortKey, setSortKey] = useState('totalAmount');
  const [sortDir, setSortDir] = useState('desc');

  // 플랫폼 탭 사용자 정의 순서
  const [platformOrder, setPlatformOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(PLATFORM_ORDER_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // 1. 브랜드 목록 로드
  useEffect(() => {
    (async () => {
      try {
        const result = await salesDashboardService.getBrands({
          viewAsUserId: viewAsUserId ? parseInt(viewAsUserId, 10) : undefined
        });
        if (result?.success) {
          setBrands(result.data.brands || []);
          // 첫 진입 시 "전체" 선택
          if (result.data.brands?.length > 0 && selectedBrandId == null) {
            setSelectedBrandId(ALL);
          }
        }
      } catch (error) {
        console.error('brands load error:', error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewAsUserId]);

  // 2. 브랜드 변경 시 월 목록 로드
  useEffect(() => {
    if (!selectedBrandId) { setMonths([]); return; }
    (async () => {
      try {
        const result = await salesDashboardService.getMonths({
          brandId: selectedBrandId,
          viewAsUserId: viewAsUserId ? parseInt(viewAsUserId, 10) : undefined
        });
        if (result?.success) setMonths(result.data.months || []);
      } catch (error) {
        console.error('months load error:', error);
      }
    })();
    // 브랜드 바뀌면 플랫폼/월 리셋
    setSelectedPlatform(ALL);
    setSelectedMonth(ALL);
    setExpandedProduct(null);
    setPage(1);
  }, [selectedBrandId, viewAsUserId]);

  // 3. overview 호출
  const loadOverview = useCallback(async () => {
    if (!selectedBrandId) return;
    try {
      setOverviewLoading(true);
      const result = await salesDashboardService.getOverview({
        brandId: selectedBrandId,
        platform: selectedPlatform,
        month: selectedMonth === ALL ? undefined : selectedMonth,
        viewAsUserId: viewAsUserId ? parseInt(viewAsUserId, 10) : undefined
      });
      if (result?.success) {
        setOverview(result.data);
        if (result.data.selectedPlatform) setSelectedPlatform(result.data.selectedPlatform);
      }
    } catch (error) {
      console.error('overview error:', error);
    } finally {
      setOverviewLoading(false);
    }
  }, [selectedBrandId, selectedPlatform, selectedMonth, viewAsUserId]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  // 4. product-list 호출 (debounced filter + 정렬 + 페이지)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(filterText.trim()), 300);
    return () => clearTimeout(t);
  }, [filterText]);
  useEffect(() => { setPage(1); }, [debouncedFilter]);

  const loadProductList = useCallback(async () => {
    if (!selectedBrandId) return;
    try {
      setProductLoading(true);
      const result = await salesDashboardService.getProductList({
        brandId: selectedBrandId,
        platform: selectedPlatform,
        month: selectedMonth === ALL ? undefined : selectedMonth,
        page, pageSize: PAGE_SIZE,
        sortKey, sortDir,
        filter: debouncedFilter || undefined,
        viewAsUserId: viewAsUserId ? parseInt(viewAsUserId, 10) : undefined
      });
      if (result?.success) {
        setProductList(result.data.rows || []);
        setProductTotalCount(result.data.totalCount || 0);
      }
    } catch (error) {
      console.error('product-list error:', error);
      setProductList([]);
      setProductTotalCount(0);
    } finally {
      setProductLoading(false);
    }
  }, [selectedBrandId, selectedPlatform, selectedMonth, page, sortKey, sortDir, debouncedFilter, viewAsUserId]);

  useEffect(() => { loadProductList(); }, [loadProductList]);

  const goToCampaign = useCallback((campaignId) => {
    const base = isAdminMode ? '/admin/view-sales' : '/sales';
    const suffix = isAdminMode && viewAsUserId ? `?userId=${viewAsUserId}` : '';
    navigate(`${base}/campaign/${campaignId}${suffix}`);
  }, [navigate, isAdminMode, viewAsUserId]);

  // 플랫폼 정렬 적용
  const rawPlatforms = overview?.platforms || [];
  const allTab = rawPlatforms.find(p => p.platform === ALL);
  const others = rawPlatforms.filter(p => p.platform !== ALL);
  const ordered = [];
  for (const name of platformOrder) {
    const hit = others.find(p => p.platform === name);
    if (hit) ordered.push(hit);
  }
  for (const p of others) {
    if (!ordered.find(o => o.platform === p.platform)) ordered.push(p);
  }
  const platforms = allTab ? [allTab, ...ordered] : ordered;

  const handlePlatformDragEnd = (result) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const newOthers = Array.from(ordered);
    const [moved] = newOthers.splice(from, 1);
    newOthers.splice(to, 0, moved);
    const newOrder = newOthers.map(p => p.platform);
    setPlatformOrder(newOrder);
    try { localStorage.setItem(PLATFORM_ORDER_KEY, JSON.stringify(newOrder)); } catch {}
  };

  const summary = overview?.summary || {
    totalAmount: 0, buyerCount: 0, reviewCompletedCount: 0,
    reviewCompletionRate: 0, activeCampaignCount: 0, productCount: 0
  };
  const issues = overview?.issues || { lowCompletionRate: [], noReviewYet: [], topAmount: [] };
  const dailyTrend = overview?.dailyTrend || [];

  const pageCount = Math.max(1, Math.ceil(productTotalCount / PAGE_SIZE));
  const selectedBrand = brands.find(b => b.id === selectedBrandId);

  // 빈 상태
  if (brands.length === 0) {
    return (
      <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            담당 브랜드가 없습니다
          </Typography>
          <Typography variant="body2" color="text.secondary">
            아직 캠페인을 만든 브랜드사가 없어 대시보드를 표시할 수 없습니다.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', p: 1 }}>
      {/* 1단계: 브랜드 + 월 (Autocomplete - 검색 가능) */}
      <Paper sx={{ p: 1.5, mb: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Autocomplete
          size="small"
          sx={{ minWidth: 240 }}
          options={[{ id: ALL, name: '전체' }, ...brands]}
          getOptionLabel={(opt) => opt?.name || ''}
          isOptionEqualToValue={(opt, val) => opt.id === val?.id}
          value={[{ id: ALL, name: '전체' }, ...brands].find(b => b.id === selectedBrandId) || null}
          onChange={(_e, newVal) => setSelectedBrandId(newVal?.id || ALL)}
          renderInput={(params) => <TextField {...params} label="브랜드" />}
          disableClearable
        />
        <Autocomplete
          size="small"
          sx={{ minWidth: 180 }}
          options={[ALL, ...months]}
          getOptionLabel={(opt) => opt === ALL ? '전체' : opt}
          value={selectedMonth}
          onChange={(_e, newVal) => setSelectedMonth(newVal || ALL)}
          renderInput={(params) => <TextField {...params} label="월" />}
          disableClearable
        />
        {selectedBrand && (
          <Typography variant="body2" color="text.secondary">
            <b>{selectedBrand.name}</b> · {selectedMonth === ALL ? '전체 월' : selectedMonth} 기준
          </Typography>
        )}
      </Paper>

      {/* 데이터 없음 */}
      {!overviewLoading && platforms.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            선택한 조건에 해당하는 데이터가 없습니다.
          </Typography>
        </Paper>
      ) : (
        <>
          {/* 2단계: 플랫폼 탭 */}
          <Paper sx={{ mb: 2, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
              {allTab && (() => {
                const isSelected = selectedPlatform === ALL;
                return (
                  <Box
                    onClick={() => setSelectedPlatform(ALL)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5,
                      minHeight: 64, cursor: 'pointer', flexShrink: 0,
                      bgcolor: isSelected ? 'rgba(44,56,126,0.08)' : '#f5f6fb',
                      borderRight: '2px solid #c5cae9',
                      borderBottom: isSelected ? '3px solid #2c387e' : '3px solid transparent',
                      '&:hover': { bgcolor: isSelected ? 'rgba(44,56,126,0.12)' : '#eceef7' }
                    }}
                  >
                    <AllInclusiveIcon fontSize="small" sx={{ color: isSelected ? '#2c387e' : '#5c6bc0' }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
                      <Typography variant="body2" fontWeight="bold" sx={{ color: '#2c387e' }}>전체</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3 }}>
                        {fmtNumber(allTab.buyerCount)}건 · {fmtAmount(allTab.totalAmount)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })()}

              <DragDropContext onDragEnd={handlePlatformDragEnd}>
                <Droppable droppableId="sales-platform-tabs" direction="horizontal">
                  {(provided) => (
                    <Box ref={provided.innerRef} {...provided.droppableProps} sx={{ display: 'flex', alignItems: 'stretch' }}>
                      {ordered.map((p, idx) => {
                        const isSelected = selectedPlatform === p.platform;
                        return (
                          <Draggable key={p.platform} draggableId={`platform-${p.platform}`} index={idx}>
                            {(dragProvided, dragSnapshot) => (
                              <Box
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                onClick={() => setSelectedPlatform(p.platform)}
                                sx={{
                                  display: 'flex', alignItems: 'center', gap: 0.75, px: 2, py: 1.5,
                                  minHeight: 64, cursor: 'pointer', flexShrink: 0,
                                  borderLeft: idx > 0 ? '1px solid #eee' : 'none',
                                  borderBottom: isSelected ? '3px solid #2c387e' : '3px solid transparent',
                                  bgcolor: dragSnapshot.isDragging ? 'rgba(44,56,126,0.05)' : 'transparent',
                                  boxShadow: dragSnapshot.isDragging ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                                  '&:hover': { bgcolor: 'rgba(0,0,0,0.03)' },
                                  ...dragProvided.draggableProps.style
                                }}
                              >
                                <Box
                                  {...dragProvided.dragHandleProps}
                                  onClick={(e) => e.stopPropagation()}
                                  sx={{
                                    display: 'flex', alignItems: 'center', cursor: 'grab',
                                    color: '#bdbdbd', '&:hover': { color: '#757575' },
                                    '&:active': { cursor: 'grabbing' }
                                  }}
                                  title="드래그해 순서 변경"
                                >
                                  <DragIndicatorIcon fontSize="small" />
                                </Box>
                                <StorefrontIcon fontSize="small" sx={{ color: isSelected ? '#2c387e' : '#9e9e9e' }} />
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
                                  <Typography variant="body2" fontWeight="bold" sx={{ color: isSelected ? '#2c387e' : 'text.primary' }}>
                                    {p.platform}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3 }}>
                                    {fmtNumber(p.buyerCount)}건 · {fmtAmount(p.totalAmount)}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </DragDropContext>
            </Box>
          </Paper>

          {/* 요약 카드 6개 */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {selectedPlatform === ALL ? '전체' : selectedPlatform} 현황 요약
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

          {/* 일별 추이 차트 2개 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <Paper variant="outlined" sx={{ p: 2, height: 260, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0 }}>
                <ShowChartIcon fontSize="small" sx={{ color: '#2e7d32' }} />
                <Typography variant="subtitle2" fontWeight="bold" color="success.main">최근 14일 리뷰 완료 추이</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>(KST · 승인 이미지 기준)</Typography>
              </Box>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                {dailyTrend.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>데이터 없음</Typography>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <LineChart data={dailyTrend} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d?.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <RTooltip contentStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="reviewCompleted" name="리뷰 완료" stroke="#2e7d32" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, height: 260, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0 }}>
                <BarChartIcon fontSize="small" sx={{ color: '#1565c0' }} />
                <Typography variant="subtitle2" fontWeight="bold" color="primary">최근 14일 구매자 등록 추이</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>(KST · 진행자 등록 기준)</Typography>
              </Box>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                {dailyTrend.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>데이터 없음</Typography>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={dailyTrend} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
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

          {/* 이슈 리스트 3개 */}
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
                  <Typography variant="caption" color="text.secondary">{r.reviewCompletedCount}/{r.buyerCount}</Typography>
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
                <Typography variant="body2" fontWeight="bold" color="primary">{fmtAmount(r.totalAmount)}</Typography>
              )}
            />
          </Box>

          {/* 제품별 현황 카드 그리드 */}
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">제품별 현황</Typography>
                <Typography variant="caption" color="text.secondary">
                  같은 제품명은 캠페인이 달라도 하나로 합산. "캠페인 N개 보기" 클릭 시 펼쳐집니다.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>정렬</InputLabel>
                  <Select
                    label="정렬"
                    value={`${sortKey}_${sortDir}`}
                    onChange={(e) => {
                      const [k, d] = e.target.value.split('_');
                      setSortKey(k); setSortDir(d); setPage(1);
                    }}
                  >
                    <MenuItem value="totalAmount_desc">금액 ↓</MenuItem>
                    <MenuItem value="totalAmount_asc">금액 ↑</MenuItem>
                    <MenuItem value="buyerCount_desc">구매자 ↓</MenuItem>
                    <MenuItem value="buyerCount_asc">구매자 ↑</MenuItem>
                    <MenuItem value="reviewCompletedCount_desc">리뷰 완료 ↓</MenuItem>
                    <MenuItem value="reviewCompletedCount_asc">리뷰 완료 ↑</MenuItem>
                    <MenuItem value="reviewCompletionRate_desc">완료율 ↓</MenuItem>
                    <MenuItem value="reviewCompletionRate_asc">완료율 ↑</MenuItem>
                    <MenuItem value="campaignCount_desc">캠페인 수 ↓</MenuItem>
                    <MenuItem value="product_name_asc">제품명 ㄱ→ㅎ</MenuItem>
                    <MenuItem value="product_name_desc">제품명 ㅎ→ㄱ</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  placeholder="제품명으로 필터링"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  sx={{ minWidth: { xs: '100%', md: 240 }, width: { xs: '100%', md: 'auto' } }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                    endAdornment: filterText && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setFilterText('')}><ClearIcon fontSize="small" /></IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
            </Box>

            {productLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
            ) : productTotalCount === 0 ? (
              <Alert severity="info" variant="outlined">
                {!debouncedFilter ? '해당 조건에 등록된 제품이 없습니다.' : `"${debouncedFilter}" 로 필터된 제품이 없습니다.`}
              </Alert>
            ) : (
              <>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
                  justifyContent: 'flex-start',
                  gap: 2
                }}>
                  {productList.map((p) => {
                    const isExpanded = expandedProduct === p.product_name;
                    return (
                      <Paper
                        key={p.product_name}
                        variant="outlined"
                        sx={{
                          p: 1.5, display: 'flex', flexDirection: 'column', gap: 1,
                          borderColor: isExpanded ? '#1565c0' : '#e0e0e0',
                          borderWidth: isExpanded ? 1.5 : 1,
                          transition: 'border-color 0.15s'
                        }}
                      >
                        <Tooltip title={p.product_name} placement="top">
                          <Typography
                            variant="subtitle2" fontWeight="bold"
                            sx={{
                              fontSize: '0.9rem',
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                              minHeight: '2.4em', lineHeight: 1.25
                            }}
                          >
                            {p.product_name}
                          </Typography>
                        </Tooltip>
                        <Divider sx={{ my: 0 }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <CircularGauge value={p.reviewCompletionRate} size={72} thickness={5} />
                          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>구매자</Typography>
                              <Typography variant="body2" fontWeight="bold" noWrap>{fmtNumber(p.buyerCount)}명</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>리뷰 완료</Typography>
                              <Typography variant="body2" fontWeight="bold" color="success.main" noWrap>{fmtNumber(p.reviewCompletedCount)}건</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>총 금액</Typography>
                              <Typography
                                variant="body2" fontWeight="bold" color="primary"
                                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
                                title={fmtAmount(p.totalAmount)}
                              >
                                {fmtAmount(p.totalAmount)}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                          <Chip size="small" variant="outlined" label={`캠페인 ${fmtNumber(p.campaignCount)}개`} sx={{ fontSize: '0.7rem', height: 22 }} />
                          <Chip size="small" variant="outlined" label={`승인 이미지 ${fmtNumber(p.imageCount)}장`} sx={{ fontSize: '0.7rem', height: 22 }} />
                        </Box>
                        <Button
                          size="small"
                          variant={isExpanded ? 'contained' : 'outlined'}
                          onClick={() => setExpandedProduct(isExpanded ? null : p.product_name)}
                          endIcon={isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.4 }}
                        >
                          {isExpanded ? '캠페인 숨기기' : `캠페인 ${fmtNumber(p.campaignCount)}개 보기`}
                        </Button>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ bgcolor: '#f9fafc', p: 1, borderRadius: 1, mt: 0.5 }}>
                            <CampaignSubTable campaigns={p.campaigns} onCampaignClick={goToCampaign} />
                          </Box>
                        </Collapse>
                      </Paper>
                    );
                  })}
                </Box>

                {pageCount > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination count={pageCount} page={page} onChange={(_e, v) => setPage(v)} size="small" color="primary" />
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'right' }}>
                  전체 {fmtNumber(productTotalCount)}개 제품
                  {debouncedFilter && ` (검색어: "${debouncedFilter}")`}
                </Typography>
              </>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}

export default SalesDashboard;
