function readRuntimeApiBase() {
  if (typeof window === 'undefined') {
    return ''
  }

  if (window.__AL_ARNAB_API_BASE__) {
    return String(window.__AL_ARNAB_API_BASE__)
  }

  try {
    return window.localStorage.getItem('al-arnab-api-base') || ''
  } catch {
    return ''
  }
}

const fallbackApiBase =
  typeof window !== 'undefined'
    ? `${window.location.origin}/api`
    : 'http://localhost:3000/api'

function normalizeApiBase(rawBase) {
  const base = String(rawBase || '').trim().replace(/\/+$/, '')
  if (!base) return ''

  try {
    const url = new URL(base)
    if (url.pathname === '/api' || url.pathname.endsWith('/api')) {
      return base
    }
    return `${base}/api`
  } catch {
    if (base === '/api' || base.endsWith('/api')) {
      return base
    }
    return `${base}/api`
  }
}

const runtimeApiBase = readRuntimeApiBase()
const API_BASE_URL = normalizeApiBase(
  import.meta.env.VITE_API_BASE_URL || runtimeApiBase || fallbackApiBase,
)

async function apiRequest(path, { method = 'GET', token, body, signal } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch {
    throw new Error('تعذر الاتصال بالخادم. تحقق من رابط API و CORS على السيرفر.')
  }

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
    checkout: (token, payload) =>
      apiRequest('/cart/checkout', {
        method: 'POST',
        token,
        body: payload,
      }),
  },
  orders: {
    mine: (token) => apiRequest('/cart/orders', { token }),
  },
}
