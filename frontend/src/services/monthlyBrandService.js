import api from './api';

/**
 * 연월브랜드 목록 조회
 * @param viewAsUserId - Admin이 특정 영업사의 데이터 조회할 때 사용
 */
export const getMonthlyBrands = async (viewAsUserId = null) => {
  const params = viewAsUserId ? { viewAsUserId } : {};
  const response = await api.get('/monthly-brands', { params });
  return response.data;
};

/**
 * 브랜드사용 - 자신의 브랜드에 연결된 연월브랜드 목록 조회
 * @param viewAsUserId - Admin이 특정 브랜드사의 데이터 조회할 때 사용
 */
export const getMyBrandMonthlyBrands = async (viewAsUserId = null) => {
  const params = viewAsUserId ? { viewAsUserId } : {};
  const response = await api.get('/monthly-brands/my-brand', { params });
  return response.data;
};

/**
 * 연월브랜드 상세 조회
 */
export const getMonthlyBrandById = async (id) => {
  const response = await api.get(`/monthly-brands/${id}`);
  return response.data;
};

/**
 * 연월브랜드 생성
 * @param viewAsUserId - Admin이 영업사 대신 생성할 때 사용
 */
export const createMonthlyBrand = async (data, viewAsUserId = null) => {
  const params = viewAsUserId ? { viewAsUserId } : {};
  const response = await api.post('/monthly-brands', data, { params });
  return response.data;
};

/**
 * 연월브랜드 수정
 */
export const updateMonthlyBrand = async (id, data) => {
  const response = await api.put(`/monthly-brands/${id}`, data);
  return response.data;
};

/**
 * 연월브랜드 삭제
 */
export const deleteMonthlyBrand = async (id) => {
  const response = await api.delete(`/monthly-brands/${id}`);
  return response.data;
};

/**
 * 연월브랜드 강제 삭제 (Admin 전용) - 모든 관련 데이터 cascading delete
 */
export const deleteMonthlyBrandCascade = async (id) => {
  const response = await api.delete(`/monthly-brands/${id}/cascade`);
  return response.data;
};

/**
 * 연월브랜드 숨기기
 */
export const hideMonthlyBrand = async (id) => {
  const response = await api.patch(`/monthly-brands/${id}/hide`);
  return response.data;
};

/**
 * 연월브랜드 복구
 */
export const restoreMonthlyBrand = async (id) => {
  const response = await api.patch(`/monthly-brands/${id}/restore`);
  return response.data;
};

/**
 * Admin 전용 - 모든 연월브랜드 목록 조회 (진행자 배정용)
 */
export const getAllMonthlyBrands = async () => {
  const response = await api.get('/monthly-brands/all');
  return response.data;
};

/**
 * 연월브랜드 순서 변경 (영업사용)
 * @param orderedIds - 순서대로 정렬된 연월브랜드 ID 배열
 * @param viewAsUserId - Admin이 영업사 대신 변경할 때 사용
 */
export const reorderMonthlyBrands = async (orderedIds, viewAsUserId = null) => {
  const params = viewAsUserId ? { viewAsUserId } : {};
  const response = await api.patch('/monthly-brands/reorder', { orderedIds }, { params });
  return response.data;
};

/**
 * 연월브랜드 순서 변경 (브랜드사용)
 * @param orderedIds - 순서대로 정렬된 연월브랜드 ID 배열
 * @param viewAsUserId - Admin이 브랜드사 대신 변경할 때 사용
 */
export const reorderMonthlyBrandsBrand = async (orderedIds, viewAsUserId = null) => {
  const params = viewAsUserId ? { viewAsUserId } : {};
  const response = await api.patch('/monthly-brands/reorder-brand', { orderedIds }, { params });
  return response.data;
};

/**
 * 연월브랜드 순서 변경 (진행자용)
 * @param orderedIds - 순서대로 정렬된 연월브랜드 ID 배열
 * @param viewAsUserId - Admin이 진행자 대신 변경할 때 사용
 */
export const reorderMonthlyBrandsOperator = async (orderedIds, viewAsUserId = null) => {
  const params = viewAsUserId ? { viewAsUserId } : {};
  const response = await api.patch('/monthly-brands/reorder-operator', { orderedIds }, { params });
  return response.data;
};

export default {
  getMonthlyBrands,
  getMyBrandMonthlyBrands,
  getMonthlyBrandById,
  createMonthlyBrand,
  updateMonthlyBrand,
  deleteMonthlyBrand,
  deleteMonthlyBrandCascade,
  hideMonthlyBrand,
  restoreMonthlyBrand,
  getAllMonthlyBrands,
  reorderMonthlyBrands,
  reorderMonthlyBrandsBrand,
  reorderMonthlyBrandsOperator
};
