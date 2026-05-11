import apiClient from './api';

const buyerAnalyticsService = {
  // 계좌 단위 구매자 통계 집계
  // params: { startDate, endDate, overdueDays, minParticipation }
  getAccounts: async (params = {}) => {
    const response = await apiClient.get('/buyer-analytics/accounts', { params });
    return response.data;
  },

  // 특정 계좌의 buyer 상세
  getAccountBuyers: async (accountNormalized, params = {}) => {
    const response = await apiClient.get(
      `/buyer-analytics/accounts/${encodeURIComponent(accountNormalized)}/buyers`,
      { params }
    );
    return response.data;
  }
};

export default buyerAnalyticsService;
