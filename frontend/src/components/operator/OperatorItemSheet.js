import React, { useState, useCallback, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { Box, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Snackbar, Alert, IconButton, Tooltip, Typography, Divider, Grid, Chip } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import InfoIcon from '@mui/icons-material/Info';
import ImageSwipeViewer from '../common/ImageSwipeViewer';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import itemSlotService from '../../services/itemSlotService';
import itemService from '../../services/itemService';
import { downloadExcel, convertSlotsToExcelData } from '../../utils/excelExport';

// Handsontable 모든 모듈 등록
registerAllModules();

// 슬롯 데이터 캐시 (캠페인 전환 최적화)
const slotsCache = new Map();

// 행 타입 상수 정의
const ROW_TYPES = {
  ITEM_SEPARATOR: 'item_separator',      // 품목 구분선 (파란색, 높이 8px)
  PRODUCT_HEADER: 'product_header',      // 제품 정보 컬럼 헤더 행
  PRODUCT_DATA: 'product_data',          // 제품 정보 데이터 행
  UPLOAD_LINK_BAR: 'upload_link_bar',    // 업로드 링크 바 (검정)
  BUYER_HEADER: 'buyer_header',          // 구매자 컬럼 헤더 행
  BUYER_DATA: 'buyer_data',              // 구매자 데이터 행
};

// ========== 성능 최적화: 셀 렌더러 함수 (컴포넌트 외부 정의) ==========
// 매 렌더링마다 새 함수 생성을 방지하여 성능 향상

const itemSeparatorRenderer = (instance, td) => {
  td.className = 'item-separator-row';
  td.style.backgroundColor = '#1565c0';
  td.style.height = '8px';
  td.style.padding = '0';
  td.innerHTML = '';
  return td;
};

const productHeaderRenderer = (instance, td, r, c, prop, value) => {
  td.className = 'product-header-row';
  td.style.backgroundColor = '#e0e0e0';
  td.style.fontWeight = 'bold';
  td.style.textAlign = 'center';
  td.style.fontSize = '11px';
  td.textContent = value ?? '';
  return td;
};

const buyerHeaderRenderer = (instance, td, r, c, prop, value) => {
  td.className = 'buyer-header-row';
  td.style.backgroundColor = '#f5f5f5';
  td.style.fontWeight = 'bold';
  td.style.textAlign = 'center';
  td.style.fontSize = '11px';
  td.textContent = value ?? '';
  return td;
};

// 동적 데이터가 필요한 렌더러는 팩토리 함수로 생성
// collapsedItemsRef를 사용하여 최신 접기 상태 참조 (렌더러 재생성 방지)
const createProductDataRenderer = (tableData, collapsedItemsRef, toggleItemCollapse, columnAlignments) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableData[r];
    td.className = 'product-data-row';
    td.style.backgroundColor = '#fff8e1';
    td.style.fontSize = '11px';

    if (prop === 'col0') {
      const itemId = rowData._itemId;
      const dayGroup = rowData._dayGroup;
      const collapseKey = `${itemId}_${dayGroup}`;
      // ref를 통해 최신 상태 참조
      const isCollapsed = collapsedItemsRef.current.has(collapseKey);
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
        toggleItemCollapse(itemId, dayGroup);
      };
    } else if (prop === 'col2') {
      td.textContent = value ?? '';
      td.style.fontWeight = 'bold';
      td.style.color = '#1565c0';
    } else if (prop === 'col11' && value) {
      const url = value.startsWith('http') ? value : `https://${value}`;
      td.style.whiteSpace = 'nowrap';
      td.style.overflow = 'hidden';
      td.style.textOverflow = 'ellipsis';
      td.title = value;
      td.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #1976d2; text-decoration: underline;">${value}</a>`;
    } else {
      td.textContent = value ?? '';
    }

    if (columnAlignments[c] && !td.style.textAlign) {
      td.style.textAlign = columnAlignments[c];
    }

    return td;
  };
};

const createUploadLinkBarRenderer = (tableData) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableData[r];
    td.className = 'upload-link-bar';
    td.style.backgroundColor = '#424242';
    td.style.color = 'white';
    td.style.cursor = 'pointer';
    td.style.fontSize = '11px';
    td.setAttribute('data-token', rowData._uploadToken || '');

    if (c === 0) {
      td.textContent = '';
    } else if (c === 1) {
      td.textContent = value || '';
      td.style.paddingLeft = '8px';
    } else {
      td.textContent = '';
    }
    return td;
  };
};

const createBuyerDataRenderer = (tableData, statusLabels, duplicateOrderNumbers, columnAlignments) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableData[r];
    const dayGroup = rowData._dayGroup || 1;
    const dayClass = dayGroup % 2 === 0 ? 'day-even' : 'day-odd';
    td.className = dayClass;
    td.style.fontSize = '11px';

    if (prop === 'col0') {
      td.textContent = '';
      td.style.textAlign = 'center';
    } else if (prop === 'col1') {
      td.textContent = value ?? '';
      td.style.textAlign = 'center';
    } else if (prop === 'col2') {
      td.textContent = value ?? '';
      td.style.textAlign = 'center';
      td.style.color = '#666';
    } else if (prop === 'col3') {
      td.textContent = value ?? '';
      td.style.color = '#555';
    } else if (prop === 'col4') {
      td.textContent = value ?? '';
      td.style.color = '#555';
    } else if (prop === 'col13' && value) {
      const numValue = parseInt(String(value).replace(/[^0-9]/g, ''));
      td.textContent = numValue ? numValue.toLocaleString() : value;
    } else if (prop === 'col14') {
      td.textContent = value ?? '';
    } else if (prop === 'col15') {
      const images = rowData._reviewImages || [];
      const imageCount = images.length;
      if (imageCount > 0) {
        const label = imageCount > 1 ? `리뷰 보기 (${imageCount})` : '리뷰 보기';
        td.innerHTML = `<a href="#" class="review-link" style="color: #1976d2; text-decoration: underline; cursor: pointer; font-size: 11px;">${label}</a>`;
        td.style.textAlign = 'center';
      } else {
        td.innerHTML = '<span style="color: #999; font-size: 10px;">-</span>';
        td.style.textAlign = 'center';
      }
    } else if (prop === 'col16') {
      // col16에 저장된 상태값 직접 사용 (calculatedStatus)
      const displayStatus = value || '-';
      const label = statusLabels[displayStatus] || displayStatus;

      if (displayStatus === '-') {
        td.innerHTML = '<span style="color: #999;">-</span>';
        td.style.textAlign = 'center';
      } else if (displayStatus === 'completed') {
        td.innerHTML = `<span class="status-chip status-completed" style="font-weight: bold;">✓ ${label}</span>`;
      } else if (displayStatus === 'resubmitted') {
        td.innerHTML = `<span class="status-chip status-resubmitted" style="font-weight: bold;">🔄 ${label}</span>`;
      } else {
        td.innerHTML = `<span class="status-chip status-${displayStatus}">${label}</span>`;
      }
    } else if (prop === 'col18') {
      td.textContent = value ?? '';
    } else if (prop === 'col19') {
      td.style.textAlign = 'center';
      if (value) {
        try {
          const date = new Date(value);
          const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
          const yy = String(kstDate.getUTCFullYear()).slice(-2);
          const mm = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(kstDate.getUTCDate()).padStart(2, '0');
          td.textContent = `${yy}${mm}${dd} 입금완료`;
          td.style.color = '#388e3c';
          td.style.fontWeight = 'bold';
        } catch (e) {
          td.textContent = value;
        }
      } else {
        td.textContent = '';
      }
    } else if (prop === 'col6') {
      td.textContent = value ?? '';
      if (value && duplicateOrderNumbers.has(value)) {
        td.classList.add('duplicate-order');
      }
    } else {
      td.textContent = value ?? '';
    }

    if (columnAlignments[c] && !td.style.textAlign) {
      td.style.textAlign = columnAlignments[c];
    }

    return td;
  };
};

// 제품 정보 컬럼 헤더 (9개)
const PRODUCT_HEADERS = ['제품명', '출고', '옵션', '키워드', '가격', '총건수', '일건수', 'URL', '택배'];

// 기본 컬럼 너비 - 20개 컬럼
const DEFAULT_COLUMN_WIDTHS = [30, 80, 70, 150, 100, 60, 60, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 80, 80];

// 구매자 정보 컬럼 헤더 (20개) - 구매자 테이블에서 col2는 '순번' (슬롯 순서)
// col0: 접기, col1: 날짜, col2: 순번(구매자용), col3: 제품명, col4: 옵션, col5: 예상구매자,
// col6: 주문번호, col7: 구매자, col8: 수취인, col9: 아이디, col10: 연락처, col11: 주소, col12: 계좌, col13: 금액,
// col14: 송장번호, col15: 리뷰샷, col16: 상태, col17: 리뷰비, col18: 입금명, col19: 입금여부
// 제품 테이블에서 col2는 '플랫폼' (Item.platform)
const BUYER_HEADERS = ['', '날짜', '순번', '제품명', '옵션', '예상구매자', '주문번호', '구매자', '수취인', '아이디', '연락처', '주소', '계좌', '금액', '송장번호', '리뷰샷', '상태', '리뷰비', '입금명', '입금여부'];

/**
 * 진행자용 품목별 시트 컴포넌트 (Handsontable - 엑셀)
 * - 배정된 품목의 슬롯만 표시
 * - 구매자 정보 컬럼 포함
 *
 * 컬럼 순서:
 * URL, 날짜, 순번, 품명, 옵션, 리뷰(키워드), 예상구매자, 주문번호, 구매자, 수취인, 아이디, 연락처, 주소, 금액, 리뷰비용, 리뷰작성(상태), 특이사항
 */
