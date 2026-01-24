import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Snackbar, Alert, IconButton, Tooltip, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadIcon from '@mui/icons-material/Download';
import InfoIcon from '@mui/icons-material/Info';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import itemSlotService from '../../services/itemSlotService';
import itemService from '../../services/itemService';
import { downloadExcel, convertSlotsToExcelData } from '../../utils/excelExport';

// Handsontable 모든 모듈 등록
registerAllModules();

// 행 타입 상수 정의 (OperatorItemSheet와 동일)
const ROW_TYPES = {
  ITEM_SEPARATOR: 'item_separator',      // 품목 구분선 (파란색, 높이 8px)
  PRODUCT_HEADER: 'product_header',      // 제품 정보 컬럼 헤더 행
  PRODUCT_DATA: 'product_data',          // 제품 정보 데이터 행
  UPLOAD_LINK_BAR: 'upload_link_bar',    // 업로드 링크 바 (검정)
  BUYER_HEADER: 'buyer_header',          // 구매자 컬럼 헤더 행
  BUYER_DATA: 'buyer_data',              // 구매자 데이터 행
};

// 기본 컬럼 너비 - 19개 컬럼
const DEFAULT_COLUMN_WIDTHS = [30, 80, 70, 150, 100, 60, 60, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 80, 80];

/**
 * 품목별 시트 컴포넌트 (Handsontable - 진짜 엑셀)
 * - DB의 ItemSlot 테이블에서 데이터 조회
 * - 엑셀처럼 드래그 복사, 다중 선택, 붙여넣기 지원
 */
