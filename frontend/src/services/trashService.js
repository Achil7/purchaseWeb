import apiClient from './api';

export const trashService = {
  // 휴지통 목록 조회
  getTrash: async () => {
    const response = await apiClient.get('/trash');
    return response.data;
  },

  // 복원
  restore: async (type, id) => {
    const response = await apiClient.post(`/trash/restore/${type}/${id}`);
    return response.data;
  },

  // 영구 삭제
  permanentDelete: async (type, id) => {
    const response = await apiClient.delete(`/trash/permanent/${type}/${id}`);
    return response.data;
  },

  // 휴지통 비우기 (30일 지난 항목)
  emptyTrash: async () => {
    const response = await apiClient.delete('/trash/empty');
    return response.data;
  }
};

export default trashService;
