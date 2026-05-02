import api from './api';

/**
 * 품목별 슬롯 목록 조회
 */
export const getSlotsByItem = async (itemId) => {
  const response = await api.get(`/item-slots/item/${itemId}`);
  return response.data;
};

/**
 * 캠페인별 전체 슬롯 조회
 * @param campaignId - 캠페인 ID
 * @param params - 추가 파라미터 (viewAsUserId, viewAsRole 등)
 */
export const getSlotsByCampaign = async (campaignId, params = {}) => {
  const response = await api.get(`/item-slots/campaign/${campaignId}`, { params });
  return response.data;
};

/**
 * 제품명으로 브랜드사 전체 캠페인 슬롯 통합 검색
 * @param productName - 검색할 제품명 (부분 일치)
 * @param params - 추가 파라미터 (viewAsUserId)
 */
export const getSlotsByProductName = async (productName, params = {}) => {
  const response = await api.get('/item-slots/by-product-name', {
    params: { productName, ...params }
  });
  return response.data;
};

/**
 * 슬롯 개별 수정
 */
export const updateSlot = async (id, data) => {
  const response = await api.put(`/item-slots/${id}`, data);
  return response.data;
};

/**
 * 다중 슬롯 일괄 수정
 */
export const updateSlotsBulk = async (slots) => {
  const response = await api.put('/item-slots/bulk/update', { slots });
  return response.data;
};

/**
 * Operator용 캠페인별 배정된 슬롯만 조회
 * @param campaignId - 캠페인 ID
 * @param viewAsUserId - Admin이 특정 진행자의 데이터 조회할 때 사용
 */
export const getSlotsByCampaignForOperator = async (campaignId, viewAsUserId = null) => {
  const params = viewAsUserId ? { viewAsUserId } : {};
  const response = await api.get(`/item-slots/operator/campaign/${campaignId}`, { params });
  return response.data;
};

/**
 * Operator용 전체 배정된 슬롯 조회
 */
export const getMyAssignedSlots = async () => {
  const response = await api.get('/item-slots/operator/my-assigned');
  return response.data;
};

/**
 * 슬롯 추가 (구매자 행 추가)
 * @param itemId - 품목 ID
 * @param dayGroup - 일차 그룹 (기본값 1)
 */
export const createSlot = async (itemId, dayGroup = 1) => {
  const response = await api.post('/item-slots', { itemId, dayGroup });
  return response.data;
};

/**
 * 개별 슬롯 삭제
 */
export const deleteSlot = async (id) => {
  const response = await api.delete(`/item-slots/${id}`);
  return response.data;
};

/**
 * 다중 슬롯 삭제 (행 단위)
 */
export const deleteSlotsBulk = async (slotIds) => {
  const response = await api.delete('/item-slots/bulk/delete', { data: { slotIds } });
  return response.data;
};

/**
 * 그룹별 슬롯 삭제 (day_group 기준)
 */
export const deleteSlotsByGroup = async (itemId, dayGroup) => {
  const response = await api.delete(`/item-slots/group/${itemId}/${dayGroup}`);
  return response.data;
};

/**
 * 품목의 모든 슬롯 삭제
 */
export const deleteSlotsByItem = async (itemId) => {
  const response = await api.delete(`/item-slots/item/${itemId}`);
  return response.data;
};

/**
 * 일 마감 - day_group 분할
 * 해당 슬롯 이후의 행들을 새로운 day_group으로 분할
 * @param slotId - 기준 슬롯 ID (이 슬롯 다음 행부터 새 day_group으로 이동)
 */
export const splitDayGroup = async (slotId) => {
  const response = await api.post(`/item-slots/${slotId}/split-day-group`);
  return response.data;
};

/**
 * 날짜별 슬롯 조회 (날짜별 작업 페이지용)
 * @param date - 날짜 (yyyy-mm-dd 또는 yy-mm-dd 형식)
 * @param viewAsUserId - Admin이 특정 사용자의 데이터 조회할 때 사용
 */
export const getSlotsByDate = async (date, viewAsUserId = null) => {
  const params = { date };
  if (viewAsUserId) {
    params.viewAsUserId = viewAsUserId;
  }
  const response = await api.get('/item-slots/by-date', { params });
  return response.data;
};

/**
 * day_group 중단 처리
 * 배정 해제 + 중단 상태로 변경
 * @param itemId - 품목 ID
 * @param dayGroup - 중단할 day_group 번호
 */
export const suspendDayGroup = async (itemId, dayGroup) => {
  const response = await api.post('/item-slots/suspend', { itemId, dayGroup });
  return response.data;
};

/**
 * day_group 재개 처리
 * 중단 상태 해제 (배정은 다시 수동으로 해야 함)
 * @param itemId - 품목 ID
 * @param dayGroup - 재개할 day_group 번호
 */
export const resumeDayGroup = async (itemId, dayGroup) => {
  const response = await api.post('/item-slots/resume', { itemId, dayGroup });
  return response.data;
};

/**
 * 일건수 조정 (day_group별 슬롯 수 변경)
 * @param itemId - 품목 ID
 * @param dayGroup - 대상 day_group 번호
 * @param newCount - 새로운 일건수
 */
export const adjustDailyCount = async (itemId, dayGroup, newCount) => {
  const response = await api.post('/item-slots/adjust-daily-count', { itemId, dayGroup, newCount });
  return response.data;
};

/**
 * 진행자: 14일 이상 경과 + 리뷰샷 미제출 슬롯 조회
 * @param days - 기준 일수 (기본 14)
 * @param viewAsUserId - Admin이 특정 진행자의 데이터 조회할 때 사용
 */
export const getOverdueSlots = async (days = 14, viewAsUserId = null) => {
  const params = { days };
  if (viewAsUserId) params.viewAsUserId = viewAsUserId;
  const response = await api.get('/item-slots/operator/overdue', { params });
  return response.data;
};

/**
 * 진행자: 월별 일자별 카운트 (전체/작성/리뷰샷)
 * @param year - 연도
 * @param month - 월 (1~12)
 * @param viewAsUserId - Admin이 특정 진행자의 데이터 조회할 때 사용
 */
export const getMonthlyCounts = async (year, month, viewAsUserId = null) => {
  const params = { year, month };
  if (viewAsUserId) params.viewAsUserId = viewAsUserId;
  const response = await api.get('/item-slots/operator/monthly-counts', { params });
  return response.data;
};

const itemSlotService = {
  getSlotsByItem,
  getSlotsByCampaign,
  getSlotsByProductName,
  updateSlot,
  updateSlotsBulk,
  getSlotsByCampaignForOperator,
  getMyAssignedSlots,
  createSlot,
  deleteSlot,
  deleteSlotsBulk,
  deleteSlotsByGroup,
  deleteSlotsByItem,
  splitDayGroup,
  getSlotsByDate,
  suspendDayGroup,
  resumeDayGroup,
  adjustDailyCount,
  getOverdueSlots,
  getMonthlyCounts
};

export default itemSlotService;
