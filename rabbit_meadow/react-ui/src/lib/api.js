const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

async function apiRequest(path, { method = 'GET', token, body, signal } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message = data?.message
    if (Array.isArray(message)) {
      throw new Error(message[0] || 'Request failed')
    }

    throw new Error(message || 'Request failed')
  }

  return data
}

export const api = {
  baseUrl: API_BASE_URL,
  request: apiRequest,
  auth: {
    register: (payload) => apiRequest('/auth/register', { method: 'POST', body: payload }),
    login: (payload) => apiRequest('/auth/login', { method: 'POST', body: payload }),
    guest: (payload) => apiRequest('/auth/guest', { method: 'POST', body: payload }),
    session: (token) => apiRequest('/auth/session', { token }),
    logout: (token) => apiRequest('/auth/logout', { method: 'POST', token }),
  },
  catalog: {
    bootstrap: () => apiRequest('/catalog/bootstrap'),
    products: () => apiRequest('/catalog/products'),
    categories: () => apiRequest('/catalog/categories'),
  },
  cart: {
    get: (token) => apiRequest('/cart', { token }),
    addItem: (token, payload) =>
      apiRequest('/cart/items', {
        method: 'POST',
        token,
        body: payload,
      }),
    setQty: (token, productId, qty) =>
      apiRequest(`/cart/items/${encodeURIComponent(productId)}`, {
        method: 'PATCH',
        token,
        body: { qty },
      }),
    clear: (token) => apiRequest('/cart/clear', { method: 'DELETE', token }),
  },
}
