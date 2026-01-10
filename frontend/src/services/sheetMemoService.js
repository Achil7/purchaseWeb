import api from './api';

/**
 * 캠페인별 시트 메모 조회
 * @param {number} campaignId - 캠페인 ID
 * @param {string} sheetType - 'operator' 또는 'sales'
 * @param {number} viewAsUserId - Admin이 다른 사용자로 조회 시
 */
export const getSheetMemos = async (campaignId, sheetType, viewAsUserId = null) => {
  const params = { sheetType };
  if (viewAsUserId) {
    params.viewAsUserId = viewAsUserId;
  }
  const response = await api.get(`/sheet-memos/campaign/${campaignId}`, { params });
  return response.data;
};

/**
 * 시트 메모 일괄 저장
 * @param {number} campaignId - 캠페인 ID
 * @param {string} sheetType - 'operator' 또는 'sales'
 * @param {Array} memos - [{ row_index, col_index, value }]
 * @param {number} viewAsUserId - Admin이 다른 사용자로 저장 시
 */
export const saveSheetMemos = async (campaignId, sheetType, memos, viewAsUserId = null) => {
  const body = { sheetType, memos };
  if (viewAsUserId) {
    body.viewAsUserId = viewAsUserId;
  }
  const response = await api.post(`/sheet-memos/campaign/${campaignId}/bulk`, body);
  return response.data;
};

/**
 * 캠페인의 모든 메모 삭제
 * @param {number} campaignId - 캠페인 ID
 * @param {string} sheetType - 'operator' 또는 'sales' (선택적)
 * @param {number} viewAsUserId - Admin이 다른 사용자로 삭제 시
 */
export const deleteSheetMemos = async (campaignId, sheetType = null, viewAsUserId = null) => {
  const params = {};
  if (sheetType) params.sheetType = sheetType;
  if (viewAsUserId) params.viewAsUserId = viewAsUserId;
  const response = await api.delete(`/sheet-memos/campaign/${campaignId}`, { params });
  return response.data;
};

export default {
  getSheetMemos,
  saveSheetMemos,
  deleteSheetMemos
};
