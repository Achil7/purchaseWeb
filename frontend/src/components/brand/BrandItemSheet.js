import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, CircularProgress, Dialog, DialogTitle, DialogContent, IconButton, Typography, Button, Snackbar, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { itemSlotService } from '../../services';

// Handsontable 모든 모듈 등록
registerAllModules();

// 행 타입 상수 정의
const ROW_TYPES = {
  ITEM_SEPARATOR: 'item_separator',      // 품목 구분선 (보라색, 높이 8px)
  PRODUCT_HEADER: 'product_header',      // 제품 정보 컬럼 헤더 행
  PRODUCT_DATA: 'product_data',          // 제품 정보 데이터 행
  BUYER_HEADER: 'buyer_header',          // 구매자 컬럼 헤더 행
  BUYER_DATA: 'buyer_data',              // 구매자 데이터 행
};

/**
 * 브랜드사용 품목별 시트 컴포넌트 (Handsontable - 엑셀)
 * - 연결된 캠페인의 품목/구매자 정보를 표시
 * - 읽기 전용 (수정 불가)
 * - 영업사/진행자와 유사한 제품 테이블 구조 + 접기/펼치기
 *
 * 제품 테이블 (14개 컬럼): 접기, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배대행, URL, (빈칸), 특이사항
 * 구매자 테이블 (14개 컬럼): 빈칸, 주문번호, 구매자, 수취인, 아이디, 금액, 송장번호, 리뷰샷, ...(나머지 빈칸)
 */
