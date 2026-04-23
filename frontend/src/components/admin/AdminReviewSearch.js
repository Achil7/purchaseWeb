import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Autocomplete,
  CircularProgress,
  Chip,
  Stack,
  Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { Grid as VGrid } from 'react-window';
import imageService from '../../services/imageService';
import { getBrandUsers } from '../../services/userService';
import ImageSwipeViewer from '../common/ImageSwipeViewer';

// 설정값
const COLUMNS = 6;
const CELL_HEIGHT = 170;
const INITIAL_LIMIT = 100;   // 초기 로드
const BATCH_LIMIT = 50;      // 추가 배치
const WINDOW_RADIUS = 100;   // 현재 활성 인덱스 기준 앞뒤 유지 장수
const PREFETCH_BUFFER = 40;  // 가시 영역 너머 미리 당겨 로드할 장수

// 컨테이너 크기 측정 훅 (AutoSizer 대체)
// ref callback 패턴으로 DOM이 붙는 순간 즉시 측정 + ResizeObserver 부착
const useContainerSize = () => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef(null);

  const refCallback = useCallback((el) => {
    // 이전 observer 정리
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!el) {
      setSize({ width: 0, height: 0 });
      return;
    }
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  return [refCallback, size];
};

// 그리드 셀 컴포넌트 (react-window v2는 cellComponent + cellProps)
const ReviewCell = ({ rowIndex, columnIndex, style, imageMap, totalCount, onCellClick }) => {
  const globalIdx = rowIndex * COLUMNS + columnIndex;
  if (globalIdx >= totalCount) {
    return <div style={style} />;
  }
  const img = imageMap.get(globalIdx);
  return (
    <div style={{ ...style, padding: 4, boxSizing: 'border-box' }}>
      <Box
        onClick={() => onCellClick(globalIdx)}
        sx={{
          width: '100%',
          height: '100%',
          position: 'relative',
          cursor: img ? 'pointer' : 'default',
          border: '1px solid #e0e0e0',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: img ? 'transparent' : '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '&:hover': img ? { outline: '2px solid #2c387e' } : {}
        }}
      >
        {img ? (
          <>
            <img
              src={img.s3_url}
              alt={img.file_name || `리뷰샷 ${globalIdx + 1}`}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {img.buyer?.is_temporary && (
              <Chip
                label="선"
                size="small"
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  bgcolor: '#fbc02d',
                  color: '#000',
                  height: 20,
                  fontSize: 11,
                  fontWeight: 'bold'
                }}
              />
            )}
            <Chip
              label={`#${(globalIdx + 1).toLocaleString()}`}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 4,
                left: 4,
                bgcolor: 'rgba(0,0,0,0.6)',
                color: '#fff',
                height: 18,
                fontSize: 10
              }}
            />
          </>
        ) : (
          <CircularProgress size={20} sx={{ color: '#9e9e9e' }} />
        )}
      </Box>
    </div>
  );
};

/**
 * Admin 리뷰샷 검색 페이지
 *
 * 최악 시나리오(10,000장 중 9999번째)를 위해 설계:
 * - 전역 인덱스(0..total-1) 기반, 서버 정렬 고정 (buyer_id ASC, created_at ASC)
 * - Map<globalIndex, image>로 부분 로드된 이미지만 유지
 * - 슬라이딩 윈도우: 활성 인덱스 앞뒤 ±100장만 메모리 유지, 그 밖은 삭제
 * - 그리드: react-window Grid (화면에 보이는 셀만 DOM)
 * - 뷰어: Swiper virtual 모듈 (화면 근처 슬라이드만 DOM)
 * - 뒤로 돌아가기: 윈도우 밖 인덱스 진입 시 재로드
 */
