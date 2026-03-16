import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { HotTable } from '@handsontable/react';
import ImageSwipeViewer from './ImageSwipeViewer';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import itemSlotService from '../../services/itemSlotService';
import buyerService from '../../services/buyerService';
import { itemService } from '../../services';

// Handsontable 모든 모듈 등록
registerAllModules();

// 슬롯 데이터 캐시 (캠페인 전환 최적화)
const slotsCache = new Map();

// ========== 성능 최적화: 상수 (컴포넌트 외부 정의) ==========
const STATUS_OPTIONS = ['active', 'completed', 'cancelled'];
const STATUS_LABELS = { active: '진행', completed: '완료', cancelled: '취소' };

// ========== 성능 최적화: 셀 렌더러 함수 (컴포넌트 외부 정의) ==========
const unifiedItemSeparatorRenderer = (instance, td) => {
  td.className = 'item-separator-row';
  td.style.backgroundColor = '#1565c0';
  td.style.height = '6px';
  td.style.padding = '0';
  td.innerHTML = '';
  return td;
};

const createUnifiedUploadLinkBarRenderer = (tableDataRef) => {
  return (instance, td, r, c) => {
    const rowData = tableDataRef.current[r];
    td.className = 'upload-link-bar';
    td.style.backgroundColor = '#424242';
    td.style.color = 'white';
    td.style.height = '22px';
    td.style.lineHeight = '22px';
    td.style.cursor = 'pointer';
    td.style.fontSize = '11px';
    td.style.textAlign = 'center';

    if (c === 0) {
      td.innerHTML = '📷 업로드 링크 복사 (클릭)';
      td.colSpan = 16;
    } else {
      td.innerHTML = '';
      td.style.display = 'none';
    }

    td.setAttribute('data-token', rowData._uploadToken || '');
    return td;
  };
};

const unifiedProductHeaderRenderer = (instance, td, r, c, prop, value) => {
  td.className = 'product-header-row';
  td.style.backgroundColor = '#fff9c4';
  td.style.fontWeight = 'bold';

  if ([5, 10, 11].includes(c) && value) {
    td.textContent = Number(value).toLocaleString();
  } else {
    td.textContent = value ?? '';
  }

  return td;
};

const createUnifiedBuyerDataRenderer = (tableDataRef) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableDataRef.current[r];
    const dayGroup = rowData._dayGroup || 1;
    const bgClass = dayGroup % 2 === 0 ? 'buyer-row-even' : 'buyer-row-odd';
    td.className = bgClass;
    td.style.backgroundColor = dayGroup % 2 === 0 ? '#f5f5f5' : '#ffffff';

    // 리뷰샷 컬럼 (col11)
    if (c === 11) {
      if (value) {
        td.innerHTML = `<img src="${value}" alt="리뷰" class="review-thumbnail" data-url="${value}" data-filename="${rowData._reviewImageName || ''}" style="width: 35px; height: 35px; object-fit: cover; border-radius: 4px; cursor: pointer;" />`;
        td.style.padding = '2px';
        td.style.textAlign = 'center';
      } else {
        td.innerHTML = '<span style="color: #999; font-size: 10px;">-</span>';
        td.style.textAlign = 'center';
      }
      return td;
    }

    // 배송지연 컬럼 (col12)
    if (c === 12) {
      td.style.textAlign = 'center';
      const buyerId = rowData._buyerId;
      const isDelayed = value === true || value === 'true';

      if (buyerId) {
        if (isDelayed) {
          td.innerHTML = `<span class="shipping-delayed-chip delayed" data-buyer-id="${buyerId}" data-delayed="true" style="background-color: #ffebee; color: #d32f2f; padding: 2px 8px; border-radius: 10px; font-size: 10px; cursor: pointer;">지연</span>`;
        } else {
          td.innerHTML = `<span class="shipping-delayed-chip" data-buyer-id="${buyerId}" data-delayed="false" style="color: #9e9e9e; padding: 2px 8px; font-size: 10px; cursor: pointer;">-</span>`;
        }
      } else {
        td.innerHTML = '<span style="color: #ccc; font-size: 10px;">-</span>';
      }
      return td;
    }

    // 리뷰작성(상태) 컬럼 (col13)
    if (c === 13) {
      const hasReviewImage = rowData._reviewImageUrl;
      const displayStatus = hasReviewImage ? 'completed' : (value || 'active');
      const label = STATUS_LABELS[displayStatus] || displayStatus;
      const colors = {
        active: { bg: '#e3f2fd', color: '#1976d2' },
        completed: { bg: '#e8f5e9', color: '#388e3c' },
        cancelled: { bg: '#ffebee', color: '#d32f2f' }
      };
      const style = colors[displayStatus] || { bg: '#f5f5f5', color: '#666' };

      if (hasReviewImage) {
        td.innerHTML = `<span style="background:${style.bg};color:${style.color};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:bold;">✓ ${label}</span>`;
      } else {
        td.innerHTML = `<span style="background:${style.bg};color:${style.color};padding:2px 8px;border-radius:12px;font-size:10px;">${label}</span>`;
      }
      return td;
    }

    // 금액/리뷰비용 컬럼
    if ([9, 10].includes(c) && value) {
      td.textContent = Number(value).toLocaleString();
      td.style.textAlign = 'right';
      return td;
    }

    td.textContent = value ?? '';
    return td;
  };
};

/**
 * 통합 품목 시트 컴포넌트 (영업사 + 진행자 공용)
 *
 * 구조 (day_group별 반복):
 * 1. 제품정보 헤더행 (노란색 배경) - 제품명, 옵션, 키워드, 총구매건수, 일구매건수 등
 * 2. 업로드 링크 구분선 (검정색) - 클릭 시 업로드 링크 복사
 * 3. 구매자/진행자 행들 (흰색) - 주문번호, 구매자, 수취인, 연락처, 주소, 금액 등
 *
 * 영업사/진행자 모두 모든 필드 수정 가능
 */
