import api from './api';

// 정산 목록 조회
export const getSettlements = async (params = {}) => {
  const response = await api.get('/settlements', { params });
  return response.data;
};

// 사용 가능한 월 목록
export const getAvailableMonths = async () => {
  const response = await api.get('/settlements/months');
  return response.data;
};

// 총정리 (Summary)
export const getSummary = async (params = {}) => {
  const response = await api.get('/settlements/summary', { params });
  return response.data;
};

// 정산 상세
export const getSettlementById = async (id) => {
  const response = await api.get(`/settlements/${id}`);
  return response.data;
};

// 정산 생성
export const createSettlement = async (data) => {
  const response = await api.post('/settlements', data);
  return response.data;
};

// 정산 일괄 생성
export const createSettlementsBulk = async (settlements) => {
  const response = await api.post('/settlements/bulk', { settlements });
  return response.data;
};

// 정산 수정
export const updateSettlement = async (id, data) => {
  const response = await api.put(`/settlements/${id}`, data);
  return response.data;
};

// 정산 삭제
export const deleteSettlement = async (id) => {
  const response = await api.delete(`/settlements/${id}`);
  return response.data;
};

// 설정값 조회
export const getSettings = async () => {
  const response = await api.get('/settlements/settings');
  return response.data;
};

// 설정값 수정
export const updateSettings = async (data) => {
  const response = await api.put('/settlements/settings', data);
  return response.data;
};
