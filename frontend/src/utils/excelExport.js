import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * 엑셀 파일 다운로드
 * @param {Array} data - 2차원 배열 (첫 행은 헤더)
 * @param {string} fileName - 파일명 (확장자 제외)
 * @param {string} sheetName - 시트명
 */
export const downloadExcel = (data, fileName, sheetName = 'Sheet1', appendDate = true) => {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  if (appendDate) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    saveAs(blob, `${fileName}_${date}.xlsx`);
  } else {
    saveAs(blob, `${fileName}.xlsx`);
  }
};

/**
 * Sales/Operator 시트 데이터를 엑셀용 배열로 변환
 * 시트에 표시되는 모든 컬럼을 포함
 * @param {Array} slots - 원본 슬롯 데이터
 * @param {Object} items - 품목 정보 객체
 * @param {string} role - 'sales' | 'operator'
 */
export const convertSlotsToExcelData = (slots, items, role = 'sales') => {
  // 헤더 정의 - 시트의 모든 컬럼 포함
  // 제품 정보 + 구매자 정보 통합
  const headers = [
    // 제품 정보 (day_group별)
    '일차', '제품날짜', '플랫폼', '제품명', '옵션', '출고유형', '키워드',
    '가격', '총건수', '일건수', '택배대행', '상품URL', '특이사항',
    // 구매자 정보
    '순번', '구매자날짜', '예상구매자', '주문번호', '구매자', '수취인',
    '아이디', '연락처', '주소', '계좌', '금액', '송장번호', '리뷰샷URL',
    '상태', '리뷰비', '입금명', '입금확인일', '배송지연'
  ];

  const data = [headers];

  // 슬롯을 품목별, day_group별로 그룹화
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
      itemGroups[itemId].dayGroups[dayGroup] = [];
    }
    itemGroups[itemId].dayGroups[dayGroup].push(slot);
  });

  // 품목별, day_group별로 행 생성
  Object.entries(itemGroups).forEach(([itemId, itemGroup]) => {
    const item = itemGroup.item || {};

    Object.entries(itemGroup.dayGroups).forEach(([dayGroup, groupSlots]) => {
      // day_group별 제품 정보 (첫 번째 슬롯 기준)
      const firstSlot = groupSlots[0] || {};

      // 슬롯 값 > Item 값 우선순위
      const productName = firstSlot.product_name || item.product_name || '';
      const platform = firstSlot.platform || item.platform || '';
      const shippingType = firstSlot.shipping_type || item.shipping_type || '';
      const keyword = firstSlot.keyword || item.keyword || '';
      const productPrice = firstSlot.product_price || item.product_price || '';
      const totalPurchaseCount = firstSlot.total_purchase_count || item.total_purchase_count || '';
      const dailyPurchaseCount = firstSlot.daily_purchase_count || item.daily_purchase_count || '';
      const purchaseOption = firstSlot.purchase_option || item.purchase_option || '';
      const courierServiceYn = firstSlot.courier_service_yn || item.courier_service_yn || '';
      const productUrl = firstSlot.product_url || item.product_url || '';
      const notes = firstSlot.notes || item.notes || '';
      const productDate = item.date || '';

      groupSlots.forEach((slot, slotIndex) => {
        const buyer = slot.buyer || {};
        const reviewImage = buyer.images?.[0];
        const reviewImageUrl = reviewImage?.s3_url || '';

        // 상태 계산
        const hasBuyerData = buyer.order_number || buyer.buyer_name || buyer.recipient_name ||
                            buyer.user_id || buyer.contact || buyer.address ||
                            buyer.account_info || buyer.amount;
        const hasReviewImage = !!reviewImageUrl;
        const status = hasReviewImage ? '완료' : (hasBuyerData ? '진행' : '-');

        const row = [
          // 제품 정보
          dayGroup,                          // 일차
          productDate,                       // 제품날짜
          platform,                          // 플랫폼
          productName,                       // 제품명
          purchaseOption,                    // 옵션
          shippingType,                      // 출고유형
          keyword,                           // 키워드
          productPrice,                      // 가격
          totalPurchaseCount,                // 총건수
          dailyPurchaseCount,                // 일건수
          courierServiceYn,                  // 택배대행
          productUrl,                        // 상품URL
          notes,                             // 특이사항
          // 구매자 정보
          slotIndex + 1,                     // 순번
          slot.date || '',                   // 구매자날짜
          slot.expected_buyer || '',         // 예상구매자
          buyer.order_number || '',          // 주문번호
          buyer.buyer_name || '',            // 구매자
          buyer.recipient_name || '',        // 수취인
          buyer.user_id || '',               // 아이디
          buyer.contact || '',               // 연락처
          buyer.address || '',               // 주소
          buyer.account_info || '',          // 계좌
          buyer.amount || '',                // 금액
          buyer.tracking_number || '',       // 송장번호
          reviewImageUrl,                    // 리뷰샷URL
          status,                            // 상태
          slot.review_cost || '',            // 리뷰비
          buyer.deposit_name || '',          // 입금명
          buyer.payment_confirmed_at         // 입금확인일
            ? new Date(buyer.payment_confirmed_at).toLocaleDateString('ko-KR')
            : '',
          buyer.shipping_delayed ? 'Y' : ''  // 배송지연
        ];

        data.push(row);
      });
    });
  });

  return data;
};