const OperatorItemSheetInner = forwardRef(function OperatorItemSheetInner({
  campaignId,
  campaignName = '',
  items,
  onRefresh,
  viewAsUserId = null
}, ref) {
  const hotRef = useRef(null);
  const containerRef = useRef(null);

  // 슬롯 데이터
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  // 컬럼 너비 상태
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);

  // 접기 상태 초기화 완료 플래그 (캠페인ID 추적용)
  const lastCampaignId = useRef(null);

  // 변경된 슬롯들 추적
  const [changedSlots, setChangedSlots] = useState({});
  const changedSlotsRef = useRef(changedSlots);
  changedSlotsRef.current = changedSlots;

  // 변경된 아이템들 추적 (제품 정보 수정용)
  const [changedItems, setChangedItems] = useState({});
  const changedItemsRef = useRef(changedItems);
  changedItemsRef.current = changedItems;

  // 스낵바 상태
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // 삭제 다이얼로그 상태
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    type: '', // 'rows', 'group'
    data: null,
    message: ''
  });

  // 저장 중 상태
  const [saving, setSaving] = useState(false);

  // 이미지 갤러리 팝업 상태
  const [imagePopup, setImagePopup] = useState({
    open: false,
    images: [],      // 전체 이미지 배열
    currentIndex: 0, // 현재 보고 있는 이미지 인덱스
    buyer: null      // 구매자 정보
  });

  // 제품 상세 정보 팝업 상태
  const [productDetailPopup, setProductDetailPopup] = useState({
    open: false,
    item: null,       // Item 정보
    dayGroup: null    // day_group 정보
  });

  // 메모 기능 비활성화됨

  // 필터링된 행 인덱스 (null이면 전체, 배열이면 필터링된 행만)
  const [filteredRows, setFilteredRows] = useState(null);

  // 필터링된 컬럼 인덱스 추적
  const [filteredColumns, setFilteredColumns] = useState(new Set());

  // 필터 조건 저장 (데이터 리로드 시 복원용)
  const filterConditionsRef = useRef(null);

  // 접힌 품목 ID Set (localStorage에서 초기화)
  const [collapsedItems, setCollapsedItems] = useState(() => {
    try {
      const saved = localStorage.getItem(`operator_itemsheet_collapsed_items_${campaignId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // collapsedItems를 ref로도 유지 (렌더러에서 최신 상태 참조용)
  const collapsedItemsRef = useRef(collapsedItems);
  collapsedItemsRef.current = collapsedItems;

  // localStorage 저장 디바운스용 타이머 ref
  const saveCollapsedTimeoutRef = useRef(null);

  // 여분 행/열 개수 (기능 비활성화 - 나중에 복원 가능)
  // const SPARE_ROWS = 20;
  // const SPARE_COLS = 3;

  // 컬럼 크기 저장 키 (캠페인별로 구분)
  const COLUMN_WIDTHS_KEY = `operator_itemsheet_column_widths_${campaignId}`;

  // 접기 상태 저장 키 (캠페인별로 구분)
  const COLLAPSED_ITEMS_KEY = `operator_itemsheet_collapsed_items_${campaignId}`;

  // 컬럼 정렬 저장 키 (캠페인별로 구분)
  const COLUMN_ALIGNMENTS_KEY = `operator_itemsheet_column_alignments_${campaignId}`;

  // 컬럼별 정렬 상태 (left, center, right)
  const [columnAlignments, setColumnAlignments] = useState({});

  // localStorage에서 컬럼 크기 로드
  const getSavedColumnWidths = useCallback(() => {
    try {
      const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, [COLUMN_WIDTHS_KEY]);

  // localStorage에서 접기 상태 로드
  const getSavedCollapsedItems = useCallback(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_ITEMS_KEY);
      return saved ? new Set(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  }, [COLLAPSED_ITEMS_KEY]);

  // 접기 상태 저장
  const saveCollapsedItems = useCallback((items) => {
    try {
      const value = JSON.stringify([...items]);
      localStorage.setItem(COLLAPSED_ITEMS_KEY, value);
      console.log('[OperatorItemSheet] Saved collapsed items:', {
        key: COLLAPSED_ITEMS_KEY,
        count: items.size,
        ids: [...items]
      });
    } catch (e) {
      console.error('Failed to save collapsed items:', e);
    }
  }, [COLLAPSED_ITEMS_KEY]);

  // 컬럼 정렬 로드
  const getSavedColumnAlignments = useCallback(() => {
    try {
      const saved = localStorage.getItem(COLUMN_ALIGNMENTS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, [COLUMN_ALIGNMENTS_KEY]);

  // 컬럼 정렬 저장
  const saveColumnAlignments = useCallback((alignments) => {
    try {
      localStorage.setItem(COLUMN_ALIGNMENTS_KEY, JSON.stringify(alignments));
    } catch (e) {
      console.error('Failed to save column alignments:', e);
    }
  }, [COLUMN_ALIGNMENTS_KEY]);

  // 컬럼 정렬 변경 핸들러
  const handleAlignmentChange = useCallback((col, alignment) => {
    setColumnAlignments(prev => {
      const newAlignments = { ...prev, [col]: alignment };
      saveColumnAlignments(newAlignments);
      // Handsontable 리렌더
      const hot = hotRef.current?.hotInstance;
      if (hot) {
        hot.render();
      }
      return newAlignments;
    });
  }, [saveColumnAlignments]);

  // 컬럼 크기 변경 시 저장 (state 업데이트 없이 localStorage만 저장 - 스크롤 점프 방지)
  const handleColumnResize = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    // 현재 모든 컬럼 너비 가져오기
    const widths = [];
    for (let i = 0; i < hot.countCols(); i++) {
      widths.push(hot.getColWidth(i));
    }

    // localStorage에만 저장 (state 업데이트 시 리렌더링으로 스크롤 점프 발생)
    try {
      localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
    } catch (e) {
      console.error('Failed to save column widths:', e);
    }
  }, [COLUMN_WIDTHS_KEY]);

  // 캠페인별 배정된 슬롯 데이터 로드 (Operator 전용)
  // 성능 최적화: 의존성 배열을 비워서 함수 재생성 방지, campaignId는 파라미터로 전달
  const loadSlots = useCallback(async (targetCampaignId, targetViewAsUserId, forceRefresh = false) => {
    if (!targetCampaignId) return;

    // 캐시 키 생성
    const cacheKey = `operator_${targetCampaignId}_${targetViewAsUserId || ''}`;

    // 캐시 확인 (forceRefresh가 아닌 경우)
    if (!forceRefresh && slotsCache.has(cacheKey)) {
      const cached = slotsCache.get(cacheKey);
      setSlots(cached.slots);
      setChangedSlots({});

      // localStorage에서 접기 상태 복원
      const allKeys = new Set();
      cached.slots.forEach(s => {
        const key = `${s.item_id}_${s.day_group}`;
        allKeys.add(key);
      });

      const collapsedKey = `operator_itemsheet_collapsed_items_${targetCampaignId}`;
      try {
        const saved = localStorage.getItem(collapsedKey);
        if (saved) {
          const savedKeys = JSON.parse(saved);
          const validKeys = savedKeys.filter(key => allKeys.has(key));
          setCollapsedItems(new Set(validKeys));
        } else {
          setCollapsedItems(new Set());
        }
      } catch (e) {
        setCollapsedItems(new Set());
      }

      // localStorage에서 컬럼 너비 복원
      const widthKey = `operator_itemsheet_column_widths_${targetCampaignId}`;
      try {
        const savedWidths = localStorage.getItem(widthKey);
        if (savedWidths) {
          setColumnWidths(JSON.parse(savedWidths));
        } else {
          setColumnWidths(DEFAULT_COLUMN_WIDTHS);
        }
      } catch (e) {
        setColumnWidths(DEFAULT_COLUMN_WIDTHS);
      }

      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('[OperatorItemSheet] Loading slots for campaign:', targetCampaignId);
      const response = await itemSlotService.getSlotsByCampaignForOperator(targetCampaignId, targetViewAsUserId);
      console.log('[OperatorItemSheet] Slots API response:', {
        campaignId: targetCampaignId,
        success: response.success,
        dataCount: response.data?.length || 0,
        uniqueItemIds: response.data ? [...new Set(response.data.map(s => s.item_id))] : []
      });
      if (response.success) {
        const newSlots = response.data || [];
        setSlots(newSlots);
        setChangedSlots({});

        // 캐시에 저장
        slotsCache.set(cacheKey, { slots: newSlots, timestamp: Date.now() });

        // API 응답 직후 localStorage에서 접기 상태 복원 (item_id + day_group 키 형식)
        const allKeys = new Set();
        newSlots.forEach(s => {
          const key = `${s.item_id}_${s.day_group}`;
          allKeys.add(key);
        });

        const collapsedKey = `operator_itemsheet_collapsed_items_${targetCampaignId}`;
        try {
          const saved = localStorage.getItem(collapsedKey);
          if (saved) {
            const savedKeys = JSON.parse(saved);
            // 현재 슬롯에 존재하는 키만 필터링
            const validKeys = savedKeys.filter(key => allKeys.has(key));
            setCollapsedItems(new Set(validKeys));
          } else {
            // 초기값: 모두 펼침 (빈 Set)
            setCollapsedItems(new Set());
          }
        } catch (e) {
          setCollapsedItems(new Set());
        }

        // API 응답 직후 localStorage에서 컬럼 너비 복원
        const widthKey = `operator_itemsheet_column_widths_${targetCampaignId}`;
        try {
          const savedWidths = localStorage.getItem(widthKey);
          if (savedWidths) {
            setColumnWidths(JSON.parse(savedWidths));
          } else {
            setColumnWidths(DEFAULT_COLUMN_WIDTHS);
          }
        } catch (e) {
          setColumnWidths(DEFAULT_COLUMN_WIDTHS);
        }
      }
    } catch (error) {
      console.error('Failed to load slots:', error);
    } finally {
      setLoading(false);
    }
  }, []); // 의존성 배열 비움 - 함수 재생성 방지

  // 부모 컴포넌트에서 loadSlots 호출 가능하도록 노출
  useImperativeHandle(ref, () => ({
    loadSlots: () => loadSlots(campaignId, viewAsUserId)
  }), [loadSlots, campaignId, viewAsUserId]);

  // 메모 데이터 로드 - 기능 비활성화
  // const loadMemos = useCallback(async () => {
  //   if (!campaignId) return;
  //
  //   try {
  //     const response = await sheetMemoService.getSheetMemos(campaignId, 'operator', viewAsUserId);
  //     if (response.success && response.data) {
  //       const memoMap = {};
  //       response.data.forEach(memo => {
  //         const key = `${memo.row_index}_${memo.col_index}`;
  //         memoMap[key] = memo.value;
  //       });
  //       setMemos(memoMap);
  //       setChangedMemos({});
  //     }
  //   } catch (error) {
  //     console.error('Failed to load memos:', error);
  //   }
  // }, [campaignId, viewAsUserId]);

  useEffect(() => {
    if (campaignId) {
      // 캠페인 변경 시 이전 slots 데이터를 즉시 초기화하여 잘못된 데이터로 useEffect 실행 방지
      setSlots([]);
      loadSlots(campaignId, viewAsUserId);
      // loadMemos(); // 메모 기능 비활성화
    }
  }, [campaignId, viewAsUserId, loadSlots]);

  // 접기 상태 복원은 loadSlots 함수 내에서 API 응답 직후 처리됨

  // 컬럼 정렬 상태 초기화 (최초 1회만)
  useEffect(() => {
    const savedAlignments = getSavedColumnAlignments();
    if (savedAlignments && Object.keys(savedAlignments).length > 0) {
      setColumnAlignments(savedAlignments);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 최초 마운트 시에만 실행

  // Ctrl+S 키보드 단축키로 저장
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); // 브라우저 기본 저장 동작 방지
        if (Object.keys(changedSlots).length > 0 || Object.keys(changedItems).length > 0) {
          handleSaveChanges();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changedSlots, changedItems]);

  // Shift+휠 스크롤로 횡스크롤만 지원 - 전체 테이블 영역에서 작동
  useEffect(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const rootElement = hot.rootElement;
    if (!rootElement) return;

    // wtHolder 찾기 (스크롤 가능한 내부 컨테이너)
    const wtHolder = rootElement.querySelector('.wtHolder');

    const handleWheel = (e) => {
      // Shift 키가 눌려있을 때 횡스크롤만
      if (e.shiftKey && wtHolder) {
        e.preventDefault();
        e.stopPropagation();

        // deltaY 사용 (세로 스크롤을 가로로 변환), 횡스크롤만 적용
        const scrollAmount = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        wtHolder.scrollLeft += scrollAmount;
        // 세로 스크롤은 변경하지 않음 (scrollTop 건드리지 않음)
      }
    };

    // 테이블 전체 영역에 이벤트 리스너 추가 (capture phase에서 처리)
    rootElement.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => rootElement.removeEventListener('wheel', handleWheel, { capture: true });
  }, [slots]); // slots가 변경되면 다시 바인딩

  // 성능 최적화: 2단계로 분리하여 캠페인 변경 시 불필요한 재계산 방지
  // 1단계: 기본 데이터 구조 생성 (slots만 의존, collapsedItems 제외)
  const { baseTableData, baseSlotIndexMap, baseRowMetaMap } = useMemo(() => {
    const data = [];
    const indexMap = {}; // tableRow -> slotId
    const metaMap = new Map(); // rowIndex -> 행 메타 정보

    // 슬롯을 품목별로 그룹화
    const itemGroups = {};
    slots.forEach((slot) => {
      const itemId = slot.item_id;
      if (!itemGroups[itemId]) {
        itemGroups[itemId] = {
          item: slot.item,
          dayGroups: {}
        };
      }
      const dayGroup = slot.day_group || 1;
      if (!itemGroups[itemId].dayGroups[dayGroup]) {
        itemGroups[itemId].dayGroups[dayGroup] = {
          uploadToken: slot.upload_link_token || '',
          slots: []
        };
      }
      itemGroups[itemId].dayGroups[dayGroup].slots.push(slot);
    });

    let isFirstItem = true;

    // 품목별로 행 생성 (모든 구매자 포함 - 접기 상태 무시)
    Object.entries(itemGroups).forEach(([itemId, itemGroup]) => {
      const item = itemGroup.item || {};
      const mergedItem = { ...item };

      // 일차별로 제품 정보 + 구매자 정보 반복
      const dayGroupKeys = Object.keys(itemGroup.dayGroups).sort((a, b) => parseInt(a) - parseInt(b));

      dayGroupKeys.forEach((dayGroup, dayGroupIndex) => {
        const groupData = itemGroup.dayGroups[dayGroup];
        const uploadToken = groupData.uploadToken;

        // day_group별 완료 상태 계산 (해당 day_group의 슬롯만)
        const totalSlots = groupData.slots.length;
        const completedSlots = groupData.slots.filter(
          slot => slot.buyer?.images?.length > 0
        ).length;
        const isAllCompleted = totalSlots > 0 && totalSlots === completedSlots;

        // day_group별 독립 제품 정보: 슬롯 값 > Item 값 (우선순위)
        const firstSlot = groupData.slots[0] || {};
        const dayGroupProductInfo = {
          date: firstSlot.date || '',
          product_name: firstSlot.product_name || mergedItem.product_name || '',
          platform: firstSlot.platform || mergedItem.platform || '-',
          shipping_type: firstSlot.shipping_type || mergedItem.shipping_type || '',
          keyword: firstSlot.keyword || mergedItem.keyword || '',
          product_price: firstSlot.product_price || mergedItem.product_price || '',
          total_purchase_count: firstSlot.total_purchase_count || mergedItem.total_purchase_count || '',
          daily_purchase_count: firstSlot.daily_purchase_count || mergedItem.daily_purchase_count || '',
          purchase_option: firstSlot.purchase_option || mergedItem.purchase_option || '',
          courier_service_yn: firstSlot.courier_service_yn || mergedItem.courier_service_yn || '',
          product_url: firstSlot.product_url || mergedItem.product_url || '',
          notes: firstSlot.notes || mergedItem.notes || ''
        };

        // 첫 번째 품목의 첫 번째 일차가 아닌 경우 품목 구분선 추가
        if (!isFirstItem || dayGroupIndex > 0) {
          metaMap.set(data.length, { rowType: ROW_TYPES.ITEM_SEPARATOR });
          data.push({ _rowType: ROW_TYPES.ITEM_SEPARATOR, _itemId: parseInt(itemId), _dayGroup: parseInt(dayGroup) });
        }
        if (dayGroupIndex === 0) {
          isFirstItem = false;
        }

        // 제품 헤더 행 (19개 컬럼)
        metaMap.set(data.length, { rowType: ROW_TYPES.PRODUCT_HEADER, dayGroup: parseInt(dayGroup) });
        data.push({
          _rowType: ROW_TYPES.PRODUCT_HEADER,
          _itemId: parseInt(itemId),
          _dayGroup: parseInt(dayGroup),
          col0: '', col1: '날짜', col2: '플랫폼', col3: '제품명', col4: '옵션', col5: '출고', col6: '키워드',
          col7: '가격', col8: '총건수', col9: '일건수', col10: '택배대행', col11: 'URL', col12: '특이사항', col13: '상세',
          col14: '', col15: '', col16: '', col17: '', col18: ''
        });

        // 제품 데이터 행 (19개 컬럼)
        metaMap.set(data.length, { rowType: ROW_TYPES.PRODUCT_DATA, itemId: parseInt(itemId), dayGroup: parseInt(dayGroup) });
        data.push({
          _rowType: ROW_TYPES.PRODUCT_DATA,
          _itemId: parseInt(itemId),
          _dayGroup: parseInt(dayGroup),
          _completionStatus: { total: totalSlots, completed: completedSlots, isAllCompleted },
          col0: '',
          col1: dayGroupProductInfo.date,
          col2: dayGroupProductInfo.platform,
          col3: dayGroupProductInfo.product_name,
          col4: dayGroupProductInfo.purchase_option,
          col5: dayGroupProductInfo.shipping_type,
          col6: dayGroupProductInfo.keyword,
          col7: dayGroupProductInfo.product_price,
          col8: dayGroupProductInfo.total_purchase_count,
          col9: dayGroupProductInfo.daily_purchase_count,
          col10: dayGroupProductInfo.courier_service_yn,
          col11: dayGroupProductInfo.product_url,
          col12: dayGroupProductInfo.notes,
          col13: '📋',
          col14: '', col15: '', col16: '', col17: '', col18: ''
        });

        // 업로드 링크 바 (항상 포함)
        metaMap.set(data.length, {
          rowType: ROW_TYPES.UPLOAD_LINK_BAR,
          uploadToken,
          dayGroup: parseInt(dayGroup)
        });
        data.push({
          _rowType: ROW_TYPES.UPLOAD_LINK_BAR,
          _itemId: parseInt(itemId),
          _uploadToken: uploadToken,
          _dayGroup: parseInt(dayGroup),
          col0: '',
          col1: `📷 업로드 링크 복사`,
          col2: '', col3: '', col4: '', col5: '', col6: '', col7: '', col8: '', col9: '',
          col10: '', col11: '', col12: '', col13: '', col14: '', col15: '', col16: '', col17: '', col18: ''
        });

        // 구매자 헤더 행 (항상 포함)
        metaMap.set(data.length, { rowType: ROW_TYPES.BUYER_HEADER, dayGroup: parseInt(dayGroup) });
        data.push({
          _rowType: ROW_TYPES.BUYER_HEADER,
          _itemId: parseInt(itemId),
          _dayGroup: parseInt(dayGroup),
          col0: '', col1: '날짜', col2: '순번', col3: '제품명', col4: '옵션', col5: '예상구매자',
          col6: '주문번호', col7: '구매자', col8: '수취인', col9: '아이디', col10: '연락처', col11: '주소', col12: '계좌', col13: '금액',
          col14: '송장번호', col15: '리뷰샷', col16: '상태', col17: '리뷰비', col18: '입금명', col19: '입금여부'
        });

        // 구매자 데이터 행 (항상 포함)
        groupData.slots.forEach((slot, slotIndex) => {
          const buyer = slot.buyer || {};
          const reviewImage = buyer.images && buyer.images.length > 0 ? buyer.images[0] : null;

          const hasBuyerData = buyer.order_number || buyer.buyer_name || buyer.recipient_name ||
                               buyer.user_id || buyer.contact || buyer.address ||
                               buyer.account_info || buyer.amount;
          const hasReviewImage = reviewImage?.s3_url;
          // slot.status가 'resubmitted'이면 우선 사용, 아니면 자동 계산
          const calculatedStatus = slot.status === 'resubmitted'
            ? 'resubmitted'
            : (hasReviewImage ? 'completed' : (hasBuyerData ? 'active' : '-'));

          metaMap.set(data.length, {
            rowType: ROW_TYPES.BUYER_DATA,
            slotId: slot.id,
            buyerId: buyer.id || null,
            itemId: parseInt(itemId),
            dayGroup: parseInt(dayGroup)
          });
          indexMap[data.length] = slot.id;

          data.push({
            _rowType: ROW_TYPES.BUYER_DATA,
            _slotId: slot.id,
            _itemId: parseInt(itemId),
            _buyerId: buyer.id || null,
            _dayGroup: parseInt(dayGroup),
            _uploadToken: uploadToken,
            _reviewImages: buyer.images || [],
            _reviewImageUrl: reviewImage?.s3_url || '',
            _reviewImageName: reviewImage?.file_name || '',
            _buyer: buyer,
            _hasBuyerData: !!hasBuyerData,
            col0: '',
            col1: slot.date || '',
            col2: slotIndex + 1,
            col3: slot.product_name || '',
            col4: slot.purchase_option || '',
            col5: slot.expected_buyer || '',
            col6: buyer.order_number || '',
            col7: buyer.buyer_name || '',
            col8: buyer.recipient_name || '',
            col9: buyer.user_id || '',
            col10: buyer.contact || '',
            col11: buyer.address || '',
            col12: buyer.account_info || '',
            col13: buyer.amount || '',
            col14: buyer.tracking_number || '',
            col15: reviewImage?.s3_url || '',
            col16: calculatedStatus,
            col17: slot.review_cost || '',
            col18: buyer.deposit_name || '',
            col19: buyer.payment_confirmed_at || '',
            shipping_delayed: buyer.shipping_delayed || false
          });
        });
      });
    });

    return { baseTableData: data, baseSlotIndexMap: indexMap, baseRowMetaMap: metaMap };
  }, [slots]); // collapsedItems 제거 - 캠페인 변경 시 재계산 방지

  // 성능 최적화: 배열 필터링 대신 hiddenRows 플러그인 사용
  // baseTableData를 그대로 사용하고, 접기 상태에 따라 숨길 행만 계산
  const tableData = baseTableData;
  const slotIndexMap = baseSlotIndexMap;
  const rowMetaMap = baseRowMetaMap;

  // hiddenRows 플러그인용 숨길 행 인덱스 계산
  const hiddenRowIndices = useMemo(() => {
    if (collapsedItems.size === 0) return [];

    const hidden = [];
    let currentCollapsedKey = null;

    baseTableData.forEach((row, index) => {
      const collapseKey = `${row._itemId}_${row._dayGroup}`;

      // 제품 데이터 행에서 접힘 상태 확인
      if (row._rowType === ROW_TYPES.PRODUCT_DATA) {
        currentCollapsedKey = collapsedItems.has(collapseKey) ? collapseKey : null;
      }

      // 접힌 품목의 업로드 링크, 구매자 헤더, 구매자 데이터 행은 숨김
      if (currentCollapsedKey !== null &&
          collapseKey === currentCollapsedKey &&
          (row._rowType === ROW_TYPES.UPLOAD_LINK_BAR ||
           row._rowType === ROW_TYPES.BUYER_HEADER ||
           row._rowType === ROW_TYPES.BUYER_DATA)) {
        hidden.push(index);
      }
    });

    return hidden;
  }, [baseTableData, collapsedItems]);

  // hiddenRowIndices를 ref로 저장하여 useEffect에서 최신 값 참조
  const hiddenRowIndicesRef = useRef(hiddenRowIndices);
  hiddenRowIndicesRef.current = hiddenRowIndices;

  // hiddenRows 플러그인 직접 업데이트 (collapsedItems 변경 시에만)
  useEffect(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const hiddenRowsPlugin = hot.getPlugin('hiddenRows');
    if (!hiddenRowsPlugin) return;

    // 먼저 모든 행 표시
    hiddenRowsPlugin.showRows(hiddenRowsPlugin.getHiddenRows());
    // 그 다음 숨길 행만 숨기기
    const indices = hiddenRowIndicesRef.current;
    if (indices.length > 0) {
      hiddenRowsPlugin.hideRows(indices);
    }
    hot.render();
  }, [collapsedItems]); // hiddenRowIndices 대신 collapsedItems만 의존

  // 성능 최적화: tableData를 ref로 참조하여 handleAfterChange 재생성 방지
  const tableDataRef = useRef(tableData);
  tableDataRef.current = tableData;

  // 상태 옵션
  const statusOptions = ['active', 'completed', 'resubmitted', 'cancelled'];
  const statusLabels = {
    active: '진행',
    completed: '완료',
    resubmitted: '재제출완료',
    cancelled: '취소'
  };

  // 중복 주문번호 감지 (빈 문자열 제외)
  const duplicateOrderNumbers = useMemo(() => {
    const orderNumbers = tableData
      .filter(row => row._rowType === ROW_TYPES.BUYER_DATA && row.col6)
      .map(row => row.col6);

    const counts = {};
    orderNumbers.forEach(num => {
      counts[num] = (counts[num] || 0) + 1;
    });

    // 2개 이상인 주문번호만 반환
    return new Set(Object.keys(counts).filter(num => counts[num] >= 2));
  }, [tableData]);

  // 업로드 링크 복사 핸들러
  const handleCopyUploadLink = useCallback((token) => {
    if (!token) return;
    const uploadUrl = `${window.location.origin}/upload-slot/${token}`;
    navigator.clipboard.writeText(uploadUrl).then(() => {
      setSnackbar({ open: true, message: '업로드 링크가 복사되었습니다' });
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }, []);

  // 엑셀 다운로드 핸들러
  const handleDownloadExcel = useCallback(() => {
    // items 객체 생성 (item_id → item 매핑)
    const itemsMap = {};
    slots.forEach(slot => {
      if (!itemsMap[slot.item_id] && slot.item) {
        itemsMap[slot.item_id] = slot.item;
      }
    });

    const excelData = convertSlotsToExcelData(slots, itemsMap, 'operator');
    const fileName = campaignName || 'campaign';
    downloadExcel(excelData, `${fileName}_operator`, '진행자시트');
    setSnackbar({ open: true, message: '엑셀 파일이 다운로드되었습니다' });
  }, [slots, campaignName]);

  // 변경사항 저장 및 새로고침 헬퍼 함수
  const saveAndRefresh = useCallback(async () => {
    const hasSlotChanges = Object.keys(changedSlots).length > 0;
    const hasItemChanges = Object.keys(changedItems).length > 0;

    try {
      // 슬롯 데이터 저장
      if (hasSlotChanges) {
        const slotsToUpdate = Object.values(changedSlots);
        await itemSlotService.updateSlotsBulk(slotsToUpdate);
      }
      // 제품 정보 저장 (day_group별 슬롯 업데이트)
      if (hasItemChanges) {
        const dayGroupUpdates = Object.values(changedItems);
        for (const update of dayGroupUpdates) {
          const { itemId, dayGroup, ...productData } = update;
          // 해당 day_group의 모든 슬롯 ID 수집
          const dayGroupSlotIds = slots
            .filter(s => s.item_id === itemId && s.day_group === dayGroup)
            .map(s => s.id);

          // 해당 슬롯들에 제품 정보 업데이트
          if (dayGroupSlotIds.length > 0) {
            const slotsToUpdateProduct = dayGroupSlotIds.map(id => ({
              id,
              ...productData
            }));
            await itemSlotService.updateSlotsBulk(slotsToUpdateProduct);
          }
        }
      }
      // 상태 초기화
      setChangedSlots({});
      setChangedItems({});
      // 데이터 새로고침 (변경사항 유무와 관계없이 항상 최신 데이터 로드)
      await loadSlots(campaignId, viewAsUserId);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [changedSlots, changedItems, slots, loadSlots]);

  // 개별 품목 접기/펼치기 토글 (item_id + day_group 조합으로 독립적 관리)
  // 성능 최적화: localStorage 저장을 디바운스하여 I/O 지연
  const toggleItemCollapse = useCallback((itemId, dayGroup) => {
    const key = `${itemId}_${dayGroup}`;
    setCollapsedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      // localStorage 저장 디바운스 (300ms)
      if (saveCollapsedTimeoutRef.current) {
        clearTimeout(saveCollapsedTimeoutRef.current);
      }
      saveCollapsedTimeoutRef.current = setTimeout(() => {
        saveCollapsedItems(next);
      }, 300);

      return next;
    });
  }, [saveCollapsedItems]);

  // 모두 펼치기
  const expandAll = useCallback(() => {
    const emptySet = new Set();
    setCollapsedItems(emptySet);
    // 즉시 저장 (사용자 명시적 액션)
    if (saveCollapsedTimeoutRef.current) clearTimeout(saveCollapsedTimeoutRef.current);
    saveCollapsedItems(emptySet);
  }, [saveCollapsedItems]);

  // 모두 접기 (item_id + day_group 조합)
  const collapseAll = useCallback(() => {
    const allKeys = new Set();
    slots.forEach(s => {
      const key = `${s.item_id}_${s.day_group}`;
      allKeys.add(key);
    });
    setCollapsedItems(allKeys);
    // 즉시 저장 (사용자 명시적 액션)
    if (saveCollapsedTimeoutRef.current) clearTimeout(saveCollapsedTimeoutRef.current);
    saveCollapsedItems(allKeys);
  }, [slots, saveCollapsedItems]);

  // 기본 컬럼 너비 - 20개 컬럼
  // col0: 접기(20), col1: 날짜(60), col2: 플랫폼/순번(70), col3: 제품명(120), col4: 옵션(80), col5: 예상구매자(80),
  // 컬럼 정의: 통합 컬럼 (행 타입에 따라 다른 데이터 표시) - 20개
  const columns = useMemo(() => {
    const baseColumns = [];

    for (let i = 0; i < 20; i++) {
      baseColumns.push({
        data: `col${i}`,
        type: 'text',
        width: columnWidths[i] || DEFAULT_COLUMN_WIDTHS[i],
        className: 'htCenter htMiddle'
      });
    }

    // 맨 오른쪽에 여백 컬럼 추가 (컬럼 너비 조절 용이하게)
    baseColumns.push({
      data: 'col20',
      type: 'text',
      width: 50,
      readOnly: true,
      className: 'htCenter htMiddle'
    });

    return baseColumns;
  }, [columnWidths]); // columnWidths 변경 시 컬럼 재생성

  // 컬럼 헤더는 빈 배열 (manualColumnResize를 위해 헤더 행 필요)
  // 빈 문자열 배열이면 헤더는 비어있지만 리사이즈 핸들 동작
  const colHeaders = Array(21).fill('');

  // 구매자 컬럼 필드 매핑 (20개 컬럼 → API 필드명)
  // col0: 접기(readOnly), col1: 날짜(slot.date), col2: 순번(readOnly), col3: 제품명(readOnly), col4: 옵션(readOnly),
  // col5: 예상구매자(편집가능-slot), col6: 주문번호, col7: 구매자, col8: 수취인, col9: 아이디, col10: 연락처, col11: 주소, col12: 계좌, col13: 금액,
  // col14: 송장번호, col15: 리뷰샷(readOnly), col16: 상태, col17: 리뷰비(slot), col18: 입금명, col19: 입금여부
  const buyerFieldMap = {
    col1: 'date',  // 날짜 (slot 필드)
    col5: 'expected_buyer',  // 예상 구매자 (slot 필드)
    col6: 'order_number',
    col7: 'buyer_name',
    col8: 'recipient_name',
    col9: 'user_id',
    col10: 'contact',
    col11: 'address',
    col12: 'account_info',
    col13: 'amount',
    col14: 'tracking_number',  // 송장번호
    col16: 'status',
    col17: 'review_cost',  // 리뷰비 (slot 필드)
    col18: 'deposit_name',
    col19: 'payment_confirmed'
    // col0: 접기 (readOnly)
    // col2: 순번 (readOnly)
    // col3: 제품명 (readOnly)
    // col4: 옵션 (readOnly)
    // col15: 리뷰샷 (readOnly)
  };

  // 제품 정보 컬럼 필드 매핑 (col1~col13 → API 필드명) - col0은 토글
  // 순서: 접기, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배대행, URL, 특이사항, 상세
  const itemFieldMap = {
    // col0: 토글 (readOnly)
    col1: 'date',  // 제품 날짜 (Item 테이블)
    col2: 'platform',  // 플랫폼 (순번 대신)
    col3: 'product_name',
    col4: 'purchase_option',
    col5: 'shipping_type',
    col6: 'keyword',
    col7: 'product_price',
    col8: 'total_purchase_count',
    col9: 'daily_purchase_count',
    col10: 'courier_service_yn',
    col11: 'product_url',
    col12: 'notes'
    // col13: 상세보기 버튼 (readOnly)
  };

  // buyer 필드 목록 (slot이 아닌 buyer 객체에 속하는 필드들)
  const buyerFieldsList = ['order_number', 'buyer_name', 'recipient_name', 'user_id', 'contact', 'address', 'account_info', 'amount', 'tracking_number', 'deposit_name', 'payment_confirmed'];

  // 데이터 변경 핸들러 (구매자 데이터 + 제품 정보 수정 가능)
  // 성능 최적화: changedSlots, changedItems, tableData를 ref로 접근하여 useCallback 재생성 방지
  const handleAfterChange = useCallback((changes, source) => {
    if (!changes || source === 'loadData' || source === 'loadMemo') return;

    // 변경사항이 없으면 조기 반환
    const hasActualChanges = changes.some(([, , oldValue, newValue]) => oldValue !== newValue);
    if (!hasActualChanges) return;

    // ref로 최신 상태 접근 (의존성 배열에서 제거하여 함수 재생성 방지)
    const slotUpdates = { ...changedSlotsRef.current };
    const itemUpdates = { ...changedItemsRef.current };
    const currentTableData = tableDataRef.current;
    const slotImmediateUpdates = {}; // 즉시 slots 상태에 반영할 변경사항

    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue === newValue) return;

      // 행 데이터 확인 (ref 사용)
      const rowData = currentTableData[row];
      if (!rowData) return;

      // 제품 정보 행 처리 (day_group별 독립적인 제품 정보)
      if (rowData._rowType === ROW_TYPES.PRODUCT_DATA) {
        const itemId = rowData._itemId;
        const dayGroup = rowData._dayGroup;
        if (!itemId || !dayGroup) return;

        const apiField = itemFieldMap[prop];
        if (!apiField) return;

        // day_group별 독립 키 사용 (itemId_dayGroup 형식)
        const dayGroupKey = `${itemId}_${dayGroup}`;
        if (!itemUpdates[dayGroupKey]) {
          itemUpdates[dayGroupKey] = { itemId, dayGroup };
        }

        // 사용자 입력값을 그대로 저장 (계산 시에만 숫자 추출)
        itemUpdates[dayGroupKey][apiField] = newValue ?? '';
        return;
      }

      // 구매자 데이터 행 처리
      if (rowData._rowType === ROW_TYPES.BUYER_DATA) {
        const slotId = slotIndexMap[row];
        if (!slotId) return;

        const apiField = buyerFieldMap[prop];
        if (!apiField) return;

        if (!slotUpdates[slotId]) {
          slotUpdates[slotId] = { id: slotId };
        }

        // 사용자 입력값을 그대로 저장 (계산 시에만 숫자 추출)
        slotUpdates[slotId][apiField] = newValue ?? '';

        // 즉시 반영할 변경사항 저장
        if (!slotImmediateUpdates[slotId]) {
          slotImmediateUpdates[slotId] = {};
        }
        slotImmediateUpdates[slotId][apiField] = newValue ?? '';
      }
    });

    // ref에 저장 (저장 시 사용)
    changedSlotsRef.current = slotUpdates;
    changedItemsRef.current = itemUpdates;

    // state도 업데이트 (저장 버튼 표시용)
    setChangedSlots(slotUpdates);
    setChangedItems(itemUpdates);
  }, [slotIndexMap, itemFieldMap, buyerFieldMap, buyerFieldsList]);

  // 변경사항 저장 (슬롯 데이터 + 제품 정보) - DB 저장 + 스크롤 위치 유지
  const handleSaveChanges = async () => {
    // ref에서 변경사항 읽기 (성능 최적화로 state 대신 ref 사용)
    const currentChangedSlots = changedSlotsRef.current;
    const currentChangedItems = changedItemsRef.current;
    const hasSlotChanges = Object.keys(currentChangedSlots).length > 0;
    const hasItemChanges = Object.keys(currentChangedItems).length > 0;

    if (!hasSlotChanges && !hasItemChanges) {
      setSnackbar({ open: true, message: '변경된 내용이 없습니다' });
      return;
    }

    // 스크롤 위치 저장
    const hot = hotRef.current?.hotInstance;
    const scrollPosition = hot?.rootElement?.querySelector('.wtHolder')?.scrollTop || 0;
    const scrollLeft = hot?.rootElement?.querySelector('.wtHolder')?.scrollLeft || 0;

    setSaving(true);

    try {
      // 슬롯 데이터 저장 (DB 업데이트)
      if (hasSlotChanges) {
        const slotsToUpdate = Object.values(currentChangedSlots);
        await itemSlotService.updateSlotsBulk(slotsToUpdate);
      }

      // 제품 정보 저장 (day_group별 슬롯 업데이트)
      if (hasItemChanges) {
        const dayGroupUpdates = Object.values(currentChangedItems);
        for (const update of dayGroupUpdates) {
          const { itemId, dayGroup, ...productData } = update;
          // 해당 day_group의 모든 슬롯 ID 수집
          const dayGroupSlotIds = slots
            .filter(s => s.item_id === itemId && s.day_group === dayGroup)
            .map(s => s.id);

          // 해당 슬롯들에 제품 정보 업데이트
          if (dayGroupSlotIds.length > 0) {
            const slotsToUpdateProduct = dayGroupSlotIds.map(id => ({
              id,
              ...productData
            }));
            await itemSlotService.updateSlotsBulk(slotsToUpdateProduct);
          }
        }
      }

      // 로컬 slots 상태 업데이트 (DB 재조회 대신 직접 업데이트)
      // buyer 필드 목록 (slot이 아닌 buyer 객체에 속하는 필드들)
      const buyerFields = ['order_number', 'buyer_name', 'recipient_name', 'user_id', 'contact', 'address', 'account_info', 'amount', 'tracking_number', 'deposit_name', 'payment_confirmed'];

      setSlots(prevSlots => {
        return prevSlots.map(slot => {
          let updatedSlot = slot;

          // 슬롯(구매자) 변경사항 적용
          const slotChangesData = currentChangedSlots[slot.id];
          if (slotChangesData) {
            // slot 필드와 buyer 필드 분리
            const slotFieldChanges = {};
            const buyerChanges = {};

            Object.entries(slotChangesData).forEach(([key, value]) => {
              if (key === 'id') return; // id는 제외
              if (buyerFields.includes(key)) {
                buyerChanges[key] = value;
              } else {
                slotFieldChanges[key] = value;
              }
            });

            // buyer 객체 업데이트
            const updatedBuyer = slot.buyer
              ? { ...slot.buyer, ...buyerChanges }
              : Object.keys(buyerChanges).length > 0 ? buyerChanges : null;

            updatedSlot = { ...updatedSlot, ...slotFieldChanges, buyer: updatedBuyer };
          }

          // day_group별 제품 정보 변경사항 적용 (슬롯에 직접 저장)
          const dayGroupKey = `${slot.item_id}_${slot.day_group}`;
          const productChangesData = currentChangedItems[dayGroupKey];
          if (productChangesData) {
            const { itemId, dayGroup, ...productFieldChanges } = productChangesData;
            updatedSlot = {
              ...updatedSlot,
              ...productFieldChanges
            };
          }

          return updatedSlot;
        });
      });

      // ref 및 state 초기화
      changedSlotsRef.current = {};
      changedItemsRef.current = {};
      setChangedSlots({});
      setChangedItems({});

      // 캐시 무효화 (다음 로드 시 최신 데이터 가져오도록)
      const cacheKey = `operator_${campaignId}_${viewAsUserId || ''}`;
      slotsCache.delete(cacheKey);

      setSnackbar({ open: true, message: '저장되었습니다' });

      // 스크롤 위치 복원 (다음 렌더링 후)
      setTimeout(() => {
        const wtHolder = hot?.rootElement?.querySelector('.wtHolder');
        if (wtHolder) {
          wtHolder.scrollTop = scrollPosition;
          wtHolder.scrollLeft = scrollLeft;
        }
      }, 0);

    } catch (error) {
      console.error('Failed to save changes:', error);
      // 서버 에러 메시지 추출
      const serverMessage = error.response?.data?.message || error.response?.data?.error || error.message;

      // 저장 실패 시 변경사항 ref 초기화 (다음 저장에 영향 주지 않도록)
      changedSlotsRef.current = {};
      changedItemsRef.current = {};

      // 에러 메시지 표시
      setSnackbar({ open: true, message: `저장 실패: ${serverMessage}` });
    } finally {
      setSaving(false);
    }
  };

  // 삭제 확인 다이얼로그 열기
  const openDeleteDialog = (type, data, message) => {
    setDeleteDialog({ open: true, type, data, message });
  };

  // 삭제 다이얼로그 닫기
  const closeDeleteDialog = () => {
    setDeleteDialog({ open: false, type: '', data: null, message: '' });
  };

  // 삭제 실행
  const handleDeleteConfirm = async () => {
    const { type, data } = deleteDialog;

    try {
      if (type === 'rows') {
        // 선택한 행(슬롯) 삭제
        await itemSlotService.deleteSlotsBulk(data.slotIds);
        // 로컬 상태 즉시 업데이트 - 삭제된 슬롯 ID에 해당하는 행 제거
        setSlots(prev => prev.filter(slot => !data.slotIds.includes(slot.id)));
      } else if (type === 'group') {
        // 그룹(일차)별 삭제
        await itemSlotService.deleteSlotsByGroup(data.itemId, data.dayGroup);
        // 로컬 상태 즉시 업데이트 - 해당 품목/일차의 모든 슬롯 제거
        setSlots(prev => prev.filter(slot =>
          !(slot.item_id === data.itemId && slot.day_group === data.dayGroup)
        ));
      } else if (type === 'item') {
        // 품목 삭제
        await itemService.deleteItem(data.itemId);
        // 로컬 상태 즉시 업데이트 - 해당 품목의 모든 슬롯 제거
        setSlots(prev => prev.filter(slot => slot.item_id !== data.itemId));
      }

      closeDeleteDialog();
      setSnackbar({ open: true, message: '삭제되었습니다' });

      // 필터 상태 초기화 (삭제 후 필터가 유효하지 않을 수 있음)
      setFilteredRows(null);
      setFilteredColumns(new Set());
      filterConditionsRef.current = null;

      // hiddenRows 플러그인 초기화
      const hot = hotRef.current?.hotInstance;
      if (hot) {
        const hiddenRowsPlugin = hot.getPlugin('hiddenRows');
        if (hiddenRowsPlugin) {
          const currentHidden = hiddenRowsPlugin.getHiddenRows();
          if (currentHidden.length > 0) {
            hiddenRowsPlugin.showRows(currentHidden);
          }
        }
      }

      // 부모 컴포넌트에 알림 (캠페인 목록 새로고침)
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Delete failed:', error);

      // 404 에러 (이미 삭제된 품목): UI만 새로고침
      if (error.response?.status === 404) {
        closeDeleteDialog();
        setSnackbar({ open: true, message: '이미 삭제된 항목입니다. 목록을 새로고침합니다.' });
        await loadSlots(campaignId, viewAsUserId, true); // forceRefresh
        if (onRefresh) onRefresh();
        return;
      }

      const errorMessage = error.response?.data?.message || error.message || '알 수 없는 오류';
      alert('삭제 실패: ' + errorMessage);
    }
  };

  // 배송지연 토글 핸들러 - 현재 비활성화됨
  // const handleToggleShippingDelayed = useCallback(async (buyerId, currentValue, rowIndex) => {
  //   if (!buyerId) {
  //     setSnackbar({ open: true, message: '구매자 정보가 없습니다' });
  //     return;
  //   }
  //
  //   try {
  //     const newValue = !currentValue;
  //     await buyerService.toggleShippingDelayed(buyerId, newValue);
  //
  //     // 로컬 상태 업데이트
  //     setSlots(prevSlots => {
  //       return prevSlots.map(slot => {
  //         if (slot.buyer && slot.buyer.id === buyerId) {
  //           return {
  //             ...slot,
  //             buyer: {
  //               ...slot.buyer,
  //               shipping_delayed: newValue
  //             }
  //           };
  //         }
  //         return slot;
  //       });
  //     });
  //
  //     setSnackbar({
  //       open: true,
  //       message: newValue ? '배송지연으로 표시되었습니다' : '배송지연이 해제되었습니다'
  //     });
  //   } catch (error) {
  //     console.error('Failed to toggle shipping delayed:', error);
  //     setSnackbar({ open: true, message: '배송지연 상태 변경에 실패했습니다' });
  //   }
  // }, []);

  // 성능 최적화: 동적 렌더러 함수들을 useMemo로 캐싱
  // collapsedItemsRef를 사용하여 접기 상태 변경 시 렌더러 재생성 방지
  const productDataRenderer = useMemo(() =>
    createProductDataRenderer(tableData, collapsedItemsRef, toggleItemCollapse, columnAlignments),
    [tableData, toggleItemCollapse, columnAlignments]
  );

  const uploadLinkBarRenderer = useMemo(() =>
    createUploadLinkBarRenderer(tableData),
    [tableData]
  );

  const buyerDataRenderer = useMemo(() =>
    createBuyerDataRenderer(tableData, statusLabels, duplicateOrderNumbers, columnAlignments),
    [tableData, statusLabels, duplicateOrderNumbers, columnAlignments]
  );

  // 셀 렌더러 - 행 타입별 분기 (최적화: 외부 정의 렌더러 사용)
  const cellsRenderer = useCallback((row, col, prop) => {
    const cellProperties = {};

    // spare rows (실제 데이터 범위 밖)
    if (row >= tableData.length) {
      cellProperties.className = 'spare-row-cell';
      return cellProperties;
    }

    const rowData = tableData[row];
    const rowType = rowData?._rowType;

    // 행 타입별 처리
    switch (rowType) {
      case ROW_TYPES.ITEM_SEPARATOR:
        cellProperties.readOnly = true;
        cellProperties.renderer = itemSeparatorRenderer;
        break;

      case ROW_TYPES.PRODUCT_HEADER:
        cellProperties.readOnly = true;
        cellProperties.renderer = productHeaderRenderer;
        break;

      case ROW_TYPES.PRODUCT_DATA:
        cellProperties.readOnly = (col === 0);
        cellProperties.renderer = productDataRenderer;
        break;

      case ROW_TYPES.UPLOAD_LINK_BAR:
        cellProperties.readOnly = true;
        cellProperties.renderer = uploadLinkBarRenderer;
        break;

      case ROW_TYPES.BUYER_HEADER:
        cellProperties.readOnly = true;
        cellProperties.renderer = buyerHeaderRenderer;
        break;

      case ROW_TYPES.BUYER_DATA:
        // 구매자 데이터 행
        const dayGroup = rowData._dayGroup || 1;
        const dayClass = dayGroup % 2 === 0 ? 'day-even' : 'day-odd';
        cellProperties.className = dayClass;

        if (col === 15) {
          cellProperties.readOnly = true;
        } else {
          cellProperties.readOnly = false;
        }

        if (col === 16) {
          cellProperties.type = 'dropdown';
          cellProperties.source = statusOptions;
        }

        cellProperties.renderer = buyerDataRenderer;
        break;

      default:
        break;
    }

    return cellProperties;
  }, [tableData, statusOptions, productDataRenderer, uploadLinkBarRenderer, buyerDataRenderer]);

  const hasChanges = Object.keys(changedSlots).length > 0 || Object.keys(changedItems).length > 0;
  const totalChanges = Object.keys(changedSlots).length + Object.keys(changedItems).length;

  // 전체 데이터 건수 (원본 slots 데이터 기준 - 접기/펼치기와 무관)
  const totalDataCount = useMemo(() => {
    return slots.length;
  }, [slots]);

  // 금액 파싱 헬퍼 함수 (숫자 또는 문자열 -> 정수)
  const parseAmount = useCallback((value) => {
    if (value === null || value === undefined || value === '') return 0;
    // 숫자 타입이면 그대로 반환
    if (typeof value === 'number') return Math.round(value);
    // 문자열에서 숫자만 추출 (쉼표, 공백 등 제거)
    const numStr = String(value).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(numStr);
    return isNaN(parsed) ? 0 : Math.round(parsed);
  }, []);

  // 금액 합산 계산 (원본 slots 데이터 기준 - 접기/펼치기와 무관)
  const totalAmount = useMemo(() => {
    return slots.reduce((sum, slot) => {
      const buyer = slot.buyer || {};
      return sum + parseAmount(buyer.amount);
    }, 0);
  }, [slots, parseAmount]);

  // 필터링된 건수 계산 (구매자 데이터 행만) - 필터 기능용
  const filteredCount = useMemo(() => {
    if (filteredRows === null) return totalDataCount;
    return filteredRows.filter(rowIndex => {
      const row = tableData[rowIndex];
      return row && row._rowType === ROW_TYPES.BUYER_DATA;
    }).length;
  }, [filteredRows, totalDataCount, tableData]);

  // 필터링된 금액 합계 계산 - 필터 기능용
  const filteredAmount = useMemo(() => {
    if (filteredRows === null) return totalAmount;
    return filteredRows.reduce((sum, rowIndex) => {
      const row = tableData[rowIndex];
      if (!row || row._rowType !== ROW_TYPES.BUYER_DATA) return sum;
      return sum + parseAmount(row.col13);
    }, 0);
  }, [filteredRows, tableData, totalAmount, parseAmount]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 헤더: 전체 건수 + 저장 버튼 */}
      <Box sx={{
        mb: 0.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: '#2c387e',
        color: 'white',
        px: 2,
        py: 1,
        borderRadius: '4px 4px 0 0'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
            {filteredRows !== null ? `${filteredCount}건 / 전체 ${totalDataCount}건` : `전체 ${totalDataCount}건`}
          </Box>
          <Box sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
            금액 합계: {filteredRows !== null ? `${filteredAmount.toLocaleString()}원 / ${totalAmount.toLocaleString()}원` : `${totalAmount.toLocaleString()}원`}
            {filteredRows !== null && <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: 4 }}>(필터적용)</span>}
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
          <Box sx={{ fontSize: '0.75rem', opacity: 0.8 }}>
            드래그 복사, Ctrl+C/V 지원
          </Box>
          <Button
            size="small"
            onClick={handleDownloadExcel}
            disabled={slots.length === 0}
            startIcon={<DownloadIcon />}
            sx={{
              color: 'white',
              bgcolor: 'rgba(255,255,255,0.15)',
              fontSize: '0.75rem',
              px: 1.5,
              py: 0.5,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
              '&:disabled': { color: 'rgba(255,255,255,0.5)' }
            }}
          >
            엑셀 다운로드
          </Button>
        </Box>
        {/* 중앙 저장 안내 */}
        <Box sx={{
          color: '#ff5252',
          fontWeight: 'bold',
          fontSize: '0.85rem',
          textAlign: 'center',
          flex: 1
        }}>
          작업 내용 손실을 막기위해 저장(Ctrl+S)을 일상화 해주세요!
        </Box>
        {saving && (
          <Box sx={{ fontSize: '0.85rem', color: '#1976d2', fontWeight: 'bold' }}>
            저장 중...
          </Box>
        )}
        {hasChanges && !saving && (
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<SaveIcon />}
            onClick={handleSaveChanges}
            sx={{ bgcolor: '#4caf50' }}
          >
            저장 ({totalChanges})
          </Button>
        )}
      </Box>

      <Paper
        ref={containerRef}
        sx={{
        overflow: 'hidden',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        '& .handsontable': {
          fontSize: '12px'
        },
        // 헤더 스타일 - 필터 버튼 호버 시에만 표시 (엑셀처럼)
        '& .handsontable thead th': {
          whiteSpace: 'nowrap',
          overflow: 'visible',
          position: 'relative',
          textAlign: 'center !important'
        },
        '& .handsontable thead th .changeType': {
          position: 'absolute',
          right: '50%',
          transform: 'translateX(50%)',
          top: '50%',
          marginTop: '-7px',
          opacity: 0,
          transition: 'opacity 0.15s ease-in-out'
        },
        '& .handsontable thead th:hover .changeType': {
          opacity: 1
        },
        // 품목 구분선 행 스타일
        '& .item-separator-row': {
          backgroundColor: '#1565c0 !important',
          height: '8px !important',
          padding: '0 !important',
          border: 'none !important'
        },
        // 제품 헤더 행 스타일
        '& .product-header-row': {
          backgroundColor: '#e0e0e0 !important',
          fontWeight: 'bold !important',
          textAlign: 'center'
        },
        // 제품 데이터 행 스타일
        '& .product-data-row': {
          backgroundColor: '#fff8e1 !important'
        },
        // 업로드 링크 바 스타일
        '& .upload-link-bar': {
          backgroundColor: '#424242 !important',
          color: 'white !important',
          cursor: 'pointer'
        },
        // 구매자 헤더 행 스타일
        '& .buyer-header-row': {
          backgroundColor: '#f5f5f5 !important',
          fontWeight: 'bold !important',
          textAlign: 'center'
        },
        // 짝수 일차 배경
        '& .day-even': {
          backgroundColor: '#e0f2f1 !important'
        },
        // 홀수 일차 배경
        '& .day-odd': {
          backgroundColor: '#fff !important'
        },
        // 중복 주문번호 배경
        '& .duplicate-order': {
          backgroundColor: '#ffcdd2 !important'
        },
        // 상태 칩 스타일
        '& .status-chip': {
          padding: '2px 6px',
          borderRadius: '10px',
          fontSize: '10px'
        },
        '& .status-active': {
          backgroundColor: '#e3f2fd',
          color: '#1976d2'
        },
        '& .status-completed': {
          backgroundColor: '#e8f5e9',
          color: '#388e3c'
        },
        '& .status-cancelled': {
          backgroundColor: '#ffebee',
          color: '#d32f2f'
        },
        '& .status-resubmitted': {
          backgroundColor: '#fff4e5',
          color: '#ed6c02'
        },
        // spare-row-cell 클래스의 드롭다운 화살표 숨김
        '& .spare-row-cell .htAutocompleteArrow': {
          display: 'none !important'
        },
        // 모든 셀에 텍스트 오버플로우 처리 (... 표시)
        '& .handsontable td': {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '0'
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
            height="calc(100vh - 210px)"
            licenseKey="non-commercial-and-evaluation"
            stretchH="none"
            autoRowSize={false}
            autoColumnSize={false}
            viewportRowRenderingOffset={100}
            manualColumnResize={true}
            manualRowResize={false}
            disableVisualSelection={false}
            imeFastEdit={true}
            minSpareRows={0}
            hiddenRows={{
              rows: hiddenRowIndices,
              indicators: false
            }}
            contextMenu={{
              items: {
                copy: { name: '복사' },
                cut: { name: '잘라내기' },
                paste: { name: '붙여넣기' },
                sp1: { name: '---------' },
                add_row: {
                  name: '➕ 행 추가',
                  callback: async function(key, selection) {
                    const row = selection[0]?.start?.row;
                    if (row === undefined) return;

                    const rowData = tableData[row];
                    // 구매자 데이터 행이나 구매자 헤더 행이 아니면 무시
                    if (!rowData || (rowData._rowType !== ROW_TYPES.BUYER_DATA && rowData._rowType !== ROW_TYPES.BUYER_HEADER)) {
                      alert('구매자 행에서 우클릭하여 행을 추가해주세요.');
                      return;
                    }

                    const itemId = rowData._itemId;
                    const dayGroup = rowData._dayGroup;

                    try {
                      await itemSlotService.createSlot(itemId, dayGroup);
                      setSnackbar({ open: true, message: '행이 추가되었습니다' });
                      loadSlots(campaignId, viewAsUserId); // 데이터 새로고침
                    } catch (error) {
                      console.error('Failed to add row:', error);
                      alert('행 추가 실패: ' + (error.response?.data?.message || error.message));
                    }
                  }
                },
                delete_rows: {
                  name: '🗑️ 선택한 행 삭제',
                  callback: function(key, selection) {
                    const hot = hotRef.current?.hotInstance;
                    if (!hot) return;

                    const selectedRows = new Set();
                    selection.forEach(sel => {
                      for (let r = sel.start.row; r <= sel.end.row; r++) {
                        selectedRows.add(r);
                      }
                    });

                    const slotIds = [];
                    selectedRows.forEach(row => {
                      // 구매자 데이터 행만 삭제 가능
                      const rowData = tableData[row];
                      if (rowData?._rowType === ROW_TYPES.BUYER_DATA) {
                        const slotId = slotIndexMap[row];
                        if (slotId) slotIds.push(slotId);
                      }
                    });

                    if (slotIds.length === 0) {
                      alert('삭제할 구매자 행을 선택해주세요.');
                      return;
                    }

                    openDeleteDialog('rows', { slotIds }, `선택한 ${slotIds.length}개 행을 삭제하시겠습니까?\n\n⚠️ 해당 행의 구매자 정보가 삭제됩니다.`);
                  }
                },
                delete_group: {
                  name: '이 그룹 전체 삭제',
                  callback: function(key, selection) {
                    const row = selection[0]?.start?.row;
                    if (row === undefined) return;

                    const rowData = tableData[row];
                    // 구매자 데이터 행이 아니면 무시
                    if (!rowData || rowData._rowType !== ROW_TYPES.BUYER_DATA) {
                      alert('유효한 구매자 행을 선택해주세요.');
                      return;
                    }

                    const itemId = rowData._itemId;
                    const dayGroup = rowData._dayGroup;

                    openDeleteDialog('group', { itemId, dayGroup }, `${dayGroup}일차 그룹 전체를 삭제하시겠습니까?`);
                  }
                },
                sp2: { name: '---------' },
                split_day_group: {
                  name: '📅 일 마감 (다음 행부터 새 일차)',
                  callback: async function(key, selection) {
                    const row = selection[0]?.start?.row;
                    if (row === undefined) return;

                    const rowData = tableData[row];
                    if (!rowData || rowData._rowType !== ROW_TYPES.BUYER_DATA) {
                      alert('구매자 행에서만 일 마감을 사용할 수 있습니다.');
                      return;
                    }

                    const slotId = slotIndexMap[row];
                    if (!slotId) {
                      alert('슬롯 정보를 찾을 수 없습니다.');
                      return;
                    }

                    const slotNumber = rowData.col0;
                    const dayGroup = rowData._dayGroup;
                    const confirmMsg = `${dayGroup}일차의 ${slotNumber}번째 행 이후로 일 마감하시겠습니까?\n\n현재 행까지 ${dayGroup}일차로 유지되고,\n다음 행부터 새로운 일차로 분할됩니다.`;

                    if (!window.confirm(confirmMsg)) return;

                    try {
                      const result = await itemSlotService.splitDayGroup(slotId);
                      setSnackbar({ open: true, message: result.message });
                      loadSlots(campaignId, viewAsUserId);
                    } catch (error) {
                      console.error('Failed to split day group:', error);
                      alert('일 마감 실패: ' + (error.response?.data?.message || error.message));
                    }
                  }
                },
                sp3: { name: '---------' },
                delete_item: {
                  name: '🗑️ 이 품목 삭제',
                  callback: function(key, selection) {
                    const row = selection[0]?.start?.row;
                    if (row === undefined) return;

                    const rowData = tableData[row];
                    if (!rowData) return;

                    // 품목 ID 찾기 (제품 행 또는 구매자 행에서)
                    let itemId = null;
                    let productName = '';

                    if (rowData._rowType === ROW_TYPES.PRODUCT_HEADER || rowData._rowType === ROW_TYPES.PRODUCT_DATA) {
                      itemId = rowData._itemId;
                      productName = rowData.col3 || '';  // col3가 제품명 (col0은 토글, col1은 날짜, col2는 순번)
                    } else if (rowData._rowType === ROW_TYPES.BUYER_DATA || rowData._rowType === ROW_TYPES.BUYER_HEADER || rowData._rowType === ROW_TYPES.UPLOAD_LINK_BAR) {
                      itemId = rowData._itemId;
                      // 제품명 찾기
                      const productDataRow = tableData.find(r => r._rowType === ROW_TYPES.PRODUCT_DATA && r._itemId === itemId);
                      productName = productDataRow?.col3 || '';  // col3가 제품명 (col0은 토글, col1은 날짜, col2는 순번)
                    }

                    if (!itemId) {
                      alert('삭제할 품목을 선택해주세요.');
                      return;
                    }

                    openDeleteDialog('item', { itemId }, `품목 "${productName}"을(를) 삭제하시겠습니까?\n\n⚠️ 해당 품목의 모든 구매자 정보와 이미지가 함께 삭제됩니다.`);
                  }
                },
                sp4: { name: '---------' },
                align_left: {
                  name: '⬅️ 왼쪽 정렬',
                  callback: function(key, selection) {
                    const col = selection[0]?.start?.col;
                    if (col !== undefined) {
                      handleAlignmentChange(col, 'left');
                    }
                  }
                },
                align_center: {
                  name: '↔️ 가운데 정렬',
                  callback: function(key, selection) {
                    const col = selection[0]?.start?.col;
                    if (col !== undefined) {
                      handleAlignmentChange(col, 'center');
                    }
                  }
                },
                align_right: {
                  name: '➡️ 오른쪽 정렬',
                  callback: function(key, selection) {
                    const col = selection[0]?.start?.col;
                    if (col !== undefined) {
                      handleAlignmentChange(col, 'right');
                    }
                  }
                }
              }
            }}
            copyPaste={true}
            fillHandle={true}
            beforeCopy={(data, coords) => {
              // URL 형식의 데이터 복사 시 하이퍼링크 형식으로 변환
              // col11 뿐 아니라 모든 셀에서 URL 패턴을 감지하여 처리
              const urlPattern = /^(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|co\.kr|kr|net|org|io|shop|store))/i;

              for (let i = 0; i < data.length; i++) {
                for (let j = 0; j < data[i].length; j++) {
                  const value = data[i][j];
                  if (value && typeof value === 'string' && value.trim()) {
                    if (urlPattern.test(value.trim())) {
                      const url = value.startsWith('http') ? value : `https://${value}`;
                      data[i][j] = url;
                    }
                  }
                }
              }
            }}
            beforePaste={(data, coords) => {
              // 주문번호 컬럼(col6, 인덱스 6)에서만 슬래시 파싱 적용
              // 슬래시 구분: 주문번호/구매자/수취인/아이디/연락처/주소/계좌/금액 → col6~col13
              const startCol = coords[0].startCol;
              if (startCol !== 6) return; // 다른 컬럼이면 기본 동작

              // 붙여넣기 대상 행이 구매자 데이터 행인지 확인
              const startRow = coords[0].startRow;
              const targetRowData = tableData[startRow];
              if (!targetRowData || targetRowData._rowType !== ROW_TYPES.BUYER_DATA) return;

              // 첫 번째 셀에 슬래시가 있는지 확인
              const firstCell = data[0]?.[0];
              if (!firstCell || typeof firstCell !== 'string' || !firstCell.includes('/')) return;

              // 모든 행을 처리
              const newData = [];

              for (const row of data) {
                const cellValue = row[0];
                if (!cellValue || typeof cellValue !== 'string') continue;

                // 셀 내에 줄바꿈이 있으면 분리 (Windows: \r\n, Unix: \n)
                const lines = cellValue.split(/\r?\n/).filter(line => line.trim());

                for (const line of lines) {
                  if (!line.includes('/')) continue;

                  const parts = line.split('/');
                  newData.push([
                    parts[0]?.trim() || '',  // col6: 주문번호
                    parts[1]?.trim() || '',  // col7: 구매자
                    parts[2]?.trim() || '',  // col8: 수취인
                    parts[3]?.trim() || '',  // col9: 아이디
                    parts[4]?.trim() || '',  // col10: 연락처
                    parts[5]?.trim() || '',  // col11: 주소
                    parts[6]?.trim() || '',  // col12: 계좌
                    parts[7]?.trim() || ''   // col13: 금액
                  ]);
                }
              }

              if (newData.length === 0) return;

              // 원본 data 배열 수정 (Handsontable이 이 데이터로 붙여넣기)
              data.length = 0;
              newData.forEach(row => data.push(row));
            }}
            afterChange={handleAfterChange}
            cells={cellsRenderer}
            afterOnCellMouseUp={(event, coords) => {
              const rowData = tableData[coords.row];
              if (!rowData) return;

              // 업로드 링크 바 클릭 시 링크 복사
              if (rowData._rowType === ROW_TYPES.UPLOAD_LINK_BAR) {
                const token = rowData._uploadToken;
                if (token) {
                  handleCopyUploadLink(token);
                }
                return;
              }

              // 제품 데이터 행의 col13(상세보기) 클릭 시 팝업
              if (rowData._rowType === ROW_TYPES.PRODUCT_DATA && coords.col === 13) {
                const itemId = rowData._itemId;
                const dayGroup = rowData._dayGroup;
                // slots에서 해당 아이템의 정보 찾기
                const itemData = slots.find(s => s.item_id === itemId);
                if (itemData) {
                  // dayGroup에 해당하는 슬롯들의 정보 수집
                  const dayGroupSlots = slots.filter(s => s.item_id === itemId && s.day_group === dayGroup);
                  const firstSlot = dayGroupSlots[0];
                  setProductDetailPopup({
                    open: true,
                    item: itemData.Item || itemData,
                    slot: firstSlot,
                    dayGroup: dayGroup
                  });
                }
                return;
              }

              // 리뷰 보기 링크 클릭 시 갤러리 팝업
              const target = event.target;
              if (target.tagName === 'A' && target.classList.contains('review-link')) {
                event.preventDefault();
                const rowData = tableData[coords.row];
                const images = rowData?._reviewImages || [];
                if (images.length > 0) {
                  setImagePopup({
                    open: true,
                    images: images,
                    currentIndex: 0,
                    buyer: rowData?._buyer || null
                  });
                }
              }

              // 배송지연 칩 클릭 시 토글 (현재는 비활성화 - 필요하면 추가)
              // if (target.classList.contains('shipping-delayed-chip')) {
              //   const buyerId = target.getAttribute('data-buyer-id');
              //   const currentDelayed = target.getAttribute('data-delayed') === 'true';
              //   if (buyerId) {
              //     handleToggleShippingDelayed(parseInt(buyerId), currentDelayed, coords.row);
              //   }
              // }
            }}
            className="htCenter"
            autoWrapRow={false}
            autoWrapCol={false}
            selectionMode="multiple"
            outsideClickDeselects={true}
            enterBeginsEditing={true}
            enterMoves={{ row: 1, col: 0 }}
            tabMoves={{ row: 0, col: 1 }}
            afterColumnResize={handleColumnResize}
            autoScrollOnSelection={false}
            // afterRender - 메모 기능 비활성화
            // afterRender={() => {
            //   // 메모 데이터를 여분 행/열에 적용
            //   const hot = hotRef.current?.hotInstance;
            //   if (!hot || Object.keys(memos).length === 0) return;
            //
            //   Object.entries(memos).forEach(([key, value]) => {
            //     const [rowStr, colStr] = key.split('_');
            //     const row = parseInt(rowStr, 10);
            //     const col = parseInt(colStr, 10);
            //
            //     // 현재 셀 값과 다르면 설정 (무한 루프 방지)
            //     const currentValue = hot.getDataAtCell(row, col);
            //     if (currentValue !== value && value) {
            //       hot.setDataAtCell(row, col, value, 'loadMemo');
            //     }
            //   });
            // }}
            filters={true}
            dropdownMenu={['filter_by_condition', 'filter_by_value', 'filter_action_bar']}
            hiddenRows={{
              rows: [],
              indicators: false
            }}
            afterFilter={(conditionsStack) => {
              console.log('[OperatorItemSheet] afterFilter called:', conditionsStack);

              const hot = hotRef.current?.hotInstance;
              if (!hot) return;

              // 필터 조건 저장
              filterConditionsRef.current = conditionsStack && conditionsStack.length > 0 ? [...conditionsStack] : null;

              // 필터링된 컬럼 추적
              const filteredCols = new Set();
              if (conditionsStack && conditionsStack.length > 0) {
                conditionsStack.forEach(condition => {
                  if (condition.column !== undefined) {
                    filteredCols.add(condition.column);
                  }
                });
              }
              setFilteredColumns(filteredCols);

              // hiddenRows 플러그인 가져오기
              const hiddenRowsPlugin = hot.getPlugin('hiddenRows');
              if (!hiddenRowsPlugin) {
                console.log('[OperatorItemSheet] hiddenRows plugin not available');
                return;
              }

              // 먼저 모든 hiddenRows 초기화
              const currentHidden = hiddenRowsPlugin.getHiddenRows();
              if (currentHidden.length > 0) {
                hiddenRowsPlugin.showRows(currentHidden);
              }

              // 필터 조건이 없으면 전체 표시
              if (!conditionsStack || conditionsStack.length === 0) {
                console.log('[OperatorItemSheet] No filter conditions, showing all');
                setFilteredRows(null);
                hot.render();
                return;
              }

              // 조건에 따라 직접 필터링
              const visibleRows = [];
              const hiddenRows = [];
              const dataRowCount = tableData.length;

              for (let physicalRow = 0; physicalRow < dataRowCount; physicalRow++) {
                const rowData = tableData[physicalRow];

                // 구매자 데이터 행만 필터링 대상, 나머지는 숨기기
                if (rowData?._rowType !== ROW_TYPES.BUYER_DATA) {
                  hiddenRows.push(physicalRow);
                  continue;
                }

                // 필터 조건 확인 - 각 컬럼별 조건 체크
                let passesFilter = true;
                conditionsStack.forEach(condition => {
                  if (!passesFilter) return;

                  const col = condition.column;
                  const colName = columns[col]?.data; // col0, col1, ...
                  const cellValue = colName ? rowData[colName] : null;

                  // 필터 조건 타입에 따라 체크
                  if (condition.conditions && condition.conditions.length > 0) {
                    condition.conditions.forEach(cond => {
                      if (!passesFilter) return;

                      const { name, args } = cond;
                      const filterValue = args && args[0];

                      // by_value 필터 체크
                      if (name === 'by_value' && args) {
                        const allowedValues = args[0];
                        if (Array.isArray(allowedValues)) {
                          const cellStr = String(cellValue ?? '');
                          if (!allowedValues.includes(cellStr)) {
                            passesFilter = false;
                          }
                        }
                      }
                      // 조건 필터 체크
                      else if (name === 'eq' && filterValue !== undefined) {
                        if (String(cellValue) !== String(filterValue)) {
                          passesFilter = false;
                        }
                      } else if (name === 'contains' && filterValue) {
                        if (!String(cellValue ?? '').includes(String(filterValue))) {
                          passesFilter = false;
                        }
                      } else if (name === 'not_contains' && filterValue) {
                        if (String(cellValue ?? '').includes(String(filterValue))) {
                          passesFilter = false;
                        }
                      } else if (name === 'empty') {
                        if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                          passesFilter = false;
                        }
                      } else if (name === 'not_empty') {
                        if (cellValue === null || cellValue === undefined || cellValue === '') {
                          passesFilter = false;
                        }
                      }
                    });
                  }
                });

                if (passesFilter) {
                  visibleRows.push(physicalRow);
                } else {
                  hiddenRows.push(physicalRow);
                }
              }

              console.log('[OperatorItemSheet] visibleRows:', visibleRows.length, 'hiddenRows:', hiddenRows.length, 'totalDataRows:', dataRowCount);

              // 필터링된 행 숨기기 (hiddenRows 플러그인 사용)
              if (hiddenRows.length > 0) {
                hiddenRowsPlugin.hideRows(hiddenRows);
              }

              hot.render();

              setFilteredRows(visibleRows.length > 0 && visibleRows.length < dataRowCount ? visibleRows : null);
            }}
          />
        ) : (
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 200,
            color: 'text.secondary'
          }}>
            배정된 품목이 없습니다. 관리자에게 품목 배정을 요청하세요.
          </Box>
        )}
      </Paper>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialog.open} onClose={(event, reason) => { if (reason !== 'backdropClick') closeDeleteDialog(); }}>
        <DialogTitle>삭제 확인</DialogTitle>
        <DialogContent>
          <DialogContentText>{deleteDialog.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* 이미지 스와이프 뷰어 */}
      <ImageSwipeViewer
        open={imagePopup.open}
        onClose={() => setImagePopup({ open: false, images: [], currentIndex: 0, buyer: null })}
        images={imagePopup.images}
        initialIndex={imagePopup.currentIndex}
        buyerInfo={imagePopup.buyer}
      />

      {/* 제품 상세 정보 팝업 */}
      <Dialog
        open={productDetailPopup.open}
        onClose={(event, reason) => { if (reason !== 'backdropClick') setProductDetailPopup({ open: false, item: null, slot: null, dayGroup: null }); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#1976d2', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon />
            <Typography variant="h6" fontWeight="bold">제품 상세 정보</Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setProductDetailPopup({ open: false, item: null, slot: null, dayGroup: null })}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {productDetailPopup.item && (
            <Box>
              {/* 슬롯(day_group별) 정보 우선, 없으면 Item 정보 */}
              {(() => {
                const slot = productDetailPopup.slot || {};
                const item = productDetailPopup.item || {};
                // 슬롯 값이 있으면 슬롯, 없으면 Item 값
                const getValue = (field) => slot[field] || item[field] || '-';

                // 가격 포맷팅 함수 - 숫자면 천단위 구분, 아니면 그대로 표시
                const formatPrice = (price) => {
                  if (!price || price === '-') return '-';
                  const num = parseFloat(String(price).replace(/,/g, ''));
                  if (!isNaN(num)) {
                    return `${num.toLocaleString()}원`;
                  }
                  return `${price}원`;
                };

                const fields = [
                  { label: '제품명', value: getValue('product_name') },
                  { label: '플랫폼', value: getValue('platform') },
                  { label: '상품 URL', value: getValue('product_url'), isLink: true },
                  { label: '구매 옵션', value: getValue('purchase_option') },
                  { label: '희망 키워드', value: getValue('keyword') },
                  { label: '출고 유형', value: getValue('shipping_type') },
                  { label: '총 구매 건수', value: getValue('total_purchase_count') },
                  { label: '일 구매 건수', value: getValue('daily_purchase_count') },
                  { label: '제품 가격', value: formatPrice(getValue('product_price')) },
                  { label: '출고 마감 시간', value: item.shipping_deadline || '-' },
                  { label: '택배대행 Y/N', value: getValue('courier_service_yn') },
                  { label: '리뷰 가이드', value: item.review_guide || '-', multiline: true },
                  { label: '특이사항', value: getValue('notes'), multiline: true },
                ];

                return (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {fields.map((field, idx) => (
                      <Box key={idx} sx={{
                        display: 'flex',
                        borderBottom: '1px solid #eee',
                        pb: 1.5,
                        flexDirection: field.multiline ? 'column' : 'row',
                        alignItems: field.multiline ? 'flex-start' : 'center'
                      }}>
                        <Typography
                          sx={{
                            fontWeight: 'bold',
                            color: '#555',
                            minWidth: field.multiline ? 'auto' : 140,
                            mb: field.multiline ? 0.5 : 0
                          }}
                        >
                          {field.label}
                        </Typography>
                        {field.isLink && field.value !== '-' ? (
                          <Typography
                            component="a"
                            href={field.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ color: '#1976d2', textDecoration: 'underline', wordBreak: 'break-all' }}
                          >
                            {field.value}
                          </Typography>
                        ) : field.multiline ? (
                          <Typography
                            sx={{
                              whiteSpace: 'pre-wrap',
                              bgcolor: '#f9f9f9',
                              p: 1.5,
                              borderRadius: 1,
                              width: '100%',
                              fontSize: '0.9rem',
                              lineHeight: 1.6
                            }}
                          >
                            {field.value}
                          </Typography>
                        ) : (
                          <Typography>{field.value}</Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                );
              })()}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="contained"
            onClick={() => setProductDetailPopup({ open: false, item: null, slot: null, dayGroup: null })}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

// React.memo로 감싸서 부모 리렌더링 시 불필요한 리렌더링 방지
// campaignId, viewAsUserId가 변경되지 않으면 시트가 리렌더링되지 않음
const OperatorItemSheet = React.memo(OperatorItemSheetInner, (prevProps, nextProps) => {
  // true 반환 = 리렌더링 하지 않음, false 반환 = 리렌더링 함
  // campaignId, campaignName, viewAsUserId가 같으면 리렌더링 방지
  return (
    prevProps.campaignId === nextProps.campaignId &&
    prevProps.campaignName === nextProps.campaignName &&
    prevProps.viewAsUserId === nextProps.viewAsUserId
  );
});

export default OperatorItemSheet;
