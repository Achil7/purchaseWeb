import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Typography, Button, Snackbar, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import InfoIcon from '@mui/icons-material/Info';
import ImageSwipeViewer from '../common/ImageSwipeViewer';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { itemSlotService } from '../../services';
import { downloadExcel, convertBrandSlotsToExcelData } from '../../utils/excelExport';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import api from '../../services/api';

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
  ITEM_SEPARATOR: 'item_separator',      // 품목 구분선 (보라색, 높이 8px)
  PRODUCT_HEADER: 'product_header',      // 제품 정보 컬럼 헤더 행
  PRODUCT_DATA: 'product_data',          // 제품 정보 데이터 행
  BUYER_HEADER: 'buyer_header',          // 구매자 컬럼 헤더 행
  BUYER_DATA: 'buyer_data',              // 구매자 데이터 행
};

// ========== 성능 최적화: 셀 렌더러 함수 (컴포넌트 외부 정의) ==========
const brandItemSeparatorRenderer = (instance, td) => {
  td.className = 'item-separator-row';
  td.style.backgroundColor = '#1565c0';
  td.style.height = '8px';
  td.style.padding = '0';
  td.innerHTML = '';
  return td;
};

const brandProductHeaderRenderer = (instance, td, r, c, prop, value) => {
  td.className = 'product-header-row';
  td.style.backgroundColor = '#e0e0e0';
  td.style.fontWeight = 'bold';
  td.style.textAlign = 'center';
  td.style.fontSize = '11px';
  td.textContent = value ?? '';
  return td;
};

// tableData를 받아서 중단된 경우 빨간 배경 적용
const createBrandBuyerHeaderRenderer = (tableData) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableData[r];
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

// collapsedItemsRef를 사용하여 최신 접기 상태 참조 (렌더러 재생성 방지)
const createBrandProductDataRenderer = (tableData, collapsedItemsRef, toggleItemCollapse, columnAlignments) => {
  return (instance, td, r, c, prop, value) => {
    const rowData = tableData[r];
    const isSuspended = rowData._isSuspended;
    td.className = 'product-data-row';
    // 중단된 경우 빨간 배경, 아닌 경우 기본 노란 배경
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
      td.textContent = value ?? '';
      td.style.fontWeight = 'bold';
      if (!isSuspended) td.style.color = '#1565c0';
    } else if (prop === 'col3') {
      td.textContent = value ?? '';
      td.style.fontWeight = 'bold';
      if (!isSuspended) td.style.color = '#1b5e20';
    } else if (prop === 'col7' && value) {
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

    if (columnAlignments[c] && !td.style.textAlign) {
      td.style.textAlign = columnAlignments[c];
    }

    return td;
  };
};

const createBrandBuyerDataRenderer = (tableData, columnAlignments) => {
  // 컬럼 구조 (14개):
  // col0: 빈칸, col1: 날짜, col2: 순번, col3: 제품명, col4: 옵션,
  // col5: 주문번호, col6: 구매자, col7: 수취인, col8: 아이디,
  // col9: 주소, col10: 금액, col11: 송장번호, col12: 리뷰샷, col13: 빈칸
  return (instance, td, r, c, prop, value) => {
    const rowData = tableData[r];
    const hasReviewImage = rowData._reviewImageUrl;
    const isSuspended = rowData._isSuspended;
    td.className = hasReviewImage ? 'has-review' : 'no-review';
    td.style.fontSize = '11px';

    // 중단된 행은 맨 마지막에 스타일 강제 적용
    const applySuspendedStyle = () => {
      if (isSuspended) {
        td.style.setProperty('background-color', '#ffcdd2', 'important');
        td.style.setProperty('color', '#b71c1c', 'important');
      }
    };

    if (prop === 'col0' || prop === 'col13') {
      // 빈칸 컬럼
      td.textContent = '';
    } else if (prop === 'col1') {
      // 날짜
      td.textContent = value ?? '';
      if (!isSuspended) td.style.color = '#666';
    } else if (prop === 'col2') {
      // 순번
      td.textContent = value ?? '';
      td.style.textAlign = 'center';
    } else if (prop === 'col3') {
      // 제품명
      td.textContent = value ?? '';
      td.style.fontWeight = 'bold';
      if (!isSuspended) td.style.color = '#1565c0';
    } else if (prop === 'col4') {
      // 옵션
      td.textContent = value ?? '';
      if (!isSuspended) td.style.color = '#1b5e20';
    } else if (prop === 'col6') {
      // 구매자 (굵게)
      td.textContent = value ?? '';
      td.style.fontWeight = 'bold';
    } else if (prop === 'col9') {
      // 주소
      td.textContent = value ?? '';
      if (!isSuspended) td.style.color = '#666';
    } else if (prop === 'col10' && value) {
      // 금액 (포맷팅)
      const numValue = parseInt(String(value).replace(/[^0-9]/g, ''));
      td.textContent = numValue ? numValue.toLocaleString() + '원' : value;
      td.style.fontWeight = 'bold';
      if (!isSuspended) td.style.color = '#c2185b';
    } else if (prop === 'col11') {
      // 송장번호
      td.textContent = value ?? '';
      if (value && !isSuspended) {
        td.style.color = '#1565c0';
      }
    } else if (prop === 'col12') {
      // 리뷰샷
      const images = rowData._reviewImages || [];
      const imageCount = images.length;
      if (imageCount > 0) {
        const displayText = imageCount > 1 ? `리뷰 보기 (${imageCount})` : '리뷰 보기';
        td.innerHTML = `<a href="#" class="review-link" data-row="${r}" style="color: ${isSuspended ? '#b71c1c' : '#2e7d32'}; text-decoration: underline; cursor: pointer; font-size: 11px; font-weight: bold;">${displayText}</a>`;
        td.style.textAlign = 'center';
      } else {
        td.innerHTML = '<span style="color: #999; font-size: 10px;">-</span>';
        td.style.textAlign = 'center';
      }
    } else {
      td.textContent = value ?? '';
    }

    if (columnAlignments[c] && !td.style.textAlign) {
      td.style.textAlign = columnAlignments[c];
    }

    // 중단된 행은 맨 마지막에 스타일 강제 적용
    applySuspendedStyle();

    return td;
  };
};

