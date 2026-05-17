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
 * 리뷰샷 검색 / 구매자 분석용 브랜드사 옵션 조회
 *  - operator: 본인 배정 캠페인 소속 브랜드사만
 *  - admin + viewAsUserId: 해당 진행자 배정 소속 브랜드사
 *  - admin (no viewAsUserId): 전체 활성 브랜드사
 * @param {number|null} viewAsUserId
 */
export const getBrandsForReviewSearch = async (viewAsUserId = null) => {
  const params = viewAsUserId ? { viewAsUserId } : {};
  const response = await api.get('/users/brands-for-review-search', { params });
  return response.data;
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
 * 사용자 삭제 (연관 데이터 체크/위임/강제 삭제 지원)
 * @param {number} id - 사용자 ID
 * @param {object} options - { force: 'true', delegateTo: userId }
 */
export const deleteUser = async (id, options = {}) => {
  const params = new URLSearchParams();
  if (options.force) params.append('force', options.force);
  if (options.delegateTo) params.append('delegateTo', options.delegateTo);
  const queryString = params.toString();
  const url = `/users/${id}${queryString ? `?${queryString}` : ''}`;
  const response = await api.delete(url);
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
  const response = await api.post(`/users/brands/${brandId}/sales`, { sales_id: salesId });
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

/**
 * 영업사 일괄 인수인계 미리보기 (Admin용)
 * @param fromSalesId - 인수인계 대상(원 영업사) ID
 */
export const previewSalesTransfer = async (fromSalesId) => {
  const response = await api.get(`/users/sales/${fromSalesId}/transfer-preview`);
  return response.data;
};

/**
 * 영업사 A의 모든 권한을 영업사 B에게 일괄 이전 (Admin용)
 * @param fromSalesId - 원 영업사 ID
 * @param toSalesId - 인수받을 영업사 ID
 */
export const transferAllFromSales = async (fromSalesId, toSalesId) => {
  const response = await api.post(`/users/sales/${fromSalesId}/transfer-all/${toSalesId}`);
  return response.data;
};

/**
 * 특정 브랜드사에 한정해서 영업사 A → B 이전 미리보기 (Admin용)
 * @param brandId - 브랜드 사용자 ID
 * @param fromSalesId - 원 영업사 ID
 */
export const previewBrandTransfer = async (brandId, fromSalesId) => {
  const response = await api.get(`/users/brands/${brandId}/transfer-preview`, {
    params: { fromSalesId }
  });
  return response.data;
};

/**
 * 특정 브랜드사에 한정해서 영업사 A → B 이전 실행 (Admin용)
 * @param brandId - 브랜드 사용자 ID
 * @param fromSalesId - 원 영업사 ID
 * @param toSalesId - 인수받을 영업사 ID
 */
export const transferBrandSales = async (brandId, fromSalesId, toSalesId) => {
  const response = await api.post(`/users/brands/${brandId}/transfer`, {
    fromSalesId,
    toSalesId
  });
  return response.data;
};
