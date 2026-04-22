import api from './api';

export const getOverview = async ({ platform, viewAsUserId } = {}) => {
  const params = {};
  if (platform) params.platform = platform;
  if (viewAsUserId) params.viewAsUserId = viewAsUserId;
  const response = await api.get('/brand-dashboard/overview', { params });
  return response.data;
};

export const getProductRollup = async ({ platform, query, viewAsUserId } = {}) => {
  const params = { platform, query };
  if (viewAsUserId) params.viewAsUserId = viewAsUserId;
  const response = await api.get('/brand-dashboard/product-rollup', { params });
  return response.data;
};
