import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InfoIcon from '@mui/icons-material/Info';
import ImageSwipeViewer from './ImageSwipeViewer';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { format } from 'date-fns';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import itemSlotService from '../../services/itemSlotService';
import imageService from '../../services/imageService';
import { downloadExcel, convertSlotsToExcelData } from '../../utils/excelExport';

// Handsontable 모든 모듈 등록
registerAllModules();

// 슬롯 데이터 캐시 (날짜별 전환 최적화)
const slotsCache = new Map();

// 행 타입 상수 정의
const ROW_TYPES = {
  ITEM_SEPARATOR: 'item_separator',
  PRODUCT_HEADER: 'product_header',
  PRODUCT_DATA: 'product_data',
  UPLOAD_LINK_BAR: 'upload_link_bar',
  BUYER_HEADER: 'buyer_header',
  BUYER_DATA: 'buyer_data',
};

// ========== 성능 최적화: 상수 (컴포넌트 외부 정의) ==========
const STATUS_LABELS = { active: '진행', completed: '완료', cancelled: '취소' };

// ========== 성능 최적화: 셀 렌더러 함수 (컴포넌트 외부 정의) ==========
const dailyItemSeparatorRenderer = (instance, td) => {
  td.className = 'item-separator-row';
  td.style.backgroundColor = '#1565c0';
  td.style.height = '8px';
  td.style.padding = '0';
  td.innerHTML = '';
  return td;
};

const dailyProductHeaderRenderer = (instance, td, r, c, prop, value) => {
  td.className = 'product-header-row';
  td.style.backgroundColor = '#e0e0e0';
  td.style.fontWeight = 'bold';
  td.style.textAlign = 'center';
  td.style.fontSize = '11px';
  td.textContent = value ?? '';
  return td;
};

const dailyBuyerHeaderRenderer = (instance, td, r, c, prop, value) => {
  td.className = 'buyer-header-row';
  td.style.backgroundColor = '#f5f5f5';
  td.style.fontWeight = 'bold';
  td.style.textAlign = 'center';
  td.style.fontSize = '11px';
  td.textContent = value ?? '';
  return td;
};

const createDailyProductDataRenderer = (tableDataRef, collapsedItemsRef) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableDataRef.current[r];
    td.className = 'product-data-row';
    td.style.backgroundColor = '#fff8e1';
    td.style.fontSize = '11px';

    if (prop === 'col0') {
      const groupKey = rowData._groupKey;
      const isCollapsed = collapsedItemsRef.current.has(groupKey);
      td.innerHTML = `<span style="cursor: pointer; user-select: none; font-size: 14px; color: #666;">${isCollapsed ? '▶' : '▼'}</span>`;
      td.style.textAlign = 'center';
      td.style.cursor = 'pointer';
    } else if (prop === 'col1') {
      td.textContent = value ?? '';
      td.style.fontWeight = 'bold';
      td.style.color = '#1565c0';
      td.style.userSelect = 'none';
      td.style.cursor = 'default';
      td.style.backgroundColor = '#f5f5f5';
    } else if (prop === 'col3') {
      td.textContent = value ?? '';
      td.style.fontWeight = 'bold';
      td.style.color = '#1565c0';
    } else if (prop === 'col13' && value) {
      // URL 컬럼 (col13 = product_url)
      const url = value.startsWith('http') ? value : `https://${value}`;
      td.style.whiteSpace = 'nowrap';
      td.style.overflow = 'hidden';
      td.style.textOverflow = 'ellipsis';
      td.title = value;
      td.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #1976d2; text-decoration: underline;">${value}</a>`;
    } else if (prop === 'col15') {
      // 상세보기 버튼 (col15)
      td.innerHTML = `<span class="detail-btn" style="cursor: pointer; font-size: 14px; color: #1976d2;">📋</span>`;
      td.style.textAlign = 'center';
      td.style.cursor = 'pointer';
    } else {
      td.textContent = value ?? '';
    }

    return td;
  };
};

const createDailyUploadLinkBarRenderer = () => {
  return (instance, td, r, c, prop, value) => {
    td.className = 'upload-link-bar';
    td.style.backgroundColor = '#424242';
    td.style.color = 'white';
    td.style.cursor = 'pointer';
    td.style.fontSize = '11px';

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

const createDailyBuyerDataRenderer = (tableDataRef, duplicateOrderNumbersRef) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableDataRef.current[r];
    const dayGroup = rowData._dayGroup || 1;
    const dayClass = dayGroup % 2 === 0 ? 'day-even' : 'day-odd';
    td.className = dayClass;
    td.style.fontSize = '11px';
    td.style.backgroundColor = dayGroup % 2 === 0 ? '#e0f2f1' : '#fff';

    if (prop === 'col0' || prop === 'col1') {
      td.textContent = '';
    } else if (prop === 'col2') {
      td.textContent = value ?? '';
      td.style.textAlign = 'center';
    } else if (prop === 'col3') {
      td.textContent = value ?? '';
      td.style.textAlign = 'center';
      td.style.color = '#666';
    } else if (prop === 'col4' || prop === 'col5' || prop === 'col6') {
      // col4: 제품명, col5: 옵션, col6: 비고
      td.textContent = value ?? '';
      td.style.color = '#555';
    } else if (prop === 'col8') {
      // col8: 주문번호 (col7 -> col8로 시프트)
      td.textContent = value ?? '';
      if (value && duplicateOrderNumbersRef.current.has(value)) {
        td.classList.add('duplicate-order');
        td.style.backgroundColor = '#ffcdd2';
      }
    } else if (prop === 'col15' && value) {
      // col15: 금액 (col14 -> col15로 시프트)
      const numValue = parseInt(String(value).replace(/[^0-9]/g, ''));
      td.textContent = numValue ? numValue.toLocaleString() : value;
    } else if (prop === 'col17') {
      // col17: 리뷰샷 (col16 -> col17로 시프트)
      const images = rowData._reviewImages || [];
      const imageCount = images.length;
      if (imageCount > 0) {
        const label = imageCount > 1 ? `보기(${imageCount})` : '보기';
        td.innerHTML = `
          <span style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            <a href="#" class="review-link" style="color: #1976d2; text-decoration: underline; cursor: pointer; font-size: 11px;">${label}</a>
            <a href="#" class="review-delete-link" style="color: #d32f2f; font-size: 10px; cursor: pointer;" title="리뷰샷 삭제">✕</a>
          </span>`;
        td.style.textAlign = 'center';
      } else {
        td.innerHTML = '<span style="color: #999; font-size: 10px;">-</span>';
        td.style.textAlign = 'center';
      }
    } else if (prop === 'col18') {
      // col18: 상태 (col17 -> col18로 시프트)
      const status = rowData._calculatedStatus;
      const label = STATUS_LABELS[status] || status;

      if (status === '-') {
        td.innerHTML = '<span style="color: #999;">-</span>';
      } else if (status === 'completed') {
        td.innerHTML = `<span style="background-color: #e8f5e9; color: #388e3c; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: bold;">✓ ${label}</span>`;
      } else {
        td.innerHTML = `<span style="background-color: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 10px; font-size: 10px;">${label}</span>`;
      }
      td.style.textAlign = 'center';
    } else if (prop === 'col21') {
      // col21: 입금여부 (col20 -> col21로 시프트)
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
    } else {
      td.textContent = value ?? '';
    }

    return td;
  };
};

// 기본 컬럼 너비 - 23개 컬럼 (col22 여백 컬럼 포함, 비고 컬럼 추가)
const DEFAULT_COLUMN_WIDTHS = [30, 180, 70, 60, 120, 80, 80, 50, 80, 60, 50, 50, 50, 80, 30, 80, 100, 80, 50, 60, 70, 70, 50];

// ========== 성능 최적화: colHeaders 배열 (컴포넌트 외부 정의) ==========
const COL_HEADERS = Array(23).fill('');

/**
 * 날짜별 작업 시트 컴포넌트
 * - Operator/Sales 공용
 * - 특정 날짜의 모든 연월브랜드-캠페인 데이터를 한 시트에 표시
 */