function BrandItemSheet({
  campaignId,
  viewAsUserId = null
}) {
  const hotRef = useRef(null);

  // 슬롯 데이터
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  // 이미지 확대 팝업 상태
  const [imagePopup, setImagePopup] = useState({ open: false, url: '', fileName: '', buyer: null });

  // 스낵바 상태
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // 접힌 품목 ID Set (기본값: 빈 Set = 모두 펼침)
  const [collapsedItems, setCollapsedItems] = useState(new Set());

  // 컬럼 크기 저장 키
  const COLUMN_WIDTHS_KEY = 'brand_itemsheet_column_widths';

  // 접기 상태 저장 키
  const COLLAPSED_ITEMS_KEY = 'brand_itemsheet_collapsed_items';

  // localStorage에서 컬럼 크기 로드
  const getSavedColumnWidths = useCallback(() => {
    try {
      const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  // localStorage에서 접기 상태 로드
  const getSavedCollapsedItems = useCallback(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_ITEMS_KEY);
      return saved ? new Set(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  }, []);

  // 접기 상태 저장
  const saveCollapsedItems = useCallback((items) => {
    try {
      localStorage.setItem(COLLAPSED_ITEMS_KEY, JSON.stringify([...items]));
    } catch (e) {
      console.error('Failed to save collapsed items:', e);
    }
  }, []);

  // 컬럼 크기 변경 시 저장
  const handleColumnResize = useCallback((newSize, column) => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const widths = [];
    for (let i = 0; i < hot.countCols(); i++) {
      widths.push(hot.getColWidth(i));
    }

    try {
      localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
    } catch (e) {
      console.error('Failed to save column widths:', e);
    }
  }, []);

  // 캠페인별 슬롯 데이터 로드 (Brand 전용)
  const loadSlots = useCallback(async () => {
    if (!campaignId) return;

    setLoading(true);
    try {
      const params = { viewAsRole: 'brand' };
      if (viewAsUserId) {
        params.viewAsUserId = viewAsUserId;
      }
      const response = await itemSlotService.getSlotsByCampaign(campaignId, params);
      if (response.success) {
        // 모든 슬롯 표시 (임시 구매자만 제외)
        const allSlots = (response.data || []).filter(slot => {
          const buyer = slot.buyer;
          return !buyer?.is_temporary;
        });
        setSlots(allSlots);
      }
    } catch (error) {
      console.error('Failed to load slots:', error);
    } finally {
      setLoading(false);
    }
  }, [campaignId, viewAsUserId]);

  useEffect(() => {
    if (campaignId) {
      loadSlots();
    }
  }, [campaignId, loadSlots]);

  // slots 로드 후 접기 상태 초기화 (localStorage 복원 또는 기본값=모두 접기)
  useEffect(() => {
    if (slots.length === 0) return;

    const allItemIds = [...new Set(slots.map(s => s.item_id))];
    const savedCollapsed = getSavedCollapsedItems();

    if (savedCollapsed !== null && savedCollapsed.size > 0) {
      const validCollapsed = new Set([...savedCollapsed].filter(id => allItemIds.includes(id)));
      setCollapsedItems(validCollapsed);
    } else {
      // 기본값: 모두 접기
      setCollapsedItems(new Set(allItemIds));
    }
  }, [slots, getSavedCollapsedItems]);

  // Shift+휠 스크롤로 횡스크롤만 지원
  useEffect(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const rootElement = hot.rootElement;
    if (!rootElement) return;

    const wtHolder = rootElement.querySelector('.wtHolder');

    const handleWheel = (e) => {
      if (e.shiftKey && wtHolder) {
        e.preventDefault();
        e.stopPropagation();
        const scrollAmount = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        wtHolder.scrollLeft += scrollAmount;
      }
    };

    rootElement.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => rootElement.removeEventListener('wheel', handleWheel, { capture: true });
  }, [slots]);

  // Handsontable 데이터 변환 - 제품 테이블 + 구매자 테이블 구조
  const { tableData, slotIndexMap } = useMemo(() => {
    const data = [];
    const indexMap = {}; // tableRow -> slotId

    // 슬롯을 품목별로 그룹화
    const itemGroups = {};
    slots.forEach((slot) => {
      const itemId = slot.item_id;
      if (!itemGroups[itemId]) {
        itemGroups[itemId] = {
          item: slot.item,
          slots: []
        };
      }
      itemGroups[itemId].slots.push(slot);
    });

    let isFirstItem = true;

    // 품목별로 행 생성
    Object.entries(itemGroups).forEach(([itemId, itemGroup]) => {
      const item = itemGroup.item || {};

      // 품목별 완료 상태 계산 (전체 슬롯 vs 리뷰샷 완료)
      const totalSlots = itemGroup.slots.length;
      const completedSlots = itemGroup.slots.filter(
        slot => slot.buyer?.images?.length > 0
      ).length;
      const isAllCompleted = totalSlots > 0 && totalSlots === completedSlots;

      // 첫 번째 품목이 아닌 경우 품목 구분선 추가
      if (!isFirstItem) {
        data.push({ _rowType: ROW_TYPES.ITEM_SEPARATOR });
      }
      isFirstItem = false;

      // 제품 헤더 행 (14개 컬럼) - 브랜드사 전용 (순번 대신 플랫폼 표시)
      // 순서: 접기, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배대행, URL, (빈칸), 특이사항
      data.push({
        _rowType: ROW_TYPES.PRODUCT_HEADER,
        col0: '', col1: '날짜', col2: '플랫폼', col3: '제품명', col4: '옵션', col5: '출고', col6: '키워드',
        col7: '가격', col8: '총건수', col9: '일건수', col10: '택배대행', col11: 'URL', col12: '', col13: '특이사항'
      });

      // 제품 데이터 행 (14개 컬럼) - 브랜드사 전용 (순번 대신 플랫폼 표시)
      data.push({
        _rowType: ROW_TYPES.PRODUCT_DATA,
        _itemId: parseInt(itemId),
        _completionStatus: { total: totalSlots, completed: completedSlots, isAllCompleted },
        col0: '',  // 토글 버튼
        col1: item.date || '',  // 날짜
        col2: item.platform || '-',  // 플랫폼 (순번 대신)
        col3: item.product_name || '',  // 제품명
        col4: item.purchase_option || '',  // 옵션
        col5: item.shipping_type || '',  // 출고
        col6: item.keyword || '',  // 키워드
        col7: item.product_price ? Number(item.product_price).toLocaleString() : '',  // 가격
        col8: item.total_purchase_count || '',  // 총건수
        col9: item.daily_purchase_count || '',  // 일건수
        col10: item.courier_service_yn ? 'Y' : 'N',  // 택배대행
        col11: item.product_url || '',  // URL
        col12: '',  // 빈칸 (기존 플랫폼 위치)
        col13: item.notes || ''  // 특이사항
      });

      // 접힌 상태가 아닐 때만 구매자 정보 표시
      const isCollapsed = collapsedItems.has(parseInt(itemId));

      if (!isCollapsed) {
        // 구매자 헤더 행 (14개 컬럼)
        data.push({
          _rowType: ROW_TYPES.BUYER_HEADER,
          _itemId: parseInt(itemId),
          col0: '', col1: '주문번호', col2: '구매자', col3: '수취인', col4: '아이디', col5: '금액', col6: '송장번호', col7: '리뷰샷',
          col8: '', col9: '', col10: '', col11: '', col12: '', col13: ''
        });

        // 구매자 데이터 행 (슬롯별)
        itemGroup.slots.forEach((slot, slotIndex) => {
          const buyer = slot.buyer || {};
          const reviewImage = buyer.images && buyer.images.length > 0 ? buyer.images[0] : null;

          indexMap[data.length] = slot.id;

          data.push({
            _rowType: ROW_TYPES.BUYER_DATA,
            _slotId: slot.id,
            _itemId: parseInt(itemId),
            _buyerId: buyer.id || null,
            _buyer: buyer,
            _reviewImageUrl: reviewImage?.s3_url || '',
            _reviewImageName: reviewImage?.file_name || '',
            col0: '',  // 빈칸 (순번은 표시 안 함)
            col1: buyer.order_number || '',
            col2: buyer.buyer_name || '',
            col3: buyer.recipient_name || '',
            col4: buyer.user_id || '',
            col5: buyer.amount || '',
            col6: buyer.tracking_number || '',
            col7: reviewImage?.s3_url || '',
            col8: '', col9: '', col10: '', col11: '', col12: '', col13: ''
          });
        });
      }
    });

    return { tableData: data, slotIndexMap: indexMap };
  }, [slots, collapsedItems]);

  // 개별 품목 접기/펼치기 토글
  const toggleItemCollapse = useCallback((itemId) => {
    setCollapsedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      saveCollapsedItems(next);
      return next;
    });
  }, [saveCollapsedItems]);

  // 모두 펼치기
  const expandAll = useCallback(() => {
    const emptySet = new Set();
    setCollapsedItems(emptySet);
    saveCollapsedItems(emptySet);
  }, [saveCollapsedItems]);

  // 모두 접기
  const collapseAll = useCallback(() => {
    const allItemIds = slots
      .map(s => s.item_id)
      .filter((id, idx, arr) => arr.indexOf(id) === idx);
    const allCollapsed = new Set(allItemIds);
    setCollapsedItems(allCollapsed);
    saveCollapsedItems(allCollapsed);
  }, [slots, saveCollapsedItems]);

  // 기본 컬럼 너비 - 14개 컬럼 (브랜드사 전용)
  // 접기, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배대행, URL, (빈칸), 특이사항
  const defaultColumnWidths = [30, 80, 70, 150, 100, 60, 120, 80, 60, 60, 60, 150, 50, 200];

  // 컬럼 정의
  const columns = useMemo(() => {
    const savedWidths = getSavedColumnWidths();
    const baseColumns = [];

    for (let i = 0; i < 14; i++) {
      baseColumns.push({
        data: `col${i}`,
        type: 'text',
        width: savedWidths?.[i] || defaultColumnWidths[i],
        readOnly: true
      });
    }

    return baseColumns;
  }, [getSavedColumnWidths]);

  // 컬럼 헤더
  const colHeaders = Array(14).fill('');

  // 셀 렌더러 - 행 타입별 분기
  const cellsRenderer = useCallback((row, col, prop) => {
    const cellProperties = {};

    if (row >= tableData.length) {
      cellProperties.className = 'spare-row-cell';
      return cellProperties;
    }

    const rowData = tableData[row];
    const rowType = rowData?._rowType;

    switch (rowType) {
      case ROW_TYPES.ITEM_SEPARATOR:
        cellProperties.readOnly = true;
        cellProperties.renderer = function(instance, td) {
          td.className = 'item-separator-row';
          td.style.backgroundColor = '#9c27b0';
          td.style.height = '8px';
          td.style.padding = '0';
          td.innerHTML = '';
          return td;
        };
        break;

      case ROW_TYPES.PRODUCT_HEADER:
        cellProperties.readOnly = true;
        cellProperties.renderer = function(instance, td, r, c, prop, value) {
          td.className = 'product-header-row';
          td.style.backgroundColor = '#ede7f6';
          td.style.fontWeight = 'bold';
          td.style.textAlign = 'center';
          td.style.fontSize = '11px';
          td.textContent = value ?? '';
          return td;
        };
        break;

      case ROW_TYPES.PRODUCT_DATA:
        cellProperties.readOnly = true;
        cellProperties.renderer = function(instance, td, r, c, prop, value) {
          td.className = 'product-data-row';
          td.style.backgroundColor = '#f3e5f5';
          td.style.fontSize = '11px';

          // col0 - 토글 아이콘 + 완료 배지 표시
          if (prop === 'col0') {
            const itemId = rowData._itemId;
            const isCollapsed = collapsedItems.has(itemId);
            const status = rowData._completionStatus;

            let completionBadge = '';
            if (status?.isAllCompleted) {
              completionBadge = '<span style="color: #388e3c; font-size: 12px; margin-left: 4px; font-weight: bold;">✓</span>';
            } else if (status?.completed > 0) {
              completionBadge = `<span style="color: #f57c00; font-size: 10px; margin-left: 4px;">${status.completed}/${status.total}</span>`;
            }

            td.innerHTML = `<span class="collapse-toggle" style="cursor: pointer; user-select: none; font-size: 14px; color: #666;">${isCollapsed ? '▶' : '▼'}</span>${completionBadge}`;
            td.style.textAlign = 'center';
            td.style.cursor = 'pointer';
            td.onclick = (e) => {
              e.stopPropagation();
              toggleItemCollapse(itemId);
            };
          }
          // col2 - 플랫폼 (볼드, 파란색)
          else if (prop === 'col2') {
            td.textContent = value ?? '';
            td.style.fontWeight = 'bold';
            td.style.color = '#1565c0';
          }
          // col3 - 제품명 (볼드, 보라색)
          else if (prop === 'col3') {
            td.textContent = value ?? '';
            td.style.fontWeight = 'bold';
            td.style.color = '#4a148c';
          }
          // col7 - 가격 (숫자 포맷)
          else if (prop === 'col7' && value) {
            td.textContent = value;
            td.style.fontWeight = 'bold';
            td.style.color = '#c2185b';
          }
          // col11 - URL 하이퍼링크 (행 높이 고정을 위해 텍스트 오버플로우 처리)
          else if (prop === 'col11' && value) {
            const url = value.startsWith('http') ? value : `https://${value}`;
            td.style.whiteSpace = 'nowrap';
            td.style.overflow = 'hidden';
            td.style.textOverflow = 'ellipsis';
            td.title = value;  // 툴팁으로 전체 URL 표시
            td.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #1976d2; text-decoration: underline;">${value}</a>`;
          }
          else {
            td.textContent = value ?? '';
          }
          return td;
        };
        break;

      case ROW_TYPES.BUYER_HEADER:
        cellProperties.readOnly = true;
        cellProperties.renderer = function(instance, td, r, c, prop, value) {
          td.className = 'buyer-header-row';
          td.style.backgroundColor = '#f5f5f5';
          td.style.fontWeight = 'bold';
          td.style.textAlign = 'center';
          td.style.fontSize = '11px';
          td.textContent = value ?? '';
          return td;
        };
        break;

      case ROW_TYPES.BUYER_DATA:
        cellProperties.readOnly = true;
        const hasReviewImage = rowData._reviewImageUrl;
        cellProperties.className = hasReviewImage ? 'has-review' : 'no-review';

        cellProperties.renderer = function(instance, td, r, c, prop, value) {
          td.className = hasReviewImage ? 'has-review' : 'no-review';
          td.style.fontSize = '11px';

          // col0 - 빈칸
          if (prop === 'col0') {
            td.textContent = '';
          }
          // col2 - 구매자 (볼드)
          else if (prop === 'col2') {
            td.textContent = value ?? '';
            td.style.fontWeight = 'bold';
          }
          // col5 - 금액 (숫자 포맷)
          else if (prop === 'col5' && value) {
            const numValue = parseInt(String(value).replace(/[^0-9]/g, ''));
            td.textContent = numValue ? numValue.toLocaleString() + '원' : value;
            td.style.fontWeight = 'bold';
            td.style.color = '#c2185b';
          }
          // col6 - 송장번호
          else if (prop === 'col6') {
            td.textContent = value ?? '';
            if (value) {
              td.style.color = '#1565c0';
            }
          }
          // col7 - 리뷰샷 (썸네일)
          else if (prop === 'col7') {
            const imageUrl = rowData._reviewImageUrl;
            if (imageUrl) {
              td.innerHTML = `<img
                src="${imageUrl}"
                alt="리뷰"
                class="review-thumbnail"
                data-url="${imageUrl}"
                data-filename="${rowData._reviewImageName || ''}"
                style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 2px solid #9c27b0;"
              />`;
              td.style.padding = '2px';
              td.style.textAlign = 'center';
            } else {
              td.innerHTML = '<span style="color: #999; font-size: 10px;">-</span>';
              td.style.textAlign = 'center';
            }
          } else {
            td.textContent = value ?? '';
          }

          return td;
        };
        break;

      default:
        break;
    }

    return cellProperties;
  }, [tableData, collapsedItems, toggleItemCollapse]);

  // 전체 데이터 건수 (원본 slots 기준)
  const totalDataCount = useMemo(() => {
    return slots.length;
  }, [slots]);

  // 금액 합산 계산
  const totalAmount = useMemo(() => {
    return slots.reduce((sum, slot) => {
      const buyer = slot.buyer || {};
      const amount = parseInt(String(buyer.amount || 0).replace(/[^0-9]/g, '')) || 0;
      return sum + amount;
    }, 0);
  }, [slots]);

  // 리뷰 이미지가 있는 건수
  const reviewCount = useMemo(() => {
    return slots.filter(slot => slot.buyer?.images?.length > 0).length;
  }, [slots]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 헤더: 전체 건수 + 모두 펼치기/접기 */}
      <Box sx={{
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: '#4a148c',
        color: 'white',
        px: 2,
        py: 1,
        borderRadius: '4px 4px 0 0'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
            전체 {totalDataCount}건
          </Box>
          <Box sx={{ fontSize: '0.9rem' }}>
            리뷰 완료: <strong>{reviewCount}건</strong>
          </Box>
          <Box sx={{ fontSize: '0.9rem' }}>
            금액 합계: <strong>{totalAmount.toLocaleString()}원</strong>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              onClick={expandAll}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.15)',
                fontSize: '0.7rem',
                minWidth: 'auto',
                px: 1,
                py: 0.3,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
              }}
            >
              모두 펼치기
            </Button>
            <Button
              size="small"
              onClick={collapseAll}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.15)',
                fontSize: '0.7rem',
                minWidth: 'auto',
                px: 1,
                py: 0.3,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
              }}
            >
              모두 접기
            </Button>
          </Box>
        </Box>
      </Box>

      <Paper sx={{
        overflow: 'hidden',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        '& .handsontable': {
          fontSize: '12px'
        },
        '& .handsontable thead th': {
          whiteSpace: 'nowrap',
          overflow: 'visible',
          position: 'relative',
          textAlign: 'center !important'
        },
        // 품목 구분선 행 스타일
        '& .item-separator-row': {
          backgroundColor: '#9c27b0 !important',
          height: '8px !important',
          padding: '0 !important',
          border: 'none !important'
        },
        // 제품 헤더 행 스타일
        '& .product-header-row': {
          backgroundColor: '#ede7f6 !important',
          fontWeight: 'bold !important',
          textAlign: 'center'
        },
        // 제품 데이터 행 스타일
        '& .product-data-row': {
          backgroundColor: '#f3e5f5 !important'
        },
        // 구매자 헤더 행 스타일
        '& .buyer-header-row': {
          backgroundColor: '#f5f5f5 !important',
          fontWeight: 'bold !important',
          textAlign: 'center'
        },
        // 리뷰 있는 행 배경
        '& .has-review': {
          backgroundColor: '#e8f5e9 !important'
        },
        // 리뷰 없는 행 배경
        '& .no-review': {
          backgroundColor: '#fff !important'
        }
      }}>
        {tableData.length > 0 ? (
          <HotTable
            ref={hotRef}
            data={tableData}
            columns={columns}
            colHeaders={colHeaders}
            rowHeaders={false}
            width="100%"
            height="100%"
            licenseKey="non-commercial-and-evaluation"
            stretchH="none"
            autoRowSize={false}
            manualColumnResize={true}
            manualRowResize={false}
            readOnly={true}
            disableVisualSelection={false}
            contextMenu={false}
            copyPaste={true}
            cells={cellsRenderer}
            afterOnCellMouseUp={(event, coords) => {
              // 리뷰샷 썸네일 클릭 시 확대 팝업
              const target = event.target;
              if (target.tagName === 'IMG' && target.classList.contains('review-thumbnail')) {
                const url = target.getAttribute('data-url');
                const fileName = target.getAttribute('data-filename');
                const rowData = tableData[coords.row];
                if (url) {
                  setImagePopup({
                    open: true,
                    url,
                    fileName: fileName || '리뷰 이미지',
                    buyer: rowData?._buyer || null
                  });
                }
              }
            }}
            className="htCenter"
            columnSorting={true}
            autoWrapRow={false}
            autoWrapCol={false}
            afterColumnResize={handleColumnResize}
            rowHeights={23}
          />
        ) : (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: 200,
            color: 'text.secondary'
          }}>
            <Typography variant="body1">등록된 품목이 없습니다.</Typography>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 1 }}>
              영업사가 품목을 등록하면 여기에 표시됩니다.
            </Typography>
          </Box>
        )}
      </Paper>

      {/* 스낵바 알림 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* 이미지 확대 팝업 */}
      <Dialog
        open={imagePopup.open}
        onClose={() => setImagePopup({ open: false, url: '', fileName: '', buyer: null })}
        maxWidth="lg"
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <span style={{ fontSize: '14px', color: '#666' }}>{imagePopup.fileName}</span>
          <IconButton
            size="small"
            onClick={() => setImagePopup({ open: false, url: '', fileName: '', buyer: null })}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 1 }}>
          {imagePopup.url && (
            <Box>
              <img
                src={imagePopup.url}
                alt={imagePopup.fileName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain'
                }}
              />
              {/* 구매자 정보 표시 */}
              {imagePopup.buyer && (
                <Box sx={{ p: 2, bgcolor: '#f5f5f5', mt: 1, borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    <Typography variant="body2">
                      <strong>구매자:</strong> {imagePopup.buyer.buyer_name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>수취인:</strong> {imagePopup.buyer.recipient_name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>주문번호:</strong> {imagePopup.buyer.order_number}
                    </Typography>
                    <Typography variant="body2">
                      <strong>아이디:</strong> {imagePopup.buyer.user_id}
                    </Typography>
                    {imagePopup.buyer.tracking_number && (
                      <Typography variant="body2" color="#1565c0">
                        <strong>송장번호:</strong> {imagePopup.buyer.tracking_number}
                      </Typography>
                    )}
                    {imagePopup.buyer.amount && (
                      <Typography variant="body2" color="#c2185b" fontWeight="bold">
                        <strong>금액:</strong> {Number(imagePopup.buyer.amount).toLocaleString()}원
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default BrandItemSheet;
