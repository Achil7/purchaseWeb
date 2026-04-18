import api from './api';

// Admin: 브랜드사 > 연월브랜드 > 캠페인 3단 정산 요약
export const getSummary = async () => {
  const response = await api.get('/brand-settlements/summary');
  return response.data;
};