function DailyWorkSheetInner({ userRole = 'operator', viewAsUserId = null }) {
  const hotRef = useRef(null);

  // localStorage 키 정의
  const COLUMN_WIDTHS_KEY = `daily_work_sheet_column_widths_${userRole}`;
  const SELECTED_DATE_KEY = `daily_work_sheet_selected_date_${userRole}_${viewAsUserId || 'self'}`;
  const SEARCH_DATE_KEY = `daily_work_sheet_search_date_${userRole}_${viewAsUserId || 'self'}`;
  const COLLAPSED_ITEMS_KEY = `daily_work_sheet_collapsed_${userRole}_${viewAsUserId || 'self'}`;

  // 날짜 상태 - localStorage에서 복원
  const [selectedDate, setSelectedDate] = useState(() => {
    try {
      const saved = localStorage.getItem(SELECTED_DATE_KEY);
      if (saved) {
        const date = new Date(saved);
        return isNaN(date.getTime()) ? null : date;
      }
    } catch {
      return null;
    }
    return null;
  });

  // 검색(조회)된 날짜 - localStorage에서 복원
  const [searchDate, setSearchDate] = useState(() => {
    try {
      const saved = localStorage.getItem(SEARCH_DATE_KEY);
      if (saved) {
        const date = new Date(saved);
        return isNaN(date.getTime()) ? null : date;
      }
    } catch {
      return null;
    }
    return null;
  });

  // 슬롯 데이터
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  // 컬럼 너비 상태
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);

  // 변경된 슬롯들 추적 (성능 최적화: ref만 사용, state 제거로 리렌더링 방지)
  const changedSlotsRef = useRef({});

  // 변경된 아이템들 추적 (제품 정보 수정용, 성능 최적화: ref만 사용)
  const changedItemsRef = useRef({});

  // 미저장 변경사항 플래그 (성능 최적화: ref만 사용)
  const hasUnsavedChangesRef = useRef(false);

  // 스낵바 ref (성능 최적화: state 대신 ref + DOM 직접 조작)
  const snackbarRef = useRef(null);

  // 한글 입력 조합 중 상태 추적 (성능 최적화)
  const isComposingRef = useRef(false);

  // 저장 중 상태 (성능 최적화: ref 사용으로 리렌더링 방지)
  const savingRef = useRef(false);

  // 선택된 셀 개수 표시용 ref (DOM 직접 업데이트로 리렌더링 방지)
  const selectedCellCountRef = useRef(null);

  // 이미지 갤러리 팝업 상태
  const [imagePopup, setImagePopup] = useState({
    open: false,
    images: [],
    currentIndex: 0,
    buyer: null
  });

  // 리뷰샷 삭제 팝업 상태
  const [deleteReviewPopup, setDeleteReviewPopup] = useState({
    open: false,
    images: [],
    buyer: null,
    rowIndex: null
  });
  const [deletingReview, setDeletingReview] = useState(false);

  // 제품 상세 정보 팝업 상태
  const [productDetailPopup, setProductDetailPopup] = useState({
    open: false,
    item: null,
    productInfo: null,
    dayGroup: null
  });

  // 접힌 품목 ID Set - localStorage에서 복원
  const [collapsedItems, setCollapsedItems] = useState(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_ITEMS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(parsed);
      }
    } catch {
      return new Set();
    }
    return new Set();
  });

  // selectedDate 변경 시 localStorage에 저장
  useEffect(() => {
    if (selectedDate) {
      try {
        localStorage.setItem(SELECTED_DATE_KEY, selectedDate.toISOString());
      } catch (e) {
        console.error('Failed to save selected date:', e);
      }
    }
  }, [selectedDate, SELECTED_DATE_KEY]);

  // searchDate 변경 시 localStorage에 저장
  useEffect(() => {
    try {
      if (searchDate) {
        localStorage.setItem(SEARCH_DATE_KEY, searchDate.toISOString());
      } else {
        localStorage.removeItem(SEARCH_DATE_KEY);
      }
    } catch (e) {
      console.error('Failed to save search date:', e);
    }
  }, [searchDate, SEARCH_DATE_KEY]);

  // collapsedItems 변경 시 localStorage에 저장
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_ITEMS_KEY, JSON.stringify([...collapsedItems]));
    } catch (e) {
      console.error('Failed to save collapsed items:', e);
    }
  }, [collapsedItems, COLLAPSED_ITEMS_KEY]);

  // localStorage에서 컬럼 크기 로드
  const getSavedColumnWidths = useCallback(() => {
    try {
      const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, [COLUMN_WIDTHS_KEY]);

  // 컬럼 크기 저장
  const saveColumnWidths = useCallback((widths) => {
    try {
      localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
    } catch (e) {
      console.error('Failed to save column widths:', e);
    }
  }, [COLUMN_WIDTHS_KEY]);

  // 초기 컬럼 너비 로드
  useEffect(() => {
    const saved = getSavedColumnWidths();
    if (saved && Array.isArray(saved) && saved.length > 0) {
      // 저장된 너비와 기본 너비를 병합 (저장된 값 우선, 부족하면 기본값 사용)
      const merged = DEFAULT_COLUMN_WIDTHS.map((defaultWidth, i) =>
        saved[i] !== undefined ? saved[i] : defaultWidth
      );
      setColumnWidths(merged);
    }
  }, [getSavedColumnWidths]);

  // showSnackbar 함수 (성능 최적화: CSS animation 사용, setTimeout 콜백 제거)
  const showSnackbar = useCallback((message) => {
    const snackbarEl = snackbarRef.current;
    if (!snackbarEl) return;

    const messageEl = snackbarEl.querySelector('.snackbar-message');
    if (messageEl) {
      messageEl.textContent = message;
    }

    // CSS animation 초기화 및 재시작
    snackbarEl.style.animation = 'none';
    void snackbarEl.offsetHeight; // reflow 강제 (animation 재시작 트릭)
    snackbarEl.style.visibility = 'visible';
    snackbarEl.style.opacity = '1';
    // 2초 후 0.3초 동안 페이드아웃 (CSS animation)
    snackbarEl.style.animation = 'snackbarFadeOut 0.3s 2s forwards';
  }, []);

  // 한글 입력 compositionend 이벤트 리스너 (성능 최적화: rAF 지연)
  useEffect(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const rootElement = hot.rootElement;
    if (!rootElement) return;

    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
      // requestAnimationFrame으로 1프레임 지연하여 브라우저가 IME 상태를 완전히 정리할 시간을 줌
      requestAnimationFrame(() => {
        isComposingRef.current = false;
      });
    };

    rootElement.addEventListener('compositionstart', handleCompositionStart);
    rootElement.addEventListener('compositionend', handleCompositionEnd);

    return () => {
      rootElement.removeEventListener('compositionstart', handleCompositionStart);
      rootElement.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [slots]);

  // 날짜별 슬롯 조회
  const loadSlots = useCallback(async (forceRefresh = false) => {
    if (!searchDate) return;

    const formattedDate = format(searchDate, 'yyyy-MM-dd');

    // 캐시 키 생성
    const cacheKey = `daily_${formattedDate}_${viewAsUserId || ''}`;

    // 캐시 확인 (forceRefresh가 아닌 경우)
    if (!forceRefresh && slotsCache.has(cacheKey)) {
      const cached = slotsCache.get(cacheKey);
      setSlots(cached.slots);
      changedSlotsRef.current = {};
      changedItemsRef.current = {};
      hasUnsavedChangesRef.current = false;
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await itemSlotService.getSlotsByDate(formattedDate, viewAsUserId);
      if (response.success) {
        const newSlots = response.data || [];
        setSlots(newSlots);
        changedSlotsRef.current = {};
        changedItemsRef.current = {};
        hasUnsavedChangesRef.current = false;

        // 캐시에 저장
        slotsCache.set(cacheKey, { slots: newSlots, timestamp: Date.now() });
      } else {
        showSnackbar(response.message || '데이터 조회 실패');
      }
    } catch (error) {
      console.error('Load slots error:', error);
      showSnackbar('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [searchDate, viewAsUserId, showSnackbar]);

  // 조회 버튼 클릭
  const handleSearch = () => {
    if (selectedDate) {
      setSearchDate(selectedDate);
    }
  };

  // 이전 날짜로 이동 (-1일)
  const handlePreviousDate = () => {
    if (selectedDate) {
      const prevDate = new Date(selectedDate);
      prevDate.setDate(prevDate.getDate() - 1);
      setSelectedDate(prevDate);
    }
  };

  // 다음 날짜로 이동 (+1일)
  const handleNextDate = () => {
    if (selectedDate) {
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 1);
      setSelectedDate(nextDate);
    }
  };

  // 컴포넌트 마운트 시 캐시 클리어 (다른 시트와 동기화 위해)
  useEffect(() => {
    slotsCache.clear();
  }, []);

  // searchDate 변경 시 데이터 로드
  useEffect(() => {
    if (searchDate) {
      loadSlots();
    }
  }, [searchDate, loadSlots]);

  // Shift+휠 횡스크롤 핸들러
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
  }, []); // DOM 참조는 HotTable 생존 기간 동안 불변

  // 슬롯을 품목 ID와 day_group으로 그룹화
  const groupedSlots = useMemo(() => {
    const groups = {};

    slots.forEach(slot => {
      const item = slot.item;
      if (!item) return;

      const campaign = item.campaign;
      const monthlyBrand = campaign?.monthlyBrand;
      const groupKey = `${item.id}_${slot.day_group}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          item,
          campaign,
          monthlyBrand,
          dayGroup: slot.day_group,
          slots: [],
          uploadLinkToken: slot.upload_link_token
        };
      }
      groups[groupKey].slots.push(slot);
    });

    // 슬롯 정렬
    Object.values(groups).forEach(group => {
      group.slots.sort((a, b) => a.slot_number - b.slot_number);
    });

    return groups;
  }, [slots]);

  // 중복 주문번호 감지
  const duplicateOrderNumbers = useMemo(() => {
    const orderNumbers = [];
    slots.forEach(slot => {
      if (slot.buyer?.order_number) {
        orderNumbers.push(slot.buyer.order_number);
      }
    });

    const counts = {};
    orderNumbers.forEach(num => {
      counts[num] = (counts[num] || 0) + 1;
    });

    return new Set(Object.keys(counts).filter(num => counts[num] >= 2));
  }, [slots]);

  // 렌더러용 ref (의존성 체인 끊기)
  const duplicateOrderNumbersRef = useRef(duplicateOrderNumbers);
  duplicateOrderNumbersRef.current = duplicateOrderNumbers;

  // 상태 옵션은 컴포넌트 외부 상수 STATUS_LABELS 사용

  // Handsontable 데이터 생성 (성능 최적화: collapsedItems 의존성 제거, hiddenRows 플러그인으로 접기/펼치기 처리)
  const { baseTableData, baseRowMeta } = useMemo(() => {
    const data = [];
    const meta = [];

    // 품목 ID와 day_group 순서대로 정렬
    const sortedGroups = Object.values(groupedSlots).sort((a, b) => {
      const mbNameA = a.monthlyBrand?.name || '';
      const mbNameB = b.monthlyBrand?.name || '';
      if (mbNameA !== mbNameB) return mbNameA.localeCompare(mbNameB);

      const cNameA = a.campaign?.name || '';
      const cNameB = b.campaign?.name || '';
      if (cNameA !== cNameB) return cNameA.localeCompare(cNameB);

      if (a.item.id !== b.item.id) return a.item.id - b.item.id;
      return a.dayGroup - b.dayGroup;
    });

    sortedGroups.forEach((groupData, groupIndex) => {
      const { item, campaign, monthlyBrand, dayGroup, uploadLinkToken } = groupData;
      const groupKey = `${item.id}_${dayGroup}`;

      // 연월브랜드-캠페인 표시 문자열
      const mbCampaignLabel = `${monthlyBrand?.name || '연월브랜드'} - ${campaign?.name || '캠페인'}`;

      // day_group 중단 상태 확인 (슬롯 중 하나라도 is_suspended가 true면 중단됨)
      const isDayGroupSuspended = groupData.slots.some(s => s.is_suspended);

      // 슬롯/아이템에서 제품 정보 병합 (changedItems > 슬롯 > 아이템 우선순위)
      const firstSlot = groupData.slots[0] || {};
      const localChanges = changedItemsRef.current[groupKey] || {};
      const productInfo = {
        product_name: localChanges.product_name ?? firstSlot.product_name ?? item.product_name ?? '',
        platform: localChanges.platform ?? firstSlot.platform ?? item.platform ?? '',
        shipping_type: localChanges.shipping_type ?? firstSlot.shipping_type ?? item.shipping_type ?? '',
        keyword: localChanges.keyword ?? firstSlot.keyword ?? item.keyword ?? '',
        product_price: localChanges.product_price ?? firstSlot.product_price ?? item.product_price ?? '',
        total_purchase_count: localChanges.total_purchase_count ?? firstSlot.total_purchase_count ?? item.total_purchase_count ?? '',
        daily_purchase_count: localChanges.daily_purchase_count ?? firstSlot.daily_purchase_count ?? item.daily_purchase_count ?? '',
        purchase_option: localChanges.purchase_option ?? firstSlot.purchase_option ?? item.purchase_option ?? '',
        courier_service_yn: localChanges.courier_service_yn ?? firstSlot.courier_service_yn ?? item.courier_service_yn ?? '',
        courier_name: (() => {
          const name = localChanges.courier_name ?? firstSlot.courier_name ?? item.courier_name;
          if (name) return name;
          const courierYn = localChanges.courier_service_yn ?? firstSlot.courier_service_yn ?? item.courier_service_yn ?? '';
          return courierYn.toUpperCase().trim() === 'Y' ? '롯데택배' : '';
        })(),
        product_url: localChanges.product_url ?? firstSlot.product_url ?? item.product_url ?? '',
        notes: localChanges.notes ?? firstSlot.notes ?? item.notes ?? '',
        date: localChanges.date ?? firstSlot.date ?? item.date ?? ''
      };

      // 품목 구분선 (첫 번째 그룹 제외)
      if (groupIndex > 0) {
        data.push({
          _rowType: ROW_TYPES.ITEM_SEPARATOR,
          col0: '', col1: '', col2: '', col3: '', col4: '', col5: '', col6: '', col7: '',
          col8: '', col9: '', col10: '', col11: '', col12: '', col13: '', col14: '',
          col15: '', col16: '', col17: '', col18: '', col19: '', col20: '', col21: ''
        });
        meta.push({ type: ROW_TYPES.ITEM_SEPARATOR });
      }

      // 제품 정보 헤더 행 (22개 컬럼)
      data.push({
        _rowType: ROW_TYPES.PRODUCT_HEADER,
        col0: '', col1: '연월브랜드-캠페인', col2: '날짜', col3: '플랫폼', col4: '제품명', col5: '옵션', col6: '출고', col7: '키워드',
        col8: '가격', col9: '총건수', col10: '일건수', col11: '택배사', col12: '택배', col13: 'URL', col14: '특이사항', col15: '상세',
        col16: '', col17: '', col18: '', col19: '', col20: '', col21: ''
      });
      meta.push({ type: ROW_TYPES.PRODUCT_HEADER, itemId: item.id, dayGroup });

      // 제품 정보 데이터 행 (22개 컬럼) - col0는 항상 '▼' (접기 상태는 hiddenRows 플러그인이 처리)
      data.push({
        _rowType: ROW_TYPES.PRODUCT_DATA,
        _itemId: item.id,
        _dayGroup: dayGroup,
        _groupKey: groupKey,
        _uploadToken: uploadLinkToken,
        _item: item,
        _productInfo: productInfo,
        col0: '▼',
        col1: mbCampaignLabel,
        col2: productInfo.date,
        col3: productInfo.platform,
        col4: productInfo.product_name,
        col5: productInfo.purchase_option,
        col6: productInfo.shipping_type,
        col7: productInfo.keyword,
        col8: productInfo.product_price,
        col9: productInfo.total_purchase_count,
        col10: productInfo.daily_purchase_count,
        col11: productInfo.courier_name,
        col12: productInfo.courier_service_yn,
        col13: productInfo.product_url,
        col14: productInfo.notes,
        col15: '📋',
        col16: '', col17: '', col18: '', col19: '', col20: '', col21: ''
      });
      meta.push({ type: ROW_TYPES.PRODUCT_DATA, itemId: item.id, dayGroup, uploadLinkToken, groupKey });

      // 모든 구매자 행 항상 포함 (접기/펼치기는 hiddenRows 플러그인으로 처리)
      // 업로드 링크 바 (22개 컬럼)
      data.push({
        _rowType: ROW_TYPES.UPLOAD_LINK_BAR,
        _uploadToken: uploadLinkToken,
        _groupKey: groupKey,
        _isSuspended: isDayGroupSuspended,
        col0: '', col1: '📷 업로드 링크 복사',
        col2: '', col3: '', col4: '', col5: '', col6: '', col7: '', col8: '', col9: '',
        col10: '', col11: '', col12: '', col13: '', col14: '', col15: '', col16: '', col17: '', col18: '', col19: '', col20: '', col21: ''
      });
      meta.push({ type: ROW_TYPES.UPLOAD_LINK_BAR, uploadLinkToken });

      // 구매자 헤더 행 (23개 컬럼 - col6에 비고 추가)
      data.push({
        _rowType: ROW_TYPES.BUYER_HEADER,
        _groupKey: groupKey,
        _isSuspended: isDayGroupSuspended,
        col0: '', col1: '', col2: '날짜', col3: '순번', col4: '제품명', col5: '옵션', col6: '비고', col7: '예상구매자',
        col8: '주문번호', col9: '구매자', col10: '수취인', col11: '아이디', col12: '연락처', col13: '주소',
        col14: '계좌', col15: '금액', col16: '송장번호', col17: '리뷰샷', col18: '상태', col19: '리뷰비',
        col20: '입금명', col21: '입금여부'
      });
      meta.push({ type: ROW_TYPES.BUYER_HEADER, itemId: item.id, dayGroup });

      // 구매자 데이터 행
      groupData.slots.forEach((slot, slotIndex) => {
        const buyer = slot.buyer || {};
        const reviewImage = buyer.images && buyer.images.length > 0 ? buyer.images[0] : null;

        // changedSlotsRef에서 로컬 변경사항 가져오기 (저장 전 즉시 반영용)
        const slotChanges = changedSlotsRef.current[slot.id] || {};

        // buyer 필드 (changedSlots > buyer 우선순위)
        const mergedBuyer = {
          order_number: slotChanges.order_number ?? buyer.order_number ?? '',
          buyer_name: slotChanges.buyer_name ?? buyer.buyer_name ?? '',
          recipient_name: slotChanges.recipient_name ?? buyer.recipient_name ?? '',
          user_id: slotChanges.user_id ?? buyer.user_id ?? '',
          contact: slotChanges.contact ?? buyer.contact ?? '',
          address: slotChanges.address ?? buyer.address ?? '',
          account_info: slotChanges.account_info ?? buyer.account_info ?? '',
          amount: slotChanges.amount ?? buyer.amount ?? '',
          tracking_number: slotChanges.tracking_number ?? buyer.tracking_number ?? '',
          deposit_name: slotChanges.deposit_name ?? buyer.deposit_name ?? '',
          date: slotChanges.date ?? buyer.date ?? ''
        };

        // slot 필드 (changedSlots > slot 우선순위)
        const mergedSlot = {
          product_name: slotChanges.product_name ?? slot.product_name ?? item.product_name ?? '',
          purchase_option: slotChanges.purchase_option ?? slot.purchase_option ?? '',
          buyer_notes: slotChanges.buyer_notes ?? slot.buyer_notes ?? '',
          expected_buyer: slotChanges.expected_buyer ?? slot.expected_buyer ?? '',
          review_cost: slotChanges.review_cost ?? slot.review_cost ?? '',
          date: slotChanges.date ?? slot.date ?? ''
        };

        const hasBuyerData = mergedBuyer.order_number || mergedBuyer.buyer_name || mergedBuyer.recipient_name ||
                             mergedBuyer.user_id || mergedBuyer.contact || mergedBuyer.address ||
                             mergedBuyer.account_info || mergedBuyer.amount;
        const hasReviewImage = reviewImage?.s3_url;
        const calculatedStatus = hasReviewImage ? 'completed' : (hasBuyerData ? 'active' : '-');

        data.push({
          _rowType: ROW_TYPES.BUYER_DATA,
          _slotId: slot.id,
          _itemId: item.id,
          _dayGroup: dayGroup,
          _groupKey: groupKey,
          _buyerId: buyer.id || null,
          _buyer: buyer,
          _isSuspended: isDayGroupSuspended,
          _reviewImages: buyer.images || [],
          _reviewImageUrl: reviewImage?.s3_url || '',
          _hasBuyerData: !!hasBuyerData,
          _calculatedStatus: calculatedStatus,
          col0: '',
          col1: '',
          col2: mergedBuyer.date || mergedSlot.date || '',  // Buyer.date 우선, 없으면 slot.date
          col3: slotIndex + 1,
          col4: mergedSlot.product_name,
          col5: mergedSlot.purchase_option,
          col6: mergedSlot.buyer_notes,
          col7: mergedSlot.expected_buyer,
          col8: mergedBuyer.order_number,
          col9: mergedBuyer.buyer_name,
          col10: mergedBuyer.recipient_name,
          col11: mergedBuyer.user_id,
          col12: mergedBuyer.contact,
          col13: mergedBuyer.address,
          col14: mergedBuyer.account_info,
          col15: mergedBuyer.amount,
          col16: mergedBuyer.tracking_number,
          col17: reviewImage?.s3_url || '',
          col18: calculatedStatus,
          col19: mergedSlot.review_cost,
          col20: mergedBuyer.deposit_name,
          col21: buyer.payment_confirmed_at || ''
        });
        meta.push({
          type: ROW_TYPES.BUYER_DATA,
          itemId: item.id,
          dayGroup,
          slotId: slot.id,
          buyerId: buyer.id,
          buyer,
          slot
        });
      });
    });

    return { baseTableData: data, baseRowMeta: meta };
  }, [groupedSlots]); // 성능 최적화: collapsedItems 의존성 제거 (hiddenRows 플러그인으로 처리)

  // 성능 최적화: baseTableData를 tableData로 alias (OperatorItemSheet와 동일 패턴)
  const tableData = baseTableData;
  const rowMeta = baseRowMeta;

  // 성능 최적화: tableData/rowMeta를 ref로도 유지 (handleAfterChange 의존성에서 제거하기 위함)
  const tableDataRef = useRef(tableData);
  tableDataRef.current = tableData;
  const rowMetaRef = useRef(rowMeta);
  rowMetaRef.current = rowMeta;

  // hiddenRows 플러그인용 숨길 행 인덱스 계산 (OperatorItemSheet와 동일 패턴)
  const hiddenRowIndices = useMemo(() => {
    if (collapsedItems.size === 0) return [];

    const hidden = [];
    let currentCollapsedKey = null;

    baseTableData.forEach((row, index) => {
      const collapseKey = row._groupKey;

      // 제품 데이터 행에서 접힘 상태 확인
      if (row._rowType === ROW_TYPES.PRODUCT_DATA) {
        currentCollapsedKey = collapsedItems.has(collapseKey) ? collapseKey : null;
      }

      // 접힌 품목의 업로드 링크, 구매자 헤더, 구매자 데이터 행은 숨김
      if (currentCollapsedKey !== null &&
          row._groupKey === currentCollapsedKey &&
          (row._rowType === ROW_TYPES.UPLOAD_LINK_BAR ||
           row._rowType === ROW_TYPES.BUYER_HEADER ||
           row._rowType === ROW_TYPES.BUYER_DATA)) {
        hidden.push(index);
      }
    });

    return hidden;
  }, [baseTableData, collapsedItems]);

  // hiddenRowIndices를 ref로 유지 (afterLoadData에서 사용)
  const hiddenRowIndicesRef = useRef(hiddenRowIndices);
  hiddenRowIndicesRef.current = hiddenRowIndices;

  // collapsedItems 변경 시 hiddenRows 플러그인 수동 업데이트
  useEffect(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const hiddenRowsPlugin = hot.getPlugin('hiddenRows');
    if (!hiddenRowsPlugin) return;

    // 현재 숨겨진 행과 새로 숨길 행 비교
    const currentHidden = new Set(hiddenRowsPlugin.getHiddenRows());
    const newHidden = new Set(hiddenRowIndices);

    // 변경이 없으면 스킵
    if (currentHidden.size === newHidden.size &&
        [...currentHidden].every(r => newHidden.has(r))) {
      return;
    }

    // 차이점만 업데이트 (batch로 묶어서 한 번에 렌더링)
    hot.batch(() => {
      const rowsToShow = [...currentHidden].filter(r => !newHidden.has(r));
      const rowsToHide = [...newHidden].filter(r => !currentHidden.has(r));

      if (rowsToShow.length > 0) {
        hiddenRowsPlugin.showRows(rowsToShow);
      }
      if (rowsToHide.length > 0) {
        hiddenRowsPlugin.hideRows(rowsToHide);
      }
    });
    hot.render(); // 20차: 토글 아이콘(▶/▼) 업데이트를 위해 렌더링 트리거
  }, [hiddenRowIndices]);

  // collapsedItemsRef (렌더러에서 ref로 접근하기 위함)
  const collapsedItemsRef = useRef(collapsedItems);
  collapsedItemsRef.current = collapsedItems;

  // 접기/펼치기 토글
  const toggleCollapse = useCallback((groupKey) => {
    setCollapsedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  }, []);

  // 모든 그룹 키 목록
  const allGroupKeys = useMemo(() => {
    return Object.keys(groupedSlots);
  }, [groupedSlots]);

  // 모두 펼치기
  const expandAll = useCallback(() => {
    setCollapsedItems(new Set());
  }, []);

  // 모두 접기
  const collapseAll = useCallback(() => {
    setCollapsedItems(new Set(allGroupKeys));
  }, [allGroupKeys]);

  // 업로드 링크 복사 핸들러
  const handleCopyUploadLink = useCallback((token) => {
    if (!token) return;
    const uploadUrl = `${window.location.origin}/upload-slot/${token}`;
    navigator.clipboard.writeText(uploadUrl).then(() => {
      showSnackbar('업로드 링크가 복사되었습니다');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }, [showSnackbar]);

  // 금액 파싱 함수
  const parseAmount = useCallback((value) => {
    if (!value) return 0;
    if (typeof value === 'number') return Math.round(value);
    const numStr = String(value).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(numStr);
    return isNaN(parsed) ? 0 : Math.round(parsed);
  }, []);

  // 총 구매자 건수 계산 (원본 slots 데이터 기준 - 접기와 무관하게 전체 건수 표시)
  const totalDataCount = useMemo(() => {
    return slots.length;
  }, [slots]);

  // 금액 합계 계산 (원본 slots 데이터 기준)
  const totalAmount = useMemo(() => {
    return slots.reduce((sum, slot) => {
      const buyer = slot.buyer || {};
      return sum + parseAmount(buyer.amount);
    }, 0);
  }, [slots, parseAmount]);

  // 엑셀 다운로드 핸들러
  const handleDownloadExcel = useCallback(() => {
    const itemsMap = {};
    slots.forEach(slot => {
      if (!itemsMap[slot.item_id] && slot.item) {
        itemsMap[slot.item_id] = slot.item;
      }
    });

    const excelData = convertSlotsToExcelData(slots, itemsMap, userRole);
    const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'daily';
    downloadExcel(excelData, `${dateStr}_daily_work`, '날짜별작업');
    showSnackbar('엑셀 파일이 다운로드되었습니다');
  }, [slots, userRole, selectedDate]);

  // 19차 최적화: 렌더러 팩토리에 ref 전달 → 의존성 [] → cellsRenderer 안정화 → IME 깨짐 방지
  const productDataRenderer = useMemo(() =>
    createDailyProductDataRenderer(tableDataRef, collapsedItemsRef),
    []
  );

  const uploadLinkBarRenderer = useMemo(() =>
    createDailyUploadLinkBarRenderer(),
    []
  );

  const buyerDataRenderer = useMemo(() =>
    createDailyBuyerDataRenderer(tableDataRef, duplicateOrderNumbersRef),
    []
  );

  // 렌더러를 ref로 유지 (cellsRenderer 의존성 제거)
  const productDataRendererRef = useRef(productDataRenderer);
  productDataRendererRef.current = productDataRenderer;
  const uploadLinkBarRendererRef = useRef(uploadLinkBarRenderer);
  uploadLinkBarRendererRef.current = uploadLinkBarRenderer;
  const buyerDataRendererRef = useRef(buyerDataRenderer);
  buyerDataRendererRef.current = buyerDataRenderer;

  // cellsRenderer - 19차: 의존성 완전 제거
  const cellsRenderer = useCallback((row, col, prop) => {
    const cellProperties = {};
    const currentTableData = tableDataRef.current;

    if (row >= currentTableData.length) {
      return cellProperties;
    }

    const rowData = currentTableData[row];
    const rowType = rowData?._rowType;

    switch (rowType) {
      case ROW_TYPES.ITEM_SEPARATOR:
        cellProperties.readOnly = true;
        cellProperties.renderer = dailyItemSeparatorRenderer;
        break;

      case ROW_TYPES.PRODUCT_HEADER:
        cellProperties.readOnly = true;
        cellProperties.renderer = dailyProductHeaderRenderer;
        break;

      case ROW_TYPES.PRODUCT_DATA:
        cellProperties.readOnly = (col === 0 || col === 1 || col === 15);  // col0=토글, col1=연월브랜드-캠페인, col15=상세보기 버튼
        if (col === 1) {
          cellProperties.disableVisualSelection = true;
        }
        cellProperties.renderer = productDataRendererRef.current;
        break;

      case ROW_TYPES.UPLOAD_LINK_BAR:
        cellProperties.readOnly = true;
        cellProperties.renderer = uploadLinkBarRendererRef.current;
        // 중단 상태면 suspended 클래스 추가
        if (rowData._isSuspended) {
          cellProperties.className = 'suspended-row';
        }
        break;

      case ROW_TYPES.BUYER_HEADER:
        cellProperties.readOnly = true;
        cellProperties.renderer = dailyBuyerHeaderRenderer;
        // 중단 상태면 suspended 클래스 추가
        if (rowData._isSuspended) {
          cellProperties.className = 'suspended-row';
        }
        break;

      case ROW_TYPES.BUYER_DATA:
        const dayGroup = rowData._dayGroup || 1;
        const dayClass = dayGroup % 2 === 0 ? 'day-even' : 'day-odd';
        // 중단 상태면 suspended 클래스 추가
        cellProperties.className = rowData._isSuspended ? `${dayClass} suspended-row` : dayClass;

        // col17: 리뷰샷 (col16 -> col17로 시프트)
        if (col === 17) {
          cellProperties.readOnly = true;
        } else {
          cellProperties.readOnly = false;
        }

        cellProperties.renderer = buyerDataRendererRef.current;
        break;

      default:
        break;
    }

    return cellProperties;
  }, []);  // 19차: 의존성 완전 제거

  // 19차: hiddenRows prop 안정화
  // 21차: 초기값만 설정, 동적 변경은 useEffect에서 처리 (HotTable updateSettings 충돌 방지)
  const hiddenRowsConfig = useMemo(() => ({
    rows: [],
    indicators: false
  }), []);

  // 셀 변경 핸들러
  const handleAfterChange = useCallback((changes, source) => {
    if (!changes || source === 'loadData' || source === 'syncBuyerDate') return;

    // 성능 최적화: ref에서 최신값 읽기 (의존성 배열에서 제거하여 함수 재생성 방지)
    const currentRowMeta = rowMetaRef.current;
    const currentTableData = tableDataRef.current;

    const slotUpdates = { ...changedSlotsRef.current };
    const itemUpdates = { ...changedItemsRef.current };

    for (const [row, prop, oldValue, newValue] of changes) {
      if (oldValue === newValue) continue;

      const meta = currentRowMeta[row];
      if (!meta) continue;

      const { type, slotId, itemId, dayGroup } = meta;

      // 제품 데이터 행 수정
      if (type === ROW_TYPES.PRODUCT_DATA) {
        const PRODUCT_FIELD_MAP = {
          col2: 'date',
          col3: 'platform',
          col4: 'product_name',
          col5: 'purchase_option',
          col6: 'shipping_type',
          col7: 'keyword',
          col8: 'product_price',
          col9: 'total_purchase_count',
          col10: 'daily_purchase_count',
          col11: 'courier_name',
          col12: 'courier_service_yn',
          col13: 'product_url',
          col14: 'notes'
        };

        const apiField = PRODUCT_FIELD_MAP[prop];
        if (apiField) {
          const updateKey = `${itemId}_${dayGroup}`;
          if (!itemUpdates[updateKey]) {
            itemUpdates[updateKey] = { itemId, dayGroup };
          }
          itemUpdates[updateKey][apiField] = newValue ?? '';

          // 핵심: 날짜 필드(col2) 변경 시 같은 그룹의 구매자 행 날짜도 즉시 업데이트
          if (prop === 'col2' && apiField === 'date') {
            const newDate = newValue ?? '';
            const hot = hotRef.current?.hotInstance;
            if (hot) {
              const groupKey = `${itemId}_${dayGroup}`;
              // 성능 최적화: 변경할 셀들을 배열로 모아서 한 번에 업데이트
              const cellsToUpdate = [];
              currentTableData.forEach((buyerRow, buyerRowIndex) => {
                const buyerMeta = currentRowMeta[buyerRowIndex];
                if (buyerMeta?.type === ROW_TYPES.BUYER_DATA &&
                    `${buyerMeta.itemId}_${buyerMeta.dayGroup}` === groupKey) {
                  cellsToUpdate.push([buyerRowIndex, 2, newDate]);

                  // changedSlots에도 추가 (저장 시 DB 반영)
                  if (buyerMeta.slotId) {
                    if (!slotUpdates[buyerMeta.slotId]) {
                      slotUpdates[buyerMeta.slotId] = { id: buyerMeta.slotId };
                    }
                    slotUpdates[buyerMeta.slotId].date = newDate;
                  }
                }
              });
              // 성능 최적화: requestAnimationFrame로 비동기화 (IME 조합 중단 방지)
              if (cellsToUpdate.length > 0) {
                requestAnimationFrame(() => {
                  const hotInstance = hotRef.current?.hotInstance;
                  if (hotInstance) {
                    hotInstance.setDataAtCell(cellsToUpdate, 'syncBuyerDate');
                  }
                });
              }
            }
          }
        }
      }

      // 구매자 데이터 행 수정 (col6에 비고 추가, 이후 컬럼 +1 시프트)
      if (type === ROW_TYPES.BUYER_DATA && slotId) {
        const BUYER_FIELD_MAP = {
          col2: 'date',
          col6: 'buyer_notes',     // 비고 (신규 추가)
          col7: 'expected_buyer',  // col6 -> col7로 시프트
          col8: 'order_number',    // col7 -> col8로 시프트
          col9: 'buyer_name',      // col8 -> col9로 시프트
          col10: 'recipient_name', // col9 -> col10으로 시프트
          col11: 'user_id',        // col10 -> col11로 시프트
          col12: 'contact',        // col11 -> col12로 시프트
          col13: 'address',        // col12 -> col13으로 시프트
          col14: 'account_info',   // col13 -> col14로 시프트
          col15: 'amount',         // col14 -> col15로 시프트
          col16: 'tracking_number',// col15 -> col16으로 시프트
          col19: 'review_cost',    // col18 -> col19로 시프트
          col20: 'deposit_name'    // col19 -> col20으로 시프트
        };

        const apiField = BUYER_FIELD_MAP[prop];
        if (apiField) {
          if (!slotUpdates[slotId]) {
            slotUpdates[slotId] = { id: slotId };
          }
          slotUpdates[slotId][apiField] = newValue ?? '';
        }
      }
    }

    // 성능 최적화: ref 직접 할당 (setState 제거로 리렌더링 방지)
    changedSlotsRef.current = slotUpdates;
    changedItemsRef.current = itemUpdates;
    hasUnsavedChangesRef.current = true;
  }, []); // 성능 최적화: 의존성 빈배열 (rowMeta/tableData는 ref로 접근)

  // ========== 성능 최적화: HotTable inline 콜백용 ref (updateSettings 방지) ==========
  const toggleCollapseRef = useRef(toggleCollapse);
  toggleCollapseRef.current = toggleCollapse;
  const handleCopyUploadLinkRef = useRef(handleCopyUploadLink);
  handleCopyUploadLinkRef.current = handleCopyUploadLink;
  const handleAfterChangeRef = useRef(handleAfterChange);
  handleAfterChangeRef.current = handleAfterChange;
  const saveColumnWidthsRef = useRef(saveColumnWidths);
  saveColumnWidthsRef.current = saveColumnWidths;
  const showSnackbarRef = useRef(showSnackbar);
  showSnackbarRef.current = showSnackbar;
  const searchDateRef = useRef(searchDate);
  searchDateRef.current = searchDate;
  const viewAsUserIdRef = useRef(viewAsUserId);
  viewAsUserIdRef.current = viewAsUserId;

  // 저장 핸들러 - 캠페인 시트와 동일하게 스크롤 위치 유지, 새로고침 없음
  const handleSave = useCallback(async () => {
    // ref에서 변경사항 읽기 (성능 최적화)
    const currentChangedSlots = changedSlotsRef.current;
    const currentChangedItems = changedItemsRef.current;
    const hasSlotChanges = Object.keys(currentChangedSlots).length > 0;
    const hasItemChanges = Object.keys(currentChangedItems).length > 0;

    if (!hasSlotChanges && !hasItemChanges) {
      showSnackbar('변경된 내용이 없습니다.');
      return;
    }

    // 스크롤 위치 저장
    const hot = hotRef.current?.hotInstance;
    const scrollPosition = hot?.rootElement?.querySelector('.wtHolder')?.scrollTop || 0;
    const scrollLeft = hot?.rootElement?.querySelector('.wtHolder')?.scrollLeft || 0;

    // 중복 저장 방지 (성능 최적화: ref 사용)
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      // 슬롯 변경사항 저장
      if (hasSlotChanges) {
        const slotsToUpdate = Object.values(currentChangedSlots);
        await itemSlotService.updateSlotsBulk(slotsToUpdate);
      }

      // 품목 변경사항 저장 (day_group별 슬롯 업데이트)
      if (hasItemChanges) {
        const dayGroupUpdates = Object.values(currentChangedItems);
        for (const update of dayGroupUpdates) {
          const { itemId, dayGroup, ...productData } = update;
          const dayGroupSlots = slots
            .filter(s => s.item_id === itemId && s.day_group === dayGroup);
          const dayGroupSlotIds = dayGroupSlots.map(s => s.id);

          if (dayGroupSlotIds.length > 0) {
            // 제품 테이블의 date가 변경되면 해당 그룹의 모든 구매자 date도 같이 업데이트 (단방향 연동)
            const slotsToUpdateProduct = dayGroupSlotIds.map(id => {
              const slotData = { id, ...productData };
              // date가 변경되었다면 해당 슬롯의 buyer.date도 업데이트하도록 포함
              // (백엔드에서 슬롯 date 변경 시 buyer.date도 자동 업데이트)
              return slotData;
            });
            await itemSlotService.updateSlotsBulk(slotsToUpdateProduct);
          }
        }
      }

      // 로컬 slots 상태 업데이트 (DB 재조회 대신 직접 업데이트) - 캠페인 시트와 동일한 방식
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

      // ref 초기화 (성능 최적화: state 제거)
      changedSlotsRef.current = {};
      changedItemsRef.current = {};
      hasUnsavedChangesRef.current = false;

      // 모든 캐시 무효화 (다른 시트와 동기화를 위해)
      slotsCache.clear();

      showSnackbar('저장되었습니다.');

      // 스크롤 위치 복원 (다음 렌더링 후)
      setTimeout(() => {
        const wtHolder = hot?.rootElement?.querySelector('.wtHolder');
        if (wtHolder) {
          wtHolder.scrollTop = scrollPosition;
          wtHolder.scrollLeft = scrollLeft;
        }
      }, 0);

    } catch (error) {
      console.error('Save error:', error);
      // 저장 실패 시 변경사항 ref 초기화 (다음 저장에 영향 주지 않도록)
      changedSlotsRef.current = {};
      changedItemsRef.current = {};
      const serverMessage = error.response?.data?.message || error.response?.data?.error || error.message;
      showSnackbar(`저장 실패: ${serverMessage}`);
    } finally {
      savingRef.current = false;
    }
  }, [slots, searchDate, viewAsUserId, showSnackbar]);

  // Ctrl+S 키보드 단축키로 저장 (성능 최적화: ref 기반으로 의존성 최소화)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (Object.keys(changedSlotsRef.current).length > 0 || Object.keys(changedItemsRef.current).length > 0) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // 리뷰샷 삭제 핸들러
  const handleDeleteReviewConfirm = useCallback(async () => {
    const { images, buyer } = deleteReviewPopup;
    if (!images || images.length === 0) return;

    setDeletingReview(true);
    try {
      // 모든 이미지 삭제
      for (const image of images) {
        await imageService.deleteImage(image.id);
      }

      // 삭제 팝업 닫기
      setDeleteReviewPopup({ open: false, images: [], buyer: null, rowIndex: null });
      showSnackbar('리뷰샷이 삭제되었습니다');

      // 캐시 무효화 및 데이터 새로고침
      const formattedDate = format(searchDate, 'yyyy-MM-dd');
      const cacheKey = `daily_${formattedDate}_${viewAsUserId || ''}`;
      slotsCache.delete(cacheKey);
      loadSlots(true);
    } catch (error) {
      console.error('Delete review failed:', error);
      const errorMessage = error.response?.data?.message || error.message || '알 수 없는 오류';
      showSnackbar('리뷰샷 삭제 실패: ' + errorMessage);
    } finally {
      setDeletingReview(false);
    }
  }, [deleteReviewPopup, searchDate, viewAsUserId, loadSlots, showSnackbar]);

  // 컬럼 설정 (23개 컬럼 - col6에 비고 추가)
  const columns = useMemo(() => {
    const cols = Array(22).fill(null).map((_, index) => ({
      data: `col${index}`,
      width: columnWidths[index] || 100
    }));
    // 맨 오른쪽에 여백 컬럼 추가 (컬럼 너비 조절 용이하게)
    cols.push({
      data: 'col22',
      width: 50,
      readOnly: true
    });
    return cols;
  }, [columnWidths]);

  // 배정된 품목 수 계산 (day_group별 고유 품목)
  const uniqueItemCount = useMemo(() => {
    const uniqueItems = new Set();
    slots.forEach(slot => {
      uniqueItems.add(`${slot.item_id}_${slot.day_group}`);
    });
    return uniqueItems.size;
  }, [slots]);

  // ========== 성능 최적화: HotTable inline props → useCallback/useMemo (updateSettings 방지, IME 깨짐 방지) ==========

  // colWidths - 안정화
  const stableColWidths = useMemo(() => {
    return columnWidths.length > 0 ? columnWidths : undefined;
  }, [columnWidths]);

  // afterChange - IME 조합 중 건너뛰기 래퍼
  const stableAfterChange = useCallback((changes, source) => {
    if (isComposingRef.current) return;  // IME 조합 중에는 건너뛰기
    handleAfterChangeRef.current(changes, source);
  }, []);

  // afterLoadData - 데이터 로드 직후 hiddenRows 즉시 적용 (깜빡임 방지)
  const stableAfterLoadData = useCallback((sourceData, initialLoad) => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const hiddenRowsPlugin = hot.getPlugin('hiddenRows');
    if (!hiddenRowsPlugin) return;

    const indices = hiddenRowIndicesRef.current;
    const currentHidden = new Set(hiddenRowsPlugin.getHiddenRows());
    const newHidden = new Set(indices);

    const rowsToShow = [...currentHidden].filter(r => !newHidden.has(r));
    const rowsToHide = [...newHidden].filter(r => !currentHidden.has(r));

    if (rowsToShow.length > 0 || rowsToHide.length > 0) {
      hot.batch(() => {
        if (rowsToShow.length > 0) {
          hiddenRowsPlugin.showRows(rowsToShow);
        }
        if (rowsToHide.length > 0) {
          hiddenRowsPlugin.hideRows(rowsToHide);
        }
      });
    }
  }, []);

  // afterOnCellMouseUp - 셀 클릭 이벤트 핸들러
  const stableAfterOnCellMouseUp = useCallback((event, coords) => {
    const rowData = tableDataRef.current[coords.row];
    if (!rowData) return;

    // 제품 데이터 행 col0 클릭 - 접기/펼치기
    if (rowData._rowType === ROW_TYPES.PRODUCT_DATA && coords.col === 0) {
      const groupKey = rowData._groupKey;
      if (groupKey) {
        toggleCollapseRef.current(groupKey);
      }
      return;
    }

    // 제품 데이터 행 col15 클릭 - 상세보기 팝업
    if (rowData._rowType === ROW_TYPES.PRODUCT_DATA && coords.col === 15) {
      setProductDetailPopup({
        open: true,
        item: rowData._item,
        productInfo: rowData._productInfo,
        dayGroup: rowData._dayGroup
      });
      return;
    }

    // 업로드 링크 바 클릭
    if (rowData._rowType === ROW_TYPES.UPLOAD_LINK_BAR) {
      const token = rowData._uploadToken;
      if (token) {
        handleCopyUploadLinkRef.current(token);
      }
      return;
    }

    // 리뷰 보기 링크 클릭
    const target = event.target;
    if (target.tagName === 'A' && target.classList.contains('review-link')) {
      event.preventDefault();
      const images = rowData._reviewImages || [];
      if (images.length > 0) {
        setImagePopup({
          open: true,
          images: images,
          currentIndex: 0,
          buyer: rowData._buyer || null
        });
      }
    }

    // 리뷰 삭제 링크 클릭
    if (target.tagName === 'A' && target.classList.contains('review-delete-link')) {
      event.preventDefault();
      const images = rowData._reviewImages || [];
      if (images.length > 0) {
        setDeleteReviewPopup({
          open: true,
          images: images,
          buyer: rowData._buyer || null,
          rowIndex: coords.row
        });
      }
    }
  }, []);

  // afterColumnResize - 컬럼 너비 변경 시 localStorage 저장
  const stableAfterColumnResize = useCallback((currentColumn, newSize) => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    const widths = [];
    for (let i = 0; i < hot.countCols(); i++) {
      widths.push(hot.getColWidth(i));
    }
    saveColumnWidthsRef.current(widths);
  }, []);

  // beforePaste - 슬래시 파싱 붙여넣기
  const stableBeforePaste = useCallback((data, coords) => {
    // DailyWorkSheet에서 주문번호 컬럼은 col8 (col7 -> col8로 시프트됨)
    const startCol = coords[0].startCol;
    if (startCol !== 8) return; // 다른 컬럼이면 기본 동작

    // 붙여넣기 대상 행이 구매자 데이터 행인지 확인
    const startRow = coords[0].startRow;
    const currentTableData = tableDataRef.current;
    const targetRowData = currentTableData[startRow];
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
        // DailyWorkSheet 컬럼 매핑: col8~col15 (col6에 비고 추가로 +1 시프트)
        // col8: 주문번호, col9: 구매자, col10: 수취인, col11: 아이디,
        // col12: 연락처, col13: 주소, col14: 계좌, col15: 금액
        newData.push([
          parts[0]?.trim() || '',  // col8: 주문번호
          parts[1]?.trim() || '',  // col9: 구매자
          parts[2]?.trim() || '',  // col10: 수취인
          parts[3]?.trim() || '',  // col11: 아이디
          parts[4]?.trim() || '',  // col12: 연락처
          parts[5]?.trim() || '',  // col13: 주소
          parts[6]?.trim() || '',  // col14: 계좌
          parts[7]?.trim() || ''   // col15: 금액
        ]);
      }
    }

    if (newData.length === 0) return;

    // 원본 data 배열 수정 (Handsontable이 이 데이터로 붙여넣기)
    data.length = 0;
    newData.forEach(row => data.push(row));
  }, []);

  // contextMenu - 우클릭 메뉴 설정
  const stableContextMenu = useMemo(() => ({
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

          const meta = rowMetaRef.current[row];
          // 구매자 데이터 행이나 구매자 헤더 행이 아니면 무시
          if (!meta || (meta.type !== ROW_TYPES.BUYER_DATA && meta.type !== ROW_TYPES.BUYER_HEADER)) {
            alert('구매자 행에서 우클릭하여 행을 추가해주세요.');
            return;
          }

          const itemId = meta.itemId;
          const dayGroup = meta.dayGroup;

          try {
            const response = await itemSlotService.createSlot(itemId, dayGroup);
            const newSlot = response.data;

            // 로컬 상태에 새 슬롯 추가
            setSlots(prevSlots => [...prevSlots, newSlot]);

            // 캐시 무효화
            const formattedDate = format(searchDateRef.current, 'yyyy-MM-dd');
            const cacheKey = `daily_${formattedDate}_${viewAsUserIdRef.current || ''}`;
            slotsCache.delete(cacheKey);

            showSnackbarRef.current('행이 추가되었습니다');
          } catch (error) {
            console.error('Failed to add row:', error);
            showSnackbarRef.current('행 추가 실패: ' + (error.response?.data?.message || error.message));
          }
        }
      },
      delete_rows: {
        name: '🗑️ 선택한 행 삭제',
        callback: async function(key, selection) {
          const selectedRows = new Set();
          selection.forEach(sel => {
            for (let r = sel.start.row; r <= sel.end.row; r++) {
              selectedRows.add(r);
            }
          });

          const slotIds = [];
          selectedRows.forEach(row => {
            const meta = rowMetaRef.current[row];
            if (meta?.type === ROW_TYPES.BUYER_DATA && meta.slotId) {
              slotIds.push(meta.slotId);
            }
          });

          if (slotIds.length === 0) {
            alert('삭제할 구매자 행을 선택해주세요.');
            return;
          }

          if (!window.confirm(`선택한 ${slotIds.length}개 행을 삭제하시겠습니까?\n\n⚠️ 해당 행의 구매자 정보가 삭제됩니다.`)) {
            return;
          }

          try {
            await itemSlotService.deleteSlotsBulk(slotIds);

            // 로컬 상태에서 삭제된 슬롯 제거
            setSlots(prevSlots => prevSlots.filter(s => !slotIds.includes(s.id)));

            // 캐시 무효화
            const formattedDate = format(searchDateRef.current, 'yyyy-MM-dd');
            const cacheKey = `daily_${formattedDate}_${viewAsUserIdRef.current || ''}`;
            slotsCache.delete(cacheKey);

            showSnackbarRef.current(`${slotIds.length}개 행이 삭제되었습니다`);
          } catch (error) {
            console.error('Failed to delete rows:', error);
            showSnackbarRef.current('행 삭제 실패: ' + (error.response?.data?.message || error.message));
          }
        }
      }
    }
  }), []);

  // afterSelection - 선택 영역 이벤트
  const stableAfterSelection = useCallback((row, column, row2, column2, preventScrolling) => {
    // 마우스 클릭 시에는 스크롤 방지, 키보드 이동 시에는 스크롤 허용
    if (hotRef.current?.hotInstance?._isKeyboardNav) {
      preventScrolling.value = false;
      hotRef.current.hotInstance._isKeyboardNav = false;
    } else {
      preventScrolling.value = true;
    }

    // 선택된 셀 개수 계산 및 DOM 직접 업데이트 (리렌더링 방지)
    const rowCount = Math.abs(row2 - row) + 1;
    const colCount = Math.abs(column2 - column) + 1;
    const cellCount = rowCount * colCount;
    if (selectedCellCountRef.current) {
      if (cellCount > 1) {
        selectedCellCountRef.current.textContent = `선택: ${cellCount}셀 (${rowCount}행 × ${colCount}열)`;
        selectedCellCountRef.current.style.display = 'inline';
      } else {
        selectedCellCountRef.current.style.display = 'none';
      }
    }
  }, []);

  // afterDeselect - 선택 해제 이벤트
  const stableAfterDeselect = useCallback(() => {
    // 선택 해제 시 셀 개수 숨김
    if (selectedCellCountRef.current) {
      selectedCellCountRef.current.style.display = 'none';
    }
  }, []);

  // beforeKeyDown - 키보드 이벤트
  const stableBeforeKeyDown = useCallback((event) => {
    // 방향키 입력 시 플래그 설정
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
    if (arrowKeys.includes(event.key)) {
      if (hotRef.current?.hotInstance) {
        hotRef.current.hotInstance._isKeyboardNav = true;
      }
    }
  }, []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 날짜 헤더 - 캠페인 시트와 동일한 구조 */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 0.5,
        px: 1,
        flexShrink: 0
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* 날짜 선택 */}
          <IconButton
            size="small"
            onClick={handlePreviousDate}
            disabled={!selectedDate}
            title="이전 날짜"
          >
            <ChevronLeftIcon />
          </IconButton>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <DatePicker
              value={selectedDate}
              onChange={(newValue) => setSelectedDate(newValue)}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: {
                    width: 160,
                    '& .MuiOutlinedInput-root': {
                      height: 32
                    },
                    '& .MuiOutlinedInput-input': {
                      py: 0.5,
                      fontSize: '0.85rem'
                    }
                  }
                }
              }}
            />
          </LocalizationProvider>
          <IconButton
            size="small"
            onClick={handleNextDate}
            disabled={!selectedDate}
            title="다음 날짜"
          >
            <ChevronRightIcon />
          </IconButton>
          <Button
            variant="outlined"
            size="small"
            onClick={handleSearch}
            disabled={!selectedDate || loading}
            sx={{ fontSize: '0.75rem', px: 1.5, py: 0.5 }}
          >
            {loading ? '조회 중...' : '조회'}
          </Button>

          {/* 날짜 표시 및 품목 수 - 캠페인명처럼 표시 */}
          {searchDate && (
            <>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ ml: 2 }}>
                {format(searchDate, 'yyyy.MM.dd')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                배정 품목 {uniqueItemCount}개
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {/* 통계 바 - 캠페인 시트와 동일한 스타일 */}
      <Box sx={{
        mb: 0.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: '#2c387e',
        color: 'white',
        px: 2,
        py: 1,
        minHeight: 48,
        borderRadius: '4px 4px 0 0'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {/* 건수 및 금액 */}
          <Box sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
            전체 {totalDataCount}건
          </Box>
          <Box sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
            금액 합계: {totalAmount.toLocaleString()}원
          </Box>

          {/* 펼치기/접기 버튼 */}
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
          {/* 선택된 셀 개수 표시 */}
          <Box
            component="span"
            ref={selectedCellCountRef}
            sx={{
              display: 'none',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              color: '#ffeb3b',
              bgcolor: 'rgba(0,0,0,0.3)',
              px: 1,
              py: 0.3,
              borderRadius: 1
            }}
          />
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

        {/* 저장 버튼 (성능 최적화: 항상 표시, 조건부 렌더링 제거) */}
        <Button
          variant="contained"
          color="success"
          size="small"
          onClick={handleSave}
          sx={{ bgcolor: '#4caf50', minWidth: 0, px: 1.5, py: 0.3, fontSize: '0.75rem' }}
        >
          저장
        </Button>
      </Box>

      {/* 데이터 영역 */}
      <Paper sx={{
        '& .handsontable': {
          fontSize: '12px'
        },
        '& .item-separator-row': {
          backgroundColor: '#1565c0 !important',
          height: '8px !important',
          padding: '0 !important',
          border: 'none !important'
        },
        '& .product-header-row': {
          backgroundColor: '#e0e0e0 !important',
          fontWeight: 'bold !important',
          textAlign: 'center'
        },
        '& .product-data-row': {
          backgroundColor: '#fff8e1 !important'
        },
        '& .upload-link-bar': {
          backgroundColor: '#424242 !important',
          color: 'white !important',
          cursor: 'pointer'
        },
        '& .buyer-header-row': {
          backgroundColor: '#f5f5f5 !important',
          fontWeight: 'bold !important',
          textAlign: 'center'
        },
        '& .day-even': {
          backgroundColor: '#e0f2f1 !important'
        },
        '& .day-odd': {
          backgroundColor: '#fff !important'
        },
        // 중단된 day_group 배경 (빨간색)
        '& .suspended-row': {
          backgroundColor: '#ffcdd2 !important'
        },
        '& .duplicate-order': {
          backgroundColor: '#ffcdd2 !important'
        },
        '& .handsontable td': {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '0'
        }
      }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <CircularProgress />
          </Box>
        ) : !searchDate ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Typography color="text.secondary">날짜를 선택하고 조회 버튼을 클릭하세요.</Typography>
          </Box>
        ) : slots.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Typography color="text.secondary">해당 날짜에 데이터가 없습니다.</Typography>
          </Box>
        ) : tableData.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Typography color="text.secondary">슬롯에 연결된 품목 정보가 없습니다.</Typography>
          </Box>
        ) : (
          <HotTable
            ref={hotRef}
            data={tableData}
            columns={columns}
            colHeaders={COL_HEADERS}
            colWidths={stableColWidths}
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
            hiddenRows={hiddenRowsConfig}
            cells={cellsRenderer}
            afterChange={stableAfterChange}
            afterLoadData={stableAfterLoadData}
            afterOnCellMouseUp={stableAfterOnCellMouseUp}
            afterColumnResize={stableAfterColumnResize}
            beforePaste={stableBeforePaste}
            contextMenu={stableContextMenu}
            copyPaste={true}
            undo={true}
            outsideClickDeselects={false}
            rowHeights={23}
            autoScrollOnSelection={false}
            afterSelection={stableAfterSelection}
            afterDeselect={stableAfterDeselect}
            beforeKeyDown={stableBeforeKeyDown}
          />
        )}
      </Paper>

      {/* 이미지 스와이프 뷰어 */}
      <ImageSwipeViewer
        open={imagePopup.open}
        onClose={() => setImagePopup({ open: false, images: [], currentIndex: 0, buyer: null })}
        images={imagePopup.images}
        initialIndex={imagePopup.currentIndex}
        buyerInfo={imagePopup.buyer}
      />

      {/* 리뷰샷 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteReviewPopup.open}
        onClose={() => setDeleteReviewPopup({ open: false, images: [], buyer: null, rowIndex: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#d32f2f', color: 'white', fontWeight: 'bold' }}>
          리뷰샷 삭제
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography>
            {deleteReviewPopup.buyer?.buyer_name || '해당 구매자'}의 리뷰샷 {deleteReviewPopup.images?.length || 0}개를 삭제하시겠습니까?
          </Typography>
          <Typography sx={{ mt: 1, color: '#d32f2f', fontSize: '0.85rem' }}>
            ※ 삭제 시 리뷰 제출 상태가 초기화됩니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setDeleteReviewPopup({ open: false, images: [], buyer: null, rowIndex: null })}
            disabled={deletingReview}
          >
            취소
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteReviewConfirm}
            disabled={deletingReview}
            startIcon={deletingReview ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {deletingReview ? '삭제 중...' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 제품 상세 정보 팝업 */}
      <Dialog
        open={productDetailPopup.open}
        onClose={(event, reason) => { if (reason !== 'backdropClick') setProductDetailPopup({ open: false, item: null, productInfo: null, dayGroup: null }); }}
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
            onClick={() => setProductDetailPopup({ open: false, item: null, productInfo: null, dayGroup: null })}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {(productDetailPopup.item || productDetailPopup.productInfo) && (
            <Box>
              {(() => {
                const productInfo = productDetailPopup.productInfo || {};
                const item = productDetailPopup.item || {};
                // productInfo 값이 있으면 productInfo, 없으면 item 값
                const getValue = (field) => productInfo[field] || item[field] || '-';

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
            onClick={() => setProductDetailPopup({ open: false, item: null, productInfo: null, dayGroup: null })}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 (성능 최적화: ref 기반 DOM 직접 조작 + CSS animation) */}
      <Box
        ref={snackbarRef}
        sx={{
          visibility: 'hidden',
          opacity: 0,
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          '@keyframes snackbarFadeOut': {
            '0%': { opacity: 1, visibility: 'visible' },
            '100%': { opacity: 0, visibility: 'hidden' }
          },
          '& .snackbar-content': {
            backgroundColor: '#323232',
            color: 'white',
            padding: '10px 24px',
            borderRadius: '4px',
            fontSize: '14px',
            boxShadow: '0 3px 5px -1px rgba(0,0,0,.2), 0 6px 10px 0 rgba(0,0,0,.14), 0 1px 18px 0 rgba(0,0,0,.12)'
          }
        }}
      >
        <Box className="snackbar-content">
          <span className="snackbar-message"></span>
        </Box>
      </Box>
    </Box>
  );
}

// React.memo로 감싸서 부모 리렌더링 시 불필요한 리렌더링 방지
// userRole, viewAsUserId가 변경되지 않으면 시트가 리렌더링되지 않음
const DailyWorkSheet = React.memo(DailyWorkSheetInner, (prevProps, nextProps) => {
  // true 반환 = 리렌더링 하지 않음, false 반환 = 리렌더링 함
  return (
    prevProps.userRole === nextProps.userRole &&
    prevProps.viewAsUserId === nextProps.viewAsUserId
  );
});

export default DailyWorkSheet;