const AdminReviewSearch = () => {
  // 브랜드사 옵션
  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(false);

  // 필터 상태
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [productName, setProductName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  const hasAnyFilter = !!(
    selectedBrand?.id ||
    productName.trim() ||
    startDate ||
    endDate ||
    accountHolder.trim()
  );

  // 검색 결과 상태
  const [imageMap, setImageMap] = useState(() => new Map());
  const [totalCount, setTotalCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false); // 초기 검색 중
  const [error, setError] = useState('');

  // 활성 인덱스 (뷰어 오픈 시 current, 뷰어 닫힘 상태에선 그리드 가시 영역 중앙)
  const [activeIndex, setActiveIndex] = useState(0);

  // 뷰어 상태
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // 그리드 컨테이너 크기 측정
  const [gridRef, gridSize] = useContainerSize();

  // 현재 검색 조건을 ref로 유지(요청 중 조건이 바뀌어도 결과 혼선 방지 + closure 이슈)
  const queryVersionRef = useRef(0); // 검색 버튼 클릭마다 증가 → 이전 요청 무시
  const inFlightRangesRef = useRef(new Set()); // "start-end" 문자열 키로 중복 방지
  const currentQueryRef = useRef(null); // 마지막으로 실행한 쿼리 스냅샷
  const imageMapRef = useRef(imageMap); // loadRange에서 최신 Map 참조
  const totalCountRef = useRef(totalCount);

  useEffect(() => { imageMapRef.current = imageMap; }, [imageMap]);
  useEffect(() => { totalCountRef.current = totalCount; }, [totalCount]);

  // 브랜드사 목록 로드
  useEffect(() => {
    (async () => {
      try {
        setBrandsLoading(true);
        const res = await getBrandUsers();
        const list = Array.isArray(res) ? res : (res?.data || res?.users || []);
        setBrands(list);
      } catch (e) {
        console.error('브랜드사 목록 조회 실패', e);
      } finally {
        setBrandsLoading(false);
      }
    })();
  }, []);

  // 검색 실행 (초기)
  const runSearch = useCallback(async () => {
    const filters = {
      brand_id: selectedBrand?.id || undefined,
      product_name: productName.trim() || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      account_holder: accountHolder.trim() || undefined
    };
    const hasAny = Object.values(filters).some(v => v !== undefined);
    if (!hasAny) {
      setError('최소 1개 이상의 검색 조건을 입력해주세요');
      return;
    }

    queryVersionRef.current += 1;
    const myVersion = queryVersionRef.current;

    // 상태 초기화
    inFlightRangesRef.current = new Set();
    currentQueryRef.current = filters;

    setError('');
    setSearching(true);
    setImageMap(new Map());
    setTotalCount(0);
    setActiveIndex(0);

    try {
      const params = {
        ...currentQueryRef.current,
        limit: INITIAL_LIMIT,
        offset: 0
      };
      const res = await imageService.searchImages(params);
      if (myVersion !== queryVersionRef.current) return; // 취소됨

      const next = res?.data || [];
      const total = res?.total || 0;

      const newMap = new Map();
      for (let i = 0; i < next.length; i++) {
        newMap.set(i, next[i]);
      }
      setImageMap(newMap);
      setTotalCount(total);
      setHasSearched(true);
    } catch (e) {
      if (myVersion !== queryVersionRef.current) return;
      console.error('리뷰샷 검색 실패', e);
      setError(e?.response?.data?.message || '리뷰샷 검색 중 오류가 발생했습니다');
      setImageMap(new Map());
      setTotalCount(0);
      setHasSearched(true);
    } finally {
      if (myVersion === queryVersionRef.current) {
        setSearching(false);
      }
    }
  }, [selectedBrand, productName, startDate, endDate, accountHolder]);

  // 구간 로드 (뷰어/그리드 둘 다 호출)
  // start~end 범위를 확인하고, 로드 안 된 하위 구간들만 BATCH_LIMIT 단위로 fetch
  // imageMap/totalCount는 ref로 최신값 참조 → loadRange 자체는 안정적인 정체성 유지
  const loadRange = useCallback(async (requestStart, requestEnd) => {
    if (!currentQueryRef.current) return;
    const total = totalCountRef.current;
    if (total <= 0) return;

    const myVersion = queryVersionRef.current;
    const start = Math.max(0, requestStart);
    const end = Math.min(total - 1, requestEnd);
    if (start > end) return;

    // 로드 안 된 인덱스만 모아서 연속 구간으로 나눔
    const currentMap = imageMapRef.current;
    const missing = [];
    for (let i = start; i <= end; i++) {
      if (!currentMap.has(i)) missing.push(i);
    }
    if (missing.length === 0) return;

    // 연속 구간으로 묶기
    const chunks = [];
    let chunkStart = missing[0];
    let prev = missing[0];
    for (let i = 1; i < missing.length; i++) {
      if (missing[i] === prev + 1) {
        prev = missing[i];
      } else {
        chunks.push([chunkStart, prev]);
        chunkStart = missing[i];
        prev = missing[i];
      }
    }
    chunks.push([chunkStart, prev]);

    // 각 연속 구간을 BATCH_LIMIT으로 쪼개어 병렬 요청
    const requests = [];
    for (const [cs, ce] of chunks) {
      let s = cs;
      while (s <= ce) {
        const e = Math.min(ce, s + BATCH_LIMIT - 1);
        const key = `${s}-${e}`;
        if (!inFlightRangesRef.current.has(key)) {
          inFlightRangesRef.current.add(key);
          requests.push({ offset: s, limit: e - s + 1, key });
        }
        s = e + 1;
      }
    }
    if (requests.length === 0) return;

    await Promise.all(
      requests.map(async ({ offset, limit, key }) => {
        try {
          const res = await imageService.searchImages({
            ...currentQueryRef.current,
            limit,
            offset
          });
          if (myVersion !== queryVersionRef.current) return; // 취소됨
          const data = res?.data || [];
          setImageMap(prev => {
            const next = new Map(prev);
            for (let i = 0; i < data.length; i++) {
              next.set(offset + i, data[i]);
            }
            return next;
          });
        } catch (e) {
          console.error(`구간 로드 실패 offset=${offset} limit=${limit}`, e);
        } finally {
          inFlightRangesRef.current.delete(key);
        }
      })
    );
  }, []);

  // 슬라이딩 윈도우 적용: activeIndex가 바뀌면 윈도우 밖 인덱스 제거
  useEffect(() => {
    if (totalCount <= 0 || imageMap.size === 0) return;
    const minKeep = Math.max(0, activeIndex - WINDOW_RADIUS);
    const maxKeep = Math.min(totalCount - 1, activeIndex + WINDOW_RADIUS);

    let needsPrune = false;
    for (const idx of imageMap.keys()) {
      if (idx < minKeep || idx > maxKeep) {
        needsPrune = true;
        break;
      }
    }
    if (!needsPrune) return;

    setImageMap(prev => {
      const next = new Map();
      for (const [idx, img] of prev.entries()) {
        if (idx >= minKeep && idx <= maxKeep) {
          next.set(idx, img);
        }
      }
      return next;
    });
  }, [activeIndex, totalCount, imageMap]);

  // 셀 클릭 핸들러 (cellProps로 전달)
  const handleCellClick = useCallback((globalIdx) => {
    if (!imageMap.has(globalIdx)) return;
    setActiveIndex(globalIdx);
    setViewerIndex(globalIdx);
    setViewerOpen(true);
  }, [imageMap]);

  // 그리드 onCellsRendered: 보이는 범위가 바뀌면 prefetch 및 activeIndex 갱신
  const handleCellsRendered = useCallback((visibleCells /*, allCells */) => {
    if (totalCount <= 0) return;
    const visStart = visibleCells.rowStartIndex * COLUMNS;
    const visEnd = (visibleCells.rowStopIndex + 1) * COLUMNS - 1;
    const prefetchStart = Math.max(0, visStart - PREFETCH_BUFFER);
    const prefetchEnd = Math.min(totalCount - 1, visEnd + PREFETCH_BUFFER);
    loadRange(prefetchStart, prefetchEnd);

    // 뷰어가 닫힌 상태에서만 activeIndex를 가시 영역 중앙으로 갱신 (슬라이딩 윈도우 기준)
    if (!viewerOpen) {
      const mid = Math.floor((visStart + visEnd) / 2);
      if (mid >= 0 && mid < totalCount) {
        setActiveIndex(mid);
      }
    }
  }, [loadRange, totalCount, viewerOpen]);

  // 뷰어용: 전역 인덱스로 이미지 조회
  const getImage = useCallback((globalIdx) => {
    return imageMap.get(globalIdx) || null;
  }, [imageMap]);

  // 뷰어용: 식별 정보 (getMeta). "같은 구매자 내 N/M장"은 로드된 Map 안에서 스캔하여 계산
  const getMeta = useCallback((image, idx) => {
    if (!image) return null;
    let buyerImagePosition, buyerImageTotal;
    if (image.buyer?.id) {
      const buyerId = image.buyer.id;
      // 같은 구매자의 연속 구간 범위 찾기 (서버가 buyer_id 정렬로 반환하므로 연속임)
      let s = idx;
      while (s - 1 >= 0) {
        const prev = imageMap.get(s - 1);
        if (prev && prev.buyer?.id === buyerId) s -= 1;
        else break;
      }
      let e = idx;
      while (e + 1 < totalCount) {
        const nxt = imageMap.get(e + 1);
        if (nxt && nxt.buyer?.id === buyerId) e += 1;
        else break;
      }
      buyerImagePosition = idx - s + 1;
      buyerImageTotal = e - s + 1;
    }
    return {
      monthly_brand: image.monthly_brand,
      campaign: image.campaign,
      item: image.item,
      buyer: image.buyer,
      buyerImagePosition,
      buyerImageTotal
    };
  }, [imageMap, totalCount]);

  // 뷰어용 콜백
  const handleViewerNeedLoad = useCallback((start, end) => {
    loadRange(start, end);
  }, [loadRange]);

  const handleViewerIndexChange = useCallback((newIdx) => {
    setActiveIndex(newIdx);
  }, []);

  const handleViewerClose = useCallback(() => {
    setViewerOpen(false);
  }, []);

  // 엔터키 검색
  const onKeyDownSearch = (e) => {
    if (e.key === 'Enter' && hasAnyFilter) {
      runSearch();
    }
  };

  // 그리드 행 개수
  const rowCount = useMemo(
    () => totalCount > 0 ? Math.ceil(totalCount / COLUMNS) : 0,
    [totalCount]
  );
  const loadedCount = imageMap.size;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
        리뷰샷 검색
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        예금주 / 브랜드사 / 제품명 / 기간(리뷰샷 업로드 일자) 중 1개 이상 조건으로 후보 리뷰샷을 훑어볼 수 있습니다.
        썸네일 클릭 → 방향키(←→)로 끝까지 탐색, 상단에 연월브랜드·캠페인·제품·구매자 정보 표시.
      </Typography>

      {/* 필터 바 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ md: 'center' }}
          sx={{ flexWrap: { md: 'wrap' }, rowGap: { md: 2 } }}
        >
          <TextField
            label="예금주 (선택, 부분 일치)"
            size="small"
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            onKeyDown={onKeyDownSearch}
            sx={{ minWidth: 200 }}
          />

          <Autocomplete
            sx={{ minWidth: 280 }}
            options={brands}
            loading={brandsLoading}
            getOptionLabel={(o) => o?.name || o?.username || ''}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            value={selectedBrand}
            onChange={(_, v) => setSelectedBrand(v)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="브랜드사 (선택)"
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {brandsLoading ? <CircularProgress size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  )
                }}
              />
            )}
          />

          <TextField
            label="제품명 (선택, 부분 일치)"
            size="small"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            onKeyDown={onKeyDownSearch}
            sx={{ minWidth: 220 }}
          />

          <TextField
            label="시작일"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="종료일"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            disabled={!hasAnyFilter || searching}
            onClick={runSearch}
            sx={{ minWidth: 100 }}
          >
            {searching ? '검색 중' : '검색'}
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 결과 헤더 */}
      {hasSearched && !error && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">
            전체 <b>{totalCount.toLocaleString()}</b>건 · 현재 메모리 <b>{loadedCount.toLocaleString()}</b>장 유지
            {totalCount > 0 && ` · 활성 위치 #${(activeIndex + 1).toLocaleString()}`}
          </Typography>
        </Box>
      )}

      {/* 가상 스크롤 그리드 */}
      {searching && totalCount === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : hasSearched && totalCount === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          조건에 맞는 리뷰샷이 없습니다.
        </Paper>
      ) : totalCount > 0 ? (
        <Box
          ref={gridRef}
          sx={{
            width: '100%',
            height: 'calc(100vh - 280px)',
            minHeight: 400,
            position: 'relative'
          }}
        >
          {gridSize.width > 0 && gridSize.height > 0 && (
            <VGrid
              cellComponent={ReviewCell}
              cellProps={{
                imageMap,
                totalCount,
                onCellClick: handleCellClick
              }}
              columnCount={COLUMNS}
              columnWidth={Math.floor(gridSize.width / COLUMNS)}
              rowCount={rowCount}
              rowHeight={CELL_HEIGHT}
              style={{ width: gridSize.width, height: gridSize.height }}
              overscanCount={2}
              onCellsRendered={handleCellsRendered}
            />
          )}
        </Box>
      ) : null}

      {/* 뷰어 (Virtual 모드) */}
      <ImageSwipeViewer
        open={viewerOpen}
        onClose={handleViewerClose}
        totalCount={totalCount}
        getImage={getImage}
        initialGlobalIndex={viewerIndex}
        onChangeGlobalIndex={handleViewerIndexChange}
        onNeedLoad={handleViewerNeedLoad}
        getMeta={getMeta}
      />
    </Box>
  );
};

export default AdminReviewSearch;