// 기본 컬럼 너비 - 14개 컬럼 (브랜드사 전용)
// 접기, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배대행, URL, (빈칸), 특이사항
const DEFAULT_COLUMN_WIDTHS = [30, 80, 70, 150, 100, 60, 120, 80, 60, 60, 60, 150, 50, 200];

/**
 * 브랜드사용 품목별 시트 컴포넌트 (Handsontable - 엑셀)
 * - 연결된 캠페인의 품목/구매자 정보를 표시
 * - 읽기 전용 (수정 불가)
 * - 영업사/진행자와 유사한 제품 테이블 구조 + 접기/펼치기
 *
 * 제품 테이블 (14개 컬럼): 접기, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배대행, URL, (빈칸), 특이사항
 * 구매자 테이블 (14개 컬럼): 빈칸, 날짜, 순번, 제품명, 옵션, 주문번호, 구매자, 수취인, 아이디, 주소, 금액, 송장번호, 리뷰샷, (빈칸)
 */
function BrandItemSheetInner({
  campaignId,
  campaignName = '',
  viewAsUserId = null
}) {
  const hotRef = useRef(null);

  // 슬롯 데이터
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  // 컬럼 너비 상태
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);

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
    item: null,
    slot: null,
    dayGroup: null
  });

  // 스낵바 상태
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // 접힌 품목 ID Set (기본값: 빈 Set = 모두 펼침)
  const [collapsedItems, setCollapsedItems] = useState(new Set());

  // collapsedItems를 ref로도 유지 (렌더러에서 최신 상태 참조용)
  const collapsedItemsRef = useRef(collapsedItems);
  collapsedItemsRef.current = collapsedItems;

  // localStorage 저장 디바운스용 타이머 ref
  const saveCollapsedTimeoutRef = useRef(null);

  // 리뷰샷 필터 상태 ('all', 'with_review', 'without_review')
  const [reviewFilter, setReviewFilter] = useState('all');

  // 컬럼 크기 저장 키 (캠페인별로 구분)
  const COLUMN_WIDTHS_KEY = `brand_itemsheet_column_widths_${campaignId}`;

  // 접기 상태 저장 키 (캠페인별로 구분)
  const COLLAPSED_ITEMS_KEY = `brand_itemsheet_collapsed_items_${campaignId}`;

  // 컬럼 정렬 저장 키 (캠페인별로 구분)
  const COLUMN_ALIGNMENTS_KEY = `brand_itemsheet_column_alignments_${campaignId}`;

  // 컬럼별 정렬 상태 (left, center, right)
  const [columnAlignments, setColumnAlignments] = useState({});

  // 접기 상태 저장
  const saveCollapsedItems = useCallback((items) => {
    try {
      const value = JSON.stringify([...items]);
      localStorage.setItem(COLLAPSED_ITEMS_KEY, value);
      console.log('[BrandItemSheet] Saved collapsed items:', {
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

  // 엑셀 다운로드 핸들러
  const handleDownloadExcel = useCallback(() => {
    // items 객체 생성 (item_id → item 매핑)
    const itemsMap = {};
    slots.forEach(slot => {
      if (!itemsMap[slot.item_id] && slot.item) {
        itemsMap[slot.item_id] = slot.item;
      }
    });

    const excelData = convertBrandSlotsToExcelData(slots, itemsMap);
    const fileName = campaignName || 'campaign';
    downloadExcel(excelData, `${fileName}_brand`, '브랜드시트');
    setSnackbar({ open: true, message: '엑셀 파일이 다운로드되었습니다' });
  }, [slots, campaignName]);

  // 이미지 ZIP 다운로드 핸들러
  const [zipDownloading, setZipDownloading] = useState(false);
  const handleDownloadImages = useCallback(async () => {
    // 리뷰 이미지가 있는 구매자들 수집 (품목+day_group별 순번)
    const buyersWithImages = [];

    // 슬롯을 item_id, day_group, slot_number 순서로 정렬
    const sortedSlots = [...slots].sort((a, b) => {
      if (a.item_id !== b.item_id) return a.item_id - b.item_id;
      if ((a.day_group || 1) !== (b.day_group || 1)) return (a.day_group || 1) - (b.day_group || 1);
      return (a.slot_number || 0) - (b.slot_number || 0);
    });

    // 품목+day_group별로 그룹화하여 순번 계산
    let currentItemId = null;
    let currentDayGroup = null;
    let rowNumberInGroup = 0;

    sortedSlots.forEach(slot => {
      const itemId = slot.item_id;
      const dayGroup = slot.day_group || 1;

      // 새로운 품목/day_group이면 순번 리셋
      if (itemId !== currentItemId || dayGroup !== currentDayGroup) {
        currentItemId = itemId;
        currentDayGroup = dayGroup;
        rowNumberInGroup = 0;
      }

      // BrandItemSheet는 slot.buyer (단수) 구조 사용
      const buyer = slot.buyer;

      // is_temporary=false인 구매자만 (브랜드사 기준)
      if (!buyer || buyer.is_temporary) {
        return;
      }

      rowNumberInGroup++;

      // 제품명 가져오기 (슬롯 > 아이템)
      const productName = slot.product_name || slot.item?.product_name || `품목${itemId}`;
      // 파일명에 사용할 수 없는 문자 제거
      const safeProductName = productName.replace(/[\\/:*?"<>|]/g, '_').substring(0, 30);

      if (buyer.images && buyer.images.length > 0) {
        buyersWithImages.push({
          rowNumber: rowNumberInGroup,
          productName: safeProductName,
          dayGroup,
          buyer,
          images: buyer.images
        });
      }
    });

    if (buyersWithImages.length === 0) {
      setSnackbar({ open: true, message: '다운로드할 리뷰샷이 없습니다', severity: 'warning' });
      return;
    }

    setZipDownloading(true);
    setSnackbar({ open: true, message: `리뷰샷 ${buyersWithImages.reduce((sum, b) => sum + b.images.length, 0)}개 다운로드 중...` });

    try {
      const zip = new JSZip();
      let successCount = 0;
      let failCount = 0;

      for (const { rowNumber, productName, dayGroup, images } of buyersWithImages) {
        for (let imgIndex = 0; imgIndex < images.length; imgIndex++) {
          const image = images[imgIndex];
          const imageUrl = image.s3_url;

          if (!imageUrl) continue;

          try {
            // 프록시 API를 통해 이미지 가져오기
            const response = await api.get('/images/proxy', {
              params: { url: imageUrl },
              responseType: 'blob'
            });

            // 파일 확장자 추출
            const contentType = response.headers['content-type'] || 'image/jpeg';
            let ext = 'jpg';
            if (contentType.includes('png')) ext = 'png';
            else if (contentType.includes('gif')) ext = 'gif';
            else if (contentType.includes('webp')) ext = 'webp';

            // 파일명 생성: 제품명_일차_순번(-이미지번호).확장자
            // 예: 상품A_1일차_3.jpg 또는 상품A_1일차_3-2.jpg
            const dayLabel = `${dayGroup}일차`;
            const fileName = images.length > 1
              ? `${productName}_${dayLabel}_${rowNumber}-${imgIndex + 1}.${ext}`
              : `${productName}_${dayLabel}_${rowNumber}.${ext}`;

            zip.file(fileName, response.data);
            successCount++;
          } catch (err) {
            console.error(`이미지 다운로드 실패: ${imageUrl}`, err);
            failCount++;
          }
        }
      }

      if (successCount === 0) {
        setSnackbar({ open: true, message: '이미지 다운로드에 실패했습니다', severity: 'error' });
        setZipDownloading(false);
        return;
      }

      // ZIP 파일 생성 및 다운로드
      const content = await zip.generateAsync({ type: 'blob' });
      const zipFileName = `${campaignName || 'campaign'}_리뷰샷.zip`;
      saveAs(content, zipFileName);

      const message = failCount > 0
        ? `리뷰샷 ${successCount}개 다운로드 완료 (${failCount}개 실패)`
        : `리뷰샷 ${successCount}개 다운로드 완료`;
      setSnackbar({ open: true, message, severity: failCount > 0 ? 'warning' : 'success' });
    } catch (error) {
      console.error('ZIP 다운로드 실패:', error);
      setSnackbar({ open: true, message: 'ZIP 파일 생성에 실패했습니다', severity: 'error' });
    } finally {
      setZipDownloading(false);
    }
  }, [slots, campaignName]);

  // 캠페인별 슬롯 데이터 로드 (Brand 전용)
  // 성능 최적화: 의존성 배열을 비워서 함수 재생성 방지, campaignId는 파라미터로 전달
  const loadSlots = useCallback(async (targetCampaignId, targetViewAsUserId, forceRefresh = false) => {
    if (!targetCampaignId) {
      return;
    }

    // 캐시 키 생성
    const cacheKey = `brand_${targetCampaignId}_${targetViewAsUserId || ''}`;

    // 캐시 확인 (forceRefresh가 아닌 경우)
    if (!forceRefresh && slotsCache.has(cacheKey)) {
      const cached = slotsCache.get(cacheKey);
      setSlots(cached.slots);

      // localStorage에서 접기 상태 복원 (day_group별 키 사용)
      const allKeys = new Set();
      cached.slots.forEach(s => {
        const key = `${s.item_id}_${s.day_group || 1}`;
        allKeys.add(key);
      });
      const collapsedKey = `brand_itemsheet_collapsed_items_${targetCampaignId}`;
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
      const widthKey = `brand_itemsheet_column_widths_${targetCampaignId}`;
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
      const params = { viewAsRole: 'brand' };
      if (targetViewAsUserId) {
        params.viewAsUserId = targetViewAsUserId;
      }
      const response = await itemSlotService.getSlotsByCampaign(targetCampaignId, params);
      if (response.success) {
        // 모든 슬롯 표시 (임시 구매자만 제외)
        const allSlots = (response.data || []).filter(slot => {
          const buyer = slot.buyer;
          return !buyer?.is_temporary;
        });
        setSlots(allSlots);

        // 캐시에 저장
        slotsCache.set(cacheKey, { slots: allSlots, timestamp: Date.now() });

        // API 응답 직후 localStorage에서 접기 상태 복원 (day_group별 키 사용)
        const allKeys = new Set();
        allSlots.forEach(s => {
          const key = `${s.item_id}_${s.day_group || 1}`;
          allKeys.add(key);
        });
        const collapsedKey = `brand_itemsheet_collapsed_items_${targetCampaignId}`;
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

        // API 응답 직후 localStorage에서 컬럼 너비 복원
        const widthKey = `brand_itemsheet_column_widths_${targetCampaignId}`;
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
      } else {
        console.warn('[BrandItemSheet] API response success=false');
      }
    } catch (error) {
      console.error('[BrandItemSheet] Failed to load slots:', error);
    } finally {
      setLoading(false);
    }
  }, []); // 의존성 배열 비움 - 함수 재생성 방지

  useEffect(() => {
    if (campaignId) {
      // 캠페인 변경 시 이전 slots 데이터를 즉시 초기화
      setSlots([]);
      loadSlots(campaignId, viewAsUserId);
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

  // 성능 최적화: 2단계로 분리하여 캠페인 변경 시 불필요한 재계산 방지
  // 1단계: 기본 데이터 구조 생성 (slots, reviewFilter만 의존)
  // day_group별로 분리하여 영업사/진행자와 동일한 구조로 표시
  const { baseTableData } = useMemo(() => {
    const data = [];

    // 슬롯을 품목별 + day_group별로 그룹화
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
          slots: []
        };
      }
      itemGroups[itemId].dayGroups[dayGroup].slots.push(slot);
    });

    let isFirstItem = true;

    // 품목별로 행 생성
    Object.entries(itemGroups).forEach(([itemId, itemGroup]) => {
      const item = itemGroup.item || {};
      const mergedItem = { ...item };

      // 일차별로 제품 정보 + 구매자 정보 반복
      const dayGroupKeys = Object.keys(itemGroup.dayGroups).sort((a, b) => parseInt(a) - parseInt(b));

      dayGroupKeys.forEach((dayGroup, dayGroupIndex) => {
        const groupData = itemGroup.dayGroups[dayGroup];
        // 해당 day_group이 중단 상태인지 확인 (슬롯 중 하나라도 is_suspended가 true면 중단)
        const isSuspended = groupData.slots.some(slot => slot.is_suspended);

        // 리뷰샷 필터 적용
        let filteredSlots = groupData.slots;
        if (reviewFilter === 'with_review') {
          filteredSlots = groupData.slots.filter(slot => slot.buyer?.images?.length > 0);
        } else if (reviewFilter === 'without_review') {
          filteredSlots = groupData.slots.filter(slot => !slot.buyer?.images || slot.buyer.images.length === 0);
        }

        // 필터링 후 슬롯이 없으면 이 day_group은 표시하지 않음
        if (filteredSlots.length === 0) {
          return;
        }

        // day_group별 완료 상태 계산
        const totalSlots = groupData.slots.length;
        const completedSlots = groupData.slots.filter(
          slot => slot.buyer?.images?.length > 0
        ).length;
        const isAllCompleted = totalSlots > 0 && totalSlots === completedSlots;

        // day_group별 독립 제품 정보: 슬롯 값 > Item 값 (우선순위)
        const firstSlot = groupData.slots[0] || {};
        const dayGroupProductInfo = {
          date: firstSlot.date || mergedItem.date || '',
          product_name: firstSlot.product_name || mergedItem.product_name || '',
          platform: firstSlot.platform || mergedItem.platform || '-',
          shipping_type: firstSlot.shipping_type || mergedItem.shipping_type || '',
          keyword: firstSlot.keyword || mergedItem.keyword || '',
          product_price: firstSlot.product_price || mergedItem.product_price || '',
          total_purchase_count: firstSlot.total_purchase_count || mergedItem.total_purchase_count || '',
          daily_purchase_count: firstSlot.daily_purchase_count || mergedItem.daily_purchase_count || '',
          purchase_option: firstSlot.purchase_option || mergedItem.purchase_option || '',
          courier_service_yn: firstSlot.courier_service_yn || mergedItem.courier_service_yn || '',
          courier_name: (() => {
            const name = firstSlot.courier_name || mergedItem.courier_name;
            if (name) return name;
            const courierYn = firstSlot.courier_service_yn || mergedItem.courier_service_yn || '';
            return courierYn.toUpperCase().trim() === 'Y' ? '롯데택배' : '';
          })(),
          product_url: firstSlot.product_url || mergedItem.product_url || '',
          notes: firstSlot.notes || mergedItem.notes || ''
        };

        // 첫 번째 품목의 첫 번째 일차가 아닌 경우 품목 구분선 추가
        if (!isFirstItem || dayGroupIndex > 0) {
          data.push({ _rowType: ROW_TYPES.ITEM_SEPARATOR, _itemId: parseInt(itemId), _dayGroup: parseInt(dayGroup) });
        }
        if (dayGroupIndex === 0) {
          isFirstItem = false;
        }

        // 제품 헤더 행 (14개 컬럼) - 브랜드사 전용
        data.push({
          _rowType: ROW_TYPES.PRODUCT_HEADER,
          _itemId: parseInt(itemId),
          _dayGroup: parseInt(dayGroup),
          _isSuspended: isSuspended,
          col0: '', col1: '날짜', col2: '플랫폼', col3: '제품명', col4: '옵션', col5: '출고', col6: '키워드',
          col7: '가격', col8: '총건수', col9: '일건수', col10: '택배사', col11: '택배대행', col12: 'URL', col13: '특이사항', col14: '상세'
        });

        // 제품 데이터 행 (15개 컬럼)
        data.push({
          _rowType: ROW_TYPES.PRODUCT_DATA,
          _itemId: parseInt(itemId),
          _dayGroup: parseInt(dayGroup),
          _item: item,
          _isSuspended: isSuspended,
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
          col14: '📋'
        });

        // 구매자 헤더 행 (14개 컬럼) - 항상 포함
        // 날짜, 순번, 제품명, 옵션을 주문번호 앞에 추가 (영업사/진행자와 동일한 구조)
        data.push({
          _rowType: ROW_TYPES.BUYER_HEADER,
          _itemId: parseInt(itemId),
          _dayGroup: parseInt(dayGroup),
          _isSuspended: isSuspended,
          col0: '', col1: '날짜', col2: '순번', col3: '제품명', col4: '옵션', col5: '주문번호', col6: '구매자', col7: '수취인', col8: '아이디',
          col9: '주소', col10: '금액', col11: '송장번호', col12: '리뷰샷', col13: ''
        });

        // 구매자 데이터 행 - 항상 포함
        // 날짜, 순번, 제품명, 옵션을 주문번호 앞에 추가 (영업사/진행자와 동일한 구조)
        filteredSlots.forEach((slot, slotIndex) => {
          const buyer = slot.buyer || {};
          const reviewImage = buyer.images && buyer.images.length > 0 ? buyer.images[0] : null;

          // 슬롯에서 제품 정보 가져오기 (슬롯 값 > dayGroupProductInfo)
          const slotProductName = slot.product_name || dayGroupProductInfo.product_name || '';
          const slotPurchaseOption = slot.purchase_option || dayGroupProductInfo.purchase_option || '';
          const slotDate = slot.date || dayGroupProductInfo.date || '';

          data.push({
            _rowType: ROW_TYPES.BUYER_DATA,
            _slotId: slot.id,
            _itemId: parseInt(itemId),
            _dayGroup: parseInt(dayGroup),
            _buyerId: buyer.id || null,
            _buyer: buyer,
            _isSuspended: isSuspended,
            _reviewImages: buyer.images || [],
            _reviewImageUrl: reviewImage?.s3_url || '',
            _reviewImageName: reviewImage?.file_name || '',
            col0: '',
            col1: slotDate,                        // 날짜
            col2: slotIndex + 1,                   // 순번 (품목/day_group별 1부터 시작)
            col3: slotProductName,                 // 제품명
            col4: slotPurchaseOption,              // 옵션
            col5: buyer.order_number || '',        // 주문번호
            col6: buyer.buyer_name || '',          // 구매자
            col7: buyer.recipient_name || '',      // 수취인
            col8: buyer.user_id || '',             // 아이디
            col9: buyer.address || '',             // 주소
            col10: buyer.amount || '',             // 금액
            col11: buyer.tracking_number || '',    // 송장번호
            col12: reviewImage?.s3_url || '',      // 리뷰샷
            col13: ''
          });
        });
      });
    });

    return { baseTableData: data };
  }, [slots, reviewFilter]); // collapsedItems 제거 - 캠페인 변경 시 재계산 방지

  // 성능 최적화: 배열 필터링 대신 hiddenRows 플러그인 사용
  // baseTableData를 그대로 사용하고, 접기 상태에 따라 숨길 행만 계산
  const tableData = baseTableData;

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

      // 접힌 품목의 구매자 행은 숨김
      if (currentCollapsedKey !== null &&
          (row._rowType === ROW_TYPES.BUYER_HEADER || row._rowType === ROW_TYPES.BUYER_DATA) &&
          collapseKey === currentCollapsedKey) {
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

  // 개별 품목(day_group별) 접기/펼치기 토글
  // 성능 최적화: localStorage 저장을 디바운스하여 I/O 지연
  const toggleItemCollapse = useCallback((itemId, dayGroup) => {
    const collapseKey = `${itemId}_${dayGroup}`;
    setCollapsedItems(prev => {
      const next = new Set(prev);
      if (next.has(collapseKey)) {
        next.delete(collapseKey);
      } else {
        next.add(collapseKey);
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
    saveCollapsedItems(emptySet);
  }, [saveCollapsedItems]);

  // 모두 접기
  const collapseAll = useCallback(() => {
    // day_group별 키 수집 (itemId_dayGroup 형식)
    const allKeys = new Set();
    slots.forEach(s => {
      const key = `${s.item_id}_${s.day_group || 1}`;
      allKeys.add(key);
    });
    setCollapsedItems(allKeys);
    saveCollapsedItems(allKeys);
  }, [slots, saveCollapsedItems]);

  // 컬럼 정의
  const columns = useMemo(() => {
    const baseColumns = [];

    for (let i = 0; i < 14; i++) {
      baseColumns.push({
        data: `col${i}`,
        type: 'text',
        width: columnWidths[i] || DEFAULT_COLUMN_WIDTHS[i],
        readOnly: true,
        className: 'htCenter htMiddle'
      });
    }

    // 맨 오른쪽에 여백 컬럼 추가 (컬럼 너비 조절 용이하게)
    baseColumns.push({
      data: 'col14',
      type: 'text',
      width: 50,
      readOnly: true,
      className: 'htCenter htMiddle'
    });

    return baseColumns;
  }, [columnWidths]); // columnWidths 변경 시 컬럼 재생성

  // 컬럼 헤더
  const colHeaders = Array(15).fill('');

  // 성능 최적화: 동적 렌더러 함수들을 useMemo로 캐싱
  // collapsedItemsRef를 사용하여 접기 상태 변경 시 렌더러 재생성 방지
  const productDataRenderer = useMemo(() =>
    createBrandProductDataRenderer(tableData, collapsedItemsRef, toggleItemCollapse, columnAlignments),
    [tableData, toggleItemCollapse, columnAlignments]
  );

  const buyerDataRenderer = useMemo(() =>
    createBrandBuyerDataRenderer(tableData, columnAlignments),
    [tableData, columnAlignments]
  );

  const buyerHeaderRenderer = useMemo(() =>
    createBrandBuyerHeaderRenderer(tableData),
    [tableData]
  );

  // 셀 렌더러 - 행 타입별 분기 (최적화: 외부 정의 렌더러 사용)
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
        cellProperties.renderer = brandItemSeparatorRenderer;
        break;

      case ROW_TYPES.PRODUCT_HEADER:
        cellProperties.readOnly = true;
        cellProperties.renderer = brandProductHeaderRenderer;
        // 중단된 day_group은 빨간 배경
        if (rowData._isSuspended) {
          cellProperties.className = 'suspended-row';
        }
        break;

      case ROW_TYPES.PRODUCT_DATA:
        cellProperties.readOnly = true;
        cellProperties.renderer = productDataRenderer;
        // 중단된 day_group은 빨간 배경
        if (rowData._isSuspended) {
          cellProperties.className = 'suspended-row';
        }
        break;

      case ROW_TYPES.BUYER_HEADER:
        cellProperties.readOnly = true;
        cellProperties.renderer = buyerHeaderRenderer;
        // 중단된 day_group은 빨간 배경
        if (rowData._isSuspended) {
          cellProperties.className = 'suspended-row';
        }
        break;

      case ROW_TYPES.BUYER_DATA:
        cellProperties.readOnly = true;
        const hasReviewImage = rowData._reviewImageUrl;
        // 중단된 경우 suspended-row 클래스 추가
        const baseClass = hasReviewImage ? 'has-review' : 'no-review';
        cellProperties.className = rowData._isSuspended ? `${baseClass} suspended-row` : baseClass;
        cellProperties.renderer = buyerDataRenderer;
        break;

      default:
        break;
    }

    return cellProperties;
  }, [tableData, productDataRenderer, buyerDataRenderer, buyerHeaderRenderer]);

  // 전체 데이터 건수 (원본 slots 기준)
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

  // 금액 합산 계산
  const totalAmount = useMemo(() => {
    return slots.reduce((sum, slot) => {
      const buyer = slot.buyer || {};
      return sum + parseAmount(buyer.amount);
    }, 0);
  }, [slots, parseAmount]);

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
        bgcolor: '#2c387e',  // Admin 색상으로 통일
        color: 'white',
        px: 2,
        py: 1,
        borderRadius: '4px 4px 0 0'
      }}>
        {/* 왼쪽: 건수 정보 + 접기/펼치기 */}
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

        {/* 오른쪽: 리뷰샷 필터 + 엑셀 다운로드 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* 리뷰샷 필터 버튼 */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              onClick={() => setReviewFilter('all')}
              sx={{
                color: 'white',
                bgcolor: reviewFilter === 'all' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
                fontSize: '0.7rem',
                minWidth: 'auto',
                px: 1,
                py: 0.3,
                fontWeight: reviewFilter === 'all' ? 'bold' : 'normal',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
              }}
            >
              전체
            </Button>
            <Button
              size="small"
              onClick={() => setReviewFilter('with_review')}
              sx={{
                color: 'white',
                bgcolor: reviewFilter === 'with_review' ? 'rgba(76,175,80,0.5)' : 'rgba(255,255,255,0.15)',
                fontSize: '0.7rem',
                minWidth: 'auto',
                px: 1,
                py: 0.3,
                fontWeight: reviewFilter === 'with_review' ? 'bold' : 'normal',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
              }}
            >
              리뷰샷 있음
            </Button>
            <Button
              size="small"
              onClick={() => setReviewFilter('without_review')}
              sx={{
                color: 'white',
                bgcolor: reviewFilter === 'without_review' ? 'rgba(244,67,54,0.5)' : 'rgba(255,255,255,0.15)',
                fontSize: '0.7rem',
                minWidth: 'auto',
                px: 1,
                py: 0.3,
                fontWeight: reviewFilter === 'without_review' ? 'bold' : 'normal',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
              }}
            >
              리뷰샷 없음
            </Button>
          </Box>

          {/* 다운로드 버튼들 */}
          <Box sx={{ display: 'flex', gap: 1 }}>
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
            <Button
              size="small"
              onClick={handleDownloadImages}
              disabled={slots.length === 0 || zipDownloading}
              startIcon={zipDownloading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <FolderZipIcon />}
              sx={{
                color: 'white',
                bgcolor: 'rgba(76,175,80,0.6)',
                fontSize: '0.75rem',
                px: 1.5,
                py: 0.5,
                '&:hover': { bgcolor: 'rgba(76,175,80,0.8)' },
                '&:disabled': { color: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(76,175,80,0.3)' }
              }}
            >
              {zipDownloading ? '다운로드 중...' : '리뷰샷 다운로드'}
            </Button>
          </Box>
        </Box>
      </Box>

      <Paper sx={{
        '& .handsontable': {
          fontSize: '12px'
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
        },
        // 중단된 day_group 배경 (연한 빨강)
        '& .suspended-row': {
          backgroundColor: '#ffcdd2 !important',
          color: '#c62828 !important'
        },
        // 모든 셀에 텍스트 오버플로우 처리 (... 표시)
        '& .handsontable td': {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      }}>
        {tableData.length > 0 ? (
          <HotTable
            ref={hotRef}
            data={tableData}
            columns={columns}
            colHeaders={colHeaders}
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
            minSpareRows={0}
            readOnly={true}
            disableVisualSelection={false}
            hiddenRows={{
              rows: hiddenRowIndices,
              indicators: false
            }}
            filters={true}
            dropdownMenu={['filter_by_condition', 'filter_by_value', 'filter_action_bar']}
            contextMenu={{
              items: {
                copy: { name: '복사' },
                sp1: { name: '---------' },
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
            cells={cellsRenderer}
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
            beforeOnCellMouseDown={(event, coords, TD) => {
              // 토글 셀(제품 데이터 행의 col0) 클릭 시 기본 동작 방지
              const rowData = tableData[coords.row];
              if (rowData?._rowType === ROW_TYPES.PRODUCT_DATA && coords.col === 0) {
                event.stopImmediatePropagation();
              }
            }}
            afterOnCellMouseUp={(event, coords) => {
              const rowData = tableData[coords.row];
              if (!rowData) return;

              // 제품 데이터 행의 col0(토글) 클릭 시 접기/펼치기
              if (rowData._rowType === ROW_TYPES.PRODUCT_DATA && coords.col === 0) {
                const itemId = rowData._itemId;
                const dayGroup = rowData._dayGroup;
                toggleItemCollapse(itemId, dayGroup);
                return;
              }

              // 제품 데이터 행의 col14(상세보기) 클릭 시 팝업
              if (rowData._rowType === ROW_TYPES.PRODUCT_DATA && coords.col === 14) {
                const item = rowData._item;
                const itemId = rowData._itemId;
                const dayGroup = rowData._dayGroup;
                if (item) {
                  // 해당 day_group의 슬롯 데이터 가져오기
                  const dayGroupSlots = slots.filter(s => s.item_id === itemId && s.day_group === dayGroup);
                  const firstSlot = dayGroupSlots[0] || null;
                  setProductDetailPopup({
                    open: true,
                    item: item,
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
            }}
            className="htCenter"
            autoWrapRow={false}
            autoWrapCol={false}
            afterColumnResize={handleColumnResize}
            rowHeights={23}
            autoScrollOnSelection={false}
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
        autoHideDuration={snackbar.severity === 'error' ? 5000 : 3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity || 'success'} onClose={() => setSnackbar({ ...snackbar, open: false })}>
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
              {(() => {
                const slot = productDetailPopup.slot || {};
                const item = productDetailPopup.item || {};
                // 슬롯 값 우선, 없으면 item 값 사용
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
                  { label: '출고 마감 시간', value: getValue('shipping_deadline') },
                  { label: '택배대행 Y/N', value: getValue('courier_service_yn') },
                  { label: '리뷰 가이드', value: getValue('review_guide'), multiline: true },
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
}

// React.memo로 감싸서 부모 리렌더링 시 불필요한 리렌더링 방지
// campaignId, viewAsUserId가 변경되지 않으면 시트가 리렌더링되지 않음
const BrandItemSheet = React.memo(BrandItemSheetInner, (prevProps, nextProps) => {
  // true 반환 = 리렌더링 하지 않음, false 반환 = 리렌더링 함
  return (
    prevProps.campaignId === nextProps.campaignId &&
    prevProps.campaignName === nextProps.campaignName &&
    prevProps.viewAsUserId === nextProps.viewAsUserId
  );
});

export default BrandItemSheet;