function UnifiedItemSheetInner({
  campaignId,
  items,
  onRefresh,
  userRole = 'sales', // 'sales' | 'operator' | 'admin'
  viewAsUserId = null,
  viewAsRole = null
}) {
  const hotRef = useRef(null);

  // 슬롯 데이터
  const [slots, setSlots] = useState([]);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const [loading, setLoading] = useState(false);

  // 변경된 슬롯들 추적 (성능 최적화: ref만 사용, state 제거로 리렌더링 방지)
  const changedSlotsRef = useRef({});
  // 변경된 품목 추적 (판매단가, 택배단가 등 Item 테이블 필드, 성능 최적화: ref만 사용)
  const changedItemsRef = useRef({});
  // 미저장 변경사항 플래그 (성능 최적화: ref만 사용)
  const hasUnsavedChangesRef = useRef(false);

  // 삭제 다이얼로그 상태
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    type: '',
    data: null,
    message: ''
  });

  // 저장 중 상태 (성능 최적화: ref 사용으로 리렌더링 방지)
  const savingRef = useRef(false);

  // 스낵바 ref (성능 최적화: state 대신 ref + DOM 직접 조작)
  const snackbarRef = useRef(null);

  // 한글 입력 조합 중 상태 추적 (성능 최적화)
  const isComposingRef = useRef(false);

  // 이미지 스와이프 뷰어 상태
  const [imagePopup, setImagePopup] = useState({ open: false, images: [], currentIndex: 0, buyer: null });

  // 필터링된 행 인덱스
  const [filteredRows, setFilteredRows] = useState(null);
  const [filteredColumns, setFilteredColumns] = useState(new Set());
  const filterConditionsRef = useRef(null);

  // 컬럼 크기 저장 키
  const COLUMN_WIDTHS_KEY = 'unified_itemsheet_column_widths';

  // localStorage에서 컬럼 크기 로드
  const getSavedColumnWidths = useCallback(() => {
    try {
      const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  // 컬럼 크기 변경 시 저장
  const handleColumnResize = useCallback(() => {
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

  // 실제 역할 결정 (admin이 다른 사용자 보기 시 viewAsRole 사용)
  const effectiveRole = viewAsRole || userRole;

  // 캠페인별 슬롯 데이터 로드
  const loadSlots = useCallback(async (forceRefresh = false) => {
    if (!campaignId) return;

    // 캐시 키 생성
    const cacheKey = `unified_${campaignId}_${effectiveRole}_${viewAsUserId || ''}`;

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
      let response;
      // Operator이거나 admin이 operator로 보기
      if (effectiveRole === 'operator') {
        response = await itemSlotService.getSlotsByCampaignForOperator(campaignId, viewAsUserId);
      } else {
        // Sales 또는 Admin
        response = await itemSlotService.getSlotsByCampaign(campaignId, { viewAsUserId, viewAsRole });
      }

      if (response.success) {
        const newSlots = response.data || [];
        setSlots(newSlots);
        changedSlotsRef.current = {};
        changedItemsRef.current = {};
        hasUnsavedChangesRef.current = false;

        // 캐시에 저장
        slotsCache.set(cacheKey, { slots: newSlots, timestamp: Date.now() });
      }
    } catch (error) {
      console.error('Failed to load slots:', error);
    } finally {
      setLoading(false);
    }
  }, [campaignId, effectiveRole, viewAsUserId, viewAsRole]);

  useEffect(() => {
    if (campaignId) {
      loadSlots();
    }
  }, [campaignId, loadSlots]);

  // items 변경 시 슬롯 리로드
  useEffect(() => {
    if (campaignId && items.length > 0) {
      loadSlots();
    }
  }, [items.length]);

  // 스낵바 표시 함수 (성능 최적화: DOM 직접 조작, CSS animation 사용)
  const showSnackbar = useCallback((message) => {
    const snackbarEl = snackbarRef.current;
    if (!snackbarEl) return;

    const messageEl = snackbarEl.querySelector('.snackbar-message');
    if (messageEl) messageEl.textContent = message;

    snackbarEl.style.animation = 'none';
    void snackbarEl.offsetHeight;
    snackbarEl.style.visibility = 'visible';
    snackbarEl.style.opacity = '1';
    snackbarEl.style.animation = 'snackbarFadeOut 0.3s 2s forwards';
  }, []);

  // Ctrl+S 키보드 단축키로 저장
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (Object.keys(changedSlotsRef.current).length > 0 || Object.keys(changedItemsRef.current).length > 0) {
          handleSaveChanges();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 한글 IME 조합 이벤트 리스너 (성능 최적화)
  useEffect(() => {
    const container = hotRef.current?.hotInstance?.rootElement;
    if (!container) return;
    const handleCompositionStart = () => { isComposingRef.current = true; };
    const handleCompositionEnd = () => {
      requestAnimationFrame(() => { isComposingRef.current = false; });
    };
    container.addEventListener('compositionstart', handleCompositionStart);
    container.addEventListener('compositionend', handleCompositionEnd);
    return () => {
      container.removeEventListener('compositionstart', handleCompositionStart);
      container.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [slots]);

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
  }, []); // DOM 참조는 HotTable 생존 기간 동안 불변

  /**
   * Handsontable 데이터 변환
   *
   * 구조: day_group별로
   * 1. 제품정보 헤더행 (_isProductHeader: true) - 노란색
   * 2. 업로드 링크 구분선 (_isUploadLinkBar: true) - 검정색
   * 3. 구매자 데이터행들 - 흰색/연회색 교대
   */
  const { tableData } = useMemo(() => {
    const data = [];

    let currentItemId = null;
    let currentDayGroup = null;
    let isFirstItem = true;

    // 슬롯을 item_id, day_group 순서로 정렬
    const sortedSlots = [...slots].sort((a, b) => {
      if (a.item_id !== b.item_id) return a.item_id - b.item_id;
      return (a.day_group || 1) - (b.day_group || 1);
    });

    sortedSlots.forEach((slot) => {
      const item = slot.item || items.find(i => i.id === slot.item_id);

      // 품목이 바뀌면 품목 구분선 추가
      if (slot.item_id !== currentItemId) {
        if (!isFirstItem && data.length > 0) {
          // 품목 구분선 (파란색 두꺼운 선)
          data.push({ _isItemSeparator: true });
        }
        isFirstItem = false;
        currentItemId = slot.item_id;
        currentDayGroup = null;
      }

      // 새 day_group 시작 시 제품정보 헤더 + 업로드 링크 바 추가
      if (slot.day_group !== currentDayGroup) {
        currentDayGroup = slot.day_group || 1;

        // 1. 제품정보 헤더행 (노란색)
        data.push({
          _isProductHeader: true,
          _itemId: slot.item_id,
          _dayGroup: currentDayGroup,
          // 제품정보 필드
          product_name: slot.product_name || item?.name || '',
          platform: item?.platform || '',
          shipping_type: item?.shipping_type || '',
          purchase_option: slot.purchase_option || '',
          keyword: slot.keyword || '',
          product_price: slot.product_price ? Number(slot.product_price) : '',
          total_purchase_count: item?.total_purchase_count || '',
          daily_purchase_count: item?.daily_purchase_count || '',
          product_url: item?.product_url || '',
          courier_service_yn: item?.courier_service_yn || '',
          sale_price_per_unit: item?.sale_price_per_unit ? Number(item.sale_price_per_unit) : '',
          courier_price_per_unit: item?.courier_price_per_unit ? Number(item.courier_price_per_unit) : '',
          notes: slot.notes || ''
        });

        // 2. 업로드 링크 바 (검정색)
        data.push({
          _isUploadLinkBar: true,
          _uploadToken: slot.upload_link_token || '',
          _itemId: slot.item_id,
          _dayGroup: currentDayGroup
        });
      }

      // 3. 구매자 데이터행
      const buyer = slot.buyer || {};
      const reviewImages = buyer.images || [];
      const reviewImage = reviewImages.length > 0 ? reviewImages[0] : null;

      data.push({
        _isBuyerRow: true,
        _slotId: slot.id,
        _itemId: slot.item_id,
        _dayGroup: currentDayGroup,
        _buyerId: buyer.id || null,
        _reviewImages: reviewImages,
        _reviewImageUrl: reviewImage?.s3_url || '',
        _reviewImageName: reviewImage?.file_name || '',
        _buyerInfo: { buyer_name: buyer.buyer_name, order_number: buyer.order_number },
        // 구매자 정보 필드
        date: slot.date || '',
        expected_buyer: slot.expected_buyer || '',
        order_number: buyer.order_number || '',
        buyer_name: buyer.buyer_name || '',
        recipient_name: buyer.recipient_name || '',
        user_id: buyer.user_id || '',
        contact: buyer.contact || '',
        address: buyer.address || '',
        account_info: buyer.account_info || '',
        amount: buyer.amount || '',
        review_cost: slot.review_cost || '',
        review_image: reviewImage?.s3_url || '',
        shipping_delayed: buyer.shipping_delayed || false,
        status: slot.status || 'active'
      });
    });

    return { tableData: data };
  }, [slots, items]);

  // 성능 최적화: tableData를 ref로도 유지 (handleAfterChange 의존성에서 제거하기 위함)
  const tableDataRef = useRef(tableData);
  tableDataRef.current = tableData;

  // 상태 옵션은 컴포넌트 외부 상수 STATUS_OPTIONS, STATUS_LABELS 사용

  // 업로드 링크 복사 핸들러
  const handleCopyUploadLink = useCallback((token) => {
    if (!token) return;
    const uploadUrl = `${window.location.origin}/upload-slot/${token}`;
    navigator.clipboard.writeText(uploadUrl).then(() => {
      showSnackbar('업로드 링크가 복사되었습니다');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }, []);

  /**
   * 컬럼 정의
   *
   * 제품정보 헤더행에서 사용하는 컬럼:
   * - 제품명, 미출고/실출고, 옵션, 키워드, 가격, 총구매건수, 일구매건수, 상품URL, 택배대행, 판매단가, 택배단가, 특이사항
   *
   * 구매자 데이터행에서 사용하는 컬럼:
   * - 날짜, 예상구매자, 주문번호, 구매자, 수취인, 아이디, 연락처, 주소, 계좌번호, 금액, 리뷰비용, 리뷰샷, 배송지연, 리뷰작성
   *
   * 통합 컬럼 구조: 두 종류 행이 같은 테이블에 있어야 하므로 모든 컬럼 포함
   */
  const defaultColumnWidths = [
    100,  // 0: product_name / 날짜
    70,   // 1: platform / 예상구매자
    80,   // 2: shipping_type / 주문번호
    100,  // 3: purchase_option / 구매자
    100,  // 4: keyword / 수취인
    80,   // 5: product_price / 아이디
    80,   // 6: total_purchase_count / 연락처
    80,   // 7: daily_purchase_count / 주소
    120,  // 8: product_url / 계좌번호
    60,   // 9: courier_service_yn / 금액
    80,   // 10: sale_price_per_unit / 리뷰비용
    80,   // 11: courier_price_per_unit / 리뷰샷
    60,   // 12: 특이사항(헤더) / 배송지연
    60,   // 13: - / 리뷰작성(상태)
    80,   // 14: - / 특이사항(구매자행)
    100   // 15: - / (추가)
  ];

  // 컬럼 헤더 (두 가지 행 타입에 따라 다른 내용 표시)
  const colHeaderNames = [
    '제품명/날짜',
    '플랫폼/예상구매자',
    '출고/주문번호',
    '옵션/구매자',
    '키워드/수취인',
    '가격/아이디',
    '총건수/연락처',
    '일건수/주소',
    'URL/계좌',
    '택배/금액',
    '판매단가/리뷰비용',
    '택배단가/리뷰샷',
    '특이/배송지연',
    '-/리뷰작성',
    '-/특이사항',
    '-/-',
    ''  // 여백 컬럼
  ];

  const columns = useMemo(() => {
    const savedWidths = getSavedColumnWidths();
    return [
      { data: 'col0', type: 'text', width: savedWidths?.[0] || defaultColumnWidths[0] },
      { data: 'col1', type: 'text', width: savedWidths?.[1] || defaultColumnWidths[1] },
      { data: 'col2', type: 'text', width: savedWidths?.[2] || defaultColumnWidths[2] },
      { data: 'col3', type: 'text', width: savedWidths?.[3] || defaultColumnWidths[3] },
      { data: 'col4', type: 'text', width: savedWidths?.[4] || defaultColumnWidths[4] },
      { data: 'col5', type: 'text', width: savedWidths?.[5] || defaultColumnWidths[5] },
      { data: 'col6', type: 'text', width: savedWidths?.[6] || defaultColumnWidths[6] },
      { data: 'col7', type: 'text', width: savedWidths?.[7] || defaultColumnWidths[7] },
      { data: 'col8', type: 'text', width: savedWidths?.[8] || defaultColumnWidths[8] },
      { data: 'col9', type: 'text', width: savedWidths?.[9] || defaultColumnWidths[9] },
      { data: 'col10', type: 'text', width: savedWidths?.[10] || defaultColumnWidths[10] },
      { data: 'col11', type: 'text', width: savedWidths?.[11] || defaultColumnWidths[11] },
      { data: 'col12', type: 'text', width: savedWidths?.[12] || defaultColumnWidths[12] },
      { data: 'col13', type: 'dropdown', source: STATUS_OPTIONS, width: savedWidths?.[13] || defaultColumnWidths[13] },
      { data: 'col14', type: 'text', width: savedWidths?.[14] || defaultColumnWidths[14] },
      { data: 'col15', type: 'text', width: savedWidths?.[15] || defaultColumnWidths[15] },
      // 맨 오른쪽에 여백 컬럼 추가 (컬럼 너비 조절 용이하게)
      { data: 'col16', type: 'text', width: 50, readOnly: true }
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getSavedColumnWidths]);

  // 컬럼 헤더 렌더러
  const colHeaders = useCallback((index) => {
    const baseName = colHeaderNames[index] || '';
    if (filteredColumns.has(index)) {
      return `<span style="color: #1976d2; font-weight: bold;">🔍 ${baseName}</span>`;
    }
    return baseName;
  }, [filteredColumns]);

  /**
   * 테이블 데이터를 Handsontable용 형식으로 변환
   * 행 타입에 따라 다른 필드를 각 컬럼에 매핑
   */
  const displayData = useMemo(() => {
    return tableData.map(row => {
      if (row._isItemSeparator) {
        // 품목 구분선
        return {
          _isItemSeparator: true,
          col0: '', col1: '', col2: '', col3: '', col4: '',
          col5: '', col6: '', col7: '', col8: '', col9: '',
          col10: '', col11: '', col12: '', col13: '', col14: '', col15: ''
        };
      }

      if (row._isProductHeader) {
        // 제품정보 헤더행
        return {
          ...row,
          col0: row.product_name,
          col1: row.platform,
          col2: row.shipping_type,
          col3: row.purchase_option,
          col4: row.keyword,
          col5: row.product_price,
          col6: row.total_purchase_count,
          col7: row.daily_purchase_count,
          col8: row.product_url,
          col9: row.courier_service_yn,
          col10: row.sale_price_per_unit,
          col11: row.courier_price_per_unit,
          col12: row.notes,
          col13: '',
          col14: '',
          col15: ''
        };
      }

      if (row._isUploadLinkBar) {
        // 업로드 링크 바
        return {
          ...row,
          col0: '📷 업로드 링크 복사', col1: '', col2: '', col3: '', col4: '',
          col5: '', col6: '', col7: '', col8: '', col9: '',
          col10: '', col11: '', col12: '', col13: '', col14: '', col15: ''
        };
      }

      if (row._isBuyerRow) {
        // 구매자 데이터행
        return {
          ...row,
          col0: row.date,
          col1: row.expected_buyer,
          col2: row.order_number,
          col3: row.buyer_name,
          col4: row.recipient_name,
          col5: row.user_id,
          col6: row.contact,
          col7: row.address,
          col8: row.account_info,
          col9: row.amount,
          col10: row.review_cost,
          col11: row.review_image,
          col12: row.shipping_delayed,
          col13: row.status,
          col14: '',
          col15: ''
        };
      }

      return row;
    });
  }, [tableData]);

  // 데이터 변경 핸들러
  const handleAfterChange = useCallback((changes, source) => {
    if (!changes || source === 'loadData') return;

    // 성능 최적화: ref에서 최신값 읽기 (의존성 배열에서 제거하여 함수 재생성 방지)
    const currentTableData = tableDataRef.current;

    const slotUpdates = { ...changedSlotsRef.current };
    const itemUpdates = { ...changedItemsRef.current };

    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue === newValue) return;

      const rowData = currentTableData[row];
      if (!rowData) return;

      // 품목 구분선, 업로드 링크 바는 수정 불가
      if (rowData._isItemSeparator || rowData._isUploadLinkBar) return;

      const colIndex = parseInt(prop.replace('col', ''));

      if (rowData._isProductHeader) {
        // 제품정보 헤더행 수정 - Item 테이블 필드
        const itemId = rowData._itemId;
        if (!itemId) return;

        if (!itemUpdates[itemId]) {
          itemUpdates[itemId] = { id: itemId };
        }

        // 컬럼 인덱스에 따라 필드 매핑
        const headerFieldMap = {
          0: 'product_name',  // 제품명 - 슬롯 필드
          1: 'platform',      // 플랫폼 - Item 필드
          2: 'shipping_type', // 미출고/실출고 - Item 필드
          3: 'purchase_option', // 옵션 - 슬롯 필드
          4: 'keyword',       // 키워드 - 슬롯 필드
          5: 'product_price', // 가격 - 슬롯 필드
          6: 'total_purchase_count', // 총구매건수 - Item 필드
          7: 'daily_purchase_count', // 일구매건수 - Item 필드
          8: 'product_url',   // URL - Item 필드
          9: 'courier_service_yn', // 택배대행 - Item 필드
          10: 'sale_price_per_unit', // 판매단가 - Item 필드
          11: 'courier_price_per_unit', // 택배단가 - Item 필드
          12: 'notes'         // 특이사항 - 슬롯 필드
        };

        const fieldName = headerFieldMap[colIndex];
        if (!fieldName) return;

        // Item 테이블 필드
        const itemFields = ['platform', 'shipping_type', 'total_purchase_count', 'daily_purchase_count', 'product_url', 'courier_service_yn', 'sale_price_per_unit', 'courier_price_per_unit'];

        if (itemFields.includes(fieldName)) {
          // 숫자 필드 처리
          if (['total_purchase_count', 'sale_price_per_unit', 'courier_price_per_unit'].includes(fieldName)) {
            itemUpdates[itemId][fieldName] = newValue ? parseInt(String(newValue).replace(/[^0-9]/g, '')) : null;
          } else if (fieldName === 'courier_service_yn') {
            // TEXT 필드 - 'Y' 또는 원본값 그대로 저장
            itemUpdates[itemId][fieldName] = newValue;
          } else {
            itemUpdates[itemId][fieldName] = newValue;
          }
        } else {
          // 슬롯 필드 - 해당 day_group의 모든 슬롯에 적용해야 함
          // 여기서는 첫 번째 슬롯만 업데이트 (대표 슬롯)
          const dayGroup = rowData._dayGroup;
          const slotsInGroup = slotsRef.current.filter(s => s.item_id === itemId && s.day_group === dayGroup);
          slotsInGroup.forEach(slot => {
            if (!slotUpdates[slot.id]) {
              slotUpdates[slot.id] = { id: slot.id };
            }
            if (fieldName === 'product_price') {
              slotUpdates[slot.id][fieldName] = newValue ? parseInt(String(newValue).replace(/[^0-9]/g, '')) : null;
            } else {
              slotUpdates[slot.id][fieldName] = newValue;
            }
          });
        }
      } else if (rowData._isBuyerRow) {
        // 구매자 데이터행 수정 - Slot/Buyer 필드
        const slotId = rowData._slotId;
        if (!slotId) return;

        if (!slotUpdates[slotId]) {
          slotUpdates[slotId] = { id: slotId };
        }

        // 컬럼 인덱스에 따라 필드 매핑
        const buyerFieldMap = {
          0: 'date',
          1: 'expected_buyer',
          2: 'order_number',
          3: 'buyer_name',
          4: 'recipient_name',
          5: 'user_id',
          6: 'contact',
          7: 'address',
          8: 'account_info',
          9: 'amount',
          10: 'review_cost',
          // 11: review_image (읽기 전용)
          // 12: shipping_delayed (별도 처리)
          13: 'status',
          // 14, 15: 빈 컬럼
        };

        const fieldName = buyerFieldMap[colIndex];
        if (!fieldName) return;

        // 금액/리뷰비용 필드는 숫자만 추출
        if (['amount', 'review_cost'].includes(fieldName) && newValue) {
          slotUpdates[slotId][fieldName] = String(newValue).replace(/[^0-9]/g, '');
        } else {
          slotUpdates[slotId][fieldName] = newValue;
        }
      }
    });

    // 성능 최적화: ref 직접 할당 (setState 제거로 리렌더링 방지)
    changedSlotsRef.current = slotUpdates;
    changedItemsRef.current = itemUpdates;
    hasUnsavedChangesRef.current = true;
  }, []); // 성능 최적화: 의존성 빈배열 (tableData/slots는 ref로 접근)

  // 변경사항 저장 - 새로고침 없이 로컬 상태만 업데이트
  const handleSaveChanges = async () => {
    // ref에서 변경사항 읽기 (성능 최적화)
    const currentChangedSlots = changedSlotsRef.current;
    const currentChangedItems = changedItemsRef.current;
    const hasSlotChanges = Object.keys(currentChangedSlots).length > 0;
    const hasItemChanges = Object.keys(currentChangedItems).length > 0;

    if (!hasSlotChanges && !hasItemChanges) return;

    if (savingRef.current) return;
    savingRef.current = true;

    try {
      // 슬롯 데이터 저장
      if (hasSlotChanges) {
        const slotsToUpdate = Object.values(currentChangedSlots);
        await itemSlotService.updateSlotsBulk(slotsToUpdate);
      }

      // 품목 데이터 저장
      if (hasItemChanges) {
        const itemsToUpdate = Object.values(currentChangedItems);
        await Promise.all(
          itemsToUpdate.map(item => itemService.updateItem(item.id, item))
        );
      }

      // 로컬 slots 상태 업데이트 (DB 리로드 없이)
      if (hasSlotChanges || hasItemChanges) {
        setSlots(prevSlots => {
          return prevSlots.map(slot => {
            let updatedSlot = { ...slot };

            // 슬롯 변경사항 적용
            const slotChange = currentChangedSlots[slot.id];
            if (slotChange) {
              // buyer 필드 업데이트
              const buyerFields = ['order_number', 'buyer_name', 'recipient_name', 'user_id', 'contact', 'address', 'account_info', 'amount', 'deposit_name', 'payment_confirmed', 'status'];
              const slotFields = ['date', 'expected_buyer', 'review_cost', 'product_name', 'purchase_option', 'keyword', 'product_price', 'notes'];

              const buyerUpdates = {};
              const slotUpdates = {};

              Object.entries(slotChange).forEach(([field, value]) => {
                if (buyerFields.includes(field)) {
                  buyerUpdates[field] = value;
                } else if (slotFields.includes(field)) {
                  slotUpdates[field] = value;
                }
              });

              // slot 필드 업데이트
              if (Object.keys(slotUpdates).length > 0) {
                updatedSlot = { ...updatedSlot, ...slotUpdates };
              }

              // buyer 필드 업데이트
              if (Object.keys(buyerUpdates).length > 0) {
                updatedSlot.buyer = { ...(updatedSlot.buyer || {}), ...buyerUpdates };
              }
            }

            // 제품 정보 변경사항 적용
            const itemChange = currentChangedItems[slot.item_id];
            if (itemChange && updatedSlot.item) {
              updatedSlot.item = { ...updatedSlot.item, ...itemChange };
            }

            return updatedSlot;
          });
        });
      }

      // 상태 초기화 (성능 최적화: ref 직접 초기화)
      changedSlotsRef.current = {};
      changedItemsRef.current = {};
      hasUnsavedChangesRef.current = false;

      // 캐시 무효화 (다음 로드 시 최신 데이터 가져오도록)
      const cacheKey = `unified_${campaignId}_${effectiveRole}_${viewAsUserId || ''}`;
      slotsCache.delete(cacheKey);

      showSnackbar('저장되었습니다');

    } catch (error) {
      console.error('Failed to save changes:', error);
      showSnackbar('저장 실패: ' + error.message);
    } finally {
      savingRef.current = false;
    }
  };

  // 삭제 다이얼로그 핸들러
  const openDeleteDialog = (type, data, message) => {
    setDeleteDialog({ open: true, type, data, message });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({ open: false, type: '', data: null, message: '' });
  };

  const handleDeleteConfirm = async () => {
    const { type, data } = deleteDialog;

    try {
      if (type === 'rows') {
        await itemSlotService.deleteSlotsBulk(data.slotIds);
        // 로컬 상태 즉시 업데이트 - 삭제된 슬롯 ID에 해당하는 행 제거
        setSlots(prev => prev.filter(slot => !data.slotIds.includes(slot.id)));
      } else if (type === 'group') {
        await itemSlotService.deleteSlotsByGroup(data.itemId, data.dayGroup);
        // 로컬 상태 즉시 업데이트 - 해당 품목/일차의 모든 슬롯 제거
        setSlots(prev => prev.filter(slot =>
          !(slot.item_id === data.itemId && slot.day_group === data.dayGroup)
        ));
      }

      closeDeleteDialog();
      showSnackbar('삭제되었습니다');
      setFilteredRows(null);
      setFilteredColumns(new Set());
      filterConditionsRef.current = null;

      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Delete failed:', error);
      showSnackbar('삭제 실패: ' + error.message);
    }
  };

  // 배송지연 토글 핸들러
  const handleToggleShippingDelayed = useCallback(async (buyerId, currentValue) => {
    if (!buyerId) {
      showSnackbar('구매자 정보가 없습니다');
      return;
    }

    try {
      const newValue = !currentValue;
      await buyerService.toggleShippingDelayed(buyerId, newValue);

      setSlots(prevSlots => {
        return prevSlots.map(slot => {
          if (slot.buyer && slot.buyer.id === buyerId) {
            return {
              ...slot,
              buyer: { ...slot.buyer, shipping_delayed: newValue }
            };
          }
          return slot;
        });
      });

      showSnackbar(newValue ? '배송지연으로 표시되었습니다' : '배송지연이 해제되었습니다');
    } catch (error) {
      console.error('Failed to toggle shipping delayed:', error);
      showSnackbar('배송지연 상태 변경에 실패했습니다');
    }
  }, []);

  // 19차 최적화: 렌더러 팩토리에 ref 전달 → 의존성 [] → cellsRenderer 안정화 → IME 깨짐 방지
  const uploadLinkBarRenderer = useMemo(() =>
    createUnifiedUploadLinkBarRenderer(tableDataRef),
    []
  );

  const buyerDataRenderer = useMemo(() =>
    createUnifiedBuyerDataRenderer(tableDataRef),
    []
  );

  // 렌더러를 ref로 유지 (cellsRenderer 의존성 제거)
  const uploadLinkBarRendererRef = useRef(uploadLinkBarRenderer);
  uploadLinkBarRendererRef.current = uploadLinkBarRenderer;
  const buyerDataRendererRef = useRef(buyerDataRenderer);
  buyerDataRendererRef.current = buyerDataRenderer;

  // 셀 렌더러 - 19차: 의존성 완전 제거
  const cellsRenderer = useCallback((row, col, prop) => {
    const cellProperties = {};
    const currentTableData = tableDataRef.current;
    const rowData = currentTableData[row];

    if (!rowData) return cellProperties;

    // 품목 구분선
    if (rowData._isItemSeparator) {
      cellProperties.readOnly = true;
      cellProperties.className = 'item-separator-row';
      cellProperties.renderer = unifiedItemSeparatorRenderer;
      return cellProperties;
    }

    // 업로드 링크 바
    if (rowData._isUploadLinkBar) {
      cellProperties.readOnly = true;
      cellProperties.className = 'upload-link-bar';
      cellProperties.renderer = uploadLinkBarRendererRef.current;
      return cellProperties;
    }

    // 제품정보 헤더행 (노란색 배경)
    if (rowData._isProductHeader) {
      cellProperties.className = 'product-header-row';
      cellProperties.renderer = unifiedProductHeaderRenderer;
      return cellProperties;
    }

    // 구매자 데이터행
    if (rowData._isBuyerRow) {
      const dayGroup = rowData._dayGroup || 1;
      const bgClass = dayGroup % 2 === 0 ? 'buyer-row-even' : 'buyer-row-odd';
      cellProperties.className = bgClass;
      cellProperties.renderer = buyerDataRendererRef.current;
    }

    return cellProperties;
  }, []);  // 19차: 의존성 완전 제거

  // 19차: hiddenRows prop 안정화 (매 렌더마다 새 객체 생성 방지)
  const hiddenRowsConfig = useMemo(() => ({
    rows: [],
    indicators: false
  }), []);

  // 20차: 인라인 콜백에서 사용하는 함수들을 ref로 유지
  const handleAfterChangeRef = useRef(handleAfterChange);
  handleAfterChangeRef.current = handleAfterChange;
  const handleCopyUploadLinkRef = useRef(handleCopyUploadLink);
  handleCopyUploadLinkRef.current = handleCopyUploadLink;
  const handleToggleShippingDelayedRef = useRef(handleToggleShippingDelayed);
  handleToggleShippingDelayedRef.current = handleToggleShippingDelayed;
  const openDeleteDialogRef = useRef(openDeleteDialog);
  openDeleteDialogRef.current = openDeleteDialog;
  const displayDataRef = useRef(displayData);
  displayDataRef.current = displayData;

  // 20차: 인라인 HotTable 콜백 → useCallback (매 렌더마다 새 함수 생성 방지 → IME 깨짐 방지)
  const contextMenuConfig = useMemo(() => ({
    items: {
      copy: { name: '복사' },
      cut: { name: '잘라내기' },
      paste: { name: '붙여넣기' },
      sp1: { name: '---------' },
      delete_rows: {
        name: '선택한 구매자행 삭제',
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
            const rowData = tableDataRef.current[row];
            if (rowData?._isBuyerRow && rowData._slotId) {
              slotIds.push(rowData._slotId);
            }
          });
          if (slotIds.length === 0) {
            alert('삭제할 구매자행을 선택해주세요.');
            return;
          }
          openDeleteDialogRef.current('rows', { slotIds }, `선택한 ${slotIds.length}개 행을 삭제하시겠습니까?`);
        }
      },
      delete_group: {
        name: '이 day_group 전체 삭제',
        callback: function(key, selection) {
          const row = selection[0]?.start?.row;
          if (row === undefined) return;
          const rowData = tableDataRef.current[row];
          if (!rowData || (!rowData._isBuyerRow && !rowData._isProductHeader)) {
            alert('유효한 행을 선택해주세요.');
            return;
          }
          const itemId = rowData._itemId;
          const dayGroup = rowData._dayGroup;
          openDeleteDialogRef.current('group', { itemId, dayGroup }, `이 그룹(day ${dayGroup}) 전체를 삭제하시겠습니까?`);
        }
      }
    }
  }), []);

  const afterChangeHandler = useCallback((changes, source) => {
    if (isComposingRef.current) return;
    handleAfterChangeRef.current(changes, source);
  }, []);

  const afterOnCellMouseUpHandler = useCallback((event, coords) => {
    const rowData = tableDataRef.current[coords.row];

    // 업로드 링크 바 클릭 시 링크 복사
    if (rowData?._isUploadLinkBar) {
      const token = rowData._uploadToken;
      if (token) {
        handleCopyUploadLinkRef.current(token);
      }
      return;
    }

    // 리뷰샷 썸네일 클릭 시 스와이프 뷰어 열기
    const target = event.target;
    if (target.tagName === 'IMG' && target.classList.contains('review-thumbnail')) {
      const hot = hotRef.current?.hotInstance;
      if (!hot) return;
      const clickedRowData = tableDataRef.current[coords.row];
      if (clickedRowData && clickedRowData._reviewImages && clickedRowData._reviewImages.length > 0) {
        setImagePopup({
          open: true,
          images: clickedRowData._reviewImages,
          currentIndex: 0,
          buyer: clickedRowData._buyerInfo
        });
      }
    }

    // 배송지연 칩 클릭 시 토글
    if (target.classList.contains('shipping-delayed-chip')) {
      const buyerId = target.getAttribute('data-buyer-id');
      const currentDelayed = target.getAttribute('data-delayed') === 'true';
      if (buyerId) {
        handleToggleShippingDelayedRef.current(parseInt(buyerId), currentDelayed);
      }
    }
  }, []);

  const afterSelectionHandler = useCallback((row, column, row2, column2, preventScrolling) => {
    if (hotRef.current?.hotInstance?._isKeyboardNav) {
      preventScrolling.value = false;
      hotRef.current.hotInstance._isKeyboardNav = false;
    } else {
      preventScrolling.value = true;
    }
  }, []);

  const beforeKeyDownHandler = useCallback((event) => {
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
    if (arrowKeys.includes(event.key)) {
      if (hotRef.current?.hotInstance) {
        hotRef.current.hotInstance._isKeyboardNav = true;
      }
    }
  }, []);

  const afterFilterHandler = useCallback((conditionsStack) => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    filterConditionsRef.current = conditionsStack?.length > 0 ? [...conditionsStack] : null;

    const filteredCols = new Set();
    if (conditionsStack?.length > 0) {
      conditionsStack.forEach(condition => {
        if (condition.column !== undefined) {
          filteredCols.add(condition.column);
        }
      });
    }
    setFilteredColumns(filteredCols);

    const hiddenRowsPlugin = hot.getPlugin('hiddenRows');
    if (!hiddenRowsPlugin) return;

    const currentHidden = hiddenRowsPlugin.getHiddenRows();
    if (currentHidden.length > 0) {
      hiddenRowsPlugin.showRows(currentHidden);
    }

    if (!conditionsStack || conditionsStack.length === 0) {
      setFilteredRows(null);
      hot.render();
      return;
    }

    const currentTableData = tableDataRef.current;
    const currentDisplayData = displayDataRef.current;
    const visibleRows = [];
    const hiddenRows = [];

    for (let physicalRow = 0; physicalRow < currentTableData.length; physicalRow++) {
      const rowData = currentTableData[physicalRow];

      if (!rowData._isBuyerRow) {
        hiddenRows.push(physicalRow);
        continue;
      }

      let passesFilter = true;
      conditionsStack.forEach(condition => {
        if (!passesFilter) return;

        const col = condition.column;
        const colKey = `col${col}`;
        const cellValue = currentDisplayData[physicalRow]?.[colKey];

        if (condition.conditions?.length > 0) {
          condition.conditions.forEach(cond => {
            if (!passesFilter) return;

            const { name, args } = cond;
            const filterValue = args?.[0];

            if (name === 'by_value' && args) {
              const allowedValues = args[0];
              if (Array.isArray(allowedValues)) {
                const cellStr = String(cellValue ?? '');
                if (!allowedValues.includes(cellStr)) {
                  passesFilter = false;
                }
              }
            } else if (name === 'eq' && filterValue !== undefined) {
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

    if (hiddenRows.length > 0) {
      hiddenRowsPlugin.hideRows(hiddenRows);
    }

    hot.render();
    setFilteredRows(visibleRows.length > 0 && visibleRows.length < currentTableData.length ? visibleRows : null);
  }, []);

  // 20차: enterMoves/tabMoves 안정화
  const enterMovesConfig = useMemo(() => ({ row: 1, col: 0 }), []);
  const tabMovesConfig = useMemo(() => ({ row: 0, col: 1 }), []);

  // 전체 구매자 건수 (원본 slots 기준 - 필터/접기와 무관하게 항상 전체 건수)
  const totalBuyerCount = useMemo(() => {
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

  // 금액 합계 (원본 slots 기준 - 필터/접기와 무관하게 항상 전체 금액)
  const totalAmount = useMemo(() => {
    return slots.reduce((sum, slot) => {
      const buyer = slot.buyer || {};
      return sum + parseAmount(buyer.amount);
    }, 0);
  }, [slots, parseAmount]);

  // 필터링된 건수
  const filteredCount = useMemo(() => {
    if (filteredRows === null) return totalBuyerCount;
    return filteredRows.filter(rowIndex => {
      const row = tableData[rowIndex];
      return row && row._isBuyerRow;
    }).length;
  }, [filteredRows, totalBuyerCount, tableData]);

  // 역할에 따른 헤더 색상 (모두 Admin 색상으로 통일)
  const headerColor = '#2c387e';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 헤더 */}
      <Box sx={{
        mb: 0.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: headerColor,
        color: 'white',
        px: 2,
        py: 1,
        borderRadius: '4px 4px 0 0'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
            {filteredRows !== null ? `${filteredCount}건 / 전체 ${totalBuyerCount}건` : `전체 ${totalBuyerCount}건`}
          </Box>
          <Box sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
            금액 합계: {totalAmount.toLocaleString()}원
            {filteredRows !== null && <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: 4 }}>(필터적용)</span>}
          </Box>
          <Box sx={{ fontSize: '0.75rem', opacity: 0.8 }}>
            드래그 복사, Ctrl+C/V 지원 | 노란색=제품정보, 검정=업로드링크
          </Box>
        </Box>
        <Button
          variant="contained"
          color="success"
          size="small"
          startIcon={<SaveIcon />}
          onClick={handleSaveChanges}
          sx={{ bgcolor: '#4caf50' }}
        >
          저장
        </Button>
      </Box>

      <Paper sx={{
        '& .handsontable': { fontSize: '12px' },
        '& .item-separator-row': {
          backgroundColor: '#1565c0 !important',
          border: 'none !important'
        },
        '& .upload-link-bar': {
          backgroundColor: '#424242 !important',
          color: 'white !important'
        },
        '& .product-header-row': {
          backgroundColor: '#fff9c4 !important',
          fontWeight: 'bold'
        },
        '& .buyer-row-even': { backgroundColor: '#f5f5f5 !important' },
        '& .buyer-row-odd': { backgroundColor: '#ffffff !important' }
      }}>
        {displayData.length > 0 ? (
          <HotTable
            ref={hotRef}
            data={displayData}
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
            imeFastEdit={true}
            minSpareRows={0}
            contextMenu={contextMenuConfig}
            copyPaste={true}
            fillHandle={true}
            afterChange={afterChangeHandler}
            cells={cellsRenderer}
            afterOnCellMouseUp={afterOnCellMouseUpHandler}
            className="htCenter"
            autoWrapRow={false}
            autoWrapCol={false}
            selectionMode="multiple"
            outsideClickDeselects={true}
            enterBeginsEditing={true}
            enterMoves={enterMovesConfig}
            tabMoves={tabMovesConfig}
            afterColumnResize={handleColumnResize}
            rowHeights={23}
            autoScrollOnSelection={false}
            afterSelection={afterSelectionHandler}
            beforeKeyDown={beforeKeyDownHandler}
            filters={true}
            dropdownMenu={['filter_by_condition', 'filter_by_value', 'filter_action_bar']}
            hiddenRows={hiddenRowsConfig}
            afterFilter={afterFilterHandler}
          />
        ) : (
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 200,
            color: 'text.secondary'
          }}>
            {effectiveRole === 'operator'
              ? '배정된 품목이 없습니다. 관리자에게 품목 배정을 요청하세요.'
              : '등록된 품목이 없습니다. "품목 추가" 버튼을 클릭하여 추가하세요.'}
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

      {/* 스낵바 (성능 최적화: ref 기반 DOM 직접 조작, CSS animation) */}
      <div
        ref={snackbarRef}
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#323232',
          color: '#fff',
          padding: '8px 24px',
          borderRadius: '4px',
          fontSize: '14px',
          zIndex: 9999,
          visibility: 'hidden',
          opacity: 0,
          transition: 'opacity 0.3s',
        }}
      >
        <span className="snackbar-message"></span>
      </div>
      <style>{`
        @keyframes snackbarFadeOut {
          to { opacity: 0; visibility: hidden; }
        }
      `}</style>

      {/* 이미지 스와이프 뷰어 */}
      <ImageSwipeViewer
        open={imagePopup.open}
        onClose={() => setImagePopup({ open: false, images: [], currentIndex: 0, buyer: null })}
        images={imagePopup.images}
        initialIndex={imagePopup.currentIndex}
        buyerInfo={imagePopup.buyer}
      />
    </Box>
  );
}

// React.memo로 감싸서 부모 리렌더링 시 불필요한 리렌더링 방지
// campaignId, userRole, viewAsUserId가 변경되지 않으면 시트가 리렌더링되지 않음
const UnifiedItemSheet = React.memo(UnifiedItemSheetInner, (prevProps, nextProps) => {
  // true 반환 = 리렌더링 하지 않음, false 반환 = 리렌더링 함
  return (
    prevProps.campaignId === nextProps.campaignId &&
    prevProps.userRole === nextProps.userRole &&
    prevProps.viewAsUserId === nextProps.viewAsUserId &&
    prevProps.viewAsRole === nextProps.viewAsRole
  );
});

export default UnifiedItemSheet;
