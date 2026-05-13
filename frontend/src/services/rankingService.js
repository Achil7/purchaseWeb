import apiClient from './api';

const rankingService = {
  getCategories: async () => {
    const response = await apiClient.get('/rankings/categories');
    return response.data;
  },

  getLatest: async (categoryId) => {
    const response = await apiClient.get('/rankings/latest', {
      params: { category_id: categoryId }
    });
    return response.data;
  },

  getMyProducts: async (viewAsUserId = null) => {
    const params = {};
    if (viewAsUserId) params.viewAsUserId = viewAsUserId;
    const response = await apiClient.get('/rankings/my-products', { params });
    return response.data;
  },

  getMyChanges: async (windowParam = '24h', viewAsUserId = null) => {
    const params = { window: windowParam };
    if (viewAsUserId) params.viewAsUserId = viewAsUserId;
    const response = await apiClient.get('/rankings/my-changes', { params });
    return response.data;
  },

  trigger: async (forceFresh = false) => {
    const response = await apiClient.post('/rankings/trigger', { forceFresh });
    return response.data;
  },

  getProgress: async () => {
    const response = await apiClient.get('/rankings/progress');
    return response.data;
  },

  getChanges: async (categoryId, windowParam = '24h') => {
    const response = await apiClient.get('/rankings/changes', {
      params: { category_id: categoryId, window: windowParam }
    });
    return response.data;
  },

  getHistory: async (categoryId, goodsNo, hours = 48) => {
    const response = await apiClient.get('/rankings/history', {
      params: { category_id: categoryId, goods_no: goodsNo, hours: `${hours}h` }
    });
    return response.data;
  },

  getInsights: async (categoryId, windowParam = '24h') => {
    const response = await apiClient.get('/rankings/insights', {
      params: { category_id: categoryId, window: windowParam }
    });
    return response.data;
  }
};

export default rankingService;