function SalesItemSheet({
  campaignId,
  campaignName = '',
  items,
  onDeleteItem,
  onRefresh,
  getStatusColor,
  getStatusLabel,
  viewAsUserId = null
}) {
  const hotRef = useRef(null);

  // 슬롯 데이터
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  // 컬럼 너비 상태
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);

  // 접기 상태 초기화 완료 플래그 (캠페인ID 추적용)
  const lastCampaignId = useRef(null);

  // 스낵바 상태
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // 삭제 다이얼로그 상태
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    type: '', // 'item'
    data: null,
    message: ''
  });

  // Admin 편집용 - 변경된 슬롯 추적
  const [changedSlots, setChangedSlots] = useState({});
  // Admin 편집용 - 변경된 품목 추적
  const [changedItems, setChangedItems] = useState({});
  // 저장 중 상태
  const [saving, setSaving] = useState(false);

  // 제품 상세 정보 팝업 상태
  const [productDetailPopup, setProductDetailPopup] = useState({
    open: false,
    item: null,
    slot: null,
    dayGroup: null
  });

  // 메모 기능 비활성화됨

  // 필터링된 행 인덱스 (null이면 전체, 배열이면 필터링된 행만)
  const [filteredRows, setFilteredRows] = useState(null);

  // 필터링된 컬럼 인덱스 추적 (UI에서 사용)
  const [, setFilteredColumns] = useState(new Set());

  // 필터 조건 저장 (데이터 리로드 시 복원용)
  const filterConditionsRef = useRef(null);

  // 접힌 품목 ID Set (기본값: 빈 Set = 모두 펼침)
  const [collapsedItems, setCollapsedItems] = useState(new Set());

  // 여분 행/열 개수 (기능 비활성화 - 나중에 복원 가능)
  // const SPARE_ROWS = 20;
  // const SPARE_COLS = 3;

  // 컬럼 크기 저장 키 (캠페인별로 구분)
  const COLUMN_WIDTHS_KEY = `sales_itemsheet_column_widths_${campaignId}`;

  // 접기 상태 저장 키 (캠페인별로 구분)
  const COLLAPSED_ITEMS_KEY = `sales_itemsheet_collapsed_items_${campaignId}`;

  // 컬럼 정렬 저장 키 (캠페인별로 구분)
  const COLUMN_ALIGNMENTS_KEY = `sales_itemsheet_column_alignments_${campaignId}`;

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
      console.log('[SalesItemSheet] Saved collapsed items:', {
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

  // 컬럼 크기 변경 시 저장
  const handleColumnResize = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    // 현재 모든 컬럼 너비 가져오기
    const widths = [];
    for (let i = 0; i < hot.countCols(); i++) {
      widths.push(hot.getColWidth(i));
    }

    // state 업데이트
    setColumnWidths(widths);

    // localStorage에 저장
    try {
      localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
    } catch (e) {
      console.error('Failed to save column widths:', e);
    }
  }, [COLUMN_WIDTHS_KEY]);

  // 캠페인별 슬롯 데이터 로드
  const loadSlots = useCallback(async () => {
    if (!campaignId) return;

    setLoading(true);
    try {
      const response = await itemSlotService.getSlotsByCampaign(campaignId);
      if (response.success) {
        const newSlots = response.data || [];
        setSlots(newSlots);

        // API 응답 직후 localStorage에서 접기 상태 복원
        const allItemIds = [...new Set(newSlots.map(s => s.item_id))];
        const collapsedKey = `sales_itemsheet_collapsed_items_${campaignId}`;
        try {
          const saved = localStorage.getItem(collapsedKey);
          if (saved) {
            const savedIds = JSON.parse(saved);
            const validIds = savedIds.filter(id => allItemIds.includes(id));
            setCollapsedItems(new Set(validIds));
          } else {
            setCollapsedItems(new Set(allItemIds));
          }
        } catch (e) {
          setCollapsedItems(new Set(allItemIds));
        }

        // API 응답 직후 localStorage에서 컬럼 너비 복원
        const widthKey = `sales_itemsheet_column_widths_${campaignId}`;
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
  }, [campaignId]);

  // 메모 데이터 로드 - 기능 비활성화
  // const loadMemos = useCallback(async () => {
  //   if (!campaignId) return;
  //
  //   try {
  //     const response = await sheetMemoService.getSheetMemos(campaignId, 'sales', viewAsUserId);
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
      // 캠페인 변경 시 이전 slots 데이터를 즉시 초기화
      setSlots([]);
      loadSlots();
      // loadMemos(); // 메모 기능 비활성화
    }
  }, [campaignId, loadSlots]);

  // items 변경 시 (품목 추가/삭제 후) 슬롯 리로드
  useEffect(() => {
    if (campaignId && items.length > 0) {
      // items 변경 시 이전 slots 데이터를 즉시 초기화하여 잘못된 데이터로 useEffect 실행 방지
      setSlots([]);
      loadSlots();
    }
  }, [items.length, campaignId, loadSlots]);

  // 접기 상태 복원은 loadSlots 함수 내에서 API 응답 직후 처리됨

  // 컬럼 정렬 상태 초기화 (최초 1회만)
  useEffect(() => {
    const savedAlignments = getSavedColumnAlignments();
    if (savedAlignments && Object.keys(savedAlignments).length > 0) {
      setColumnAlignments(savedAlignments);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 최초 마운트 시에만 실행

  // 저장 핸들러 - DB 저장 + 스크롤 위치 유지
  const handleSaveChanges = useCallback(async () => {
    if (Object.keys(changedSlots).length === 0 && Object.keys(changedItems).length === 0) {
      setSnackbar({ open: true, message: '변경된 내용이 없습니다' });
      return;
    }

    // 스크롤 위치 저장
    const hot = hotRef.current?.hotInstance;
    const scrollPosition = hot?.rootElement?.querySelector('.wtHolder')?.scrollTop || 0;
    const scrollLeft = hot?.rootElement?.querySelector('.wtHolder')?.scrollLeft || 0;

    setSaving(true);

    try {
      // 품목 저장 (DB 업데이트)
      for (const [itemId, itemData] of Object.entries(changedItems)) {
        await itemService.updateItem(parseInt(itemId), itemData);
      }

      // 슬롯(구매자) 저장 (DB 업데이트) - updateSlotsBulk 사용
      if (Object.keys(changedSlots).length > 0) {
        const slotsToUpdate = Object.entries(changedSlots).map(([slotId, slotData]) => ({
          id: parseInt(slotId),
          ...slotData
        }));
        await itemSlotService.updateSlotsBulk(slotsToUpdate);
      }

      // 로컬 slots 상태 업데이트 (DB 재조회 대신 직접 업데이트)
      // buyer 필드 목록 (slot이 아닌 buyer 객체에 속하는 필드들)
      const buyerFields = ['order_number', 'buyer_name', 'recipient_name', 'user_id', 'contact', 'address', 'account_info', 'amount', 'tracking_number', 'deposit_name', 'payment_confirmed'];

      setSlots(prevSlots => {
        return prevSlots.map(slot => {
          let updatedSlot = slot;

          // 슬롯(구매자) 변경사항 적용
          const slotChangesData = changedSlots[slot.id];
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

          // 아이템(제품) 변경사항 적용
          const itemChangesData = changedItems[slot.item_id];
          if (itemChangesData && updatedSlot.item) {
            const { id, ...itemFieldChanges } = itemChangesData;
            updatedSlot = {
              ...updatedSlot,
              item: { ...updatedSlot.item, ...itemFieldChanges }
            };
          }

          return updatedSlot;
        });
      });

      // 상태 초기화
      setChangedSlots({});
      setChangedItems({});
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
      console.error('Save failed:', error);
      // 저장 실패 시 변경사항 상태 초기화 (다음 저장에 영향 주지 않도록)
      setChangedSlots({});
      setChangedItems({});
      setSnackbar({ open: true, message: '저장 실패: ' + (error.response?.data?.message || error.message) });
    } finally {
      setSaving(false);
    }
  }, [changedSlots, changedItems, loadSlots]);

  // Ctrl+S 키보드 단축키로 저장
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); // 브라우저 기본 저장 동작 방지
        handleSaveChanges();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveChanges]);

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

  // Handsontable 데이터 변환 - 새로운 구조 (OperatorItemSheet와 동일)
  // 제품 정보와 구매자 정보 분리, 일차별 업로드 링크 바
  const { tableData } = useMemo(() => {
    const data = [];

    // 슬롯을 품목별로 그룹화
    const itemGroups = {};
    slots.forEach((slot) => {
      const itemId = slot.item_id;
      if (!itemGroups[itemId]) {
        itemGroups[itemId] = {
          item: slot.item || items.find(i => i.id === itemId),
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

    // 품목별로 행 생성
    Object.entries(itemGroups).forEach(([itemId, itemGroup]) => {
      const item = itemGroup.item || {};
      // changedItems에 변경사항이 있으면 적용 (즉시 반영)
      const itemChanges = changedItems[parseInt(itemId)] || {};
      const mergedItem = { ...item, ...itemChanges };

      // 품목별 완료 상태 계산 (전체 슬롯 vs 리뷰샷 완료)
      let totalSlots = 0;
      let completedSlots = 0;
      Object.values(itemGroup.dayGroups).forEach(groupData => {
        totalSlots += groupData.slots.length;
        completedSlots += groupData.slots.filter(
          slot => slot.buyer?.images?.length > 0
        ).length;
      });
      const isAllCompleted = totalSlots > 0 && totalSlots === completedSlots;

      // 첫 번째 품목이 아닌 경우 품목 구분선 추가
      if (!isFirstItem) {
        data.push({ _rowType: ROW_TYPES.ITEM_SEPARATOR });
      }
      isFirstItem = false;

      // 제품 헤더 행 (19개 컬럼) - 영업사는 리뷰비 컬럼 제외
      // 순서: 토글, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배대행, URL, 특이사항, 상세
      data.push({
        _rowType: ROW_TYPES.PRODUCT_HEADER,
        col0: '', col1: '날짜', col2: '플랫폼', col3: '제품명', col4: '옵션', col5: '출고', col6: '키워드',
        col7: '가격', col8: '총건수', col9: '일건수', col10: '택배대행', col11: 'URL', col12: '특이사항', col13: '상세',
        col14: '', col15: '', col16: '', col17: '', col18: ''
      });

      // 제품 데이터 행 (19개 컬럼) - 영업사는 리뷰비 컬럼 제외
      data.push({
        _rowType: ROW_TYPES.PRODUCT_DATA,
        _itemId: parseInt(itemId),
        _item: item,  // 전체 아이템 정보 저장
        _completionStatus: { total: totalSlots, completed: completedSlots, isAllCompleted },
        col0: '',  // 토글 버튼
        col1: mergedItem.date || '',  // 제품 날짜 (Item 테이블)
        col2: mergedItem.platform || '-',  // 플랫폼 (순번 대신)
        col3: mergedItem.product_name || '',
        col4: mergedItem.purchase_option || '',  // 옵션
        col5: mergedItem.shipping_type || '',     // 출고
        col6: mergedItem.keyword || '',           // 키워드
        col7: mergedItem.product_price || '',  // 가격 (합쳐진 제품은 텍스트 그대로 표시)
        col8: mergedItem.total_purchase_count || '',   // 총건수
        col9: mergedItem.daily_purchase_count || '',   // 일건수
        col10: mergedItem.courier_service_yn || '',  // 택배대행
        col11: mergedItem.product_url || '',      // URL
        col12: mergedItem.notes || '',            // 특이사항
        col13: '📋',                          // 상세보기 버튼
        col14: '', col15: '', col16: '', col17: '', col18: ''
      });

      // 접힌 상태가 아닐 때만 구매자 정보 표시
      const isCollapsed = collapsedItems.has(parseInt(itemId));

      if (!isCollapsed) {
        // 일차별 구매자 정보
        const dayGroupKeys = Object.keys(itemGroup.dayGroups).sort((a, b) => parseInt(a) - parseInt(b));

        dayGroupKeys.forEach((dayGroup) => {
          const groupData = itemGroup.dayGroups[dayGroup];
          const uploadToken = groupData.uploadToken;

          // 업로드 링크 바 (19개 컬럼) - 영업사는 리뷰비 컬럼 제외
          data.push({
            _rowType: ROW_TYPES.UPLOAD_LINK_BAR,
            _itemId: parseInt(itemId),
            _uploadToken: uploadToken,
            _dayGroup: parseInt(dayGroup),
            col0: '',  // 토글 컬럼 (빈칸)
            col1: `📷 업로드 링크 복사`,
            col2: '', col3: '', col4: '', col5: '', col6: '', col7: '', col8: '', col9: '',
            col10: '', col11: '', col12: '', col13: '', col14: '', col15: '', col16: '', col17: '', col18: ''
          });

          // 구매자 헤더 행 (19개 컬럼) - 영업사는 리뷰비 컬럼 제외
          // col0: 접기, col1: 날짜, col2: 순번, col3: 제품명, col4: 옵션, col5: 예상구매자,
          // col6: 주문번호, col7: 구매자, col8: 수취인, col9: 아이디, col10: 연락처, col11: 주소, col12: 계좌, col13: 금액,
          // col14: 송장번호, col15: 리뷰샷, col16: 상태, col17: 입금명, col18: 입금여부
          data.push({
            _rowType: ROW_TYPES.BUYER_HEADER,
            _itemId: parseInt(itemId),
            _dayGroup: parseInt(dayGroup),
            col0: '', col1: '날짜', col2: '순번', col3: '제품명', col4: '옵션', col5: '예상구매자',
            col6: '주문번호', col7: '구매자', col8: '수취인', col9: '아이디', col10: '연락처', col11: '주소', col12: '계좌', col13: '금액',
            col14: '송장번호', col15: '리뷰샷', col16: '상태', col17: '입금명', col18: '입금여부'
          });

          // 구매자 데이터 행 (슬롯별) - 19개 컬럼 (영업사는 리뷰비 컬럼 제외)
          groupData.slots.forEach((slot, slotIndex) => {
            // changedSlots에 변경사항이 있으면 적용
            const slotChanges = changedSlots[slot.id] || {};
            // changedItems에 제품 정보 변경사항이 있으면 적용
            const dayGroupKey = `${slot.item_id}_${slot.day_group}`;
            const productChanges = changedItems[dayGroupKey] || {};
            const { itemId, dayGroup, ...productFields } = productChanges;
            const mergedSlot = { ...slot, ...productFields, ...slotChanges };
            const buyer = mergedSlot.buyer || {};
            const reviewImage = buyer.images && buyer.images.length > 0 ? buyer.images[0] : null;

            // 상태 계산: 구매자 정보 없음 → "-", 구매자 정보 있음 → "active", 리뷰샷 있음 → "completed"
            const hasBuyerData = buyer.order_number || buyer.buyer_name || buyer.recipient_name ||
                                 buyer.user_id || buyer.contact || buyer.address ||
                                 buyer.account_info || buyer.amount;
            const hasReviewImage = reviewImage?.s3_url;
            const calculatedStatus = hasReviewImage ? 'completed' : (hasBuyerData ? 'active' : '-');

            data.push({
              _rowType: ROW_TYPES.BUYER_DATA,
              _slotId: mergedSlot.id,
              _itemId: parseInt(itemId),
              _buyerId: buyer.id || null,
              _dayGroup: parseInt(dayGroup),
              _uploadToken: uploadToken,
              _reviewImages: buyer.images || [],  // 전체 이미지 배열
              _reviewImageUrl: reviewImage?.s3_url || '',
              _reviewImageName: reviewImage?.file_name || '',
              _buyer: buyer,  // 구매자 정보 전체
              _hasBuyerData: !!hasBuyerData,
              // 19개 컬럼 구조 (영업사는 리뷰비 컬럼 제외)
              col0: '',  // 접기 (빈칸)
              col1: mergedSlot.date || '',  // 날짜 (Sales가 입력한 날짜, slot.date에서 가져옴)
              col2: slotIndex + 1,  // 순번 (1부터 시작)
              col3: mergedSlot.product_name || '',  // 제품명 (Slot 테이블 값 - Item과 독립)
              col4: mergedSlot.purchase_option || '',  // 옵션 (Slot 테이블 값 - Item과 독립)
              col5: mergedSlot.expected_buyer || '',  // 예상 구매자
              col6: buyer.order_number || '',  // 주문번호
              col7: buyer.buyer_name || '',  // 구매자
              col8: buyer.recipient_name || '',  // 수취인
              col9: buyer.user_id || '',  // 아이디
              col10: buyer.contact || '',  // 연락처
              col11: buyer.address || '',  // 주소
              col12: buyer.account_info || '',  // 계좌
              col13: buyer.amount || '',  // 금액
              col14: buyer.tracking_number || '',  // 송장번호
              col15: reviewImage?.s3_url || '',  // 리뷰샷
              col16: calculatedStatus,  // 상태
              col17: buyer.deposit_name || '',  // 입금명
              col18: buyer.payment_confirmed_at || ''  // 입금여부 (날짜 또는 빈값)
            });
          });
        });
      }
    });

    return { tableData: data };
  }, [slots, items, collapsedItems, changedSlots, changedItems]);

  // 상태 옵션 및 라벨 (드롭다운 + 조회용)
  const statusOptions = ['active', 'completed', 'cancelled'];
  const statusLabels = { active: '진행', completed: '완료', cancelled: '취소' };

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

    const excelData = convertSlotsToExcelData(slots, itemsMap, 'sales');
    const fileName = campaignName || 'campaign';
    downloadExcel(excelData, `${fileName}_sales`, '영업사시트');
    setSnackbar({ open: true, message: '엑셀 파일이 다운로드되었습니다' });
  }, [slots, campaignName]);

  // 변경사항 저장 및 새로고침 헬퍼 함수
  const saveAndRefresh = useCallback(async () => {
    const hasSlotChanges = Object.keys(changedSlots).length > 0;
    const hasItemChanges = Object.keys(changedItems).length > 0;

    try {
      // 제품 정보 저장
      if (hasItemChanges) {
        for (const [itemId, itemData] of Object.entries(changedItems)) {
          await itemService.updateItem(parseInt(itemId), itemData);
        }
      }
      // 슬롯 데이터 저장
      if (hasSlotChanges) {
        const slotsToUpdate = Object.entries(changedSlots).map(([slotId, slotData]) => ({
          id: parseInt(slotId),
          ...slotData
        }));
        await itemSlotService.updateSlotsBulk(slotsToUpdate);
      }
      // 상태 초기화
      setChangedSlots({});
      setChangedItems({});
      // 데이터 새로고침 (변경사항 유무와 관계없이 항상 최신 데이터 로드)
      await loadSlots();
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [changedSlots, changedItems, loadSlots]);

  // 개별 품목 접기/펼치기 토글
  const toggleItemCollapse = useCallback((itemId) => {
    setCollapsedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      // localStorage에 저장
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
      if (type === 'item') {
        // 품목 삭제
        await itemService.deleteItem(data.itemId);
      } else if (type === 'group') {
        // 그룹(일차) 삭제
        await itemSlotService.deleteSlotsByGroup(data.itemId, data.dayGroup);
      } else if (type === 'rows') {
        // 선택된 행들 삭제
        await itemSlotService.deleteSlotsBulk(data.slotIds);
      }

      closeDeleteDialog();

      // 필터 상태 초기화 (삭제 후 필터가 유효하지 않을 수 있음)
      setFilteredRows(null);
      setFilteredColumns(new Set());
      filterConditionsRef.current = null;

      // 데이터 새로고침
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Delete failed:', error);
      const errorMessage = error.response?.data?.message || error.message || '알 수 없는 오류';
      alert('삭제 실패: ' + errorMessage);
    }
  };

  // 이미지 갤러리 팝업 상태
  const [imagePopup, setImagePopup] = useState({
    open: false,
    images: [],      // 전체 이미지 배열
    currentIndex: 0, // 현재 보고 있는 이미지 인덱스
    buyer: null      // 구매자 정보
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

  // 기본 컬럼 너비 - 19개 컬럼 (영업사는 리뷰비 컬럼 제외)
  // col0: 접기(20), col1: 날짜(60), col2: 플랫폼(70), col3: 제품명(120), col4: 옵션(80), col5: 예상구매자(80),
  // 컬럼 정의: 통합 컬럼 (행 타입에 따라 다른 데이터 표시) - 19개 (영업사는 리뷰비 컬럼 제외)
  const columns = useMemo(() => {
    const baseColumns = [];

    for (let i = 0; i < 19; i++) {
      baseColumns.push({
        data: `col${i}`,
        type: 'text',
        width: columnWidths[i] || DEFAULT_COLUMN_WIDTHS[i],
        className: 'htCenter htMiddle'
      });
    }

    // 맨 오른쪽에 여백 컬럼 추가 (컬럼 너비 조절 용이하게)
    baseColumns.push({
      data: 'col19',
      type: 'text',
      width: 50,
      readOnly: true,
      className: 'htCenter htMiddle'
    });

    return baseColumns;
  }, [columnWidths]); // columnWidths 변경 시 컬럼 재생성

  // 컬럼 헤더는 빈 배열 (manualColumnResize를 위해 헤더 행 필요)
  // 빈 문자열 배열이면 헤더는 비어있지만 리사이즈 핸들 동작
  const colHeaders = Array(20).fill('');


  // 셀 렌더러 - 행 타입별 분기 (OperatorItemSheet와 동일)
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
        // 품목 구분선 (파란색)
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
        // 제품 정보 헤더 행 (회색 배경, 볼드)
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
        // 제품 데이터 행 (연노랑 배경) - 토글 버튼(col0)만 readOnly
        cellProperties.readOnly = (col === 0);
        cellProperties.renderer = function(instance, td, r, c, prop, value) {
          td.className = 'product-data-row';
          td.style.backgroundColor = '#fff8e1';
          td.style.fontSize = '11px';

          // col0 - 토글 아이콘 + 완료 배지 표시
          if (prop === 'col0') {
            const itemId = rowData._itemId;
            const isCollapsed = collapsedItems.has(itemId);
            const status = rowData._completionStatus;

            // 완료 배지 HTML
            let completionBadge = '';
            if (status?.isAllCompleted) {
              // 모두 완료: 초록색 체크마크
              completionBadge = '<span style="color: #388e3c; font-size: 12px; margin-left: 4px; font-weight: bold;">✓</span>';
            } else if (status?.completed > 0) {
              // 일부 완료: 주황색 진행률 표시
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
          // col11 - 상품URL 하이퍼링크 (행 높이 고정을 위해 텍스트 오버플로우 처리)
          else if (prop === 'col11' && value) {
            const url = value.startsWith('http') ? value : `https://${value}`;
            td.style.whiteSpace = 'nowrap';
            td.style.overflow = 'hidden';
            td.style.textOverflow = 'ellipsis';
            td.title = value;  // 툴팁으로 전체 URL 표시
            td.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #1976d2; text-decoration: underline;">${value}</a>`;
          } else {
            td.textContent = value ?? '';
          }

          // 사용자 정의 정렬 적용 (기존 정렬 스타일이 없는 경우에만)
          if (columnAlignments[c] && !td.style.textAlign) {
            td.style.textAlign = columnAlignments[c];
          }

          return td;
        };
        break;

      case ROW_TYPES.UPLOAD_LINK_BAR:
        // 업로드 링크 바 (검정 배경, 흰색 텍스트)
        cellProperties.readOnly = true;
        cellProperties.renderer = function(instance, td, r, c, prop, value) {
          td.className = 'upload-link-bar';
          td.style.backgroundColor = '#424242';
          td.style.color = 'white';
          td.style.cursor = 'pointer';
          td.style.fontSize = '11px';
          td.setAttribute('data-token', rowData._uploadToken || '');

          if (c === 1) {
            td.textContent = value || '';
            td.style.paddingLeft = '8px';
          } else {
            td.textContent = '';
          }
          return td;
        };
        break;

      case ROW_TYPES.BUYER_HEADER:
        // 구매자 헤더 행 (회색 배경, 볼드)
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
        // 구매자 데이터 행 - 모든 컬럼 편집 가능 (col15 리뷰샷만 readOnly)
        const dayGroup = rowData._dayGroup || 1;
        const dayClass = dayGroup % 2 === 0 ? 'day-even' : 'day-odd';
        cellProperties.className = dayClass;

        // col15(리뷰샷)만 readOnly, 나머지는 모두 편집 가능
        if (col === 15) {
          cellProperties.readOnly = true; // 이미지 컬럼만 readOnly
        } else {
          cellProperties.readOnly = false;
        }

        // 상태 컬럼 (col16) - 드롭다운
        if (col === 16) {
          cellProperties.type = 'dropdown';
          cellProperties.source = statusOptions;
        }

        cellProperties.renderer = function(instance, td, r, c, prop, value) {
          td.className = dayClass;
          td.style.fontSize = '11px';

          // 접기 컬럼 (col0) - 빈칸
          if (prop === 'col0') {
            td.textContent = '';
            td.style.textAlign = 'center';
          }
          // 날짜 컬럼 (col1) - 수작업 입력
          else if (prop === 'col1') {
            td.textContent = value ?? '';
            td.style.textAlign = 'center';
          }
          // 플랫폼 컬럼 (col2) - 볼드, 파란색
          else if (prop === 'col2') {
            td.textContent = value ?? '';
            td.style.fontWeight = 'bold';
            td.style.color = '#1565c0';
          }
          // 제품명 컬럼 (col3) - 읽기 전용
          else if (prop === 'col3') {
            td.textContent = value ?? '';
            td.style.color = '#555';
          }
          // 옵션 컬럼 (col4) - 읽기 전용
          else if (prop === 'col4') {
            td.textContent = value ?? '';
            td.style.color = '#555';
          }
          // 금액 컬럼 (col13) - 숫자 포맷
          else if (prop === 'col13' && value) {
            const numValue = parseInt(String(value).replace(/[^0-9]/g, ''));
            td.textContent = numValue ? numValue.toLocaleString() : value;
          }
          // 리뷰샷 컬럼 (col15) - "리뷰 보기" 링크 (이미지 개수 표시)
          else if (prop === 'col15') {
            const images = rowData._reviewImages || [];
            const imageCount = images.length;
            if (imageCount > 0) {
              const label = imageCount > 1 ? `리뷰 보기 (${imageCount})` : '리뷰 보기';
              td.innerHTML = `<a
                href="#"
                class="review-link"
                style="color: #1976d2; text-decoration: underline; cursor: pointer; font-size: 11px;"
              >${label}</a>`;
              td.style.textAlign = 'center';
            } else {
              td.innerHTML = '<span style="color: #999; font-size: 10px;">-</span>';
              td.style.textAlign = 'center';
            }
          }
          // 상태 컬럼 (col16) - 칩 스타일
          else if (prop === 'col16') {
            const hasReviewImage = rowData._reviewImageUrl;
            const hasBuyerData = rowData._hasBuyerData;
            // 상태 결정: 리뷰샷 있음 → completed, 구매자 정보 있음 → active, 둘 다 없음 → "-"
            const displayStatus = hasReviewImage ? 'completed' : (hasBuyerData ? 'active' : '-');
            const label = statusLabels[displayStatus] || displayStatus;

            if (displayStatus === '-') {
              td.innerHTML = '<span style="color: #999;">-</span>';
              td.style.textAlign = 'center';
            } else if (hasReviewImage) {
              td.innerHTML = `<span class="status-chip status-completed" style="font-weight: bold;">✓ ${label}</span>`;
            } else {
              td.innerHTML = `<span class="status-chip status-${displayStatus}">${label}</span>`;
            }
          }
          // 입금여부 컬럼 (col18) - 날짜(YYMMDD) 표시
          else if (prop === 'col18') {
            td.style.textAlign = 'center';
            if (value) {
              // ISO 날짜 문자열을 YYMMDD 형식으로 변환 (Asia/Seoul 기준)
              try {
                const date = new Date(value);
                const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
                const yy = String(kstDate.getUTCFullYear()).slice(-2);
                const mm = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(kstDate.getUTCDate()).padStart(2, '0');
                td.textContent = `${yy}${mm}${dd}`;
                td.style.color = '#388e3c';
                td.style.fontWeight = 'bold';
              } catch (e) {
                td.textContent = value;
              }
            } else {
              td.textContent = '';
            }
          }
          // 주문번호 컬럼 (col6) - 중복 시 빨간색 배경
          else if (prop === 'col6') {
            td.textContent = value ?? '';
            if (value && duplicateOrderNumbers.has(value)) {
              td.classList.add('duplicate-order');
            }
          }
          // 그 외
          else {
            td.textContent = value ?? '';
          }

          // 사용자 정의 정렬 적용 (기존 정렬 스타일이 없는 경우에만)
          if (columnAlignments[c] && !td.style.textAlign) {
            td.style.textAlign = columnAlignments[c];
          }

          return td;
        };
        break;

      default:
        break;
    }

    return cellProperties;
  }, [tableData, statusOptions, statusLabels, collapsedItems, toggleItemCollapse, duplicateOrderNumbers, columnAlignments]);


  // 전체 데이터 건수 (원본 slots 기준 - 필터/접기와 무관하게 항상 전체 건수)
  const totalDataCount = useMemo(() => {
    return slots.length;
  }, [slots]);

  // 금액 합산 계산 (원본 slots 기준 - 필터/접기와 무관하게 항상 전체 금액)
  const totalAmount = useMemo(() => {
    return slots.reduce((sum, slot) => {
      const buyer = slot.buyer || {};
      const amount = parseInt(String(buyer.amount || 0).replace(/[^0-9]/g, '')) || 0;
      return sum + amount;
    }, 0);
  }, [slots]);

  // 필터링된 건수 계산 (구매자 데이터 행만)
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
      const amount = parseInt(String(row.col13 || 0).replace(/[^0-9]/g, '')) || 0;
      return sum + amount;
    }, 0);
  }, [filteredRows, tableData, totalAmount]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 헤더: 전체 건수 */}
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
        {(Object.keys(changedSlots).length > 0 || Object.keys(changedItems).length > 0) && !saving && (
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<SaveIcon />}
            onClick={handleSaveChanges}
            sx={{ bgcolor: '#4caf50' }}
          >
            저장 ({Object.keys(changedSlots).length + Object.keys(changedItems).length})
          </Button>
        )}
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
          backgroundColor: '#e3f2fd !important'
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
            colWidths={columnWidths.length > 0 ? columnWidths : undefined}
            rowHeaders={false}
            width="100%"
            height="calc(100vh - 210px)"
            licenseKey="non-commercial-and-evaluation"
            stretchH="none"
            autoRowSize={true}
            viewportRowRenderingOffset={50}
            manualColumnResize={true}
            manualRowResize={false}
            disableVisualSelection={false}
            imeFastEdit={true}
            // minSpareRows={SPARE_ROWS} // 여분 행 비활성화
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
                    if (!rowData || (rowData._rowType !== ROW_TYPES.BUYER_DATA && rowData._rowType !== ROW_TYPES.BUYER_HEADER)) {
                      alert('구매자 행에서 우클릭하여 행을 추가해주세요.');
                      return;
                    }

                    const itemId = rowData._itemId;
                    const dayGroup = rowData._dayGroup;

                    try {
                      await itemSlotService.createSlot(itemId, dayGroup);
                      setSnackbar({ open: true, message: '행이 추가되었습니다' });
                      loadSlots();
                    } catch (error) {
                      console.error('Failed to add row:', error);
                      alert('행 추가 실패: ' + (error.response?.data?.message || error.message));
                    }
                  }
                },
                delete_rows: {
                  name: '🗑️ 선택한 행 삭제',
                  callback: async function(key, selection) {
                    if (!selection || selection.length === 0) return;

                    // 선택된 모든 행의 슬롯 ID 수집
                    const slotIds = [];
                    const rowIndices = [];

                    for (const sel of selection) {
                      for (let r = sel.start.row; r <= sel.end.row; r++) {
                        if (rowIndices.includes(r)) continue;
                        rowIndices.push(r);

                        const rowData = tableData[r];
                        if (rowData?._rowType === ROW_TYPES.BUYER_DATA && rowData._slotId) {
                          slotIds.push(rowData._slotId);
                        }
                      }
                    }

                    if (slotIds.length === 0) {
                      alert('삭제할 구매자 행을 선택해주세요.\n(구매자 데이터 행만 삭제 가능합니다)');
                      return;
                    }

                    const confirmMsg = `선택한 ${slotIds.length}개의 행을 삭제하시겠습니까?\n\n⚠️ 해당 행의 구매자 정보와 업로드된 이미지가 모두 삭제됩니다.`;
                    if (!window.confirm(confirmMsg)) return;

                    try {
                      await itemSlotService.deleteSlotsBulk(slotIds);
                      setSnackbar({ open: true, message: `${slotIds.length}개 행이 삭제되었습니다` });
                      loadSlots();
                    } catch (error) {
                      console.error('Failed to delete rows:', error);
                      alert('행 삭제 실패: ' + (error.response?.data?.message || error.message));
                    }
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

                    const slotId = rowData._slotId;
                    if (!slotId) {
                      alert('슬롯 정보를 찾을 수 없습니다.');
                      return;
                    }

                    const slotNumber = rowData._slotNumber || rowData.col0;
                    const dayGroup = rowData._dayGroup;
                    const confirmMsg = `${dayGroup}일차의 ${slotNumber}번째 행 이후로 일 마감하시겠습니까?\n\n현재 행까지 ${dayGroup}일차로 유지되고,\n다음 행부터 새로운 일차로 분할됩니다.`;

                    if (!window.confirm(confirmMsg)) return;

                    try {
                      const result = await itemSlotService.splitDayGroup(slotId);
                      setSnackbar({ open: true, message: result.message });
                      loadSlots();
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
                      productName = rowData.col3 || '';  // col3이 제품명 (col0은 토글, col1은 날짜, col2는 순번)
                    } else if (rowData._rowType === ROW_TYPES.BUYER_DATA || rowData._rowType === ROW_TYPES.BUYER_HEADER || rowData._rowType === ROW_TYPES.UPLOAD_LINK_BAR) {
                      itemId = rowData._itemId;
                      // 제품명 찾기
                      const productDataRow = tableData.find(r => r._rowType === ROW_TYPES.PRODUCT_DATA && r._itemId === itemId);
                      productName = productDataRow?.col3 || '';  // col3이 제품명 (col0은 토글, col1은 날짜, col2는 순번)
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
            className="htCenter"
            autoWrapRow={false}
            autoWrapCol={false}
            selectionMode="multiple"
            outsideClickDeselects={true}
            enterBeginsEditing={true}
            enterMoves={{ row: 1, col: 0 }}
            tabMoves={{ row: 0, col: 1 }}
            style={{ fontSize: '13px' }}
            afterColumnResize={handleColumnResize}
            beforePaste={(data, coords) => {
              // 붙여넣기 슬래시 파싱 적용

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
            afterChange={(changes, source) => {
              // 유효하지 않은 변경이면 무시
              if (!changes || source === 'loadData') return;

              changes.forEach(([row, prop, oldValue, newValue]) => {
                if (oldValue === newValue) return;

                const rowData = tableData[row];
                if (!rowData) return;

                // PRODUCT_DATA 행 변경 처리
                if (rowData._rowType === ROW_TYPES.PRODUCT_DATA) {
                  const itemId = rowData._itemId;
                  if (!itemId) return;

                  // 컬럼 매핑: col0=토글, col1=날짜, col2=플랫폼, col3=제품명, col4=옵션, col5=출고, col6=키워드, col7=가격, col8=총건수, col9=일건수, col10=택배대행, col11=URL, col12=특이사항, col13=상세
                  const fieldMap = {
                    col1: 'date',  // 제품 날짜
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

                  const fieldName = fieldMap[prop];
                  if (!fieldName) return;

                  const dayGroup = rowData._dayGroup;

                  // 사용자 입력값을 그대로 저장 (계산 시에만 숫자 추출)
                  const dayGroupKey = dayGroup ? `${itemId}_${dayGroup}` : String(itemId);
                  setChangedItems(prev => ({
                    ...prev,
                    [dayGroupKey]: { ...(prev[dayGroupKey] || {}), itemId, dayGroup, [fieldName]: newValue ?? '' }
                  }));

                  // 제품 데이터도 즉시 slots 상태에 반영 (Enter 후 바로 표시)
                  setSlots(prevSlots => {
                    return prevSlots.map(slot => {
                      const matchItem = dayGroup
                        ? (slot.item_id === itemId && slot.day_group === dayGroup)
                        : (slot.item_id === itemId);
                      if (matchItem) {
                        return { ...slot, [fieldName]: newValue ?? '' };
                      }
                      return slot;
                    });
                  });
                }
                // BUYER_DATA 행 변경 처리 (19개 컬럼) - 영업사는 리뷰비 컬럼 제외
                else if (rowData._rowType === ROW_TYPES.BUYER_DATA) {
                  const slotId = rowData._slotId;
                  if (!slotId) return;

                  // 컬럼 매핑: 19개 컬럼 → API 필드명 (영업사는 리뷰비 컬럼 제외)
                  // col0: 접기(readOnly), col1: 날짜(slot.date), col2: 순번(readOnly), col3: 제품명(readOnly), col4: 옵션(readOnly),
                  // col5: 예상구매자(slot), col6: 주문번호, col7: 구매자, col8: 수취인, col9: 아이디, col10: 연락처, col11: 주소, col12: 계좌, col13: 금액,
                  // col14: 송장번호, col15: 리뷰샷(readOnly), col16: 상태, col17: 입금명, col18: 입금여부
                  const fieldMap = {
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
                    col17: 'deposit_name',  // 입금명
                    col18: 'payment_confirmed'  // 입금여부
                  };

                  const fieldName = fieldMap[prop];
                  if (!fieldName) return;

                  setChangedSlots(prev => ({
                    ...prev,
                    [slotId]: { ...(prev[slotId] || {}), [fieldName]: newValue || '' }
                  }));

                  // slots 상태 즉시 업데이트 (토글 시 데이터 유지를 위해)
                  const buyerFields = ['order_number', 'buyer_name', 'recipient_name', 'user_id', 'contact', 'address', 'account_info', 'amount', 'tracking_number', 'deposit_name', 'payment_confirmed'];
                  setSlots(prevSlots => {
                    return prevSlots.map(slot => {
                      if (slot.id === slotId) {
                        if (buyerFields.includes(fieldName)) {
                          // buyer 객체 업데이트
                          const updatedBuyer = slot.buyer
                            ? { ...slot.buyer, [fieldName]: newValue || '' }
                            : { [fieldName]: newValue || '' };
                          return { ...slot, buyer: updatedBuyer };
                        } else {
                          // slot 필드 업데이트
                          return { ...slot, [fieldName]: newValue || '' };
                        }
                      }
                      return slot;
                    });
                  });
                }
              });
            }}
            // afterRender - 메모 기능 비활성화
            // afterRender={() => {
            //   const hot = hotRef.current?.hotInstance;
            //   if (!hot || Object.keys(memos).length === 0) return;
            //
            //   // 저장된 메모 데이터를 시트에 적용
            //   Object.entries(memos).forEach(([key, value]) => {
            //     const [rowStr, colStr] = key.split('_');
            //     const row = parseInt(rowStr, 10);
            //     const col = parseInt(colStr, 10);
            //
            //     const currentValue = hot.getDataAtCell(row, col);
            //     if (currentValue !== value && value) {
            //       hot.setDataAtCell(row, col, value, 'loadMemo');
            //     }
            //   });
            // }}
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
                const item = rowData._item;
                if (item) {
                  setProductDetailPopup({
                    open: true,
                    item: item,
                    slot: null,
                    dayGroup: null
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
            }}
            rowHeights={23}
            autoScrollOnSelection={false}
            filters={true}
            dropdownMenu={['filter_by_condition', 'filter_by_value', 'filter_action_bar']}
            hiddenRows={{
              rows: [],
              indicators: false
            }}
            afterFilter={(conditionsStack) => {
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
                return;
              }

              // 먼저 모든 hiddenRows 초기화
              const currentHidden = hiddenRowsPlugin.getHiddenRows();
              if (currentHidden.length > 0) {
                hiddenRowsPlugin.showRows(currentHidden);
              }

              // 필터 조건이 없으면 전체 표시
              if (!conditionsStack || conditionsStack.length === 0) {
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
            등록된 품목이 없습니다. "품목 추가" 버튼을 클릭하여 추가하세요.
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

      {/* 이미지 갤러리 팝업 */}
      <Dialog
        open={imagePopup.open}
        onClose={(event, reason) => { if (reason !== 'backdropClick') setImagePopup({ open: false, images: [], currentIndex: 0, buyer: null }); }}
        maxWidth="lg"
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            리뷰 이미지 {imagePopup.images.length > 0 && `(${imagePopup.currentIndex + 1} / ${imagePopup.images.length})`}
          </span>
          <IconButton
            size="small"
            onClick={() => setImagePopup({ open: false, images: [], currentIndex: 0, buyer: null })}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            {/* 왼쪽 화살표 */}
            <IconButton
              onClick={prevImage}
              disabled={imagePopup.currentIndex === 0}
              sx={{ visibility: imagePopup.images.length > 1 ? 'visible' : 'hidden' }}
            >
              <ChevronLeftIcon fontSize="large" />
            </IconButton>

            {/* 이미지 */}
            {imagePopup.images.length > 0 && imagePopup.images[imagePopup.currentIndex] && (
              <img
                src={imagePopup.images[imagePopup.currentIndex].s3_url}
                alt={imagePopup.images[imagePopup.currentIndex].file_name || '리뷰 이미지'}
                style={{
                  maxWidth: '70vw',
                  maxHeight: '70vh',
                  objectFit: 'contain'
                }}
              />
            )}

            {/* 오른쪽 화살표 */}
            <IconButton
              onClick={nextImage}
              disabled={imagePopup.currentIndex === imagePopup.images.length - 1}
              sx={{ visibility: imagePopup.images.length > 1 ? 'visible' : 'hidden' }}
            >
              <ChevronRightIcon fontSize="large" />
            </IconButton>
          </Box>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteDialog.open}
        onClose={(event, reason) => { if (reason !== 'backdropClick') closeDeleteDialog(); }}
      >
        <DialogTitle>삭제 확인</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ whiteSpace: 'pre-line' }}>
            {deleteDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            삭제
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
              {(() => {
                const item = productDetailPopup.item || {};
                const getValue = (field) => item[field] || '-';

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
}

export default SalesItemSheet;
