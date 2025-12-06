import apiClient from './api';

const buyerService = {
  // 품목의 구매자 목록 조회
  getBuyersByItem: async (itemId) => {
    try {
      const response = await apiClient.get(`/buyers/item/${itemId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 구매자 상세 조회
  getBuyer: async (id) => {
    try {
      const response = await apiClient.get(`/buyers/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 구매자 추가
  createBuyer: async (itemId, data) => {
    try {
      const response = await apiClient.post(`/buyers/item/${itemId}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 슬래시로 구분된 데이터 파싱 후 구매자 추가
  parseBuyer: async (itemId, data) => {
    try {
      const response = await apiClient.post(`/buyers/item/${itemId}/parse`, { data });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 구매자 수정
  updateBuyer: async (id, data) => {
    try {
      const response = await apiClient.put(`/buyers/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 구매자 삭제
  deleteBuyer: async (id) => {
    try {
      const response = await apiClient.delete(`/buyers/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 입금 확인
  confirmPayment: async (id, payment_status) => {
    try {
      const response = await apiClient.patch(`/buyers/${id}/payment`, { payment_status });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default buyerService;
