import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Snackbar, Alert, IconButton } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import itemSlotService from '../../services/itemSlotService';
import itemService from '../../services/itemService';

// Handsontable 모든 모듈 등록
registerAllModules();

// 행 타입 상수 정의
const ROW_TYPES = {
  ITEM_SEPARATOR: 'item_separator',      // 품목 구분선 (파란색, 높이 8px)
  PRODUCT_HEADER: 'product_header',      // 제품 정보 컬럼 헤더 행
  PRODUCT_DATA: 'product_data',          // 제품 정보 데이터 행
  UPLOAD_LINK_BAR: 'upload_link_bar',    // 업로드 링크 바 (검정)
  BUYER_HEADER: 'buyer_header',          // 구매자 컬럼 헤더 행
  BUYER_DATA: 'buyer_data',              // 구매자 데이터 행
};

// 제품 정보 컬럼 헤더 (9개)
const PRODUCT_HEADERS = ['제품명', '출고', '옵션', '키워드', '가격', '총건수', '일건수', 'URL', '택배'];

// 구매자 정보 컬럼 헤더 (19개) - 구매자 테이블에서 col2는 '순번' (슬롯 순서)
// col0: 접기, col1: 날짜, col2: 순번(구매자용), col3: 제품명, col4: 옵션, col5: 예상구매자,
// col6: 주문번호, col7: 구매자, col8: 수취인, col9: 아이디, col10: 연락처, col11: 주소, col12: 계좌, col13: 금액,
// col14: 리뷰샷, col15: 상태, col16: 리뷰비, col17: 입금명, col18: 입금여부
// 제품 테이블에서 col2는 '플랫폼' (Item.platform)
const BUYER_HEADERS = ['', '날짜', '순번', '제품명', '옵션', '예상구매자', '주문번호', '구매자', '수취인', '아이디', '연락처', '주소', '계좌', '금액', '리뷰샷', '상태', '리뷰비', '입금명', '입금여부'];

/**
 * 진행자용 품목별 시트 컴포넌트 (Handsontable - 엑셀)
 * - 배정된 품목의 슬롯만 표시
 * - 구매자 정보 컬럼 포함
 *
 * 컬럼 순서:
 * URL, 날짜, 순번, 품명, 옵션, 리뷰(키워드), 예상구매자, 주문번호, 구매자, 수취인, 아이디, 연락처, 주소, 금액, 리뷰비용, 리뷰작성(상태), 특이사항
 */
