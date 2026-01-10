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
 * 다중 이미지 업로드 (Public - 인증 불필요)
 * @param {string} token - 업로드 토큰
 * @param {File[]} files - 업로드할 이미지 파일 배열
 * @param {string} accountNumber - 계좌번호 (정규화 전)
 * @param {boolean} isSlotUpload - 슬롯 토큰 업로드 여부
 * @param {string} orderNumber - 주문번호 (선택)
 */
const uploadImages = async (token, files, accountNumber, isSlotUpload = false, orderNumber = '') => {
  const formData = new FormData();
  formData.append('account_number', accountNumber || '');
  formData.append('order_number', orderNumber || '');

  // 다중 파일 추가
  files.forEach(file => {
    formData.append('images', file);
  });

  // 슬롯 업로드 여부 표시
  if (isSlotUpload) {
    formData.append('is_slot_upload', 'true');
  }

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

const imageService = {
  getItemByToken,
  getSlotByToken,
  uploadImages,
  getImagesByItem,
  deleteImage
};

export default imageService;
