import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, IconButton, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
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
import itemService from '../../services/itemService';
import imageService from '../../services/imageService';

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

const createDailyProductDataRenderer = (tableData, collapsedItems) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableData[r];
    td.className = 'product-data-row';
    td.style.backgroundColor = '#fff8e1';
    td.style.fontSize = '11px';

    if (prop === 'col0') {
      const groupKey = rowData._groupKey;
      const isCollapsed = collapsedItems.has(groupKey);
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
    } else if (prop === 'col12' && value) {
      // URL 컬럼
      const url = value.startsWith('http') ? value : `https://${value}`;
      td.style.whiteSpace = 'nowrap';
      td.style.overflow = 'hidden';
      td.style.textOverflow = 'ellipsis';
      td.title = value;
      td.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #1976d2; text-decoration: underline;">${value}</a>`;
    } else if (prop === 'col14') {
      // 상세보기 버튼
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

const createDailyBuyerDataRenderer = (tableData, duplicateOrderNumbers, statusLabels) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableData[r];
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
    } else if (prop === 'col4' || prop === 'col5') {
      td.textContent = value ?? '';
      td.style.color = '#555';
    } else if (prop === 'col7') {
      td.textContent = value ?? '';
      if (value && duplicateOrderNumbers.has(value)) {
        td.classList.add('duplicate-order');
        td.style.backgroundColor = '#ffcdd2';
      }
    } else if (prop === 'col14' && value) {
      const numValue = parseInt(String(value).replace(/[^0-9]/g, ''));
      td.textContent = numValue ? numValue.toLocaleString() : value;
    } else if (prop === 'col16') {
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
    } else if (prop === 'col17') {
      const status = rowData._calculatedStatus;
      const label = statusLabels[status] || status;

      if (status === '-') {
        td.innerHTML = '<span style="color: #999;">-</span>';
      } else if (status === 'completed') {
        td.innerHTML = `<span style="background-color: #e8f5e9; color: #388e3c; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: bold;">✓ ${label}</span>`;
      } else {
        td.innerHTML = `<span style="background-color: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 10px; font-size: 10px;">${label}</span>`;
      }
      td.style.textAlign = 'center';
    } else if (prop === 'col20') {
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

// 기본 컬럼 너비 - 21개 컬럼
const DEFAULT_COLUMN_WIDTHS = [30, 180, 70, 60, 120, 80, 50, 80, 60, 50, 50, 50, 80, 30, 80, 100, 80, 50, 60, 70, 70];

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

  // 변경된 슬롯들 추적
  const [changedSlots, setChangedSlots] = useState({});
  const changedSlotsRef = useRef(changedSlots);
  changedSlotsRef.current = changedSlots;

  // 변경된 아이템들 추적 (제품 정보 수정용)
  const [changedItems, setChangedItems] = useState({});
  const changedItemsRef = useRef(changedItems);
  changedItemsRef.current = changedItems;

  // 스낵바 상태
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // 저장 중 상태
  const [saving, setSaving] = useState(false);

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
    if (saved && saved.length === DEFAULT_COLUMN_WIDTHS.length) {
      setColumnWidths(saved);
    }
  }, [getSavedColumnWidths]);

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
      setChangedSlots({});
      setChangedItems({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await itemSlotService.getSlotsByDate(formattedDate, viewAsUserId);
      if (response.success) {
        const newSlots = response.data || [];
        setSlots(newSlots);
        setChangedSlots({});
        setChangedItems({});

        // 캐시에 저장
        slotsCache.set(cacheKey, { slots: newSlots, timestamp: Date.now() });
      } else {
        setSnackbar({ open: true, message: response.message || '데이터 조회 실패', severity: 'error' });
      }
    } catch (error) {
      console.error('Load slots error:', error);
      setSnackbar({ open: true, message: '데이터를 불러오는데 실패했습니다.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [searchDate, viewAsUserId]);

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

  // searchDate 변경 시 데이터 로드
  useEffect(() => {
    if (searchDate) {
      loadSlots();
    }
  }, [searchDate, loadSlots]);

  // Ctrl+S 키보드 단축키로 저장
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (Object.keys(changedSlots).length > 0 || Object.keys(changedItems).length > 0) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changedSlots, changedItems]);

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
  }, [slots]);

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

  // 상태 옵션
  const statusLabels = { active: '진행', completed: '완료', cancelled: '취소' };

  // Handsontable 데이터 생성
  const { tableData, rowMeta } = useMemo(() => {
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
      const isCollapsed = collapsedItems.has(groupKey);

      // 연월브랜드-캠페인 표시 문자열
      const mbCampaignLabel = `${monthlyBrand?.name || '연월브랜드'} - ${campaign?.name || '캠페인'}`;

      // 슬롯/아이템에서 제품 정보 병합 (슬롯 우선)
      const firstSlot = groupData.slots[0] || {};
      const productInfo = {
        product_name: firstSlot.product_name || item.product_name || '',
        platform: firstSlot.platform || item.platform || '',
        shipping_type: firstSlot.shipping_type || item.shipping_type || '',
        keyword: firstSlot.keyword || item.keyword || '',
        product_price: firstSlot.product_price || item.product_price || '',
        total_purchase_count: firstSlot.total_purchase_count || item.total_purchase_count || '',
        daily_purchase_count: firstSlot.daily_purchase_count || item.daily_purchase_count || '',
        purchase_option: firstSlot.purchase_option || item.purchase_option || '',
        courier_service_yn: firstSlot.courier_service_yn || item.courier_service_yn || '',
        product_url: firstSlot.product_url || item.product_url || '',
        notes: firstSlot.notes || item.notes || '',
        date: firstSlot.date || item.date || ''
      };

      // 품목 구분선 (첫 번째 그룹 제외)
      if (groupIndex > 0) {
        data.push({
          _rowType: ROW_TYPES.ITEM_SEPARATOR,
          col0: '', col1: '', col2: '', col3: '', col4: '', col5: '', col6: '',
          col7: '', col8: '', col9: '', col10: '', col11: '', col12: '', col13: '',
          col14: '', col15: '', col16: '', col17: '', col18: '', col19: '', col20: ''
        });
        meta.push({ type: ROW_TYPES.ITEM_SEPARATOR });
      }

      // 제품 정보 헤더 행
      data.push({
        _rowType: ROW_TYPES.PRODUCT_HEADER,
        col0: '', col1: '연월브랜드-캠페인', col2: '날짜', col3: '플랫폼', col4: '제품명', col5: '옵션', col6: '출고', col7: '키워드',
        col8: '가격', col9: '총건수', col10: '일건수', col11: '택배', col12: 'URL', col13: '특이사항', col14: '상세',
        col15: '', col16: '', col17: '', col18: '', col19: '', col20: ''
      });
      meta.push({ type: ROW_TYPES.PRODUCT_HEADER, itemId: item.id, dayGroup });

      // 제품 정보 데이터 행
      data.push({
        _rowType: ROW_TYPES.PRODUCT_DATA,
        _itemId: item.id,
        _dayGroup: dayGroup,
        _groupKey: groupKey,
        _uploadToken: uploadLinkToken,
        _item: item,
        _productInfo: productInfo,
        col0: isCollapsed ? '▶' : '▼',
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
        col11: productInfo.courier_service_yn,
        col12: productInfo.product_url,
        col13: productInfo.notes,
        col14: '📋',
        col15: '', col16: '', col17: '', col18: '', col19: '', col20: ''
      });
      meta.push({ type: ROW_TYPES.PRODUCT_DATA, itemId: item.id, dayGroup, uploadLinkToken, groupKey });

      // 접힌 상태가 아니면 구매자 행 표시
      if (!isCollapsed) {
        // 업로드 링크 바
        data.push({
          _rowType: ROW_TYPES.UPLOAD_LINK_BAR,
          _uploadToken: uploadLinkToken,
          col0: '', col1: '📷 업로드 링크 복사',
          col2: '', col3: '', col4: '', col5: '', col6: '', col7: '', col8: '', col9: '',
          col10: '', col11: '', col12: '', col13: '', col14: '', col15: '', col16: '', col17: '', col18: '', col19: '', col20: ''
        });
        meta.push({ type: ROW_TYPES.UPLOAD_LINK_BAR, uploadLinkToken });

        // 구매자 헤더 행
        data.push({
          _rowType: ROW_TYPES.BUYER_HEADER,
          col0: '', col1: '', col2: '날짜', col3: '순번', col4: '제품명', col5: '옵션', col6: '예상구매자',
          col7: '주문번호', col8: '구매자', col9: '수취인', col10: '아이디', col11: '연락처', col12: '주소',
          col13: '계좌', col14: '금액', col15: '송장번호', col16: '리뷰샷', col17: '상태', col18: '리뷰비',
          col19: '입금명', col20: '입금여부'
        });
        meta.push({ type: ROW_TYPES.BUYER_HEADER, itemId: item.id, dayGroup });

        // 구매자 데이터 행
        groupData.slots.forEach((slot, slotIndex) => {
          const buyer = slot.buyer || {};
          const reviewImage = buyer.images && buyer.images.length > 0 ? buyer.images[0] : null;
          const hasBuyerData = buyer.order_number || buyer.buyer_name || buyer.recipient_name ||
                               buyer.user_id || buyer.contact || buyer.address ||
                               buyer.account_info || buyer.amount;
          const hasReviewImage = reviewImage?.s3_url;
          const calculatedStatus = hasReviewImage ? 'completed' : (hasBuyerData ? 'active' : '-');

          data.push({
            _rowType: ROW_TYPES.BUYER_DATA,
            _slotId: slot.id,
            _itemId: item.id,
            _dayGroup: dayGroup,
            _buyerId: buyer.id || null,
            _buyer: buyer,
            _reviewImages: buyer.images || [],
            _reviewImageUrl: reviewImage?.s3_url || '',
            _hasBuyerData: !!hasBuyerData,
            _calculatedStatus: calculatedStatus,
            col0: '',
            col1: '',
            col2: slot.date || '',
            col3: slotIndex + 1,
            col4: slot.product_name || item.product_name || '',
            col5: slot.purchase_option || '',
            col6: slot.expected_buyer || '',
            col7: buyer.order_number || '',
            col8: buyer.buyer_name || '',
            col9: buyer.recipient_name || '',
            col10: buyer.user_id || '',
            col11: buyer.contact || '',
            col12: buyer.address || '',
            col13: buyer.account_info || '',
            col14: buyer.amount || '',
            col15: buyer.tracking_number || '',
            col16: reviewImage?.s3_url || '',
            col17: calculatedStatus,
            col18: slot.review_cost || '',
            col19: buyer.deposit_name || '',
            col20: buyer.payment_confirmed_at || ''
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
      }
    });

    return { tableData: data, rowMeta: meta };
  }, [groupedSlots, collapsedItems]);

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
      setSnackbar({ open: true, message: '업로드 링크가 복사되었습니다', severity: 'success' });
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }, []);

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

  // 성능 최적화: 동적 렌더러 함수들을 useMemo로 캐싱
  const productDataRenderer = useMemo(() =>
    createDailyProductDataRenderer(tableData, collapsedItems),
    [tableData, collapsedItems]
  );

  const uploadLinkBarRenderer = useMemo(() =>
    createDailyUploadLinkBarRenderer(),
    []
  );

  const buyerDataRenderer = useMemo(() =>
    createDailyBuyerDataRenderer(tableData, duplicateOrderNumbers, statusLabels),
    [tableData, duplicateOrderNumbers, statusLabels]
  );

  // cellsRenderer - 최적화: 외부 정의 렌더러 사용
  const cellsRenderer = useCallback((row, col, prop) => {
    const cellProperties = {};

    if (row >= tableData.length) {
      return cellProperties;
    }

    const rowData = tableData[row];
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
        cellProperties.readOnly = (col === 0 || col === 1 || col === 14);
        if (col === 1) {
          cellProperties.disableVisualSelection = true;
        }
        cellProperties.renderer = productDataRenderer;
        break;

      case ROW_TYPES.UPLOAD_LINK_BAR:
        cellProperties.readOnly = true;
        cellProperties.renderer = uploadLinkBarRenderer;
        break;

      case ROW_TYPES.BUYER_HEADER:
        cellProperties.readOnly = true;
        cellProperties.renderer = dailyBuyerHeaderRenderer;
        break;

      case ROW_TYPES.BUYER_DATA:
        const dayGroup = rowData._dayGroup || 1;
        const dayClass = dayGroup % 2 === 0 ? 'day-even' : 'day-odd';
        cellProperties.className = dayClass;

        if (col === 16) {
          cellProperties.readOnly = true;
        } else {
          cellProperties.readOnly = false;
        }

        cellProperties.renderer = buyerDataRenderer;
        break;

      default:
        break;
    }

    return cellProperties;
  }, [tableData, productDataRenderer, uploadLinkBarRenderer, buyerDataRenderer]);

  // 셀 변경 핸들러
  const handleAfterChange = useCallback((changes, source) => {
    if (!changes || source === 'loadData') return;

    const slotUpdates = { ...changedSlotsRef.current };
    const itemUpdates = { ...changedItemsRef.current };

    for (const [row, prop, oldValue, newValue] of changes) {
      if (oldValue === newValue) continue;

      const meta = rowMeta[row];
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
          col11: 'courier_service_yn',
          col12: 'product_url',
          col14: 'notes'
        };

        const apiField = PRODUCT_FIELD_MAP[prop];
        if (apiField) {
          const updateKey = `${itemId}_${dayGroup}`;
          if (!itemUpdates[updateKey]) {
            itemUpdates[updateKey] = { itemId, dayGroup };
          }
          itemUpdates[updateKey][apiField] = newValue ?? '';
        }
      }

      // 구매자 데이터 행 수정
      if (type === ROW_TYPES.BUYER_DATA && slotId) {
        const BUYER_FIELD_MAP = {
          col2: 'date',
          col6: 'expected_buyer',
          col7: 'order_number',
          col8: 'buyer_name',
          col9: 'recipient_name',
          col10: 'user_id',
          col11: 'contact',
          col12: 'address',
          col13: 'account_info',
          col14: 'amount',
          col15: 'tracking_number',
          col18: 'review_cost',
          col19: 'deposit_name'
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

    setChangedSlots(slotUpdates);
    setChangedItems(itemUpdates);
  }, [rowMeta]);  // 성능 최적화: changedSlots, changedItems 제거 (ref로 대체)

  // 저장 핸들러
  const handleSave = useCallback(async () => {
    const hasSlotChanges = Object.keys(changedSlots).length > 0;
    const hasItemChanges = Object.keys(changedItems).length > 0;

    if (!hasSlotChanges && !hasItemChanges) {
      setSnackbar({ open: true, message: '변경된 내용이 없습니다.', severity: 'info' });
      return;
    }

    setSaving(true);
    try {
      // 슬롯 변경사항 저장
      if (hasSlotChanges) {
        const slotsToUpdate = Object.values(changedSlots);
        await itemSlotService.updateSlotsBulk(slotsToUpdate);
      }

      // 품목 변경사항 저장 (day_group별 슬롯 업데이트)
      if (hasItemChanges) {
        const dayGroupUpdates = Object.values(changedItems);
        for (const update of dayGroupUpdates) {
          const { itemId, dayGroup, ...productData } = update;
          const dayGroupSlotIds = slots
            .filter(s => s.item_id === itemId && s.day_group === dayGroup)
            .map(s => s.id);

          if (dayGroupSlotIds.length > 0) {
            const slotsToUpdateProduct = dayGroupSlotIds.map(id => ({
              id,
              ...productData
            }));
            await itemSlotService.updateSlotsBulk(slotsToUpdateProduct);
          }
        }
      }

      setChangedSlots({});
      setChangedItems({});

      // 캐시 무효화 (다음 로드 시 최신 데이터 가져오도록)
      const formattedDate = format(searchDate, 'yyyy-MM-dd');
      const cacheKey = `daily_${formattedDate}_${viewAsUserId || ''}`;
      slotsCache.delete(cacheKey);

      setSnackbar({ open: true, message: '저장되었습니다.', severity: 'success' });
      loadSlots(true); // forceRefresh로 최신 데이터 가져오기
    } catch (error) {
      console.error('Save error:', error);
      setSnackbar({ open: true, message: '저장 중 오류가 발생했습니다.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [changedSlots, changedItems, slots, loadSlots, searchDate, viewAsUserId]);

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
      setSnackbar({ open: true, message: '리뷰샷이 삭제되었습니다', severity: 'success' });

      // 캐시 무효화 및 데이터 새로고침
      const formattedDate = format(searchDate, 'yyyy-MM-dd');
      const cacheKey = `daily_${formattedDate}_${viewAsUserId || ''}`;
      slotsCache.delete(cacheKey);
      loadSlots(true);
    } catch (error) {
      console.error('Delete review failed:', error);
      const errorMessage = error.response?.data?.message || error.message || '알 수 없는 오류';
      setSnackbar({ open: true, message: '리뷰샷 삭제 실패: ' + errorMessage, severity: 'error' });
    } finally {
      setDeletingReview(false);
    }
  }, [deleteReviewPopup, searchDate, viewAsUserId, loadSlots]);

  // 컬럼 설정
  const columns = useMemo(() => {
    const cols = Array(21).fill(null).map((_, index) => ({
      data: `col${index}`,
      width: columnWidths[index] || 100
    }));
    // 맨 오른쪽에 여백 컬럼 추가 (컬럼 너비 조절 용이하게)
    cols.push({
      data: 'col21',
      width: 50,
      readOnly: true
    });
    return cols;
  }, [columnWidths]);

  // 변경사항 존재 여부
  const hasChanges = Object.keys(changedSlots).length > 0 || Object.keys(changedItems).length > 0;
  const totalChanges = Object.keys(changedSlots).length + Object.keys(changedItems).length;

  // 배정된 품목 수 계산 (day_group별 고유 품목)
  const uniqueItemCount = useMemo(() => {
    const uniqueItems = new Set();
    slots.forEach(slot => {
      uniqueItems.add(`${slot.item_id}_${slot.day_group}`);
    });
    return uniqueItems.size;
  }, [slots]);

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

        {/* 저장 버튼 */}
        {saving && (
          <Box sx={{ fontSize: '0.85rem', color: '#90caf9', fontWeight: 'bold' }}>
            저장 중...
          </Box>
        )}
        {hasChanges && !saving && (
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            sx={{ bgcolor: '#4caf50' }}
          >
            저장 ({totalChanges})
          </Button>
        )}
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
            colHeaders={Array(22).fill('')}
            colWidths={columnWidths.length > 0 ? columnWidths : undefined}
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
            cells={cellsRenderer}
            afterChange={handleAfterChange}
            afterOnCellMouseUp={(event, coords) => {
              const rowData = tableData[coords.row];
              if (!rowData) return;

              // 제품 데이터 행 col0 클릭 - 접기/펼치기
              if (rowData._rowType === ROW_TYPES.PRODUCT_DATA && coords.col === 0) {
                const groupKey = rowData._groupKey;
                if (groupKey) {
                  toggleCollapse(groupKey);
                }
                return;
              }

              // 제품 데이터 행 col14 클릭 - 상세보기 팝업
              if (rowData._rowType === ROW_TYPES.PRODUCT_DATA && coords.col === 14) {
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
                  handleCopyUploadLink(token);
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
            }}
            afterColumnResize={(currentColumn, newSize) => {
              // localStorage에만 저장 (setColumnWidths 호출 시 리렌더링으로 스크롤 점프 발생)
              const hot = hotRef.current?.hotInstance;
              if (!hot) return;
              const widths = [];
              for (let i = 0; i < hot.countCols(); i++) {
                widths.push(hot.getColWidth(i));
              }
              saveColumnWidths(widths);
            }}
            contextMenu={true}
            copyPaste={true}
            undo={true}
            outsideClickDeselects={false}
            rowHeights={23}
            autoScrollOnSelection={false}
            afterSelection={(row, column, row2, column2, preventScrolling) => {
              // 마우스 클릭 시에는 스크롤 방지, 키보드 이동 시에는 스크롤 허용
              if (hotRef.current?.hotInstance?._isKeyboardNav) {
                preventScrolling.value = false;
                hotRef.current.hotInstance._isKeyboardNav = false;
              } else {
                preventScrolling.value = true;
              }
            }}
            beforeKeyDown={(event) => {
              // 방향키 입력 시 플래그 설정
              const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
              if (arrowKeys.includes(event.key)) {
                if (hotRef.current?.hotInstance) {
                  hotRef.current.hotInstance._isKeyboardNav = true;
                }
              }
            }}
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

      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
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
