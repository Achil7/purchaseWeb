import apiClient from './api';

const itemService = {
  // 전체 품목 목록 조회 (Admin용 - 진행자 배정)
  getAllItems: async () => {
    try {
      const response = await apiClient.get('/items');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 내게 배정된 품목 목록 조회 (Operator용)
  getMyAssignedItems: async () => {
    try {
      const response = await apiClient.get('/items/my-assigned');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 내게 배정된 품목 중 선 업로드가 있는 품목 조회 (Operator용 - 알림)
  getMyPreUploads: async () => {
    try {
      const response = await apiClient.get('/items/my-preuploads');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 내게 배정된 연월브랜드 목록 조회 (Operator용 - SalesLayout과 동일한 구조)
  // viewAsUserId: Admin이 특정 진행자의 데이터 조회할 때 사용
  getMyMonthlyBrands: async (viewAsUserId = null) => {
    try {
      const params = viewAsUserId ? { viewAsUserId } : {};
      const response = await apiClient.get('/items/my-monthly-brands', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 브랜드별 품목 목록 조회 (Brand용 - 캠페인 없이 품목 직접 표시)
  getItemsByBrand: async () => {
    try {
      const response = await apiClient.get('/items/by-brand');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 영업사별 품목 목록 조회 (Sales용 - 일별 조회)
  getItemsBySales: async () => {
    try {
      const response = await apiClient.get('/items/by-sales');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 진행자별 품목 목록 조회 (Operator용 - 일별 조회)
  getItemsByOperator: async () => {
    try {
      const response = await apiClient.get('/items/by-operator');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 캠페인의 품목 목록 조회
  getItemsByCampaign: async (campaignId) => {
    try {
      const response = await apiClient.get(`/items/campaign/${campaignId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 품목 상세 조회
  getItem: async (id) => {
    try {
      const response = await apiClient.get(`/items/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 품목 생성
  createItem: async (campaignId, data) => {
    try {
      const response = await apiClient.post(`/items/campaign/${campaignId}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 품목 일괄 생성 (여러 품목 동시 추가)
  createItemsBulk: async (campaignId, items) => {
    try {
      const response = await apiClient.post(`/items/campaign/${campaignId}/bulk`, { items });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 품목 수정
  updateItem: async (id, data) => {
    try {
      const response = await apiClient.put(`/items/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 품목 삭제
  deleteItem: async (id) => {
    try {
      const response = await apiClient.delete(`/items/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 품목에 진행자 배정 (day_group 단위)
  assignOperator: async (itemId, operatorId, dayGroup = null) => {
    try {
      const response = await apiClient.post(`/items/${itemId}/operator`, {
        operator_id: operatorId,
        day_group: dayGroup
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 품목의 진행자 재배정 (day_group 단위)
  reassignOperator: async (itemId, operatorId, dayGroup = null) => {
    try {
      const response = await apiClient.put(`/items/${itemId}/operator`, {
        operator_id: operatorId,
        day_group: dayGroup
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 품목에서 진행자 배정 해제 (day_group 단위)
  unassignOperator: async (itemId, operatorId, dayGroup = null) => {
    try {
      const params = dayGroup != null ? { day_group: dayGroup } : {};
      const response = await apiClient.delete(`/items/${itemId}/operator/${operatorId}`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 품목 입금명 수정 (Operator, Admin)
  updateDepositName: async (itemId, deposit_name) => {
    try {
      const response = await apiClient.patch(`/items/${itemId}/deposit-name`, { deposit_name });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 품목 지출 입력/수정 (Admin 전용)
  updateItemExpense: async (itemId, expenseData) => {
    try {
      const response = await apiClient.put(`/items/${itemId}/expense`, expenseData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 마진 대시보드 데이터 조회 (Admin, Sales)
  getMarginSummary: async (params = {}) => {
    try {
      const response = await apiClient.get('/items/margin-summary', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 단일 품목 마진 조회
  getItemMargin: async (itemId) => {
    try {
      const response = await apiClient.get(`/items/${itemId}/margin`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default itemService;
