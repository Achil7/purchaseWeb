import React, { useState, useCallback, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
// 12차 최적화: unstable_batchedUpdates 제거 - 더 이상 사용하지 않음
import { Box, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Snackbar, Alert, IconButton, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import InfoIcon from '@mui/icons-material/Info';
import ImageSwipeViewer from '../common/ImageSwipeViewer';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { debounce } from 'lodash';
import itemSlotService from '../../services/itemSlotService';
import itemService from '../../services/itemService';
import imageService from '../../services/imageService';
import { downloadExcel, convertSlotsToExcelData } from '../../utils/excelExport';

// Handsontable 모든 모듈 등록
registerAllModules();

// 슬롯 데이터 캐시 (캠페인 전환 최적화)
const slotsCache = new Map();

// URL 문자열을 " | " 로 분리하여 각각 하이퍼링크로 렌더링
const renderUrlLinks = (urlString) => {
  if (!urlString || urlString === '-') return '-';

  const urls = urlString.split(' | ').map(u => u.trim()).filter(Boolean);
  if (urls.length === 0) return '-';

  return urls.map((url, index) => (
    <React.Fragment key={index}>
      {index > 0 && <span style={{ margin: '0 4px' }}>|</span>}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#1976d2', textDecoration: 'underline' }}
      >
        {url}
      </a>
    </React.Fragment>
  ));
};

// 행 타입 상수 정의
const ROW_TYPES = {
  ITEM_SEPARATOR: 'item_separator',      // 품목 구분선 (파란색, 높이 8px)
  PRODUCT_HEADER: 'product_header',      // 제품 정보 컬럼 헤더 행
  PRODUCT_DATA: 'product_data',          // 제품 정보 데이터 행
  UPLOAD_LINK_BAR: 'upload_link_bar',    // 업로드 링크 바 (검정)
  BUYER_HEADER: 'buyer_header',          // 구매자 컬럼 헤더 행
  BUYER_DATA: 'buyer_data',              // 구매자 데이터 행
};

// ========== 성능 최적화: 상수 (컴포넌트 외부 정의) ==========
const STATUS_OPTIONS = ['active', 'completed', 'resubmitted', 'cancelled'];
const STATUS_LABELS = {
  active: '진행',
  completed: '완료',
  resubmitted: '재제출완료',
  cancelled: '취소'
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

const createBuyerHeaderRenderer = (tableDataRef) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableDataRef.current[r];
    const isSuspended = rowData?._isSuspended;

    td.className = 'buyer-header-row';
    td.style.fontWeight = 'bold';
    td.style.textAlign = 'center';
    td.style.fontSize = '11px';
    td.textContent = value ?? '';

    // 중단된 경우 빨간 배경
    if (isSuspended) {
      td.style.backgroundColor = '#ef9a9a';
      td.style.color = '#b71c1c';
    } else {
      td.style.backgroundColor = '#f5f5f5';
      td.style.color = '';
    }
    return td;
  };
};

// 동적 데이터가 필요한 렌더러는 팩토리 함수로 생성
// collapsedItemsRef를 사용하여 최신 접기 상태 참조 (렌더러 재생성 방지)
const createProductDataRenderer = (tableDataRef, collapsedItemsRef, toggleItemCollapse, columnAlignmentsRef) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableDataRef.current[r];
    const isSuspended = rowData._isSuspended;
    td.className = 'product-data-row';
    // 이전 렌더링 잔여 스타일 초기화 (스크롤 흔들림 방지)
    td.style.cssText = '';
    td.style.backgroundColor = isSuspended ? '#ffcdd2' : '#fff8e1';
    td.style.fontSize = '11px';
    if (isSuspended) {
      td.style.color = '#b71c1c';
    }

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

      td.innerHTML = `<span class="collapse-toggle" style="cursor: pointer; user-select: none; font-size: 14px; color: ${isSuspended ? '#b71c1c' : '#666'};">${isCollapsed ? '▶' : '▼'}</span>${completionBadge}`;
      td.style.textAlign = 'center';
      td.style.cursor = 'pointer';
      // 토글 클릭은 afterOnCellMouseUp에서 처리 (beforeOnCellMouseDown에서 스크롤 방지)
    } else if (prop === 'col2') {
      // 플랫폼
      td.textContent = value ?? '';
      td.style.fontWeight = 'bold';
      if (!isSuspended) td.style.color = '#1565c0';
    } else if (prop === 'col3') {
      // 제품명
      td.textContent = value ?? '';
      td.style.fontWeight = 'bold';
      if (!isSuspended) td.style.color = '#1b5e20';
    } else if (prop === 'col7' && value) {
      // 가격
      td.textContent = value;
      td.style.fontWeight = 'bold';
      if (!isSuspended) td.style.color = '#c2185b';
    } else if (prop === 'col12' && value) {
      // URL을 " | "로 분리하여 각각 하이퍼링크로 렌더링 (col12 = product_url)
      const urls = value.split(' | ').map(u => u.trim()).filter(Boolean);
      if (urls.length > 0) {
        const links = urls.map(url => {
          const href = url.startsWith('http') ? url : `https://${url}`;
          return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: ${isSuspended ? '#b71c1c' : '#1976d2'}; text-decoration: underline;">${url}</a>`;
        }).join(' <span style="color: #666;">|</span> ');
        td.innerHTML = links;
      } else {
        td.textContent = value;
      }
      td.style.whiteSpace = 'nowrap';
      td.style.overflow = 'hidden';
      td.style.textOverflow = 'ellipsis';
      td.title = value;
    } else {
      td.textContent = value ?? '';
    }

    if (columnAlignmentsRef.current[c] && !td.style.textAlign) {
      td.style.textAlign = columnAlignmentsRef.current[c];
    }

    return td;
  };
};

const createUploadLinkBarRenderer = (tableDataRef) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableDataRef.current[r];
    const isSuspended = rowData._isSuspended;
    td.className = 'upload-link-bar';
    td.style.cssText = '';
    td.style.backgroundColor = isSuspended ? '#d32f2f' : '#424242';
    td.style.color = 'white';
    td.style.cursor = 'pointer';
    td.style.fontSize = '11px';
    td.setAttribute('data-token', rowData._uploadToken || '');

    if (c === 0) {
      td.textContent = '';
    } else if (c === 1) {
      td.textContent = isSuspended ? `${value || ''} (중단됨)` : (value || '');
      td.style.paddingLeft = '8px';
    } else {
      td.textContent = '';
    }
    return td;
  };
};

const createBuyerDataRenderer = (tableDataRef, duplicateOrderNumbersRef, columnAlignmentsRef) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableDataRef.current[r];
    const dayGroup = rowData._dayGroup || 1;
    const dayClass = dayGroup % 2 === 0 ? 'day-even' : 'day-odd';
    td.className = dayClass;
    td.style.cssText = '';
    td.style.fontSize = '11px';

    // 중단된 day_group 스타일
    const isSuspended = rowData._isSuspended;
    if (isSuspended) {
      td.style.setProperty('background-color', '#ffcdd2', 'important');
      td.style.setProperty('color', '#b71c1c', 'important');
    }

    if (prop === 'col0') {
      td.textContent = '';
      td.style.textAlign = 'center';
    } else if (prop === 'col1') {
      td.textContent = value ?? '';
      td.style.textAlign = 'center';
    } else if (prop === 'col2') {
      td.textContent = value ?? '';
      td.style.textAlign = 'center';
      if (!isSuspended) td.style.color = '#666';
    } else if (prop === 'col3') {
      td.textContent = value ?? '';
      if (!isSuspended) td.style.color = '#555';
    } else if (prop === 'col4') {
      td.textContent = value ?? '';
      if (!isSuspended) td.style.color = '#555';
    } else if (prop === 'col5') {
      // col5: 비고 (buyer_notes)
      td.textContent = value ?? '';
    } else if (prop === 'col14' && value) {
      // col14: 금액 (amount) - 숫자 포맷
      if (typeof value === 'number') {
        td.textContent = value.toLocaleString();
      } else {
        const numValue = parseInt(String(value).replace(/[^0-9]/g, ''));
        td.textContent = numValue ? numValue.toLocaleString() : value;
      }
    } else if (prop === 'col15') {
      // col15: 송장번호
      td.textContent = value ?? '';
    } else if (prop === 'col16') {
      // col16: 리뷰샷
      const images = rowData._reviewImages || [];
      const imageCount = images.length;
      if (imageCount > 0) {
        const label = imageCount > 1 ? `보기(${imageCount})` : '보기';
        const linkColor = isSuspended ? '#b71c1c' : '#2e7d32';
        td.innerHTML = `
          <span style="display: flex; align-items: center; justify-content: center; gap: 14px;">
            <a href="#" class="review-link" style="color: ${linkColor}; text-decoration: underline; cursor: pointer; font-size: 11px;">${label}</a>
            <a href="#" class="review-delete-link" style="color: #d32f2f; font-size: 11px; cursor: pointer; font-weight: bold;" title="리뷰샷 삭제">✕</a>
          </span>`;
        td.style.textAlign = 'center';
      } else {
        td.innerHTML = '<span style="color: #999; font-size: 10px;">-</span>';
        td.style.textAlign = 'center';
      }
    } else if (prop === 'col17') {
      // col17: 상태 (calculatedStatus)
      const displayStatus = value || '-';
      const label = STATUS_LABELS[displayStatus] || displayStatus;

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
    } else if (prop === 'col19') {
      // col19: 입금명
      td.textContent = value ?? '';
    } else if (prop === 'col20') {
      // col20: 입금여부 - 이미 포맷된 값이면 Date 파싱 스킵
      td.style.textAlign = 'center';
      if (value) {
        if (typeof value === 'string' && value.includes('입금완료')) {
          td.textContent = value;
          if (!isSuspended) td.style.color = '#388e3c';
          td.style.fontWeight = 'bold';
        } else {
          try {
            const date = new Date(value);
            const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
            const yy = String(kstDate.getUTCFullYear()).slice(-2);
            const mm = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(kstDate.getUTCDate()).padStart(2, '0');
            td.textContent = `${yy}${mm}${dd} 입금완료`;
            if (!isSuspended) td.style.color = '#388e3c';
            td.style.fontWeight = 'bold';
          } catch (e) {
            td.textContent = value;
          }
        }
      } else {
        td.textContent = '';
      }
    } else if (prop === 'col7') {
      // col7: 주문번호 - 중복 체크
      td.textContent = value ?? '';
      if (value && duplicateOrderNumbersRef.current.has(value)) {
        td.classList.add('duplicate-order');
      }
    } else if (prop === 'col18' || prop === 'col19') {
      // col18: 리뷰비, col19: 입금명 - 빈 값이면 빨간 배경
      td.textContent = value ?? '';
      if (!value || !String(value).trim()) {
        td.classList.add('duplicate-order');
      }
    } else {
      td.textContent = value ?? '';
    }

    if (columnAlignmentsRef.current[c] && !td.style.textAlign) {
      td.style.textAlign = columnAlignmentsRef.current[c];
    }

    return td;
  };
};

