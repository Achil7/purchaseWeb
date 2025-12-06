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
 * 사용자 생성 (Admin only)
 */
export const createUser = async (userData) => {
  const response = await api.post('/users', userData);
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
 * 사용자 삭제 (비활성화)
 */
export const deleteUser = async (id) => {
  const response = await api.delete(`/users/${id}`);
  return response.data;
};
