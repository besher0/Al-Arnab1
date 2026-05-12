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
const DEFAULT_REQUEST_TIMEOUT_MS = 12_000
const RETRY_DELAY_MS = 800

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function normalizeMessage(message, fallback) {
  if (Array.isArray(message)) {
    return String(message[0] || fallback)
  }
  if (typeof message === 'string' && message.trim()) {
    return message
  }
  return fallback
}

function isTransientRequestError(error) {
  if (!error || typeof error !== 'object') return false
  const code = error.code
  const status = Number(error.status || 0)
  if (code === 'NETWORK' || code === 'TIMEOUT') return true
  if (status === 502 || status === 503 || status === 504) return true
  return false
}

async function apiRequest(path, { method = 'GET', token, body, signal } = {}) {
  const methodUpper = String(method || 'GET').toUpperCase()
  const maxAttempts = methodUpper === 'GET' ? 2 : 1
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      controller.abort('request-timeout')
    }, DEFAULT_REQUEST_TIMEOUT_MS)

    function abortFromCaller() {
      controller.abort('caller-aborted')
    }

    if (signal) {
      if (signal.aborted) {
        controller.abort('caller-aborted')
      } else {
        signal.addEventListener('abort', abortFromCaller, { once: true })
      }
    }

    let response
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: methodUpper,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
    } catch (error) {
      window.clearTimeout(timeoutId)
      if (signal) signal.removeEventListener('abort', abortFromCaller)

      const requestError = new Error(
        error?.name === 'AbortError'
          ? 'انتهت مهلة الاتصال بالخادم. حاول مرة ثانية.'
          : 'تعذر الاتصال بالخادم. تحقق من رابط API و CORS على السيرفر.',
      )
      requestError.code = error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK'
      if (attempt < maxAttempts && isTransientRequestError(requestError)) {
        await wait(RETRY_DELAY_MS)
        continue
      }
      throw requestError
    }

    let data = null
    try {
      data = await response.json()
    } catch {
      data = null
    } finally {
      window.clearTimeout(timeoutId)
      if (signal) signal.removeEventListener('abort', abortFromCaller)
    }

    if (!response.ok) {
      const message = normalizeMessage(data?.message, 'Request failed')
      const requestError = new Error(message)
      requestError.status = response.status

      if (attempt < maxAttempts && isTransientRequestError(requestError)) {
        await wait(RETRY_DELAY_MS)
        continue
      }

      throw requestError
    }

    return data
  }
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
    updateProfile: (token, payload) =>
      apiRequest('/auth/profile', {
        method: 'PATCH',
        token,
        body: payload,
      }),
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
