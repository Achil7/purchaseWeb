import apiClient from './api';

const bloggerService = {
  // 목록 조회 (admin: 전체 / brand: 노출중인 것만 - 전역 공통 목록)
  list: async () => {
    const response = await apiClient.get('/bloggers');
    return response.data;
  },

  // 등록 (admin)
  create: async (data) => {
    const response = await apiClient.post('/bloggers', data);
    return response.data;
  },

  // 수정 (admin)
  update: async (id, data) => {
    const response = await apiClient.put(`/bloggers/${id}`, data);
    return response.data;
  },

  // 삭제 (admin)
  remove: async (id) => {
    const response = await apiClient.delete(`/bloggers/${id}`);
    return response.data;
  },

  // 노출 토글 (admin)
  toggleActive: async (id) => {
    const response = await apiClient.patch(`/bloggers/${id}/active`);
    return response.data;
  },

  // ===== 협의 요청 (Phase 2) =====

  // 협의 요청 생성 (brand)
  createRequest: async (data) => {
    const response = await apiClient.post('/blogger-requests', data);
    return response.data;
  },

  // 내 협의 요청 목록 (brand)
  getMyRequests: async (viewAsUserId = null) => {
    const params = {};
    if (viewAsUserId) params.viewAsUserId = viewAsUserId;
    const response = await apiClient.get('/blogger-requests/my', { params });
    return response.data;
  },

  // 전체 인박스 (admin)
  getAllRequests: async (status = null) => {
    const params = {};
    if (status) params.status = status;
    const response = await apiClient.get('/blogger-requests', { params });
    return response.data;
  },

  // 요청 상세
  getRequest: async (id) => {
    const response = await apiClient.get(`/blogger-requests/${id}`);
    return response.data;
  },

  // 요청 수정 (admin)
  updateRequest: async (id, data) => {
    const response = await apiClient.put(`/blogger-requests/${id}`, data);
    return response.data;
  },

  // 요청 취소 (brand/admin)
  cancelRequest: async (id) => {
    const response = await apiClient.patch(`/blogger-requests/${id}/cancel`);
    return response.data;
  },

  // 항목 수정 (admin)
  updateRequestItem: async (itemId, data) => {
    const response = await apiClient.put(`/blogger-requests/items/${itemId}`, data);
    return response.data;
  },

  // 항목 제출 토큰 발급 (admin)
  issueToken: async (itemId) => {
    const response = await apiClient.post(`/blogger-requests/items/${itemId}/issue-token`);
    return response.data;
  },

  // ===== 공개 제출 (Phase 3, 토큰) =====

  getSubmitByToken: async (token) => {
    const response = await apiClient.get(`/blogger-submit/${token}`);
    return response.data;
  },

  submitUrl: async (token, url) => {
    const response = await apiClient.post(`/blogger-submit/${token}`, { url });
    return response.data;
  }
};

export default bloggerService;
