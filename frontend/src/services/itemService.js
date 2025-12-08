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

  // 품목에 진행자 배정
  assignOperator: async (itemId, operatorId) => {
    try {
      const response = await apiClient.post(`/items/${itemId}/operator`, { operator_id: operatorId });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 품목의 진행자 재배정
  reassignOperator: async (itemId, operatorId) => {
    try {
      const response = await apiClient.put(`/items/${itemId}/operator`, { operator_id: operatorId });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 품목에서 진행자 배정 해제
  unassignOperator: async (itemId, operatorId) => {
    try {
      const response = await apiClient.delete(`/items/${itemId}/operator/${operatorId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default itemService;
