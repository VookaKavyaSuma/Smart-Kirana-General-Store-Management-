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


