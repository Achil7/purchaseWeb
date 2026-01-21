import api from './api';

// 견적서 목록 조회
export const getEstimates = async (params = {}) => {
  const response = await api.get('/estimates', { params });
  return response.data;
};

// 견적서 요약 조회 (월별 그룹화)
export const getEstimateSummary = async (year) => {
  const response = await api.get('/estimates/summary', { params: { year } });
  return response.data;
};

// 견적서 상세 조회
export const getEstimateById = async (id) => {
  const response = await api.get(`/estimates/${id}`);
  return response.data;
};

// 견적서 생성
export const createEstimate = async (data) => {
  const response = await api.post('/estimates', data);
  return response.data;
};

// 견적서 수정
export const updateEstimate = async (id, data) => {
  const response = await api.put(`/estimates/${id}`, data);
  return response.data;
};

// 견적서 삭제
export const deleteEstimate = async (id) => {
  const response = await api.delete(`/estimates/${id}`);
  return response.data;
};
