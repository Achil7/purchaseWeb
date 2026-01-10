import api from './api';

/**
 * 사용자 목록 조회
 * @param {string} role - 역할 필터 (optional: 'admin', 'sales', 'operator', 'brand')
 */
export const getUsers = async (role = null) => {
  const params = role ? { role } : {};
  const response = await api.get('/users', { params });
  return response.data;
};

/**
 * 브랜드사 목록 조회 (캠페인 생성 시 사용)
 */
export const getBrandUsers = async () => {
  return getUsers('brand');
};

/**
 * 영업사 목록 조회 (브랜드 등록 시 담당 영업사 선택용)
 */
export const getSalesUsers = async () => {
  return getUsers('sales');
};

/**
 * 현재 로그인한 영업사가 담당하는 브랜드 목록 조회
 */
export const getMyBrands = async () => {
  const response = await api.get('/users/my-brands');
  return response.data;
};

/**
 * 특정 영업사가 담당하는 브랜드 목록 조회 (Admin용)
 */
export const getBrandsBySalesId = async (salesId) => {
  const response = await api.get(`/users/sales/${salesId}/brands`);
  return response.data;
};

/**
 * 사용자 생성 (Admin only)
 */
export const createUser = async (userData) => {
  const response = await api.post('/users', userData);
  return response.data;
};

/**
 * 브랜드 생성 (Sales, Admin)
 * 영업사가 생성 시 자동으로 해당 영업사에 할당됨
 * @param viewAsUserId - Admin이 영업사 대신 생성할 때 사용
 */
export const createBrand = async (brandData, viewAsUserId = null) => {
  const params = viewAsUserId ? { viewAsUserId } : {};
  const response = await api.post('/users/brand', brandData, { params });
  return response.data;
};

/**
 * 사용자 상세 조회
 */
export const getUserById = async (id) => {
  const response = await api.get(`/users/${id}`);
  return response.data;
};

/**
 * 사용자 수정
 */
export const updateUser = async (id, userData) => {
  const response = await api.put(`/users/${id}`, userData);
  return response.data;
};

/**
 * 사용자 비활성화 (로그인만 차단, 데이터 유지)
 */
export const deactivateUser = async (id) => {
  const response = await api.patch(`/users/${id}/deactivate`);
  return response.data;
};

/**
 * 사용자 활성화 (비활성화된 사용자 다시 활성화)
 */
export const activateUser = async (id) => {
  const response = await api.patch(`/users/${id}/activate`);
  return response.data;
};

/**
 * 사용자 완전 삭제 (DB에서 모든 관련 데이터 삭제)
 */
export const deleteUser = async (id) => {
  const response = await api.delete(`/users/${id}`);
  return response.data;
};

// ============================================
// 컨트롤 타워용 API
// ============================================

/**
 * 컨트롤 타워용 사용자 목록 조회 (초기 비밀번호, 활동 상태 포함)
 */
export const getControlTowerUsers = async (role = null) => {
  const params = {};
  if (role) params.role = role;
  const response = await api.get('/users/control-tower/users', { params });
  return response.data;
};

/**
 * 사용자 비밀번호 초기화
 */
export const resetPassword = async (userId) => {
  const response = await api.post(`/users/${userId}/reset-password`);
  return response.data;
};

/**
 * 사용자 활동 로그 조회
 */
export const getUserActivities = async (userId, params = {}) => {
  const response = await api.get(`/users/${userId}/activities`, { params });
  return response.data;
};

/**
 * 사용자 통계 조회
 */
export const getUserStats = async (userId, days = 7) => {
  const response = await api.get(`/users/${userId}/stats`, { params: { days } });
  return response.data;
};

/**
 * 사용자의 캠페인 목록 조회
 */
export const getUserCampaigns = async (userId) => {
  const response = await api.get(`/users/${userId}/campaigns`);
  return response.data;
};

/**
 * 사용자의 품목 목록 조회
 */
export const getUserItems = async (userId, campaignId = null) => {
  const params = {};
  if (campaignId) params.campaign_id = campaignId;
  const response = await api.get(`/users/${userId}/items`, { params });
  return response.data;
};

/**
 * 사용자의 구매자 목록 조회
 */
export const getUserBuyers = async (userId, itemId = null) => {
  const params = {};
  if (itemId) params.item_id = itemId;
  const response = await api.get(`/users/${userId}/buyers`, { params });
  return response.data;
};

/**
 * Heartbeat 전송 (활동 상태 업데이트)
 */
export const sendHeartbeat = async () => {
  const response = await api.post('/auth/heartbeat');
  return response.data;
};

// ============================================
// 브랜드-영업사 N:M 매핑 API
// ============================================

/**
 * 전체 브랜드 목록 조회 (영업사 연월브랜드 생성 시 검색용)
 */
export const getAllBrands = async () => {
  const response = await api.get('/users', { params: { role: 'brand' } });
  return response.data;
};

/**
 * 영업사가 기존 브랜드에 자기 할당 (연월브랜드 생성 시 기존 브랜드 선택)
 * @param brandId - 브랜드 사용자 ID
 * @param viewAsUserId - Admin이 영업사 대신 할당할 때 사용
 */
export const assignBrandToMe = async (brandId, viewAsUserId = null) => {
  const params = viewAsUserId ? { viewAsUserId } : {};
  const response = await api.post(`/users/brands/${brandId}/assign-me`, {}, { params });
  return response.data;
};

/**
 * 브랜드의 담당 영업사 목록 조회 (Admin용)
 * @param brandId - 브랜드 사용자 ID
 */
export const getBrandSales = async (brandId) => {
  const response = await api.get(`/users/brands/${brandId}/sales`);
  return response.data;
};

/**
 * 브랜드에 영업사 할당 (Admin용)
 * @param brandId - 브랜드 사용자 ID
 * @param salesId - 영업사 사용자 ID
 */
export const addBrandSales = async (brandId, salesId) => {
  const response = await api.post(`/users/brands/${brandId}/sales`, { salesId });
  return response.data;
};

/**
 * 브랜드에서 영업사 할당 해제 (Admin용)
 * @param brandId - 브랜드 사용자 ID
 * @param salesId - 영업사 사용자 ID
 */
export const removeBrandSales = async (brandId, salesId) => {
  const response = await api.delete(`/users/brands/${brandId}/sales/${salesId}`);
  return response.data;
};
