const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Automatically send and receive HTTP-only session cookies
  });

  let data;
  try {
    data = await response.json();
  } catch (err) {
    data = { success: false, error: 'Failed to parse server response' };
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export const authApi = {
  checkUsername: (shopName) =>
    apiRequest('/v1/auth/check-username', {
      method: 'POST',
      body: JSON.stringify({ shopName }),
    }),

  sendOtp: (mobileNumber, purpose = 'REGISTRATION') =>
    apiRequest('/v1/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ mobileNumber, purpose }),
    }),

  register: (payload) =>
    apiRequest('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload) =>
    apiRequest('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => apiRequest('/v1/auth/me'),

  logout: () =>
    apiRequest('/v1/auth/logout', {
      method: 'POST',
    }),

  logoutAll: () =>
    apiRequest('/v1/auth/logout-all', {
      method: 'POST',
    }),

  getDevices: () => apiRequest('/v1/auth/devices'),

  revokeDevice: (sessionId) =>
    apiRequest(`/v1/auth/devices/${sessionId}`, {
      method: 'DELETE',
    }),

  forgotPasswordRequest: (username, mobileNumber) =>
    apiRequest('/v1/auth/forgot-password/request', {
      method: 'POST',
      body: JSON.stringify({ username, mobileNumber }),
    }),

  resetPassword: (payload) =>
    apiRequest('/v1/auth/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const itemApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.lowStockOnly) query.append('lowStockOnly', 'true');
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    return apiRequest(`/v1/items${qs ? '?' + qs : ''}`);
  },

  get: (id) => apiRequest(`/v1/items/${id}`),

  create: (itemData) =>
    apiRequest('/v1/items', {
      method: 'POST',
      body: JSON.stringify(itemData),
    }),

  update: (id, itemData) =>
    apiRequest(`/v1/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
    }),

  delete: (id) =>
    apiRequest(`/v1/items/${id}`, {
      method: 'DELETE',
    }),

  recordSold: (id, unitsSold) =>
    apiRequest(`/v1/items/${id}/sold`, {
      method: 'POST',
      body: JSON.stringify({ unitsSold }),
    }),

  updateStockCount: (id, newCount) =>
    apiRequest(`/v1/items/${id}/stock-count`, {
      method: 'POST',
      body: JSON.stringify({ newCount }),
    }),

  restock: (id, quantity, costPrice) =>
    apiRequest(`/v1/items/${id}/restock`, {
      method: 'POST',
      body: JSON.stringify({ quantity, costPrice }),
    }),

  uploadPhoto: async (file) => {
    const formData = new FormData();
    formData.append('photo', file);

    const BASE_URL = import.meta.env.VITE_API_URL || '/api';
    const res = await fetch(`${BASE_URL}/v1/items/upload-photo`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload photo');
    }
    return data;
  },
};

export const supplierApi = {
  list: () => apiRequest('/v1/suppliers'),

  get: (id) => apiRequest(`/v1/suppliers/${id}`),

  create: (shopName, phone) =>
    apiRequest('/v1/suppliers', {
      method: 'POST',
      body: JSON.stringify({ shopName, phone }),
    }),
};

export const purchaseApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.supplierId) query.append('supplierId', params.supplierId);
    if (params.itemId) query.append('itemId', params.itemId);
    if (params.type) query.append('type', params.type);
    if (params.dateFrom) query.append('dateFrom', params.dateFrom);
    if (params.dateTo) query.append('dateTo', params.dateTo);
    const qs = query.toString();
    return apiRequest(`/v1/purchases${qs ? '?' + qs : ''}`);
  },

  get: (id) => apiRequest(`/v1/purchases/${id}`),

  create: (payload) =>
    apiRequest('/v1/purchases', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id, payload) =>
    apiRequest(`/v1/purchases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  delete: (id) =>
    apiRequest(`/v1/purchases/${id}`, {
      method: 'DELETE',
    }),

  convert: (params = {}) => {
    const query = new URLSearchParams(params);
    return apiRequest(`/v1/purchases/convert?${query.toString()}`);
  },
};

export const billApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.supplierName) query.append('supplierName', params.supplierName);
    if (params.billType) query.append('billType', params.billType);
    if (params.dateFrom) query.append('dateFrom', params.dateFrom);
    if (params.dateTo) query.append('dateTo', params.dateTo);
    if (params.billNumber) query.append('billNumber', params.billNumber);
    const qs = query.toString();
    return apiRequest(`/v1/bills${qs ? '?' + qs : ''}`);
  },

  get: (id) => apiRequest(`/v1/bills/${id}`),

  getSignedUrl: (id, mode = 'view') =>
    apiRequest(`/v1/bills/${id}/signed-url?mode=${mode}`),

  read: (id) =>
    apiRequest(`/v1/bills/${id}/read`, {
      method: 'POST',
    }),

  confirm: (id, reviewData) =>
    apiRequest(`/v1/bills/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify(reviewData),
    }),

  upload: async (formData) => {
    const BASE_URL = import.meta.env.VITE_API_URL || '/api';
    const res = await fetch(`${BASE_URL}/v1/bills/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload bill');
    }
    return data;
  },

  delete: (id) =>
    apiRequest(`/v1/bills/${id}`, {
      method: 'DELETE',
    }),
};

