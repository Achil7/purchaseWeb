import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, Snackbar, Alert, IconButton, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
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

// Handsontable 모든 모듈 등록
registerAllModules();

// 행 타입 상수 정의
const ROW_TYPES = {
  ITEM_SEPARATOR: 'item_separator',
  PRODUCT_HEADER: 'product_header',
  PRODUCT_DATA: 'product_data',
  UPLOAD_LINK_BAR: 'upload_link_bar',
  BUYER_HEADER: 'buyer_header',
  BUYER_DATA: 'buyer_data',
};

// 기본 컬럼 너비 - 21개 컬럼
const DEFAULT_COLUMN_WIDTHS = [30, 180, 70, 60, 120, 80, 50, 80, 60, 50, 50, 50, 80, 30, 80, 100, 80, 50, 60, 70, 70];

/**
 * 날짜별 작업 시트 컴포넌트
 * - Operator/Sales 공용
 * - 특정 날짜의 모든 연월브랜드-캠페인 데이터를 한 시트에 표시
 */
function DailyWorkSheet({ userRole = 'operator', viewAsUserId = null }) {
  const hotRef = useRef(null);

  // 날짜 상태
  const [selectedDate, setSelectedDate] = useState(null);
  const [searchDate, setSearchDate] = useState(null);

  // 슬롯 데이터
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  // 컬럼 너비 상태
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);

  // 변경된 슬롯들 추적
  const [changedSlots, setChangedSlots] = useState({});

  // 변경된 아이템들 추적 (제품 정보 수정용)
  const [changedItems, setChangedItems] = useState({});

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

  // 이미지 갤러리 네비게이션
  const prevImage = () => {
    setImagePopup(prev => ({
      ...prev,
      currentIndex: Math.max(0, prev.currentIndex - 1)
    }));
  };

  const nextImage = () => {
    setImagePopup(prev => ({
      ...prev,
      currentIndex: Math.min(prev.images.length - 1, prev.currentIndex + 1)
    }));
  };

  // 접힌 품목 ID Set
  const [collapsedItems, setCollapsedItems] = useState(new Set());

  // 컬럼 크기 저장 키
  const COLUMN_WIDTHS_KEY = `daily_work_sheet_column_widths_${userRole}`;

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
  const loadSlots = useCallback(async () => {
    if (!searchDate) return;

    setLoading(true);
    try {
      const formattedDate = format(searchDate, 'yyyy-MM-dd');
      const response = await itemSlotService.getSlotsByDate(formattedDate, viewAsUserId);
      if (response.success) {
        setSlots(response.data || []);
        setChangedSlots({});
        setChangedItems({});
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
        col8: '가격', col9: '총건수', col10: '일건수', col11: '택배', col12: 'URL', col13: '', col14: '특이사항',
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
        col13: '',
        col14: productInfo.notes,
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

  // cellsRenderer - OperatorItemSheet와 동일한 방식
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
        cellProperties.renderer = function(instance, td) {
          td.className = 'item-separator-row';
          td.style.backgroundColor = '#1565c0';
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
          td.style.backgroundColor = '#e0e0e0';
          td.style.fontWeight = 'bold';
          td.style.textAlign = 'center';
          td.style.fontSize = '11px';
          td.textContent = value ?? '';
          return td;
        };
        break;

      case ROW_TYPES.PRODUCT_DATA:
        cellProperties.readOnly = (col === 0 || col === 1); // 접기, 연월브랜드-캠페인
        cellProperties.renderer = function(instance, td, r, c, prop, value) {
          td.className = 'product-data-row';
          td.style.backgroundColor = '#fff8e1';
          td.style.fontSize = '11px';

          // col0 - 토글 아이콘
          if (prop === 'col0') {
            const groupKey = rowData._groupKey;
            const isCollapsed = collapsedItems.has(groupKey);
            td.innerHTML = `<span style="cursor: pointer; user-select: none; font-size: 14px; color: #666;">${isCollapsed ? '▶' : '▼'}</span>`;
            td.style.textAlign = 'center';
            td.style.cursor = 'pointer';
          }
          // col1 - 연월브랜드-캠페인 (볼드)
          else if (prop === 'col1') {
            td.textContent = value ?? '';
            td.style.fontWeight = 'bold';
            td.style.color = '#1565c0';
          }
          // col3 - 플랫폼 (볼드)
          else if (prop === 'col3') {
            td.textContent = value ?? '';
            td.style.fontWeight = 'bold';
            td.style.color = '#1565c0';
          }
          // col12 - URL 하이퍼링크
          else if (prop === 'col12' && value) {
            const url = value.startsWith('http') ? value : `https://${value}`;
            td.style.whiteSpace = 'nowrap';
            td.style.overflow = 'hidden';
            td.style.textOverflow = 'ellipsis';
            td.title = value;
            td.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #1976d2; text-decoration: underline;">${value}</a>`;
          } else {
            td.textContent = value ?? '';
          }

          return td;
        };
        break;

      case ROW_TYPES.UPLOAD_LINK_BAR:
        cellProperties.readOnly = true;
        cellProperties.renderer = function(instance, td, r, c, prop, value) {
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
        const dayGroup = rowData._dayGroup || 1;
        const dayClass = dayGroup % 2 === 0 ? 'day-even' : 'day-odd';
        cellProperties.className = dayClass;

        // col16(리뷰샷)만 readOnly
        if (col === 16) {
          cellProperties.readOnly = true;
        } else {
          cellProperties.readOnly = false;
        }

        cellProperties.renderer = function(instance, td, r, c, prop, value) {
          td.className = dayClass;
          td.style.fontSize = '11px';
          td.style.backgroundColor = dayGroup % 2 === 0 ? '#e0f2f1' : '#fff';

          // col0, col1 - 빈칸
          if (prop === 'col0' || prop === 'col1') {
            td.textContent = '';
          }
          // col2 - 날짜
          else if (prop === 'col2') {
            td.textContent = value ?? '';
            td.style.textAlign = 'center';
          }
          // col3 - 순번
          else if (prop === 'col3') {
            td.textContent = value ?? '';
            td.style.textAlign = 'center';
            td.style.color = '#666';
          }
          // col4, col5 - 제품명, 옵션 (읽기전용 스타일)
          else if (prop === 'col4' || prop === 'col5') {
            td.textContent = value ?? '';
            td.style.color = '#555';
          }
          // col7 - 주문번호 (중복 시 빨간색)
          else if (prop === 'col7') {
            td.textContent = value ?? '';
            if (value && duplicateOrderNumbers.has(value)) {
              td.classList.add('duplicate-order');
              td.style.backgroundColor = '#ffcdd2';
            }
          }
          // col14 - 금액 (숫자 포맷)
          else if (prop === 'col14' && value) {
            const numValue = parseInt(String(value).replace(/[^0-9]/g, ''));
            td.textContent = numValue ? numValue.toLocaleString() : value;
          }
          // col16 - 리뷰샷
          else if (prop === 'col16') {
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
          }
          // col17 - 상태
          else if (prop === 'col17') {
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
          }
          // col20 - 입금여부
          else if (prop === 'col20') {
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
          }
          else {
            td.textContent = value ?? '';
          }

          return td;
        };
        break;

      default:
        break;
    }

    return cellProperties;
  }, [tableData, collapsedItems, duplicateOrderNumbers, statusLabels]);

  // 셀 변경 핸들러
  const handleAfterChange = useCallback((changes, source) => {
    if (!changes || source === 'loadData') return;

    const slotUpdates = { ...changedSlots };
    const itemUpdates = { ...changedItems };

    for (const [row, prop, oldValue, newValue] of changes) {
      if (oldValue === newValue) continue;

      const meta = rowMeta[row];
      if (!meta) continue;

      const { type, slotId, itemId, dayGroup } = meta;

      // 제품 데이터 행 수정
      if (type === ROW_TYPES.PRODUCT_DATA) {
        const PRODUCT_FIELD_MAP = {
          col2: 'date',
          col5: 'purchase_option',
          col7: 'keyword',
          col8: 'product_price',
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
  }, [changedSlots, changedItems, rowMeta]);

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
      setSnackbar({ open: true, message: '저장되었습니다.', severity: 'success' });
      loadSlots();
    } catch (error) {
      console.error('Save error:', error);
      setSnackbar({ open: true, message: '저장 중 오류가 발생했습니다.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [changedSlots, changedItems, slots, loadSlots]);

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

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 날짜 선택 영역 - 컴팩트하게 */}
      <Paper sx={{ p: 1.5, mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <DatePicker
              label="날짜"
              value={selectedDate}
              onChange={(newValue) => setSelectedDate(newValue)}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: { width: 150 }
                }
              }}
            />
          </LocalizationProvider>
          <Button
            variant="contained"
            size="small"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            disabled={!selectedDate || loading}
          >
            조회
          </Button>
          {hasChanges && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '저장 중...' : `저장 (${totalChanges})`}
            </Button>
          )}
          {searchDate && (
            <Typography variant="body2" color="text.secondary">
              {format(searchDate, 'yyyy-MM-dd')} | {slots.length}개 슬롯
            </Typography>
          )}
        </Box>
      </Paper>

      {/* 데이터 영역 */}
      <Paper sx={{
        overflow: 'auto',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
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
            colHeaders={false}
            rowHeaders={false}
            width="100%"
            height="calc(100vh - 160px)"
            licenseKey="non-commercial-and-evaluation"
            stretchH="none"
            autoRowSize={true}
            viewportRowRenderingOffset={50}
            manualColumnResize={true}
            manualRowResize={false}
            disableVisualSelection={false}
            imeFastEdit={true}
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
            }}
            afterColumnResize={(currentColumn, newSize) => {
              const newWidths = [...columnWidths];
              newWidths[currentColumn] = newSize;
              setColumnWidths(newWidths);
              saveColumnWidths(newWidths);
            }}
            contextMenu={true}
            copyPaste={true}
            undo={true}
            outsideClickDeselects={false}
            rowHeights={23}
          />
        )}
      </Paper>

      {/* 이미지 팝업 */}
      <Dialog
        open={imagePopup.open}
        onClose={(event, reason) => { if (reason !== 'backdropClick') setImagePopup({ ...imagePopup, open: false }); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>리뷰 이미지 ({imagePopup.currentIndex + 1}/{imagePopup.images.length})</span>
          <IconButton onClick={() => setImagePopup({ ...imagePopup, open: false })}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {imagePopup.images.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {imagePopup.images.length > 1 && (
                <IconButton
                  onClick={prevImage}
                  disabled={imagePopup.currentIndex === 0}
                  sx={{ position: 'absolute', left: 0 }}
                >
                  <ChevronLeftIcon />
                </IconButton>
              )}
              <img
                src={imagePopup.images[imagePopup.currentIndex]?.s3_url}
                alt="리뷰 이미지"
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
              {imagePopup.images.length > 1 && (
                <IconButton
                  onClick={nextImage}
                  disabled={imagePopup.currentIndex === imagePopup.images.length - 1}
                  sx={{ position: 'absolute', right: 0 }}
                >
                  <ChevronRightIcon />
                </IconButton>
              )}
            </Box>
          )}
        </DialogContent>
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

export default DailyWorkSheet;
