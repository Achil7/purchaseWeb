import axios from 'axios';
import apiClient from './api';

// API Base URL (Public 엔드포인트용)
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

/**
 * 토큰으로 품목 정보 조회 (Public - 인증 불필요)
 */
const getItemByToken = async (token) => {
  const response = await axios.get(`${API_BASE_URL}/items/token/${token}`);
  return response.data;
};

/**
 * 슬롯 토큰으로 정보 조회 (Public - 인증 불필요, 일 구매건수 그룹별)
 */
const getSlotByToken = async (token) => {
  const response = await axios.get(`${API_BASE_URL}/item-slots/token/${token}`);
  return response.data;
};

/**
 * 이름으로 구매자 검색 (Public - 인증 불필요)
 * @param {string} token - 업로드 토큰
 * @param {string} name - 검색할 이름
 */
const searchBuyersByName = async (token, name) => {
  const response = await axios.get(`${API_BASE_URL}/images/search-buyers/${token}`, {
    params: { name }
  });
  return response.data;
};

/**
 * 다중 이미지 업로드 (Public - 인증 불필요)
 * @param {string} token - 업로드 토큰
 * @param {number[]} buyerIds - 선택된 구매자 ID 배열
 * @param {File[]} files - 업로드할 이미지 파일 배열 (buyerIds와 1:1 매칭)
 */
const uploadImages = async (token, buyerIds, files) => {
  const formData = new FormData();

  // buyer_ids 배열 추가
  formData.append('buyer_ids', JSON.stringify(buyerIds));

  // 다중 파일 추가 (순서대로 buyerIds[i] ↔ files[i] 매칭)
  files.forEach(file => {
    formData.append('images', file);
  });

  const response = await axios.post(
    `${API_BASE_URL}/images/upload/${token}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  return response.data;
};

/**
 * 품목의 이미지 목록 조회 (Private - 인증 필요)
 */
const getImagesByItem = async (itemId) => {
  const response = await apiClient.get(`/images/item/${itemId}`);
  return response.data;
};

/**
 * 이미지 삭제 (Private - 인증 필요)
 */
const deleteImage = async (imageId) => {
  const response = await apiClient.delete(`/images/${imageId}`);
  return response.data;
};

/**
 * 대기 중인 재제출 이미지 목록 조회 (Admin 전용)
 */
const getPendingImages = async () => {
  const response = await apiClient.get('/images/pending');
  return response.data;
};

/**
 * 대기 중인 재제출 이미지 개수 조회 (Admin 알림 배지용)
 */
const getPendingCount = async () => {
  const response = await apiClient.get('/images/pending/count');
  return response.data;
};

/**
 * 재제출 이미지 승인 (Admin 전용)
 */
const approveImage = async (imageId) => {
  const response = await apiClient.post(`/images/${imageId}/approve`);
  return response.data;
};

/**
 * 재제출 이미지 거절 (Admin 전용)
 */
const rejectImage = async (imageId, reason = '') => {
  const response = await apiClient.post(`/images/${imageId}/reject`, { reason });
  return response.data;
};

const imageService = {
  getItemByToken,
  getSlotByToken,
  searchBuyersByName,
  uploadImages,
  getImagesByItem,
  deleteImage,
  getPendingImages,
  getPendingCount,
  approveImage,
  rejectImage
};

export default imageService;