// 기본 컬럼 너비 - 21개 컬럼 (비고 컬럼 추가)
const DEFAULT_COLUMN_WIDTHS = [30, 80, 70, 150, 100, 80, 60, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 80, 80];

// 컬럼 헤더 (컴포넌트 외부 상수 - HotTable prop 안정화)
const COL_HEADERS = Array(22).fill('');

// 구매자 정보 컬럼 헤더 (20개) - 구매자 테이블에서 col2는 '순번' (슬롯 순서)
// col0: 접기, col1: 날짜, col2: 순번(구매자용), col3: 제품명, col4: 옵션, col5: 예상구매자,
// col6: 주문번호, col7: 구매자, col8: 수취인, col9: 아이디, col10: 연락처, col11: 주소, col12: 계좌, col13: 금액,
// col14: 송장번호, col15: 리뷰샷, col16: 상태, col17: 리뷰비, col18: 입금명, col19: 입금여부
// 제품 테이블에서 col2는 '플랫폼' (Item.platform)

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

  // 변경된 슬롯들 추적 (ref만 사용 - 성능 최적화)
  const changedSlotsRef = useRef({});

  // 변경된 아이템들 추적 (제품 정보 수정용, ref만 사용)
  const changedItemsRef = useRef({});

  // 12차 최적화: hasUnsavedChanges state 제거 - ref만 사용하여 리렌더링 완전 제거
  // 저장 버튼은 항상 표시하고, 클릭 시 ref 값으로 변경사항 체크
  const hasUnsavedChangesRef = useRef(false);

  // 선택된 셀 개수 표시용 ref (DOM 직접 업데이트로 리렌더링 방지)
  const selectedCellCountRef = useRef(null);

  // 13차 최적화: 스낵바를 CSS animation으로 변경하여 리렌더링 + setTimeout 콜백 완전 제거
  // DOM 직접 조작 + CSS animation으로 메시지 표시/숨김 처리 (JS 타이머 없음)
  const snackbarRef = useRef(null);

  // 삭제 다이얼로그 상태
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    type: '', // 'rows', 'group'
    data: null,
    message: ''
  });

  // 11차 최적화: saving 상태를 ref로 변경하여 리렌더링 제거
  // 저장 중 상태는 중복 저장 방지용으로만 사용 (UI 표시 없음)
  const savingRef = useRef(false);

  // handleSaveChanges를 ref로 참조 (useEffect에서 초기화 순서 문제 해결)
  const handleSaveChangesRef = useRef(null);

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
    slot: null,       // Slot 정보 (day_group별)
    dayGroup: null    // day_group 정보
  });

  // 리뷰샷 삭제 확인 팝업 상태
  const [deleteReviewPopup, setDeleteReviewPopup] = useState({
    open: false,
    images: [],
    buyer: null,
    rowIndex: null
  });
  const [deletingReview, setDeletingReview] = useState(false);

  // 메모 기능 비활성화됨

  // 8차 최적화: IME 조합 상태 추적 (한글 입력 깨짐 방지)
  const isComposingRef = useRef(false);

  // 13차 최적화: DOM compositionstart/compositionend 이벤트 리스너
  // Handsontable은 afterCompositionEnd 훅을 지원하지 않으므로 DOM 이벤트 직접 사용
  // compositionend 후 16ms(1프레임) 지연을 두어 브라우저가 IME 상태를 완전히 정리하도록 함
  useEffect(() => {
    const container = hotRef.current?.hotInstance?.rootElement;
    if (!container) return;

    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
      // 즉시 false로 설정하지 않고 다음 프레임까지 대기
      // 브라우저가 IME 상태를 완전히 정리할 시간을 줌
      requestAnimationFrame(() => {
        isComposingRef.current = false;
      });
    };

    container.addEventListener('compositionstart', handleCompositionStart);
    container.addEventListener('compositionend', handleCompositionEnd);

    return () => {
      container.removeEventListener('compositionstart', handleCompositionStart);
      container.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [slots]); // slots 변경 시 재설정

  // 필터링된 행 인덱스 (null이면 전체, 배열이면 필터링된 행만)
  const [filteredRows, setFilteredRows] = useState(null);

  // 필터 조건 저장 (데이터 리로드 시 복원용)
  const filterConditionsRef = useRef(null);

  // 컬럼 필터로 숨길 행 인덱스 캐시
  const filterHiddenIndicesRef = useRef([]);

  // 리뷰샷 필터 숨김 행 인덱스 캐시 (hiddenRows 방식)
  const reviewHiddenIndicesRef = useRef([]);
  const reviewFilterRef = useRef('all');
  const reviewBtnContainerRef = useRef(null);

  // hiddenRows 통합 트리거 (필터/리뷰샷 필터 변경 시 useEffect 실행용)
  const [hiddenRowsTrigger, setHiddenRowsTrigger] = useState(0);

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

  // 13차 최적화: Snackbar를 CSS animation으로 표시 (setTimeout 콜백 제거)
  // - 6초 → 2초로 단축 (사용자가 딜레이 느끼기 전에 사라짐)
  // - setTimeout 대신 CSS animation 사용 (JS 콜백 없음)
  // - visibility:hidden 사용 (display:none보다 레이아웃 재계산 없음)
  const showSnackbar = useCallback((message) => {
    const snackbarEl = snackbarRef.current;
    if (!snackbarEl) return;

    // 메시지 설정
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

  // 13차 최적화: Snackbar 닫기 (수동) - CSS animation 사용
  const hideSnackbar = useCallback(() => {
    const snackbarEl = snackbarRef.current;
    if (!snackbarEl) return;

    snackbarEl.style.animation = 'none';
    snackbarEl.style.opacity = '0';
    snackbarEl.style.visibility = 'hidden';
  }, []);

  // 리뷰샷 필터로 숨길 BUYER_DATA 행 인덱스 계산
  const computeReviewHiddenRows = useCallback((filter, tableData) => {
    if (filter === 'all') return [];
    const hidden = [];
    for (let i = 0; i < tableData.length; i++) {
      const row = tableData[i];
      if (row?._rowType !== ROW_TYPES.BUYER_DATA) continue;
      const hasReview = row._reviewImages && row._reviewImages.length > 0;
      if (filter === 'with_review' && !hasReview) hidden.push(i);
      else if (filter === 'without_review' && hasReview) hidden.push(i);
    }
    return hidden;
  }, []);

  // 모든 구매자가 숨겨진 그룹의 제품 헤더/구분선도 숨김
  const computeEmptyGroupHiddenRows = useCallback((hiddenBuyerSet, tableData) => {
    if (hiddenBuyerSet.size === 0) return [];

    const groups = new Map();
    for (let i = 0; i < tableData.length; i++) {
      const row = tableData[i];
      if (!row || row._itemId === undefined || row._dayGroup === undefined) continue;
      const groupKey = `${row._itemId}_${row._dayGroup}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { nonBuyerIndices: [], buyerIndices: [] });
      }
      const group = groups.get(groupKey);
      if (row._rowType === ROW_TYPES.BUYER_DATA) {
        group.buyerIndices.push(i);
      } else {
        group.nonBuyerIndices.push(i);
      }
    }

    const groupHidden = [];
    for (const [, group] of groups) {
      const allBuyersHidden = group.buyerIndices.length === 0 ||
          group.buyerIndices.every(idx => hiddenBuyerSet.has(idx));
      if (allBuyersHidden) {
        groupHidden.push(...group.nonBuyerIndices);
      }
    }

    // 첫 번째 보이는 행이 ITEM_SEPARATOR이면 숨김
    const allHiddenForCheck = new Set([...hiddenBuyerSet, ...groupHidden]);
    for (let i = 0; i < tableData.length; i++) {
      if (!allHiddenForCheck.has(i)) {
        if (tableData[i]?._rowType === ROW_TYPES.ITEM_SEPARATOR) {
          groupHidden.push(i);
        }
        break;
      }
    }

    return groupHidden;
  }, []);

  // 리뷰샷 필터 버튼 DOM 직접 스타일 업데이트 (React re-render 방지)
  const updateReviewFilterButtonsDOM = useCallback((filter) => {
    const container = reviewBtnContainerRef.current;
    if (!container) return;
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => {
      const btnFilter = btn.dataset.filter;
      const isActive = btnFilter === filter;
      btn.style.fontWeight = isActive ? 'bold' : 'normal';
      if (btnFilter === 'all') {
        btn.style.backgroundColor = isActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)';
      } else if (btnFilter === 'with_review') {
        btn.style.backgroundColor = isActive ? 'rgba(76,175,80,0.5)' : 'rgba(255,255,255,0.15)';
      } else if (btnFilter === 'without_review') {
        btn.style.backgroundColor = isActive ? 'rgba(244,67,54,0.5)' : 'rgba(255,255,255,0.15)';
      }
    });
  }, []);

  // 리뷰샷 필터 변경 핸들러
  // setReviewFilter() 사용 금지! React re-render → HotTable updatePlugin → 필터 플러그인 리셋
  const handleReviewFilterChange = useCallback((newFilter) => {
    reviewFilterRef.current = newFilter;
    updateReviewFilterButtonsDOM(newFilter);

    const tableData = tableDataRef.current;
    const reviewHidden = computeReviewHiddenRows(newFilter, tableData);
    reviewHiddenIndicesRef.current = reviewHidden;

    const filterHidden = filterHiddenIndicesRef.current;
    const collapseIndices = hiddenRowIndicesRef.current;
    const buyerHiddenSet = new Set([...filterHidden, ...reviewHidden]);
    const emptyGroupHidden = computeEmptyGroupHiddenRows(buyerHiddenSet, tableData);
    const allHidden = [...new Set([...collapseIndices, ...filterHidden, ...reviewHidden, ...emptyGroupHidden])];
    const allHiddenSet = new Set(allHidden);
    const visibleBuyer = [];
    for (let i = 0; i < tableData.length; i++) {
      if (tableData[i]?._rowType === ROW_TYPES.BUYER_DATA && !allHiddenSet.has(i)) {
        visibleBuyer.push(i);
      }
    }
    setFilteredRows((filterHidden.length > 0 || reviewHidden.length > 0) ? visibleBuyer : null);
    setHiddenRowsTrigger(prev => prev + 1);
  }, [computeReviewHiddenRows, computeEmptyGroupHiddenRows, updateReviewFilterButtonsDOM]);

  // 캠페인별 배정된 슬롯 데이터 로드 (Operator 전용)
  // 성능 최적화: 의존성 배열을 비워서 함수 재생성 방지, campaignId는 파라미터로 전달
  // preserveCollapsedState: true면 현재 접기 상태 유지 (행 추가/삭제 시 사용)
  // skipLoading: true면 로딩 상태 변경 없이 데이터만 새로고침 (행 추가/삭제 시 깜빡임 방지)
  const loadSlots = useCallback(async (targetCampaignId, targetViewAsUserId, forceRefresh = false, preserveCollapsedState = false, skipLoading = false) => {
    if (!targetCampaignId) return;

    // 캐시 키 생성
    const cacheKey = `operator_${targetCampaignId}_${targetViewAsUserId || ''}`;

    // 캐시 확인 (forceRefresh가 아닌 경우)
    if (!forceRefresh && slotsCache.has(cacheKey)) {
      const cached = slotsCache.get(cacheKey);
      setSlots(cached.slots);
      changedSlotsRef.current = {};
      changedItemsRef.current = {};
      hasUnsavedChangesRef.current = false;

      // 필터 상태 초기화
      filterHiddenIndicesRef.current = [];
      reviewHiddenIndicesRef.current = [];
      reviewFilterRef.current = 'all';
      setFilteredRows(null);
      filterConditionsRef.current = null;

      // preserveCollapsedState가 true면 현재 접기 상태 유지
      if (!preserveCollapsedState) {
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

      if (!skipLoading) setLoading(false);
      return;
    }

    if (!skipLoading) setLoading(true);
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
        console.log('[loadSlots] setSlots called, preserveCollapsedState:', preserveCollapsedState, 'newSlots:', newSlots.length);
        setSlots(newSlots);
        changedSlotsRef.current = {};
        changedItemsRef.current = {};
        hasUnsavedChangesRef.current = false;

        // 필터 상태 초기화
        filterHiddenIndicesRef.current = [];
        reviewHiddenIndicesRef.current = [];
        reviewFilterRef.current = 'all';
        setFilteredRows(null);
        filterConditionsRef.current = null;

        // 캐시에 저장
        slotsCache.set(cacheKey, { slots: newSlots, timestamp: Date.now() });

        // preserveCollapsedState가 true면 현재 접기 상태 유지
        if (!preserveCollapsedState) {
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
      if (!skipLoading) setLoading(false);
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

  // 컴포넌트 마운트 시 캐시 클리어 (다른 시트와 동기화 위해)
  useEffect(() => {
    slotsCache.clear();
  }, []);

  // 캠페인 변경 시 슬롯 리로드
  // 성능 최적화: loadSlots를 의존성에서 제거하여 불필요한 재실행 방지
  // 행 추가/삭제 후 loadSlots 참조 변경으로 인한 불필요한 재실행 방지
  useEffect(() => {
    if (campaignId) {
      // 캠페인 변경 시 이전 slots 데이터를 즉시 초기화하여 잘못된 데이터로 useEffect 실행 방지
      setSlots([]);
      loadSlots(campaignId, viewAsUserId);
      // loadMemos(); // 메모 기능 비활성화
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, viewAsUserId]);

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
  // handleSaveChangesRef를 사용하여 초기화 순서 문제 해결
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); // 브라우저 기본 저장 동작 방지
        handleSaveChangesRef.current?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // ref 사용으로 의존성 배열 비움

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
  }, []); // DOM 참조는 HotTable 생존 기간 동안 불변

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

        // day_group 중단 상태 확인 (슬롯 중 하나라도 is_suspended가 true면 중단됨)
        const isDayGroupSuspended = groupData.slots.some(s => s.is_suspended);

        // day_group별 완료 상태 계산 (해당 day_group의 슬롯만)
        const totalSlots = groupData.slots.length;
        const completedSlots = groupData.slots.filter(
          slot => slot.buyer?.images?.length > 0
        ).length;
        const isAllCompleted = totalSlots > 0 && totalSlots === completedSlots;

        // day_group별 독립 제품 정보: changedItemsRef > 슬롯 값 > Item 값 (우선순위)
        const firstSlot = groupData.slots[0] || {};
        const dayGroupKey = `${itemId}_${dayGroup}`;
        const localChanges = changedItemsRef.current[dayGroupKey] || {};
        const dayGroupProductInfo = {
          date: localChanges.date ?? firstSlot.date ?? mergedItem.date ?? '',
          product_name: localChanges.product_name ?? firstSlot.product_name ?? mergedItem.product_name ?? '',
          platform: localChanges.platform ?? firstSlot.platform ?? mergedItem.platform ?? '-',
          shipping_type: localChanges.shipping_type ?? firstSlot.shipping_type ?? mergedItem.shipping_type ?? '',
          keyword: localChanges.keyword ?? firstSlot.keyword ?? mergedItem.keyword ?? '',
          product_price: localChanges.product_price ?? firstSlot.product_price ?? mergedItem.product_price ?? '',
          total_purchase_count: localChanges.total_purchase_count ?? firstSlot.total_purchase_count ?? mergedItem.total_purchase_count ?? '',
          daily_purchase_count: localChanges.daily_purchase_count ?? firstSlot.daily_purchase_count ?? mergedItem.daily_purchase_count ?? '',
          purchase_option: localChanges.purchase_option ?? firstSlot.purchase_option ?? mergedItem.purchase_option ?? '',
          courier_service_yn: localChanges.courier_service_yn ?? firstSlot.courier_service_yn ?? mergedItem.courier_service_yn ?? '',
          courier_name: (() => {
            const name = localChanges.courier_name ?? firstSlot.courier_name ?? mergedItem.courier_name;
            if (name) return name;
            const courierYn = localChanges.courier_service_yn ?? firstSlot.courier_service_yn ?? mergedItem.courier_service_yn ?? '';
            return courierYn.toUpperCase().trim() === 'Y' ? '롯데택배' : '';
          })(),
          product_url: localChanges.product_url ?? firstSlot.product_url ?? mergedItem.product_url ?? '',
          notes: localChanges.notes ?? firstSlot.notes ?? mergedItem.notes ?? ''
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
          col7: '가격', col8: '총건수', col9: '일건수', col10: '택배사', col11: '택배대행', col12: 'URL', col13: '특이사항', col14: '상세',
          col15: '', col16: '', col17: '', col18: ''
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
          col10: dayGroupProductInfo.courier_name,
          col11: dayGroupProductInfo.courier_service_yn,
          col12: dayGroupProductInfo.product_url,
          col13: dayGroupProductInfo.notes,
          col14: '📋',
          col15: '', col16: '', col17: '', col18: ''
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
          _isSuspended: isDayGroupSuspended,
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
          _isSuspended: isDayGroupSuspended,
          col0: '', col1: '날짜', col2: '순번', col3: '제품명', col4: '옵션', col5: '비고', col6: '예상구매자',
          col7: '주문번호', col8: '구매자', col9: '수취인', col10: '아이디', col11: '연락처', col12: '주소', col13: '계좌', col14: '금액',
          col15: '송장번호', col16: '리뷰샷', col17: '상태', col18: '리뷰비', col19: '입금명', col20: '입금여부'
        });

        // 구매자 데이터 행 (항상 포함)
        groupData.slots.forEach((slot, slotIndex) => {
          const buyer = slot.buyer || {};
          const reviewImage = buyer.images && buyer.images.length > 0 ? buyer.images[0] : null;

          // changedSlotsRef에서 로컬 변경사항 가져오기 (저장 전 즉시 반영용)
          const slotChanges = changedSlotsRef.current[slot.id] || {};

          // buyer 필드 (changedSlotsRef > buyer 우선순위)
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
            date: slotChanges.date ?? buyer.date ?? '',
            shipping_delayed: slotChanges.shipping_delayed ?? buyer.shipping_delayed ?? false
          };

          // slot 필드 (changedSlotsRef > slot 우선순위)
          const mergedSlot = {
            product_name: slotChanges.product_name ?? slot.product_name ?? '',
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
            _isSuspended: isDayGroupSuspended,
            _reviewImages: buyer.images || [],
            _reviewImageUrl: reviewImage?.s3_url || '',
            _reviewImageName: reviewImage?.file_name || '',
            _buyer: buyer,
            _hasBuyerData: !!hasBuyerData,
            col0: '',
            col1: mergedBuyer.date || mergedSlot.date || '',  // Buyer.date 우선, 없으면 slot.date
            col2: slotIndex + 1,
            col3: mergedSlot.product_name,
            col4: mergedSlot.purchase_option,
            col5: mergedSlot.buyer_notes,
            col6: mergedSlot.expected_buyer,
            col7: mergedBuyer.order_number,
            col8: mergedBuyer.buyer_name,
            col9: mergedBuyer.recipient_name,
            col10: mergedBuyer.user_id,
            col11: mergedBuyer.contact,
            col12: mergedBuyer.address,
            col13: mergedBuyer.account_info,
            col14: mergedBuyer.amount,
            col15: mergedBuyer.tracking_number,
            col16: reviewImage?.s3_url || '',
            col17: calculatedStatus,
            col18: mergedSlot.review_cost,
            col19: mergedBuyer.deposit_name,
            col20: buyer.payment_confirmed_at || '',
            shipping_delayed: mergedBuyer.shipping_delayed
          });
        });
      });
    });

    return { baseTableData: data, baseSlotIndexMap: indexMap, baseRowMetaMap: metaMap };
  }, [slots]); // changedItemsRef, changedSlotsRef는 ref이므로 의존성에서 제거

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

  // hiddenRowIndices를 ref로 유지 (afterLoadData에서 사용)
  const hiddenRowIndicesRef = useRef(hiddenRowIndices);
  hiddenRowIndicesRef.current = hiddenRowIndices;

  // hiddenRows 통합 적용 (접기 + 컬럼 필터 + 리뷰샷 필터 + 빈 그룹)
  // collapsedItems 변경 또는 hiddenRowsTrigger 변경 시 실행
  // ValueComponent state 직접 백업/복원으로 필터 체크박스 상태 보존
  useEffect(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const hiddenRowsPlugin = hot.getPlugin('hiddenRows');
    const filtersPlugin = hot.getPlugin('filters');
    if (!hiddenRowsPlugin) return;

    // 접기 인덱스 + 컬럼 필터 + 리뷰샷 필터 인덱스 합치기
    const collapseIndices = hiddenRowIndicesRef.current;
    const filterHidden = filterHiddenIndicesRef.current;
    const reviewHidden = reviewHiddenIndicesRef.current;

    let allHidden;
    if (filterHidden.length > 0 || reviewHidden.length > 0) {
      const buyerHiddenSet = new Set([...filterHidden, ...reviewHidden]);
      const emptyGroupHidden = computeEmptyGroupHiddenRows(buyerHiddenSet, tableDataRef.current);
      allHidden = [...new Set([...collapseIndices, ...filterHidden, ...reviewHidden, ...emptyGroupHidden])];
    } else {
      allHidden = collapseIndices;
    }

    // ValueComponent state 직접 백업 (conditionCollection/importConditions 우회)
    const backupStates = new Map();
    if (filtersPlugin) {
      try {
        const valueComponent = filtersPlugin.components.get('filter_by_value');
        if (valueComponent && valueComponent.state) {
          const entries = valueComponent.state.getEntries();
          entries.forEach(([physicalCol, stateObj]) => {
            if (stateObj) backupStates.set(physicalCol, stateObj);
          });
        }
      } catch(e) {}
    }

    // 전체 리셋 + 재적용
    hiddenRowsPlugin.showRows(hiddenRowsPlugin.getHiddenRows());
    if (allHidden.length > 0) {
      hiddenRowsPlugin.hideRows(allHidden);
    }

    // ValueComponent state 직접 복원 (체크박스 상태 유지)
    if (backupStates.size > 0 && filtersPlugin) {
      try {
        const valueComponent = filtersPlugin.components.get('filter_by_value');
        if (valueComponent && valueComponent.state) {
          backupStates.forEach((stateObj, physicalCol) => {
            valueComponent.state.setValueAtIndex(physicalCol, stateObj);
          });
        }
      } catch(e) {}
    }

    hot.render();
  }, [collapsedItems, hiddenRowsTrigger, computeEmptyGroupHiddenRows]);

  // 성능 최적화: tableData를 ref로 참조하여 렌더러/cellsRenderer 재생성 방지
  const tableDataRef = useRef(tableData);
  tableDataRef.current = tableData;

  // 상태 옵션은 컴포넌트 외부 상수 STATUS_OPTIONS, STATUS_LABELS 사용

  // 중복 주문번호 감지 (빈 문자열 제외) - col7이 주문번호
  const duplicateOrderNumbers = useMemo(() => {
    const orderNumbers = tableData
      .filter(row => row._rowType === ROW_TYPES.BUYER_DATA && row.col7)
      .map(row => row.col7);

    const counts = {};
    orderNumbers.forEach(num => {
      counts[num] = (counts[num] || 0) + 1;
    });

    // 2개 이상인 주문번호만 반환
    return new Set(Object.keys(counts).filter(num => counts[num] >= 2));
  }, [tableData]);

  // 렌더러용 ref (의존성 체인 끊기)
  const duplicateOrderNumbersRef = useRef(duplicateOrderNumbers);
  duplicateOrderNumbersRef.current = duplicateOrderNumbers;
  const columnAlignmentsRef = useRef(columnAlignments);
  columnAlignmentsRef.current = columnAlignments;

  // HotTable prop 안정화용 ref (useCallback/useMemo 의존성 제거)
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const slotIndexMapRef = useRef(slotIndexMap);
  slotIndexMapRef.current = slotIndexMap;

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

  // 엑셀 다운로드 핸들러
  const handleDownloadExcel = useCallback(() => {
    // changedSlotsRef의 변경사항을 slots에 머지한 복사본 생성 (리렌더링 없이 최신 데이터 반영)
    const changedSlots = changedSlotsRef.current;
    const mergedSlots = Object.keys(changedSlots).length > 0
      ? slots.map(slot => {
          const changes = changedSlots[slot.id];
          return changes ? { ...slot, ...changes } : slot;
        })
      : slots;

    // items 객체 생성 (item_id → item 매핑)
    const itemsMap = {};
    mergedSlots.forEach(slot => {
      if (!itemsMap[slot.item_id] && slot.item) {
        itemsMap[slot.item_id] = slot.item;
      }
    });

    const excelData = convertSlotsToExcelData(mergedSlots, itemsMap, 'operator');
    const fileName = campaignName || 'campaign';
    downloadExcel(excelData, `${fileName}_operator`, '진행자시트');
    showSnackbar('엑셀 파일이 다운로드되었습니다');
  }, [slots, campaignName]);

  // 변경사항 저장 및 새로고침 헬퍼 함수
  const saveAndRefresh = useCallback(async () => {
    const currentChangedSlots = changedSlotsRef.current;
    const currentChangedItems = changedItemsRef.current;
    const hasSlotChanges = Object.keys(currentChangedSlots).length > 0;
    const hasItemChanges = Object.keys(currentChangedItems).length > 0;

    try {
      // 슬롯 데이터 저장
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
      // 상태 초기화
      changedSlotsRef.current = {};
      changedItemsRef.current = {};
      hasUnsavedChangesRef.current = false;
      // 데이터 새로고침 (변경사항 유무와 관계없이 항상 최신 데이터 로드)
      await loadSlots(campaignId, viewAsUserId);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [slots, loadSlots]);

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
  // col0: 접기(20), col1: 날짜(60), col2: 플랫폼/순번(70), col3: 제품명(120), col4: 옵션(80), col5: 비고(80), col6: 예상구매자(80),
  // 컬럼 정의: 통합 컬럼 (행 타입에 따라 다른 데이터 표시) - 21개
  const columns = useMemo(() => {
    const baseColumns = [];

    for (let i = 0; i < 21; i++) {
      baseColumns.push({
        data: `col${i}`,
        type: 'text',
        width: columnWidths[i] || DEFAULT_COLUMN_WIDTHS[i],
        className: 'htCenter htMiddle'
      });
    }

    // 맨 오른쪽에 여백 컬럼 추가 (컬럼 너비 조절 용이하게)
    baseColumns.push({
      data: 'col21',
      type: 'text',
      width: 50,
      readOnly: true,
      className: 'htCenter htMiddle'
    });

    return baseColumns;
  }, [columnWidths]); // columnWidths 변경 시 컬럼 재생성

  // 구매자 컬럼 필드 매핑 (20개 컬럼 → API 필드명)
  // col0: 접기(readOnly), col1: 날짜(slot.date), col2: 순번(readOnly), col3: 제품명(slot), col4: 옵션(slot),
  // col5: 예상구매자(편집가능-slot), col6: 주문번호, col7: 구매자, col8: 수취인, col9: 아이디, col10: 연락처, col11: 주소, col12: 계좌, col13: 금액,
  // col14: 송장번호, col15: 리뷰샷(readOnly), col16: 상태, col17: 리뷰비(slot), col18: 입금명, col19: 입금여부
  const buyerFieldMap = {
    col1: 'date',  // 날짜 (slot 필드)
    col3: 'product_name',  // 제품명 (slot 필드)
    col4: 'purchase_option',  // 옵션 (slot 필드)
    col5: 'buyer_notes',  // 비고 (slot 필드)
    col6: 'expected_buyer',  // 예상 구매자 (slot 필드)
    col7: 'order_number',
    col8: 'buyer_name',
    col9: 'recipient_name',
    col10: 'user_id',
    col11: 'contact',
    col12: 'address',
    col13: 'account_info',
    col14: 'amount',
    col15: 'tracking_number',  // 송장번호
    col17: 'status',
    col18: 'review_cost',  // 리뷰비 (slot 필드)
    col19: 'deposit_name',
    col20: 'payment_confirmed'
    // col0: 접기 (readOnly)
    // col2: 순번 (readOnly)
    // col16: 리뷰샷 (readOnly)
  };

  // 제품 정보 컬럼 필드 매핑 (col1~col14 → API 필드명) - col0은 토글
  // 순서: 접기, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배사, 택배대행, URL, 특이사항, 상세
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
    col10: 'courier_name',
    col11: 'courier_service_yn',
    col12: 'product_url',
    col13: 'notes'
    // col14: 상세보기 버튼 (readOnly)
  };

  // buyer 필드 목록 (slot이 아닌 buyer 객체에 속하는 필드들)
  const buyerFieldsList = ['order_number', 'buyer_name', 'recipient_name', 'user_id', 'contact', 'address', 'account_info', 'amount', 'tracking_number', 'deposit_name', 'payment_confirmed'];

  // 데이터 변경 핸들러 (구매자 데이터 + 제품 정보 수정 가능)
  // 성능 최적화: changedSlots, changedItems, tableData를 ref로 접근하여 useCallback 재생성 방지
  const handleAfterChange = useCallback((changes, source) => {
    if (!changes || source === 'loadData' || source === 'loadMemo' || source === 'syncBuyerDate') return;

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

        // 핵심: 날짜 필드(col1) 변경 시 같은 그룹의 구매자 행 날짜도 즉시 업데이트
        if (prop === 'col1' && apiField === 'date') {
          const newDate = newValue ?? '';
          const hot = hotRef.current?.hotInstance;
          if (hot) {
            // 성능 최적화: 변경할 셀들을 배열로 모아서 한 번에 업데이트
            const cellsToUpdate = [];
            currentTableData.forEach((buyerRow, buyerRowIndex) => {
              if (buyerRow._rowType === ROW_TYPES.BUYER_DATA &&
                  buyerRow._itemId === itemId &&
                  buyerRow._dayGroup === dayGroup) {
                cellsToUpdate.push([buyerRowIndex, 1, newDate]);

                // changedSlots에도 추가 (저장 시 DB 반영)
                const buyerSlotId = slotIndexMap[buyerRowIndex];
                if (buyerSlotId) {
                  if (!slotUpdates[buyerSlotId]) {
                    slotUpdates[buyerSlotId] = { id: buyerSlotId };
                  }
                  slotUpdates[buyerSlotId].date = newDate;
                }
              }
            });
            // 6차 최적화: 비동기화하여 IME 조합 완료 후 실행
            // 동기 setDataAtCell은 IME 조합 중에 호출되면 한글 입력이 끊김
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

    // ref에 저장 (저장 시 사용) - 성능 최적화: state 업데이트 제거
    changedSlotsRef.current = slotUpdates;
    changedItemsRef.current = itemUpdates;

    // 12차 최적화: setHasUnsavedChanges 호출 완전 제거 - 리렌더링 없음
    // ref만 업데이트하여 저장 시 변경사항 존재 여부 체크
    const hasSlotChanges = Object.keys(slotUpdates).length > 0;
    const hasItemChanges = Object.keys(itemUpdates).length > 0;
    if (hasSlotChanges || hasItemChanges) {
      hasUnsavedChangesRef.current = true;
    }

    // 11차 최적화: debouncedRestoreHiddenRows 호출 제거
    // 일반 셀 편집 시에는 hiddenRows 복원이 필요 없음
    // 접기/펼치기 시에만 필요하며, 그 때는 toggleCollapse에서 직접 처리됨
  }, [slotIndexMap, itemFieldMap, buyerFieldMap, buyerFieldsList]);

  // 11차 최적화: debouncedRestoreHiddenRows 완전 제거
  // - 일반 셀 편집 시에는 hiddenRows 복원이 불필요함
  // - 접기/펼치기 시에는 collapsedItems 상태 변경으로 자동으로 처리됨
  // - 이 함수가 100ms마다 실행되면서 입력 딜레이를 유발했음

  // 변경사항 저장 (슬롯 데이터 + 제품 정보) - DB 저장 + 스크롤 위치 유지
  const handleSaveChanges = async () => {
    // 11차 최적화: 중복 저장 방지 (ref로 체크 - 리렌더링 없음)
    if (savingRef.current) return;

    // ref에서 변경사항 읽기 (성능 최적화로 state 대신 ref 사용)
    const currentChangedSlots = changedSlotsRef.current;
    const currentChangedItems = changedItemsRef.current;
    const hasSlotChanges = Object.keys(currentChangedSlots).length > 0;
    const hasItemChanges = Object.keys(currentChangedItems).length > 0;

    if (!hasSlotChanges && !hasItemChanges) {
      showSnackbar('변경된 내용이 없습니다');
      return;
    }

    // 스크롤 위치 저장
    const hot = hotRef.current?.hotInstance;
    const scrollPosition = hot?.rootElement?.querySelector('.wtHolder')?.scrollTop || 0;
    const scrollLeft = hot?.rootElement?.querySelector('.wtHolder')?.scrollLeft || 0;

    // 11차 최적화: ref만 설정 (리렌더링 없음), UI 상태는 나중에 배칭
    savingRef.current = true;

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

      // 4차 최적화: setSlots 제거 - 전체 리렌더링 방지
      // Handsontable에 이미 사용자가 수정한 데이터가 표시되어 있으므로
      // DB 저장만 수행하고 React 상태는 건드리지 않음
      // 캠페인 전환 시에만 slots 상태가 갱신됨

      // ref 초기화 (먼저 실행 - 리렌더링 없음)
      changedSlotsRef.current = {};
      changedItemsRef.current = {};
      hasUnsavedChangesRef.current = false;
      savingRef.current = false;

      // 모든 캐시 무효화 (다른 시트와 동기화를 위해)
      slotsCache.clear();

      // 12차 최적화: setHasUnsavedChanges 제거 - ref만 사용
      // Snackbar만 표시 (unstable_batchedUpdates 불필요해짐)
      showSnackbar('저장되었습니다');

      // 스크롤 위치 복원 (배칭된 렌더링 후)
      requestAnimationFrame(() => {
        const wtHolder = hot?.rootElement?.querySelector('.wtHolder');
        if (wtHolder) {
          wtHolder.scrollTop = scrollPosition;
          wtHolder.scrollLeft = scrollLeft;
        }
      });

    } catch (error) {
      console.error('Failed to save changes:', error);
      // 서버 에러 메시지 추출
      const serverMessage = error.response?.data?.message || error.response?.data?.error || error.message;

      // 저장 실패 시 변경사항 ref 초기화 (다음 저장에 영향 주지 않도록)
      changedSlotsRef.current = {};
      changedItemsRef.current = {};
      hasUnsavedChangesRef.current = false;
      savingRef.current = false;

      // 12차 최적화: setHasUnsavedChanges 제거 - ref만 사용
      showSnackbar(`저장 실패: ${serverMessage}`);
    }
  };

  // handleSaveChanges를 ref에 할당 (useEffect에서 참조할 수 있도록)
  handleSaveChangesRef.current = handleSaveChanges;

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
      showSnackbar('삭제되었습니다');

      // 캐시 무효화 (다음 캠페인 전환 시 최신 데이터 로드)
      slotsCache.delete(`operator_${campaignId}_${viewAsUserId || ''}`);

      // 필터 상태 초기화 (삭제 후 필터가 유효하지 않을 수 있음)
      setFilteredRows(null);
      filterConditionsRef.current = null;
      filterHiddenIndicesRef.current = [];
      reviewHiddenIndicesRef.current = [];
      reviewFilterRef.current = 'all';

      // 삭제된 품목/그룹의 접기 상태 제거 (collapsedItems 정리)
      if (type === 'group') {
        const keyToRemove = `${data.itemId}_${data.dayGroup}`;
        setCollapsedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(keyToRemove);
          return newSet;
        });
      } else if (type === 'item') {
        // 해당 품목의 모든 day_group 키 제거
        // collapsedItems에는 숫자(item_id) 또는 문자열(itemId_dayGroup)이 들어갈 수 있음
        setCollapsedItems(prev => {
          const newSet = new Set();
          const itemIdNum = data.itemId;
          const itemIdStr = String(data.itemId);
          prev.forEach(key => {
            // key가 숫자인 경우: 삭제된 품목 ID와 일치하면 제외
            if (typeof key === 'number') {
              if (key !== itemIdNum) {
                newSet.add(key);
              }
            } else {
              // key가 문자열인 경우: itemId_로 시작하면 제외
              const keyStr = String(key);
              if (!keyStr.startsWith(`${itemIdStr}_`)) {
                newSet.add(key);
              }
            }
          });
          return newSet;
        });
      }
      // rows 삭제는 같은 item_id/day_group 내에서 일부 행만 삭제하므로 collapsedItems 유지

      // 부모 컴포넌트에 알림 (캠페인 목록 새로고침)
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Delete failed:', error);
      const statusCode = error.response?.status;
      console.error('Error status code:', statusCode, 'type:', typeof statusCode);

      // 404 에러 (이미 삭제된 품목): 캐시 무효화 후 UI 새로고침
      // eslint-disable-next-line eqeqeq
      if (statusCode == 404) {
        console.log('404 detected - refreshing UI');
        closeDeleteDialog();
        showSnackbar('이미 삭제된 항목입니다. 목록을 새로고침합니다.');
        // 캐시 명시적 삭제 (중요!)
        const cacheKey = `operator_${campaignId}_${viewAsUserId || ''}`;
        slotsCache.delete(cacheKey);
        // forceRefresh=true, preserveCollapsedState=false (삭제된 품목 접기 상태 제거), skipLoading=false (로딩 표시)
        await loadSlots(campaignId, viewAsUserId, true, false, false);
        if (onRefresh) onRefresh();
        return;
      }

      closeDeleteDialog();
      const errorMessage = error.response?.data?.message || error.message || '알 수 없는 오류';
      alert('삭제 실패: ' + errorMessage);
    }
  };

  // 리뷰샷 삭제 핸들러
  const handleDeleteReviewConfirm = async () => {
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
      slotsCache.delete(`operator_${campaignId}_${viewAsUserId || ''}`);
      await loadSlots(campaignId, viewAsUserId, true, true, true);

      // 부모 컴포넌트에 알림
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Delete review failed:', error);
      const errorMessage = error.response?.data?.message || error.message || '알 수 없는 오류';
      showSnackbar('리뷰샷 삭제 실패: ' + errorMessage);
    } finally {
      setDeletingReview(false);
    }
  };

  // 배송지연 토글 핸들러 - 현재 비활성화됨
  // const handleToggleShippingDelayed = useCallback(async (buyerId, currentValue, rowIndex) => {
  //   if (!buyerId) {
  //     showSnackbar( '구매자 정보가 없습니다' });
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
  //     showSnackbar( '배송지연 상태 변경에 실패했습니다' });
  //   }
  // }, []);

  // HotTable prop 안정화용 함수 ref (useCallback/useMemo 의존성 제거)
  const handleAfterChangeRef = useRef(handleAfterChange);
  handleAfterChangeRef.current = handleAfterChange;

  const toggleItemCollapseRef = useRef(toggleItemCollapse);
  toggleItemCollapseRef.current = toggleItemCollapse;

  const handleCopyUploadLinkRef = useRef(handleCopyUploadLink);
  handleCopyUploadLinkRef.current = handleCopyUploadLink;

  const handleAlignmentChangeRef = useRef(handleAlignmentChange);
  handleAlignmentChangeRef.current = handleAlignmentChange;

  const showSnackbarRef = useRef(showSnackbar);
  showSnackbarRef.current = showSnackbar;

  const loadSlotsRef = useRef(loadSlots);
  loadSlotsRef.current = loadSlots;

  const openDeleteDialogRef = useRef(openDeleteDialog);
  openDeleteDialogRef.current = openDeleteDialog;

  // 성능 최적화: 동적 렌더러 함수들을 useMemo로 캐싱
  // 19차 최적화: 렌더러 팩토리에 ref 전달 → 의존성 [] → cellsRenderer 안정화 → IME 깨짐 방지
  const productDataRenderer = useMemo(() =>
    createProductDataRenderer(tableDataRef, collapsedItemsRef, toggleItemCollapse, columnAlignmentsRef),
    [toggleItemCollapse]
  );

  const uploadLinkBarRenderer = useMemo(() =>
    createUploadLinkBarRenderer(tableDataRef),
    []
  );

  const buyerDataRenderer = useMemo(() =>
    createBuyerDataRenderer(tableDataRef, duplicateOrderNumbersRef, columnAlignmentsRef),
    []
  );

  const buyerHeaderRenderer = useMemo(() =>
    createBuyerHeaderRenderer(tableDataRef),
    []
  );

  // 렌더러를 ref로 유지 (cellsRenderer 의존성 제거)
  const productDataRendererRef = useRef(productDataRenderer);
  productDataRendererRef.current = productDataRenderer;
  const uploadLinkBarRendererRef = useRef(uploadLinkBarRenderer);
  uploadLinkBarRendererRef.current = uploadLinkBarRenderer;
  const buyerDataRendererRef = useRef(buyerDataRenderer);
  buyerDataRendererRef.current = buyerDataRenderer;
  const buyerHeaderRendererRef = useRef(buyerHeaderRenderer);
  buyerHeaderRendererRef.current = buyerHeaderRenderer;

  // 셀 렌더러 - 행 타입별 분기 (최적화: 외부 정의 렌더러 사용)
  const cellsRenderer = useCallback((row, col, prop) => {
    const cellProperties = {};

    const currentTableData = tableDataRef.current;

    // spare rows (실제 데이터 범위 밖)
    if (row >= currentTableData.length) {
      cellProperties.className = 'spare-row-cell';
      return cellProperties;
    }

    const rowData = currentTableData[row];
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
        cellProperties.readOnly = (col === 0 || col === 14);  // col0=토글, col14=상세보기 버튼
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
        cellProperties.renderer = buyerHeaderRendererRef.current;
        // 중단 상태면 suspended 클래스 추가
        if (rowData._isSuspended) {
          cellProperties.className = 'suspended-row';
        }
        break;

      case ROW_TYPES.BUYER_DATA:
        // 구매자 데이터 행
        const dayGroup = rowData._dayGroup || 1;
        const dayClass = dayGroup % 2 === 0 ? 'day-even' : 'day-odd';
        // 중단 상태면 suspended 클래스 추가
        cellProperties.className = rowData._isSuspended ? `${dayClass} suspended-row` : dayClass;

        if (col === 16) {
          // col16: 리뷰샷 (readOnly)
          cellProperties.readOnly = true;
        } else {
          cellProperties.readOnly = false;
        }

        if (col === 17) {
          // col17: 상태 (드롭다운)
          cellProperties.type = 'dropdown';
          cellProperties.source = STATUS_OPTIONS;
        }

        cellProperties.renderer = buyerDataRendererRef.current;
        break;

      default:
        break;
    }

    return cellProperties;
  }, []);  // 19차: 의존성 완전 제거 - 모든 데이터를 ref로 접근

  // 19차: hiddenRows prop 안정화 (매 렌더마다 새 객체 생성 방지)
  // 21차: 초기값만 설정, 동적 변경은 useEffect에서 처리 (HotTable updateSettings 충돌 방지)
  const hiddenRowsConfig = useMemo(() => ({
    rows: [],
    indicators: false
  }), []);

  // ========== HotTable prop 안정화: contextMenu useMemo ==========
  const contextMenuConfig = useMemo(() => ({
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

          const rowData = tableDataRef.current[row];
          // 구매자 데이터 행이나 구매자 헤더 행이 아니면 무시
          if (!rowData || (rowData._rowType !== ROW_TYPES.BUYER_DATA && rowData._rowType !== ROW_TYPES.BUYER_HEADER)) {
            alert('구매자 행에서 우클릭하여 행을 추가해주세요.');
            return;
          }

          const itemId = rowData._itemId;
          const dayGroup = rowData._dayGroup;

          try {
            const response = await itemSlotService.createSlot(itemId, dayGroup);
            const newSlot = response.data;

            // 로컬 상태에 새 슬롯만 추가 (전체 리로드 대신)
            setSlots(prevSlots => [...prevSlots, newSlot]);

            // 캐시 무효화 (다음 캠페인 전환 시 최신 데이터 로드)
            slotsCache.delete(`operator_${campaignId}_${viewAsUserId || ''}`);

            showSnackbarRef.current('행이 추가되었습니다');
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
            const rowData = tableDataRef.current[row];
            if (rowData?._rowType === ROW_TYPES.BUYER_DATA) {
              const slotId = slotIndexMapRef.current[row];
              if (slotId) slotIds.push(slotId);
            }
          });

          if (slotIds.length === 0) {
            alert('삭제할 구매자 행을 선택해주세요.');
            return;
          }

          openDeleteDialogRef.current('rows', { slotIds }, `선택한 ${slotIds.length}개 행을 삭제하시겠습니까?\n\n⚠️ 해당 행의 구매자 정보가 삭제됩니다.`);
        }
      },
      sp2: { name: '---------' },
      split_day_group: {
        name: '📅 일 마감 (다음 행부터 새 일차)',
        callback: async function(key, selection) {
          const row = selection[0]?.start?.row;
          if (row === undefined) return;

          const rowData = tableDataRef.current[row];
          if (!rowData || rowData._rowType !== ROW_TYPES.BUYER_DATA) {
            alert('구매자 행에서만 일 마감을 사용할 수 있습니다.');
            return;
          }

          const slotId = slotIndexMapRef.current[row];
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
            showSnackbarRef.current(result.message);
            // forceRefresh=true, preserveCollapsedState=true, skipLoading=true
            loadSlotsRef.current(campaignId, viewAsUserId, true, true, true);
          } catch (error) {
            console.error('Failed to split day group:', error);
            alert('일 마감 실패: ' + (error.response?.data?.message || error.message));
          }
        }
      },
      sp3: { name: '---------' },
      delete_day_group: {
        name: '🗑️ 이 날짜 그룹 삭제',
        callback: function(key, selection) {
          const row = selection[0]?.start?.row;
          if (row === undefined) return;

          const rowData = tableDataRef.current[row];
          if (!rowData) return;

          // 품목 ID와 day_group 찾기 (제품 행 또는 구매자 행에서)
          let itemId = null;
          let dayGroup = null;
          let productName = '';

          if (rowData._rowType === ROW_TYPES.PRODUCT_HEADER || rowData._rowType === ROW_TYPES.PRODUCT_DATA) {
            itemId = rowData._itemId;
            dayGroup = rowData._dayGroup;
            productName = rowData.col3 || '';  // col3가 제품명 (col0은 토글, col1은 날짜, col2는 순번)
          } else if (rowData._rowType === ROW_TYPES.BUYER_DATA || rowData._rowType === ROW_TYPES.BUYER_HEADER || rowData._rowType === ROW_TYPES.UPLOAD_LINK_BAR) {
            itemId = rowData._itemId;
            dayGroup = rowData._dayGroup;
            // 제품명 찾기
            const productDataRow = tableDataRef.current.find(r => r._rowType === ROW_TYPES.PRODUCT_DATA && r._itemId === itemId && r._dayGroup === dayGroup);
            productName = productDataRow?.col3 || '';  // col3가 제품명 (col0은 토글, col1은 날짜, col2는 순번)
          }

          if (!itemId || dayGroup === null || dayGroup === undefined) {
            alert('삭제할 날짜 그룹을 선택해주세요.');
            return;
          }

          // 해당 day_group의 슬롯 수 계산
          const groupSlotCount = slotsRef.current.filter(s => s.item_id === itemId && s.day_group === dayGroup).length;

          openDeleteDialogRef.current('group', { itemId, dayGroup }, `"${productName}" 의 ${dayGroup + 1}일차 그룹을 삭제하시겠습니까?\n\n⚠️ ${groupSlotCount}개 행의 구매자 정보와 이미지가 함께 삭제됩니다.`);
        }
      },
      delete_item: {
        name: '🗑️ 이 품목 전체 삭제',
        callback: function(key, selection) {
          const row = selection[0]?.start?.row;
          if (row === undefined) return;

          const rowData = tableDataRef.current[row];
          if (!rowData) return;

          // 품목 ID 찾기 (제품 행 또는 구매자 행에서)
          let itemId = null;
          let productName = '';

          if (rowData._rowType === ROW_TYPES.PRODUCT_HEADER || rowData._rowType === ROW_TYPES.PRODUCT_DATA) {
            itemId = rowData._itemId;
            productName = rowData.col3 || '';
          } else if (rowData._rowType === ROW_TYPES.BUYER_DATA || rowData._rowType === ROW_TYPES.BUYER_HEADER || rowData._rowType === ROW_TYPES.UPLOAD_LINK_BAR) {
            itemId = rowData._itemId;
            const productDataRow = tableDataRef.current.find(r => r._rowType === ROW_TYPES.PRODUCT_DATA && r._itemId === itemId);
            productName = productDataRow?.col3 || '';
          }

          if (!itemId) {
            alert('삭제할 품목을 선택해주세요.');
            return;
          }

          // 해당 품목의 모든 슬롯 수 계산
          const itemSlotCount = slotsRef.current.filter(s => s.item_id === itemId).length;
          // 해당 품목의 day_group 개수 계산
          const dayGroups = new Set(slotsRef.current.filter(s => s.item_id === itemId).map(s => s.day_group));
          const dayGroupCount = dayGroups.size;

          openDeleteDialogRef.current('item', { itemId }, `"${productName}" 품목 전체를 삭제하시겠습니까?\n\n⚠️ ${dayGroupCount}개 일차, 총 ${itemSlotCount}개 행의 구매자 정보와 이미지가 함께 삭제됩니다.`);
        }
      },
      sp4: { name: '---------' },
      align_left: {
        name: '⬅️ 왼쪽 정렬',
        callback: function(key, selection) {
          const col = selection[0]?.start?.col;
          if (col !== undefined) {
            handleAlignmentChangeRef.current(col, 'left');
          }
        }
      },
      align_center: {
        name: '↔️ 가운데 정렬',
        callback: function(key, selection) {
          const col = selection[0]?.start?.col;
          if (col !== undefined) {
            handleAlignmentChangeRef.current(col, 'center');
          }
        }
      },
      align_right: {
        name: '➡️ 오른쪽 정렬',
        callback: function(key, selection) {
          const col = selection[0]?.start?.col;
          if (col !== undefined) {
            handleAlignmentChangeRef.current(col, 'right');
          }
        }
      }
    }
  }), []); // Empty dependency - all data accessed via refs

  // ========== HotTable prop 안정화: handler useCallbacks ==========
  const afterChangeHandler = useCallback((changes, source) => {
    // 8차 최적화: IME 조합 중이면 무시 (한글 입력 깨짐 방지)
    // DOM 이벤트 리스너로 isComposingRef 상태 관리 (useEffect에서 설정)
    if (isComposingRef.current) return;
    handleAfterChangeRef.current(changes, source);
  }, []);

  const afterLoadDataHandler = useCallback((sourceData, initialLoad) => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const hiddenRowsPlugin = hot.getPlugin('hiddenRows');
    if (!hiddenRowsPlugin) return;

    const indices = hiddenRowIndicesRef.current;
    const currentHidden = new Set(hiddenRowsPlugin.getHiddenRows());
    const newHidden = new Set(indices);

    // 차이점만 계산
    const rowsToShow = [...currentHidden].filter(r => !newHidden.has(r));
    const rowsToHide = [...newHidden].filter(r => !currentHidden.has(r));

    // batch로 묶어서 한 번에 처리 (렌더링 최소화)
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

  const afterSelectionHandler = useCallback((row, column, row2, column2, preventScrolling) => {
    // 마우스 클릭 시에는 스크롤 방지, 키보드 이동 시에는 스크롤 허용
    // _isKeyboardNav 플래그가 true면 키보드 이동이므로 스크롤 허용
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

  const afterDeselectHandler = useCallback(() => {
    // 선택 해제 시 셀 개수 숨김
    if (selectedCellCountRef.current) {
      selectedCellCountRef.current.style.display = 'none';
    }
  }, []);

  const beforeKeyDownHandler = useCallback((event) => {
    // 방향키 입력 시 플래그 설정
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
    if (arrowKeys.includes(event.key)) {
      if (hotRef.current?.hotInstance) {
        hotRef.current.hotInstance._isKeyboardNav = true;
      }
    }
  }, []);

  const beforeOnCellMouseDownHandler = useCallback((event, coords, TD) => {
    // 토글 셀(제품 데이터 행의 col0) 클릭 시 기본 동작 방지
    const rowData = tableDataRef.current[coords.row];
    if (rowData?._rowType === ROW_TYPES.PRODUCT_DATA && coords.col === 0) {
      event.stopImmediatePropagation();
    }
  }, []);

  const afterOnCellMouseUpHandler = useCallback((event, coords) => {
    const rowData = tableDataRef.current[coords.row];
    if (!rowData) return;

    // 제품 데이터 행의 col0(토글) 클릭 시 접기/펼치기
    if (rowData._rowType === ROW_TYPES.PRODUCT_DATA && coords.col === 0) {
      const itemId = rowData._itemId;
      const dayGroup = rowData._dayGroup;
      toggleItemCollapseRef.current(itemId, dayGroup);
      return;
    }

    // 업로드 링크 바 클릭 시 링크 복사
    if (rowData._rowType === ROW_TYPES.UPLOAD_LINK_BAR) {
      const token = rowData._uploadToken;
      if (token) {
        handleCopyUploadLinkRef.current(token);
      }
      return;
    }

    // 제품 데이터 행의 col14(상세보기) 클릭 시 팝업
    if (rowData._rowType === ROW_TYPES.PRODUCT_DATA && coords.col === 14) {
      const itemId = rowData._itemId;
      const dayGroup = rowData._dayGroup;
      // slots에서 해당 아이템의 정보 찾기
      const itemData = slotsRef.current.find(s => s.item_id === itemId);
      if (itemData) {
        // dayGroup에 해당하는 슬롯들의 정보 수집
        const dayGroupSlots = slotsRef.current.filter(s => s.item_id === itemId && s.day_group === dayGroup);
        const firstSlot = dayGroupSlots[0];
        // changedItems에서 로컬 수정 내용 가져와서 병합
        const dayGroupKey = `${itemId}_${dayGroup}`;
        const localChanges = changedItemsRef.current[dayGroupKey] || {};
        // slot과 localChanges를 병합한 객체 생성
        const mergedSlot = firstSlot ? { ...firstSlot, ...localChanges } : localChanges;
        setProductDetailPopup({
          open: true,
          item: itemData.item || itemData.Item || itemData,
          slot: mergedSlot,
          dayGroup: dayGroup
        });
      }
      return;
    }

    // 리뷰 보기 링크 클릭 시 갤러리 팝업
    const target = event.target;
    if (target.tagName === 'A' && target.classList.contains('review-link')) {
      event.preventDefault();
      const clickedRowData = tableDataRef.current[coords.row];
      const images = clickedRowData?._reviewImages || [];
      if (images.length > 0) {
        setImagePopup({
          open: true,
          images: images,
          currentIndex: 0,
          buyer: clickedRowData?._buyer || null
        });
      }
    }

    // 리뷰 삭제 링크 클릭 시 삭제 확인
    if (target.tagName === 'A' && target.classList.contains('review-delete-link')) {
      event.preventDefault();
      const clickedRowData = tableDataRef.current[coords.row];
      const images = clickedRowData?._reviewImages || [];
      if (images.length > 0) {
        setDeleteReviewPopup({
          open: true,
          images: images,
          buyer: clickedRowData?._buyer || null,
          rowIndex: coords.row
        });
      }
    }
  }, []);

  const beforeCopyHandler = useCallback((data, coords) => {
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
  }, []);

  const beforePasteHandler = useCallback((data, coords) => {
    // 주문번호 컬럼(col7, 인덱스 7)에서만 슬래시 파싱 적용
    // 슬래시 구분: 주문번호/구매자/수취인/아이디/연락처/주소/계좌/금액 → col7~col14
    const startCol = coords[0].startCol;
    if (startCol !== 7) return; // 다른 컬럼이면 기본 동작

    // 붙여넣기 대상 행이 구매자 데이터 행인지 확인
    const startRow = coords[0].startRow;
    const targetRowData = tableDataRef.current[startRow];
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
          parts[0]?.trim() || '',  // col7: 주문번호
          parts[1]?.trim() || '',  // col8: 구매자
          parts[2]?.trim() || '',  // col9: 수취인
          parts[3]?.trim() || '',  // col10: 아이디
          parts[4]?.trim() || '',  // col11: 연락처
          parts[5]?.trim() || '',  // col12: 주소
          parts[6]?.trim() || '',  // col13: 계좌
          parts[7]?.trim() || ''   // col14: 금액
        ]);
      }
    }

    if (newData.length === 0) return;

    // 원본 data 배열 수정 (Handsontable이 이 데이터로 붙여넣기)
    data.length = 0;
    newData.forEach(row => data.push(row));
  }, []);

  const afterRenderHandler = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const hiddenRowsPlugin = hot.getPlugin('hiddenRows');
    if (!hiddenRowsPlugin) return;

    // 접기 + 컬럼 필터 + 리뷰샷 필터 합산
    const collapseIndices = hiddenRowIndicesRef.current;
    const filterHidden = filterHiddenIndicesRef.current;
    const reviewHidden = reviewHiddenIndicesRef.current;

    let allTarget;
    if (filterHidden.length > 0 || reviewHidden.length > 0) {
      const buyerHiddenSet = new Set([...filterHidden, ...reviewHidden]);
      const emptyGroupHidden = computeEmptyGroupHiddenRows(buyerHiddenSet, tableDataRef.current);
      allTarget = [...new Set([...collapseIndices, ...filterHidden, ...reviewHidden, ...emptyGroupHidden])];
    } else {
      allTarget = collapseIndices;
    }

    if (allTarget.length === 0) return;

    // 현재 숨겨진 행 확인
    const currentHidden = hiddenRowsPlugin.getHiddenRows();
    const currentSet = new Set(currentHidden);
    const targetSet = new Set(allTarget);

    // 이미 올바르게 숨겨져 있으면 스킵 (무한 루프 방지)
    if (currentSet.size === targetSet.size &&
        [...currentSet].every(r => targetSet.has(r))) {
      return;
    }

    // hiddenRows 복원
    hot.batch(() => {
      if (currentHidden.length > 0) {
        hiddenRowsPlugin.showRows(currentHidden);
      }
      hiddenRowsPlugin.hideRows(allTarget);
    });
  }, [computeEmptyGroupHiddenRows]);

  const afterFilterHandler = useCallback((conditionsStack) => {
    console.log('[OperatorItemSheet] afterFilter called:', conditionsStack);

    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    // 필터 조건 저장
    filterConditionsRef.current = conditionsStack && conditionsStack.length > 0 ? [...conditionsStack] : null;

    const currentTableData = tableDataRef.current;

    // 필터 조건이 없으면 컬럼 필터 hidden 초기화
    if (!conditionsStack || conditionsStack.length === 0) {
      console.log('[OperatorItemSheet] No filter conditions, showing all');
      filterHiddenIndicesRef.current = [];

      // 리뷰샷 필터가 활성화된 경우 해당 필터만 유지
      const reviewHidden = reviewHiddenIndicesRef.current;
      if (reviewHidden.length > 0) {
        const buyerHiddenSet = new Set(reviewHidden);
        const allHiddenSet = new Set([...hiddenRowIndicesRef.current, ...reviewHidden, ...computeEmptyGroupHiddenRows(buyerHiddenSet, currentTableData)]);
        const visibleBuyer = [];
        for (let i = 0; i < currentTableData.length; i++) {
          if (currentTableData[i]?._rowType === ROW_TYPES.BUYER_DATA && !allHiddenSet.has(i)) {
            visibleBuyer.push(i);
          }
        }
        setFilteredRows(visibleBuyer);
      } else {
        setFilteredRows(null);
      }

      setHiddenRowsTrigger(prev => prev + 1);
      return;
    }

    // 조건에 따라 직접 필터링 (BUYER_DATA만 대상)
    const filterHidden = [];
    const dataRowCount = currentTableData.length;

    for (let physicalRow = 0; physicalRow < dataRowCount; physicalRow++) {
      const rowData = currentTableData[physicalRow];

      // 구매자 데이터 행만 필터링 대상
      if (rowData?._rowType !== ROW_TYPES.BUYER_DATA) continue;

      // 필터 조건 확인 - 각 컬럼별 조건 체크
      let passesFilter = true;
      conditionsStack.forEach(condition => {
        if (!passesFilter) return;

        const col = condition.column;
        const colName = `col${col}`;
        const cellValue = rowData[colName] ?? null;

        if (condition.conditions && condition.conditions.length > 0) {
          condition.conditions.forEach(cond => {
            if (!passesFilter) return;

            const { name, args } = cond;
            const filterValue = args && args[0];

            if (name === 'by_value' && args) {
              const allowedValues = args[0];
              if (Array.isArray(allowedValues)) {
                const cellStr = String(cellValue ?? '');
                if (!allowedValues.includes(cellStr)) {
                  passesFilter = false;
                }
              }
            } else if (name === 'eq' && filterValue !== undefined) {
              if (String(cellValue) !== String(filterValue)) passesFilter = false;
            } else if (name === 'contains' && filterValue) {
              if (!String(cellValue ?? '').includes(String(filterValue))) passesFilter = false;
            } else if (name === 'not_contains' && filterValue) {
              if (String(cellValue ?? '').includes(String(filterValue))) passesFilter = false;
            } else if (name === 'empty') {
              if (cellValue !== null && cellValue !== undefined && cellValue !== '') passesFilter = false;
            } else if (name === 'not_empty') {
              if (cellValue === null || cellValue === undefined || cellValue === '') passesFilter = false;
            }
          });
        }
      });

      if (!passesFilter) {
        filterHidden.push(physicalRow);
      }
    }

    filterHiddenIndicesRef.current = filterHidden;

    // 리뷰샷 필터 + 컬럼 필터 합산하여 visible buyer 계산
    const reviewHidden = reviewHiddenIndicesRef.current;
    const collapseIndices = hiddenRowIndicesRef.current;
    const buyerHiddenSet = new Set([...filterHidden, ...reviewHidden]);
    const emptyGroupHidden = computeEmptyGroupHiddenRows(buyerHiddenSet, currentTableData);
    const allHidden = [...new Set([...collapseIndices, ...filterHidden, ...reviewHidden, ...emptyGroupHidden])];
    const allHiddenSet = new Set(allHidden);

    const visibleBuyer = [];
    for (let i = 0; i < currentTableData.length; i++) {
      if (currentTableData[i]?._rowType === ROW_TYPES.BUYER_DATA && !allHiddenSet.has(i)) {
        visibleBuyer.push(i);
      }
    }

    console.log('[OperatorItemSheet] filterHidden:', filterHidden.length, 'reviewHidden:', reviewHidden.length, 'visibleBuyer:', visibleBuyer.length);

    setFilteredRows((filterHidden.length > 0 || reviewHidden.length > 0) ? visibleBuyer : null);
    setHiddenRowsTrigger(prev => prev + 1);
  }, [computeEmptyGroupHiddenRows]);

  // enterMoves, tabMoves 안정화 (매 렌더마다 새 객체 생성 방지)
  const enterMovesConfig = useMemo(() => ({ row: 1, col: 0 }), []);
  const tabMovesConfig = useMemo(() => ({ row: 0, col: 1 }), []);
  const dropdownMenuConfig = useMemo(() => ['filter_by_condition', 'filter_by_value', 'filter_action_bar'], []);

  // 12차 최적화: 저장 버튼 항상 표시 - state 기반 조건부 렌더링 제거
  // hasChanges는 더 이상 사용하지 않음 (저장 버튼 항상 표시)
  // totalChanges는 저장 시 ref에서 계산
  const totalChanges = Object.keys(changedSlotsRef.current).length + Object.keys(changedItemsRef.current).length;

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
      return sum + parseAmount(row.col14);  // col14가 금액
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
        minHeight: 48,
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
          {/* 리뷰샷 필터 버튼 (DOM 직접 조작 - React re-render 방지로 필터 플러그인 보존) */}
          <Box ref={reviewBtnContainerRef} sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              data-filter="all"
              onClick={() => handleReviewFilterChange('all')}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.3)',
                fontSize: '0.7rem',
                minWidth: 'auto',
                px: 1,
                py: 0.3,
                fontWeight: 'bold',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
              }}
            >
              전체
            </Button>
            <Button
              size="small"
              data-filter="with_review"
              onClick={() => handleReviewFilterChange('with_review')}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.15)',
                fontSize: '0.7rem',
                minWidth: 'auto',
                px: 1,
                py: 0.3,
                fontWeight: 'normal',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
              }}
            >
              리뷰샷 있음
            </Button>
            <Button
              size="small"
              data-filter="without_review"
              onClick={() => handleReviewFilterChange('without_review')}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.15)',
                fontSize: '0.7rem',
                minWidth: 'auto',
                px: 1,
                py: 0.3,
                fontWeight: 'normal',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
              }}
            >
              리뷰샷 없음
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
        {/* 12차 최적화: 저장 버튼 항상 표시 - state 기반 조건부 렌더링 제거 */}
        <Button
          variant="contained"
          color="success"
          size="small"
          onClick={handleSaveChanges}
          sx={{ bgcolor: '#4caf50', minWidth: 0, px: 1.5, py: 0.3, fontSize: '0.75rem' }}
        >
          저장
        </Button>
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
        // 중단된 day_group 배경 (빨간색)
        '& .suspended-row': {
          backgroundColor: '#ffcdd2 !important'
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
            colHeaders={COL_HEADERS}
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
            contextMenu={contextMenuConfig}
            copyPaste={true}
            fillHandle={true}
            beforeCopy={beforeCopyHandler}
            beforePaste={beforePasteHandler}
            afterChange={afterChangeHandler}
            cells={cellsRenderer}
            afterLoadData={afterLoadDataHandler}
            afterSelection={afterSelectionHandler}
            afterDeselect={afterDeselectHandler}
            beforeKeyDown={beforeKeyDownHandler}
            beforeOnCellMouseDown={beforeOnCellMouseDownHandler}
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
            autoScrollOnSelection={false}
            afterRender={afterRenderHandler}
            filters={true}
            dropdownMenu={dropdownMenuConfig}
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

      {/* 13차 최적화: Snackbar를 CSS animation으로 제어 - setTimeout 콜백 완전 제거 */}
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
          // CSS keyframes 정의 (inline)
          '@keyframes snackbarFadeOut': {
            '0%': { opacity: 1, visibility: 'visible' },
            '100%': { opacity: 0, visibility: 'hidden' }
          },
          '& .snackbar-content': {
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: '#4caf50',
            color: 'white',
            px: 2,
            py: 1,
            borderRadius: 1,
            boxShadow: 3,
            fontSize: '0.875rem',
            fontWeight: 500,
          }
        }}
      >
        <Box className="snackbar-content">
          <span className="snackbar-message"></span>
        </Box>
      </Box>

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
          <DialogContentText>
            {deleteReviewPopup.buyer?.buyer_name || '해당 구매자'}의 리뷰샷 {deleteReviewPopup.images?.length || 0}개를 삭제하시겠습니까?
          </DialogContentText>
          <DialogContentText sx={{ mt: 1, color: '#d32f2f', fontSize: '0.85rem' }}>
            ※ 삭제 시 리뷰 제출 상태가 초기화됩니다.
          </DialogContentText>
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
                          <Box sx={{ wordBreak: 'break-all' }}>
                            {renderUrlLinks(field.value)}
                          </Box>
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
