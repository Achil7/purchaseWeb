import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Box, Paper, Typography, LinearProgress, CircularProgress,
  TextField, InputAdornment, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TableSortLabel,
  Chip, Divider, Alert, Collapse, Pagination
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
    <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 }, textAlign: 'center', height: '100%' }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, lineHeight: 1.3 }}
        noWrap
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        fontWeight="bold"
        color={color || 'primary'}
        sx={{ fontSize: { xs: '1rem', md: '1.25rem' }, mt: 0.25 }}
        noWrap
      >
        {value}
      </Typography>
      {sub && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', fontSize: { xs: '0.65rem', md: '0.75rem' } }}
          noWrap
        >
          {sub}
        </Typography>
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
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, height: { xs: 'auto', md: 280 }, minHeight: { xs: 200, md: 280 }, display: 'flex', flexDirection: 'column' }}>
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

function BrandDashboard({
  isAdminMode: isAdminModeProp,
  viewAsUserId: viewAsUserIdProp,
  isEmbedded = false,
  onCampaignSelect
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // props 우선, 없으면 URL fallback (라우트 기반 진입 호환)
  const viewAsUserId = viewAsUserIdProp != null ? viewAsUserIdProp : searchParams.get('userId');
  const isAdminMode = isAdminModeProp != null
    ? isAdminModeProp
    : location.pathname.startsWith('/admin/view-brand');

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  // 플랫폼 탭 사용자 정의 순서 (전체 탭은 항상 맨 앞 고정)
  // localStorage 에 ['쿠팡', '네이버', ...] 형태로 저장
  const PLATFORM_ORDER_KEY = 'brand_platform_order';
  const [platformOrder, setPlatformOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(PLATFORM_ORDER_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 제품별 현황 리스트 (선택 플랫폼/전체 기준 - 서버 페이지네이션)
  const [productList, setProductList] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productTotalCount, setProductTotalCount] = useState(0);

  // 제품 테이블 UX state
  const [filterText, setFilterText] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
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

  const loadProductList = useCallback(async ({ platform, page: p, sortKey: sk, sortDir: sd, filter: ft }) => {
    if (!platform) return;
    try {
      setProductLoading(true);
      const result = await brandDashboardService.getProductList({
        platform,
        page: p,
        pageSize: PAGE_SIZE,
        sortKey: sk,
        sortDir: sd,
        filter: ft || undefined,
        viewAsUserId: viewAsUserId ? parseInt(viewAsUserId, 10) : undefined
      });
      if (result?.success) {
        setProductList(result.data.rows || []);
        setProductTotalCount(result.data.totalCount || 0);
      }
    } catch (error) {
      console.error('product-list load error:', error);
      setProductList([]);
      setProductTotalCount(0);
    } finally {
      setProductLoading(false);
    }
  }, [viewAsUserId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // 검색어 debounce (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(filterText.trim()), 300);
    return () => clearTimeout(t);
  }, [filterText]);

  // 필터 변경 시 페이지 초기화
  useEffect(() => { setPage(1); }, [debouncedFilter]);

  // selectedPlatform / page / sort / filter 변경 시 product-list 재로드
  useEffect(() => {
    if (selectedPlatform) {
      loadProductList({
        platform: selectedPlatform,
        page,
        sortKey,
        sortDir,
        filter: debouncedFilter
      });
    }
  }, [selectedPlatform, page, sortKey, sortDir, debouncedFilter, loadProductList]);

  const handlePlatformChange = (_e, newPlatform) => {
    if (!newPlatform) return;
    setSelectedPlatform(newPlatform);
    loadOverview(newPlatform);
    // 플랫폼 바꾸면 테이블 state 초기화
    setFilterText('');
    setDebouncedFilter('');
    setPage(1);
    setExpandedProduct(null);
  };

  // 서버 사이드 페이지네이션: 백엔드가 이미 정렬/필터/페이지 처리한 결과
  const pagedProducts = productList;
  const pageCount = Math.max(1, Math.ceil(productTotalCount / PAGE_SIZE));

  // 캠페인 클릭
  // - embedded (Admin 컨트롤타워 내부): 부모(BrandLayout)에 콜백으로 알려 탭/캠페인만 전환
  // - 그 외: 대시보드 루트로 ?openCampaign= 쿼리 이동 → BrandLayout 이 쿼리 감지해 자동 선택
  const goToCampaign = useCallback((campaignId) => {
    if (isEmbedded && typeof onCampaignSelect === 'function') {
      onCampaignSelect(campaignId);
      return;
    }
    const params = new URLSearchParams();
    if (isAdminMode && viewAsUserId) params.set('userId', viewAsUserId);
    params.set('openCampaign', String(campaignId));
    navigate(`${campaignBasePath}?${params.toString()}`);
  }, [navigate, campaignBasePath, isAdminMode, viewAsUserId, isEmbedded, onCampaignSelect]);

  // 렌더
  if (loading && !overview) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // 플랫폼 정렬 적용: 전체(__ALL__) 항상 맨 앞 고정 + 사용자 저장 순서
  const rawPlatforms = overview?.platforms || [];
  const allTab = rawPlatforms.find(p => p.platform === '__ALL__');
  const others = rawPlatforms.filter(p => p.platform !== '__ALL__');
  const ordered = [];
  // 1. 저장 순서대로 먼저 채움
  for (const name of platformOrder) {
    const hit = others.find(p => p.platform === name);
    if (hit) ordered.push(hit);
  }
  // 2. 저장 순서에 없는 신규 플랫폼은 응답 순서대로 뒤에 추가
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
    <Box sx={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', p: 0.5 }}>
      {/* 플랫폼 탭 - 자체 horizontal Box + 드래그 정렬
          전체 탭은 맨 앞 고정 (드래그 불가), 나머지 플랫폼만 드래그로 순서 변경 가능
          (MUI Tabs 대신 직접 구현 — DragDropContext 가 Tabs 내부 indicator 와 충돌하기 때문) */}
      <Paper sx={{ mb: 2, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
          {/* 전체 탭 (고정) */}
          {allTab && (() => {
            const isSelected = selectedPlatform === '__ALL__';
            return (
              <Box
                onClick={() => handlePlatformChange(null, '__ALL__')}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5,
                  minHeight: 72, cursor: 'pointer', flexShrink: 0,
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

          {/* 나머지 플랫폼 (드래그 가능) */}
          <DragDropContext onDragEnd={handlePlatformDragEnd}>
            <Droppable droppableId="brand-platform-tabs" direction="horizontal">
              {(provided) => (
                <Box
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  sx={{ display: 'flex', alignItems: 'stretch' }}
                >
                  {ordered.map((p, idx) => {
                    const isSelected = selectedPlatform === p.platform;
                    return (
                      <Draggable key={p.platform} draggableId={`platform-${p.platform}`} index={idx}>
                        {(dragProvided, dragSnapshot) => (
                          <Box
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            onClick={() => handlePlatformChange(null, p.platform)}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 0.75, px: 2, py: 1.5,
                              minHeight: 72, cursor: 'pointer', flexShrink: 0,
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

      {/* 요약 카드 6개 - 1920에서 과도하게 넓어지지 않도록 개수 고정 균등 분할 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          {selectedPlatform === '__ALL__' ? '전체' : selectedPlatform} 현황 요약
        </Typography>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(3, minmax(0, 1fr))',
            md: 'repeat(6, minmax(0, 1fr))'
          },
          gap: { xs: 1, md: 2 }
        }}>
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

      {/* 일별 추이 차트 행 (최근 14일) - 리뷰 완료 라인 + 구매자 등록 막대 좌우 배치 (모바일은 세로 스택) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 1, md: 2 }, mb: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, height: { xs: 220, md: 260 }, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0, flexWrap: 'wrap' }}>
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

        <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, height: { xs: 220, md: 260 }, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0, flexWrap: 'wrap' }}>
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

      {/* 이슈 리스트 3개 (PC: 3단, 태블릿: 2단, 모바일: 1단) */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(3, minmax(0, 1fr))'
        },
        gap: { xs: 1, md: 2 },
        mb: 2
      }}>
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
            sx={{ minWidth: { xs: '100%', md: 260 }, width: { xs: '100%', md: 'auto' } }}
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
        ) : productTotalCount === 0 ? (
          <Alert severity="info" variant="outlined">
            {!debouncedFilter
              ? '해당 플랫폼에 등록된 제품이 없습니다.'
              : `"${debouncedFilter}" 로 필터된 제품이 없습니다.`}
          </Alert>
        ) : (
          <>
            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
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
                    <TableCell align="right" sx={{ fontWeight: 'bold', display: { xs: 'none', md: 'table-cell' } }} sortDirection={sortKey === 'campaignCount' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'campaignCount'}
                        direction={sortKey === 'campaignCount' ? sortDir : 'desc'}
                        onClick={() => handleSort('campaignCount')}
                      >
                        캠페인
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', display: { xs: 'none', md: 'table-cell' } }} sortDirection={sortKey === 'buyerCount' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'buyerCount'}
                        direction={sortKey === 'buyerCount' ? sortDir : 'desc'}
                        onClick={() => handleSort('buyerCount')}
                      >
                        구매자
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', display: { xs: 'none', md: 'table-cell' } }} sortDirection={sortKey === 'reviewCompletedCount' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'reviewCompletedCount'}
                        direction={sortKey === 'reviewCompletedCount' ? sortDir : 'desc'}
                        onClick={() => handleSort('reviewCompletedCount')}
                      >
                        리뷰 완료
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: { xs: 80, md: 160 }, whiteSpace: 'nowrap' }} sortDirection={sortKey === 'reviewCompletionRate' ? sortDir : false}>
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
                    <TableCell align="right" sx={{ fontWeight: 'bold', display: { xs: 'none', md: 'table-cell' } }} sortDirection={sortKey === 'imageCount' ? sortDir : false}>
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
                          <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>{fmtNumber(p.campaignCount)}개</TableCell>
                          <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>{fmtNumber(p.buyerCount)}</TableCell>
                          <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                            <Typography variant="body2" color="success.main">
                              {fmtNumber(p.reviewCompletedCount)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {/* PC에서만 progress bar 표시, 모바일은 % 텍스트만 (공간 절약) */}
                              <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(100, p.reviewCompletionRate)}
                                  sx={{ height: 6, borderRadius: 3 }}
                                />
                              </Box>
                              <Typography variant="caption" fontWeight="bold" sx={{ minWidth: 36, textAlign: 'right', color: rateColor, whiteSpace: 'nowrap' }}>
                                {p.reviewCompletionRate}%
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Typography variant="body2" fontWeight="bold" color="primary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                              {fmtAmount(p.totalAmount)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>{fmtNumber(p.imageCount)}장</TableCell>
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
              전체 {fmtNumber(productTotalCount)}개 제품
              {debouncedFilter && ` (검색어: "${debouncedFilter}")`}
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
}

export default BrandDashboard;
