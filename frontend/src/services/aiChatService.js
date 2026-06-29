import apiClient from './api';

const aiChatService = {
  // AI 챗 메시지 전송 (대화 history 전체를 전달, API는 stateless)
  // attachment: 엑셀 업로드 대조 검증용(단발, 그 요청에만 적용)
  // model: 사용자가 선택한 모델(haiku/sonnet/opus). 미전달 시 서버 기본(sonnet)
  sendMessage: async (messages, attachment = null, model = null) => {
    try {
      // Claude API SDK 기본(10분)에 맞춤. nginx proxy_read_timeout도 600s로.
      const response = await apiClient.post('/ai-chat', { messages, attachment, model }, { timeout: 600000 });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default aiChatService;
