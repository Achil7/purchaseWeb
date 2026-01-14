import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * 엑셀 파일 다운로드
 * @param {Array} data - 2차원 배열 (첫 행은 헤더)
 * @param {string} fileName - 파일명 (확장자 제외)
 * @param {string} sheetName - 시트명
 */
export const downloadExcel = (data, fileName, sheetName = 'Sheet1') => {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  saveAs(blob, `${fileName}_${date}.xlsx`);
};

/**
 * Sales/Operator 시트 데이터를 엑셀용 배열로 변환
 * @param {Array} slots - 원본 슬롯 데이터
 * @param {Object} items - 품목 정보 객체
 * @param {string} role - 'sales' | 'operator'
 */
export const convertSlotsToExcelData = (slots, items, role = 'sales') => {
  // 헤더 정의
  const headers = role === 'operator'
    ? ['날짜', '제품명', '플랫폼', '옵션', '키워드', '주문번호', '구매자', '수취인',
       '아이디', '연락처', '주소', '계좌', '금액', '송장번호', '리뷰샷URL', '상태',
       '리뷰비', '입금명', '입금확인일']
    : ['날짜', '제품명', '플랫폼', '옵션', '키워드', '주문번호', '구매자', '수취인',
       '아이디', '연락처', '주소', '계좌', '금액', '송장번호', '리뷰샷URL', '상태',
       '입금명', '입금확인일'];

  const data = [headers];

  slots.forEach(slot => {
    const item = items[slot.item_id] || {};
    const buyer = slot.buyer || {};
    const reviewImageUrl = buyer.images?.[0]?.s3_url || '';

    const row = [
      slot.date || '',
      item.product_name || slot.product_name || '',
      item.platform || '',
      slot.purchase_option || '',
      item.keyword || '',
      buyer.order_number || '',
      buyer.buyer_name || '',
      buyer.recipient_name || '',
      buyer.user_id || '',
      buyer.contact || '',
      buyer.address || '',
      buyer.account_info || '',
      buyer.amount || '',
      buyer.tracking_number || '',
      reviewImageUrl,  // 이미지 URL 텍스트
      buyer.images?.length > 0 ? '완료' : (buyer.order_number ? '진행' : '-'),
    ];

    if (role === 'operator') {
      row.push(slot.review_fee || '');  // 리뷰비
    }

    row.push(buyer.deposit_name || '');  // 입금명
    row.push(buyer.payment_confirmed_at
      ? new Date(buyer.payment_confirmed_at).toLocaleDateString('ko-KR')
      : '');  // 입금확인일

    data.push(row);
  });

  return data;
};

/**
 * Brand 시트 데이터를 엑셀용 배열로 변환 (제한된 컬럼)
 */
export const convertBrandSlotsToExcelData = (slots, items) => {
  const headers = ['날짜', '제품명', '주문번호', '구매자', '수취인', '아이디',
                   '금액', '송장번호', '리뷰샷URL'];

  const data = [headers];

  slots.forEach(slot => {
    const item = items[slot.item_id] || {};
    const buyer = slot.buyer || {};
    const reviewImageUrl = buyer.images?.[0]?.s3_url || '';

    // 임시 구매자 제외
    if (buyer.is_temporary) return;

    data.push([
      slot.date || '',
      item.product_name || slot.product_name || '',
      buyer.order_number || '',
      buyer.buyer_name || '',
      buyer.recipient_name || '',
      buyer.user_id || '',
      buyer.amount || '',
      buyer.tracking_number || '',
      reviewImageUrl
    ]);
  });

  return data;
};

/**
 * Admin 일별 입금관리 데이터를 엑셀용 배열로 변환
 */
export const convertDailyPaymentsToExcelData = (buyers) => {
  const headers = ['캠페인', '제품명', '입금명', '주문번호', '구매자', '수취인',
                   '금액', '입금확인', '입금일', '리뷰샷URL'];

  const data = [headers];

  buyers.forEach(buyer => {
    data.push([
      buyer.campaign?.name || '',
      buyer.item?.product_name || '',
      buyer.item?.deposit_name || '',
      buyer.order_number || '',
      buyer.buyer_name || '',
      buyer.recipient_name || '',
      buyer.amount || '',
      buyer.payment_status === 'completed' ? '완료' : '대기',
      buyer.payment_confirmed_at
        ? new Date(buyer.payment_confirmed_at).toLocaleDateString('ko-KR')
        : '',
      buyer.image_url || ''
    ]);
  });

  return data;
};
