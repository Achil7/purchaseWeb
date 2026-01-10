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

  // 다중 구매자 일괄 추가
  createBuyersBulk: async (itemId, buyers) => {
    try {
      const response = await apiClient.post(`/buyers/item/${itemId}/bulk`, { buyers });
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

  // 송장번호 수정 (Sales, Admin)
  updateTrackingNumber: async (id, tracking_number) => {
    try {
      const response = await apiClient.patch(`/buyers/${id}/tracking`, { tracking_number });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 송장정보(송장번호+택배사) 수정 (Admin)
  updateTrackingInfo: async (id, data) => {
    try {
      const response = await apiClient.patch(`/buyers/${id}/tracking-info`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 송장번호 일괄 입력 (Admin) - 구매자 등록 순서대로 매칭
  updateTrackingNumbersBulk: async (itemId, tracking_numbers, courier_company = null) => {
    try {
      const response = await apiClient.post(`/buyers/item/${itemId}/tracking-bulk`, {
        tracking_numbers,
        courier_company
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 택배사 수정 (Admin)
  updateCourierCompany: async (id, courier_company) => {
    try {
      const response = await apiClient.patch(`/buyers/${id}/courier`, { courier_company });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 월별 구매자 조회 (이미지 업로드 날짜 기준)
  getBuyersByMonth: async (year, month) => {
    try {
      const response = await apiClient.get(`/buyers/by-month?year=${year}&month=${month}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 일별 구매자 조회 (이미지 업로드 날짜 기준)
  getBuyersByDate: async (year, month, day) => {
    try {
      const response = await apiClient.get(`/buyers/by-date?year=${year}&month=${month}&day=${day}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 배송지연 상태 토글 (Admin, Operator)
  toggleShippingDelayed: async (id, shipping_delayed) => {
    try {
      const response = await apiClient.patch(`/buyers/${id}/shipping-delayed`, { shipping_delayed });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default buyerService;
