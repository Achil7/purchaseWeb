import api from './api';

export const getOverview = async ({ platform, viewAsUserId } = {}) => {
  const params = {};
  if (platform) params.platform = platform;
  if (viewAsUserId) params.viewAsUserId = viewAsUserId;
  const response = await api.get('/brand-dashboard/overview', { params });
  return response.data;
};

export const getProductList = async ({ platform, page, pageSize, sortKey, sortDir, filter, viewAsUserId } = {}) => {
  const params = { platform };
  if (page) params.page = page;
  if (pageSize) params.pageSize = pageSize;
  if (sortKey) params.sortKey = sortKey;
  if (sortDir) params.sortDir = sortDir;
  if (filter) params.filter = filter;
  if (viewAsUserId) params.viewAsUserId = viewAsUserId;
  const response = await api.get('/brand-dashboard/product-list', { params });
  return response.data;
};