/**
 * Brand 시트 데이터를 엑셀용 배열로 변환 (제한된 컬럼 + 추가 제품 정보)
 */
export const convertBrandSlotsToExcelData = (slots, items) => {
  // 브랜드사 시트에 표시되는 모든 컬럼 포함
  const headers = [
    // 제품 정보
    '일차', '날짜', '플랫폼', '제품명', '옵션', '출고유형', '키워드',
    '가격', '총건수', '일건수', '택배대행', '상품URL', '특이사항',
    // 구매자 정보 (브랜드사 허용 컬럼 - 연락처, 계좌 제외)
    '주문번호', '구매자', '수취인', '아이디', '주소', '금액', '송장번호', '리뷰샷URL'
  ];

  const data = [headers];

  // 슬롯을 품목별, day_group별로 그룹화
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
      itemGroups[itemId].dayGroups[dayGroup] = [];
    }
    itemGroups[itemId].dayGroups[dayGroup].push(slot);
  });

  // 품목별, day_group별로 행 생성
  Object.entries(itemGroups).forEach(([itemId, itemGroup]) => {
    const item = itemGroup.item || {};

    Object.entries(itemGroup.dayGroups).forEach(([dayGroup, groupSlots]) => {
      // day_group별 제품 정보 (첫 번째 슬롯 기준)
      const firstSlot = groupSlots[0] || {};

      const productName = firstSlot.product_name || item.product_name || '';
      const platform = firstSlot.platform || item.platform || '';
      const shippingType = firstSlot.shipping_type || item.shipping_type || '';
      const keyword = firstSlot.keyword || item.keyword || '';
      const productPrice = firstSlot.product_price || item.product_price || '';
      const totalPurchaseCount = firstSlot.total_purchase_count || item.total_purchase_count || '';
      const dailyPurchaseCount = firstSlot.daily_purchase_count || item.daily_purchase_count || '';
      const purchaseOption = firstSlot.purchase_option || item.purchase_option || '';
      const courierServiceYn = firstSlot.courier_service_yn || item.courier_service_yn || '';
      const productUrl = firstSlot.product_url || item.product_url || '';
      const notes = firstSlot.notes || item.notes || '';
      const productDate = item.date || '';

      groupSlots.forEach((slot) => {
        const buyer = slot.buyer || {};
        const reviewImageUrl = buyer.images?.[0]?.s3_url || '';

        // 임시 구매자 제외
        if (buyer.is_temporary) return;

        data.push([
          // 제품 정보
          dayGroup,                          // 일차
          productDate,                       // 날짜
          platform,                          // 플랫폼
          productName,                       // 제품명
          purchaseOption,                    // 옵션
          shippingType,                      // 출고유형
          keyword,                           // 키워드
          productPrice,                      // 가격
          totalPurchaseCount,                // 총건수
          dailyPurchaseCount,                // 일건수
          courierServiceYn,                  // 택배대행
          productUrl,                        // 상품URL
          notes,                             // 특이사항
          // 구매자 정보 (브랜드사 허용 컬럼 - 연락처, 계좌 제외)
          buyer.order_number || '',          // 주문번호
          buyer.buyer_name || '',            // 구매자
          buyer.recipient_name || '',        // 수취인
          buyer.user_id || '',               // 아이디
          buyer.address || '',               // 주소
          buyer.amount || '',                // 금액
          buyer.tracking_number || '',       // 송장번호
          reviewImageUrl                     // 리뷰샷URL
        ]);
      });
    });
  });

  return data;
};

/**
 * Admin 일별 입금관리 데이터를 엑셀용 배열로 변환
 */
export const convertDailyPaymentsToExcelData = (buyers) => {
  const headers = ['캠페인', '제품명', '입금명', '리뷰 제출일', '주문번호', '구매자', '수취인',
                   '계좌', '금액', '리뷰비', '입금확인', '입금일', '리뷰샷URL'];

  const data = [headers];

  buyers.forEach(buyer => {
    data.push([
      buyer.campaign?.name || '',
      buyer.item?.product_name || '',
      buyer.deposit_name || '',
      buyer.review_submitted_at
        ? new Date(buyer.review_submitted_at).toLocaleDateString('ko-KR')
        : '',
      buyer.order_number || '',
      buyer.buyer_name || '',
      buyer.recipient_name || '',
      buyer.account_info || '',
      buyer.amount || '',
      buyer.review_cost || '',
      buyer.payment_status === 'completed' ? '완료' : '대기',
      buyer.payment_confirmed_at
        ? new Date(buyer.payment_confirmed_at).toLocaleDateString('ko-KR')
        : '',
      buyer.image_url || ''
    ]);
  });

  return data;
};