function OperatorItemSheet({
  campaignId,
  items,
  onRefresh,
  viewAsUserId = null
}) {
  const hotRef = useRef(null);

  // 슬롯 데이터
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  // 변경된 슬롯들 추적
  const [changedSlots, setChangedSlots] = useState({});

  // 변경된 아이템들 추적 (제품 정보 수정용)
  const [changedItems, setChangedItems] = useState({});

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

  // 이미지 확대 팝업 상태
  const [imagePopup, setImagePopup] = useState({ open: false, url: '', fileName: '' });

  // 메모 기능 비활성화됨

  // 필터링된 행 인덱스 (null이면 전체, 배열이면 필터링된 행만)
  const [filteredRows, setFilteredRows] = useState(null);

  // 필터링된 컬럼 인덱스 추적
  const [filteredColumns, setFilteredColumns] = useState(new Set());

  // 필터 조건 저장 (데이터 리로드 시 복원용)
  const filterConditionsRef = useRef(null);

  // 접힌 품목 ID Set (기본값: 빈 Set = 모두 펼침)
  const [collapsedItems, setCollapsedItems] = useState(new Set());

  // 여분 행/열 개수 (기능 비활성화 - 나중에 복원 가능)
  // const SPARE_ROWS = 20;
  // const SPARE_COLS = 3;

  // 컬럼 크기 저장 키
  const COLUMN_WIDTHS_KEY = 'operator_itemsheet_column_widths';

  // 접기 상태 저장 키
  const COLLAPSED_ITEMS_KEY = 'operator_itemsheet_collapsed_items';

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

    // 현재 모든 컬럼 너비 가져오기
    const widths = [];
    for (let i = 0; i < hot.countCols(); i++) {
      widths.push(hot.getColWidth(i));
    }

    // localStorage에 저장
    try {
      localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
    } catch (e) {
      console.error('Failed to save column widths:', e);
    }
  }, []);

  // 캠페인별 배정된 슬롯 데이터 로드 (Operator 전용)
  const loadSlots = useCallback(async () => {
    if (!campaignId) return;

    setLoading(true);
    try {
      const response = await itemSlotService.getSlotsByCampaignForOperator(campaignId, viewAsUserId);
      if (response.success) {
        setSlots(response.data || []);
        setChangedSlots({});
      }
    } catch (error) {
      console.error('Failed to load slots:', error);
    } finally {
      setLoading(false);
    }
  }, [campaignId, viewAsUserId]);

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
      loadSlots();
      // loadMemos(); // 메모 기능 비활성화
    }
  }, [campaignId, loadSlots]);

  // slots 로드 후 접기 상태 초기화 (localStorage 복원 또는 기본값=모두 접기)
  useEffect(() => {
    if (slots.length === 0) return;

    // 모든 품목 ID 추출
    const allItemIds = [...new Set(slots.map(s => s.item_id))];

    // localStorage에서 저장된 상태 복원
    const savedCollapsed = getSavedCollapsedItems();

    if (savedCollapsed !== null && savedCollapsed.size > 0) {
      // 저장된 상태가 있으면 복원 (현재 데이터에 있는 품목만)
      const validCollapsed = new Set([...savedCollapsed].filter(id => allItemIds.includes(id)));
      setCollapsedItems(validCollapsed);
    } else {
      // 저장된 상태가 없으면 모두 접기 (기본값)
      setCollapsedItems(new Set(allItemIds));
    }
  }, [slots, getSavedCollapsedItems]);

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

  // Handsontable 데이터 변환 - 새로운 구조
  // 제품 정보와 구매자 정보 분리, 일차별 업로드 링크 바
  const { tableData, slotIndexMap, rowMetaMap } = useMemo(() => {
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

    // 품목별로 행 생성
    Object.entries(itemGroups).forEach(([itemId, itemGroup]) => {
      const item = itemGroup.item || {};

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

      // 접힌 상태 확인
      const isCollapsed = collapsedItems.has(parseInt(itemId));

      // 일차별로 제품 정보 + 구매자 정보 반복
      const dayGroupKeys = Object.keys(itemGroup.dayGroups).sort((a, b) => parseInt(a) - parseInt(b));

      dayGroupKeys.forEach((dayGroup, dayGroupIndex) => {
        const groupData = itemGroup.dayGroups[dayGroup];
        const uploadToken = groupData.uploadToken;

        // 해당 day_group의 첫 번째 슬롯에서 날짜 가져오기 (Sales가 입력한 날짜)
        const dayGroupDate = groupData.slots[0]?.date || '';

        // 첫 번째 품목의 첫 번째 일차가 아닌 경우 품목 구분선 추가
        if (!isFirstItem || dayGroupIndex > 0) {
          metaMap.set(data.length, { rowType: ROW_TYPES.ITEM_SEPARATOR });
          data.push({ _rowType: ROW_TYPES.ITEM_SEPARATOR });
        }
        if (dayGroupIndex === 0) {
          isFirstItem = false;
        }

        // 제품 헤더 행 (19개 컬럼) - 각 일차마다 표시
        // 순서: 접기, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배대행, URL, (빈칸), 특이사항
        metaMap.set(data.length, { rowType: ROW_TYPES.PRODUCT_HEADER, dayGroup: parseInt(dayGroup) });
        data.push({
          _rowType: ROW_TYPES.PRODUCT_HEADER,
          _itemId: parseInt(itemId),
          _dayGroup: parseInt(dayGroup),
          col0: '', col1: '날짜', col2: '플랫폼', col3: '제품명', col4: '옵션', col5: '출고', col6: '키워드',
          col7: '가격', col8: '총건수', col9: '일건수', col10: '택배대행', col11: 'URL', col12: '', col13: '특이사항',
          col14: '', col15: '', col16: '', col17: '', col18: ''
        });

        // 제품 데이터 행 (19개 컬럼) - 각 일차마다 표시
        // 순서: 접기, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배대행, URL, (빈칸), 특이사항
        metaMap.set(data.length, { rowType: ROW_TYPES.PRODUCT_DATA, itemId: parseInt(itemId), dayGroup: parseInt(dayGroup) });
        data.push({
          _rowType: ROW_TYPES.PRODUCT_DATA,
          _itemId: parseInt(itemId),
          _dayGroup: parseInt(dayGroup),
          _completionStatus: { total: totalSlots, completed: completedSlots, isAllCompleted },
          col0: '',  // 토글 버튼
          col1: item.date || '',  // 제품 날짜 (Item 테이블 - 사용자 입력)
          col2: item.platform || '-',  // 플랫폼 (순번 대신)
          col3: item.product_name || '',  // 제품명
          col4: item.purchase_option || '',  // 옵션
          col5: item.shipping_type || '',   // 출고
          col6: item.keyword || '',         // 키워드
          col7: item.product_price ? Number(item.product_price).toLocaleString() : '',  // 가격
          col8: item.total_purchase_count || '',   // 총건수
          col9: item.daily_purchase_count || '',   // 일건수
          col10: item.courier_service_yn ? 'Y' : 'N',  // 택배대행
          col11: item.product_url || '',    // URL
          col12: '',                        // 빈칸 (기존 플랫폼 위치)
          col13: item.notes || '',          // 특이사항
          col14: '', col15: '', col16: '', col17: '', col18: ''
        });

        // 접힌 상태가 아닐 때만 업로드 링크 바 및 구매자 정보 표시
        if (!isCollapsed) {
          // 업로드 링크 바 (19개 컬럼)
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
            col0: '',  // 토글 컬럼 (빈칸)
            col1: `📷 업로드 링크 복사`,
            col2: '', col3: '', col4: '', col5: '', col6: '', col7: '', col8: '', col9: '',
            col10: '', col11: '', col12: '', col13: '', col14: '', col15: '', col16: '', col17: '', col18: ''
          });

          // 구매자 헤더 행 (19개 컬럼)
          // col0: 접기, col1: 날짜, col2: 순번, col3: 제품명, col4: 옵션, col5: 예상구매자,
          // col6: 주문번호, col7: 구매자, col8: 수취인, col9: 아이디, col10: 연락처, col11: 주소, col12: 계좌, col13: 금액,
          // col14: 리뷰샷, col15: 상태, col16: 리뷰비, col17: 입금명, col18: 입금여부
          metaMap.set(data.length, { rowType: ROW_TYPES.BUYER_HEADER, dayGroup: parseInt(dayGroup) });
          data.push({
            _rowType: ROW_TYPES.BUYER_HEADER,
            _itemId: parseInt(itemId),
            _dayGroup: parseInt(dayGroup),
            col0: '', col1: '날짜', col2: '순번', col3: '제품명', col4: '옵션', col5: '예상구매자',
            col6: '주문번호', col7: '구매자', col8: '수취인', col9: '아이디', col10: '연락처', col11: '주소', col12: '계좌', col13: '금액',
            col14: '리뷰샷', col15: '상태', col16: '리뷰비', col17: '입금명', col18: '입금여부'
          });

          // 구매자 데이터 행 (슬롯별) - 19개 컬럼
          groupData.slots.forEach((slot, slotIndex) => {
            const buyer = slot.buyer || {};
            const reviewImage = buyer.images && buyer.images.length > 0 ? buyer.images[0] : null;

            // 상태 계산: 구매자 정보 없음 → "-", 구매자 정보 있음 → "active", 리뷰샷 있음 → "completed"
            const hasBuyerData = buyer.order_number || buyer.buyer_name || buyer.recipient_name ||
                                 buyer.user_id || buyer.contact || buyer.address ||
                                 buyer.account_info || buyer.amount;
            const hasReviewImage = reviewImage?.s3_url;
            const calculatedStatus = hasReviewImage ? 'completed' : (hasBuyerData ? 'active' : '-');

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
              _reviewImageUrl: reviewImage?.s3_url || '',
              _reviewImageName: reviewImage?.file_name || '',
              _hasBuyerData: !!hasBuyerData,
              // 19개 컬럼 구조
              col0: '',  // 접기 (빈칸)
              col1: slot.date || '',  // 날짜 (Sales가 입력한 날짜, slot.date에서 가져옴)
              col2: slotIndex + 1,  // 순번 (1부터 시작)
              col3: slot.product_name || '',  // 제품명 (Slot 테이블 값 - Item과 독립)
              col4: slot.purchase_option || '',  // 옵션 (Slot 테이블 값 - Item과 독립)
              col5: slot.expected_buyer || '',  // 예상 구매자
              col6: buyer.order_number || '',  // 주문번호
              col7: buyer.buyer_name || '',  // 구매자
              col8: buyer.recipient_name || '',  // 수취인
              col9: buyer.user_id || '',  // 아이디
              col10: buyer.contact || '',  // 연락처
              col11: buyer.address || '',  // 주소
              col12: buyer.account_info || '',  // 계좌
              col13: buyer.amount || '',  // 금액
              col14: reviewImage?.s3_url || '',  // 리뷰샷
              col15: calculatedStatus,  // 상태
              col16: slot.review_cost || '',  // 리뷰비
              col17: buyer.deposit_name || '',  // 입금명
              col18: buyer.payment_confirmed ? 'Y' : '',  // 입금여부
              // 추가 데이터 (저장용)
              shipping_delayed: buyer.shipping_delayed || false
            });
          });
        }
      });
    });

    return { tableData: data, slotIndexMap: indexMap, rowMetaMap: metaMap };
  }, [slots, collapsedItems]);

  // 상태 옵션
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

  // 기본 컬럼 너비 - 19개 컬럼
  // col0: 접기(20), col1: 날짜(60), col2: 플랫폼/순번(70), col3: 제품명(120), col4: 옵션(80), col5: 예상구매자(80),
  // col6: 주문번호(110), col7: 구매자(70), col8: 수취인(70), col9: 아이디(100), col10: 연락처(100), col11: 주소(150),
  // col12: 계좌(120), col13: 금액(70), col14: 리뷰샷(55), col15: 상태(55), col16: 리뷰비(60), col17: 입금명(70), col18: 입금여부(55)
  const defaultColumnWidths = [20, 60, 70, 120, 80, 80, 110, 70, 70, 100, 100, 150, 120, 70, 55, 55, 60, 70, 55];

  // 컬럼 정의: 통합 컬럼 (행 타입에 따라 다른 데이터 표시) - 19개
  const columns = useMemo(() => {
    const savedWidths = getSavedColumnWidths();
    const baseColumns = [];

    for (let i = 0; i < 19; i++) {
      baseColumns.push({
        data: `col${i}`,
        type: 'text',
        width: savedWidths?.[i] || defaultColumnWidths[i]
      });
    }

    return baseColumns;
  }, [getSavedColumnWidths]);

  // 컬럼 헤더는 빈 배열 (manualColumnResize를 위해 헤더 행 필요)
  // 빈 문자열 배열이면 헤더는 비어있지만 리사이즈 핸들 동작
  const colHeaders = Array(19).fill('');

  // 구매자 컬럼 필드 매핑 (19개 컬럼 → API 필드명)
  // col0: 접기(readOnly), col1: 날짜(slot.date), col2: 순번(readOnly), col3: 제품명(readOnly), col4: 옵션(readOnly),
  // col5: 예상구매자(편집가능-slot), col6: 주문번호, col7: 구매자, col8: 수취인, col9: 아이디, col10: 연락처, col11: 주소, col12: 계좌, col13: 금액,
  // col14: 리뷰샷(readOnly), col15: 상태, col16: 리뷰비(slot), col17: 입금명, col18: 입금여부
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
    col15: 'status',
    col16: 'review_cost',  // 리뷰비 (slot 필드)
    col17: 'deposit_name',
    col18: 'payment_confirmed'
    // col0: 접기 (readOnly)
    // col2: 순번 (readOnly)
    // col3: 제품명 (readOnly)
    // col4: 옵션 (readOnly)
    // col14: 리뷰샷 (readOnly)
  };

  // 제품 정보 컬럼 필드 매핑 (col1~col13 → API 필드명) - col0은 토글
  // 순서: 접기, 날짜, 플랫폼, 제품명, 옵션, 출고, 키워드, 가격, 총건수, 일건수, 택배대행, URL, (빈칸), 특이사항
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
    // col12: 빈칸 (제거됨)
    col13: 'notes'
  };

  // 데이터 변경 핸들러 (구매자 데이터 + 제품 정보 수정 가능)
  const handleAfterChange = useCallback((changes, source) => {
    if (!changes || source === 'loadData' || source === 'loadMemo') return;

    const slotUpdates = { ...changedSlots };
    const itemUpdates = { ...changedItems };

    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue === newValue) return;

      // 행 데이터 확인
      const rowData = tableData[row];
      if (!rowData) return;

      // 제품 정보 행 처리
      if (rowData._rowType === ROW_TYPES.PRODUCT_DATA) {
        const itemId = rowData._itemId;
        if (!itemId) return;

        const apiField = itemFieldMap[prop];
        if (!apiField) return;

        if (!itemUpdates[itemId]) {
          itemUpdates[itemId] = { id: itemId };
        }

        // 사용자 입력값을 그대로 저장 (계산 시에만 숫자 추출)
        itemUpdates[itemId][apiField] = newValue ?? '';
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
      }
    });

    setChangedSlots(slotUpdates);
    setChangedItems(itemUpdates);
  }, [slotIndexMap, changedSlots, changedItems, tableData, itemFieldMap, buyerFieldMap]);

  // 변경사항 저장 (슬롯 데이터 + 제품 정보) - DB 저장 + 스크롤 위치 유지
  const handleSaveChanges = async () => {
    const hasSlotChanges = Object.keys(changedSlots).length > 0;
    const hasItemChanges = Object.keys(changedItems).length > 0;

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
        const slotsToUpdate = Object.values(changedSlots);
        await itemSlotService.updateSlotsBulk(slotsToUpdate);
      }

      // 제품 정보 저장 (DB 업데이트)
      if (hasItemChanges) {
        const itemsToUpdate = Object.values(changedItems);
        for (const item of itemsToUpdate) {
          const { id, ...updateData } = item;
          await itemService.updateItem(id, updateData);
        }
      }

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
      console.error('Failed to save changes:', error);
      alert('저장 실패: ' + error.message);
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
      } else if (type === 'group') {
        // 그룹(일차)별 삭제
        await itemSlotService.deleteSlotsByGroup(data.itemId, data.dayGroup);
      } else if (type === 'item') {
        // 품목 삭제
        await itemService.deleteItem(data.itemId);
      }

      closeDeleteDialog();

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

      // 슬롯 다시 로드
      await loadSlots();

      // 부모 컴포넌트에 알림 (캠페인 목록 새로고침)
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Delete failed:', error);
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

  // 셀 렌더러 - 행 타입별 분기
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
          // col2 - 플랫폼 (볼드, 파란색)
          else if (prop === 'col2') {
            td.textContent = value ?? '';
            td.style.fontWeight = 'bold';
            td.style.color = '#1565c0';
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

          // col0은 토글 컬럼 (빈칸), col1에 업로드 링크 텍스트
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
        // 구매자 데이터 행 - 모든 컬럼 편집 가능 (col14 리뷰샷만 readOnly)
        const dayGroup = rowData._dayGroup || 1;
        const dayClass = dayGroup % 2 === 0 ? 'day-even' : 'day-odd';
        cellProperties.className = dayClass;

        // col14(리뷰샷)만 readOnly, 나머지는 모두 편집 가능
        if (col === 14) {
          cellProperties.readOnly = true; // 이미지 컬럼만 readOnly
        } else {
          cellProperties.readOnly = false;
        }

        // 상태 컬럼 (col15) - 드롭다운
        if (col === 15) {
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
          // 순번 컬럼 (col2) - 중앙 정렬
          else if (prop === 'col2') {
            td.textContent = value ?? '';
            td.style.textAlign = 'center';
            td.style.color = '#666';
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
          // 리뷰샷 컬럼 (col14) - 썸네일 이미지
          else if (prop === 'col14') {
            const imageUrl = rowData._reviewImageUrl;
            if (imageUrl) {
              td.innerHTML = `<img
                src="${imageUrl}"
                alt="리뷰"
                class="review-thumbnail"
                data-url="${imageUrl}"
                data-filename="${rowData._reviewImageName || ''}"
                style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer;"
              />`;
              td.style.padding = '2px';
              td.style.textAlign = 'center';
            } else {
              td.innerHTML = '<span style="color: #999; font-size: 10px;">-</span>';
              td.style.textAlign = 'center';
            }
          }
          // 상태 컬럼 (col15) - 칩 스타일
          else if (prop === 'col15') {
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
          // 입금여부 컬럼 (col18) - Y/N 표시
          else if (prop === 'col18') {
            td.textContent = value ?? '';
            td.style.textAlign = 'center';
            if (value === 'Y') {
              td.style.color = '#388e3c';
              td.style.fontWeight = 'bold';
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

          return td;
        };
        break;

      default:
        break;
    }

    return cellProperties;
  }, [tableData, statusOptions, statusLabels, collapsedItems, toggleItemCollapse, duplicateOrderNumbers]);

  const hasChanges = Object.keys(changedSlots).length > 0 || Object.keys(changedItems).length > 0;
  const totalChanges = Object.keys(changedSlots).length + Object.keys(changedItems).length;

  // 전체 데이터 건수 (원본 slots 데이터 기준 - 접기/펼치기와 무관)
  const totalDataCount = useMemo(() => {
    return slots.length;
  }, [slots]);

  // 금액 합산 계산 (원본 slots 데이터 기준 - 접기/펼치기와 무관)
  const totalAmount = useMemo(() => {
    return slots.reduce((sum, slot) => {
      const buyer = slot.buyer || {};
      const amount = parseInt(String(buyer.amount || 0).replace(/[^0-9]/g, '')) || 0;
      return sum + amount;
    }, 0);
  }, [slots]);

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
      {/* 헤더: 전체 건수 + 저장 버튼 */}
      <Box sx={{
        mb: 0.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: '#00897b',
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

      <Paper sx={{
        overflow: 'hidden',
        flex: 1,
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
        // spare-row-cell 클래스의 드롭다운 화살표 숨김
        '& .spare-row-cell .htAutocompleteArrow': {
          display: 'none !important'
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
            height="calc(100vh - 160px)"
            licenseKey="non-commercial-and-evaluation"
            stretchH="none"
            autoRowSize={false}
            manualColumnResize={true}
            manualRowResize={false}
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
                      loadSlots(); // 데이터 새로고침
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
                }
              }
            }}
            copyPaste={true}
            fillHandle={true}
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

              // 리뷰샷 썸네일 클릭 시 확대 팝업
              const target = event.target;
              if (target.tagName === 'IMG' && target.classList.contains('review-thumbnail')) {
                const url = target.getAttribute('data-url');
                const fileName = target.getAttribute('data-filename');
                if (url) {
                  setImagePopup({ open: true, url, fileName: fileName || '리뷰 이미지' });
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
            columnSorting={true}
            autoWrapRow={false}
            autoWrapCol={false}
            selectionMode="multiple"
            outsideClickDeselects={true}
            enterBeginsEditing={true}
            enterMoves={{ row: 1, col: 0 }}
            tabMoves={{ row: 0, col: 1 }}
            afterColumnResize={handleColumnResize}
            rowHeights={23}
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
      <Dialog open={deleteDialog.open} onClose={closeDeleteDialog}>
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

      {/* 이미지 확대 팝업 */}
      <Dialog
        open={imagePopup.open}
        onClose={() => setImagePopup({ open: false, url: '', fileName: '' })}
        maxWidth="lg"
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <span style={{ fontSize: '14px', color: '#666' }}>{imagePopup.fileName}</span>
          <IconButton
            size="small"
            onClick={() => setImagePopup({ open: false, url: '', fileName: '' })}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 1 }}>
          {imagePopup.url && (
            <img
              src={imagePopup.url}
              alt={imagePopup.fileName}
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain'
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default OperatorItemSheet;
