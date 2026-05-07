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
  }
};

export default rankingService;
