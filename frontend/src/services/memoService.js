import api from './api';

// 내 메모 조회
export const getMyMemo = async () => {
  const response = await api.get('/memos/me');
  return response.data;
};

// 내 메모 저장
export const saveMyMemo = async (content) => {
  const response = await api.put('/memos/me', { content });
  return response.data;
};

export default {
  getMyMemo,
  saveMyMemo
};
