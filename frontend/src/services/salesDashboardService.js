import api from './api';

export const getBrands = async ({ viewAsUserId } = {}) => {
  const params = {};
  if (viewAsUserId) params.viewAsUserId = viewAsUserId;
  const response = await api.get('/sales-dashboard/brands', { params });
  return response.data;
};

export const getMonths = async ({ brandId, viewAsUserId } = {}) => {
  const params = { brandId };
  if (viewAsUserId) params.viewAsUserId = viewAsUserId;
  const response = await api.get('/sales-dashboard/months', { params });
  return response.data;
};

export const getOverview = async ({ brandId, platform, month, viewAsUserId } = {}) => {
  const params = { brandId };
  if (platform) params.platform = platform;
  if (month) params.month = month;
  if (viewAsUserId) params.viewAsUserId = viewAsUserId;
  const response = await api.get('/sales-dashboard/overview', { params });
  return response.data;
};

export const getProductList = async ({ brandId, platform, month, page, pageSize, sortKey, sortDir, filter, viewAsUserId } = {}) => {
  const params = { brandId, platform };
  if (month) params.month = month;
  if (page) params.page = page;
  if (pageSize) params.pageSize = pageSize;
  if (sortKey) params.sortKey = sortKey;
  if (sortDir) params.sortDir = sortDir;
  if (filter) params.filter = filter;
  if (viewAsUserId) params.viewAsUserId = viewAsUserId;
  const response = await api.get('/sales-dashboard/product-list', { params });
  return response.data;
};
