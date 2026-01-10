import apiClient from './api';

const campaignService = {
  // 캠페인 목록 조회
  getCampaigns: async (params = {}) => {
    try {
      const response = await apiClient.get('/campaigns', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 캠페인 상세 조회
  getCampaign: async (id) => {
    try {
      const response = await apiClient.get(`/campaigns/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 캠페인 생성
  createCampaign: async (data) => {
    try {
      const response = await apiClient.post('/campaigns', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 캠페인 수정
  updateCampaign: async (id, data) => {
    try {
      const response = await apiClient.put(`/campaigns/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 캠페인 삭제
  deleteCampaign: async (id) => {
    try {
      const response = await apiClient.delete(`/campaigns/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 캠페인 강제 삭제 (Admin 전용) - 모든 관련 데이터 cascading delete
  deleteCampaignCascade: async (id) => {
    try {
      const response = await apiClient.delete(`/campaigns/${id}/cascade`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 진행자 배정
  assignOperator: async (campaignId, data) => {
    try {
      const response = await apiClient.post(`/campaigns/${campaignId}/operators`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 진행자 배정 해제
  unassignOperator: async (campaignId, operatorId) => {
    try {
      const response = await apiClient.delete(`/campaigns/${campaignId}/operators/${operatorId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 배정된 진행자 목록
  getOperators: async (campaignId) => {
    try {
      const response = await apiClient.get(`/campaigns/${campaignId}/operators`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 캠페인 숨기기
  hideCampaign: async (id) => {
    try {
      const response = await apiClient.patch(`/campaigns/${id}/hide`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 캠페인 복구
  restoreCampaign: async (id) => {
    try {
      const response = await apiClient.patch(`/campaigns/${id}/restore`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 캠페인 영업사 변경 (Admin 전용)
  changeSales: async (campaignId, newSalesId) => {
    try {
      const response = await apiClient.patch(`/campaigns/${campaignId}/change-sales`, {
        new_sales_id: newSalesId
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default campaignService;
