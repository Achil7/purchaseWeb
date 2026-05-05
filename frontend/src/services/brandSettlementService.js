import api from './api';

// Admin: 브랜드사 > 연월브랜드 > 캠페인 3단 정산 요약
export const getSummary = async () => {
  const response = await api.get('/brand-settlements/summary');
  return response.data;
};

// Sales: 본인 캠페인의 제품 단위 정산 요약 (브랜드/플랫폼/월별 드롭다운용 메타 포함)
export const getSalesProductSummary = async (viewAsUserId) => {
  const params = viewAsUserId ? { viewAsUserId } : undefined;
  const response = await api.get('/brand-settlements/sales-products', { params });
  return response.data;
};