export const searchApi = {
  search: (q) => {
    const query = new URLSearchParams();
    if (q) query.append('q', q);
    return apiRequest(`/v1/search?${query.toString()}`);
  },

  getSuggestions: (q) => {
    const query = new URLSearchParams();
    if (q) query.append('q', q);
    return apiRequest(`/v1/search/suggestions?${query.toString()}`);
  },

  recordHistory: (searchWord, itemId) =>
    apiRequest('/v1/search/history', {
      method: 'POST',
      body: JSON.stringify({ searchWord, itemId }),
    }),

  deleteSuggestion: (id) =>
    apiRequest(`/v1/search/suggestions/${id}`, {
      method: 'DELETE',
    }),

  voiceCommand: (command, language = 'en') =>
    apiRequest('/v1/search/voice-command', {
      method: 'POST',
      body: JSON.stringify({ command, language }),
    }),
};

export const settingsApi = {
  getProfile: () => apiRequest('/v1/settings/profile'),

  uploadPhoto: async (formData) => {
    const res = await fetch(`${BASE_URL}/v1/settings/photo`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload photo');
    return data;
  },

  setPhotoUrl: (photoUrl) =>
    apiRequest('/v1/settings/photo', {
      method: 'POST',
      body: JSON.stringify({ photoUrl }),
    }),

  removePhoto: () =>
    apiRequest('/v1/settings/photo', {
      method: 'DELETE',
    }),

  changePassword: (payload) =>
    apiRequest('/v1/settings/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updatePreferences: (payload) =>
    apiRequest('/v1/settings/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  requestChangeMobileOtp: (newMobileNumber) =>
    apiRequest('/v1/settings/change-mobile/request-otp', {
      method: 'POST',
      body: JSON.stringify({ newMobileNumber }),
    }),

  verifyChangeMobileOtp: (newMobileNumber, otpCode) =>
    apiRequest('/v1/settings/change-mobile/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ newMobileNumber, otpCode }),
    }),

  downloadExportCsv: async () => {
    const res = await fetch(`${BASE_URL}/v1/settings/export-csv`, {
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Failed to export CSV');
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `smart-kirana-store-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
    return true;
  },

  requestDeleteAccountOtp: (password) =>
    apiRequest('/v1/settings/delete-account/request-otp', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  confirmDeleteAccount: (password, otpCode) =>
    apiRequest('/v1/settings/delete-account/confirm', {
      method: 'POST',
      body: JSON.stringify({ password, otpCode }),
    }),
};

export const creditApi = {
  listCustomers: (params = {}) => {
    const query = new URLSearchParams();
    if (params.filter) query.append('filter', params.filter);
    if (params.sort) query.append('sort', params.sort);
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    return apiRequest(`/v1/credit${qs ? '?' + qs : ''}`);
  },

  getCustomer: (id) => apiRequest(`/v1/credit/${id}`),

  createCustomer: (data) =>
    apiRequest('/v1/credit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addCreditEntry: (customerId, data) =>
    apiRequest(`/v1/credit/${customerId}/entries`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteCreditEntry: (customerId, entryId) =>
    apiRequest(`/v1/credit/${customerId}/entries/${entryId}`, {
      method: 'DELETE',
    }),

  recordPayment: (customerId, data) =>
    apiRequest(`/v1/credit/${customerId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const onlineApi = {
  getSummary: (params = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const qs = query.toString();
    return apiRequest(`/v1/online/summary${qs ? '?' + qs : ''}`);
  },

  getDailyEntries: (params = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const qs = query.toString();
    return apiRequest(`/v1/online/daily-entries${qs ? '?' + qs : ''}`);
  },

  upsertDailyEntry: (data) =>
    apiRequest('/v1/online/daily-entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTransactions: (params = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const qs = query.toString();
    return apiRequest(`/v1/online/transactions${qs ? '?' + qs : ''}`);
  },

  createTransaction: (data) =>
    apiRequest('/v1/online/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSupplierPayments: (params = {}) => {
    const query = new URLSearchParams();
    if (params.supplierId) query.append('supplierId', params.supplierId);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const qs = query.toString();
    return apiRequest(`/v1/online/supplier-payments${qs ? '?' + qs : ''}`);
  },

  createSupplierPayment: (data) =>
    apiRequest('/v1/online/supplier-payments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getRunningBalance: (params = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const qs = query.toString();
    return apiRequest(`/v1/online/running-balance${qs ? '?' + qs : ''}`);
  },

  getSupplierOnlineTotal: (supplierId) =>
    apiRequest(`/v1/online/supplier-total/${supplierId}`),

  downloadExportCsv: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const qs = query.toString();
    const res = await fetch(`${BASE_URL}/v1/online/export-csv${qs ? '?' + qs : ''}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Failed to export online payments CSV');
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `smart-kirana-online-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
    return true;
  },
};

export const reportApi = {
  getDashboard: () => apiRequest('/v1/reports/dashboard'),
  getItemRankings: () => apiRequest('/v1/reports/items'),
  getSupplierBreakdown: () => apiRequest('/v1/reports/suppliers'),
  getMonthlyReport: (month) =>
    apiRequest(`/v1/reports/monthly${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  getFullReport: (month) =>
    apiRequest(`/v1/reports/full${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  downloadReportCsv: async (month) => {
    const url = `${BASE_URL}/v1/reports/export/csv${month ? `?month=${encodeURIComponent(month)}` : ''}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      throw new Error('Failed to export profit report CSV');
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `kirana-profit-report-${month || 'all'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
    return true;
  },
};

export const suggestionsApi = {
  getSuggestions: (period = 'last_30_days') =>
    apiRequest(`/v1/suggestions?period=${encodeURIComponent(period)}`),
  getWeights: () => apiRequest('/v1/suggestions/weights'),
};






