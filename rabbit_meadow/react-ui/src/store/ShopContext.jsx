/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { api } from '../lib/api'

const TOKEN_STORAGE_KEY = 'al-arnab-token'
const DEFAULT_EXCHANGE_RATE = 15000
const DEFAULT_STORE = {
  currency: 'SYP',
  usdSarRate: DEFAULT_EXCHANGE_RATE,
  isOpen: true,
}

const ShopContext = createContext(null)

function numberValue(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeStore(storePayload) {
  const rate = numberValue(storePayload?.usdSarRate, DEFAULT_EXCHANGE_RATE)
  return {
    currency: String(storePayload?.currency || DEFAULT_STORE.currency),
    usdSarRate: rate >= 100 ? rate : DEFAULT_EXCHANGE_RATE,
    isOpen: Boolean(storePayload?.isOpen ?? true),
  }
}

function normalizeCartResponse(cartResponse) {
  const rawItems = Array.isArray(cartResponse?.items) ? cartResponse.items : []

  const items = rawItems
    .map((item) => {
      const qty = numberValue(item?.qty, 0)
      const price = numberValue(item?.price, 0)
      const total = numberValue(item?.total, price * qty)

      return {
        id: String(item?.id || ''),
        name: String(item?.name || ''),
        nameEn: item?.nameEn ? String(item.nameEn) : '',
        imageUrl: item?.imageUrl ? String(item.imageUrl) : '',
        price,
        qty,
        total,
      }
    })
    .filter((item) => item.id && item.qty > 0)

  const fallbackCount = items.reduce((sum, item) => sum + item.qty, 0)
  const fallbackSubtotal = items.reduce((sum, item) => sum + item.total, 0)

  return {
    items,
    itemCount: numberValue(cartResponse?.itemCount, fallbackCount),
    subtotal: numberValue(cartResponse?.subtotal, fallbackSubtotal),
  }
}

function productsMapFromList(productsList) {
  const items = Array.isArray(productsList) ? productsList : []

  return Object.fromEntries(
    items
      .map((product) => {
        const id = String(product?.id || '')
        if (!id) {
          return null
        }

        return [
          id,
          {
            id,
            name: String(product?.name || ''),
            nameEn: product?.nameEn ? String(product.nameEn) : '',
            description: product?.description ? String(product.description) : '',
            price: numberValue(product?.price, 0),
            categoryId: product?.categoryId ? String(product.categoryId) : '',
            categoryName: product?.categoryName ? String(product.categoryName) : '',
            imageUrl: product?.imageUrl ? String(product.imageUrl) : '',
            unit: product?.unit ? String(product.unit) : '',
          },
        ]
      })
      .filter(Boolean),
  )
}

export function ShopProvider({ children }) {
  const [isBootstrapping, setBootstrapping] = useState(true)
  const [isAuthenticated, setAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [products, setProducts] = useState({})
  const [store, setStore] = useState(DEFAULT_STORE)
  const [cart, setCart] = useState({
    items: [],
    itemCount: 0,
    subtotal: 0,
  })

  const refreshCatalog = useCallback(async () => {
    const bootstrap = await api.catalog.bootstrap()
    const nextProducts = productsMapFromList(bootstrap?.products)
    const nextStore = normalizeStore(bootstrap?.store)
    setProducts(nextProducts)
    setStore(nextStore)
    return nextProducts
  }, [])

  const applyAuthState = useCallback(async (authPayload) => {
    const nextToken = String(authPayload?.accessToken || '')
    if (!nextToken) {
      throw new Error('لم يتم استلام صلاحية الدخول من الخادم.')
    }

    window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
    setToken(nextToken)
    setAuthenticated(true)
    setUser(authPayload.user || null)

    const cartResponse = await api.cart.get(nextToken)
    setCart(normalizeCartResponse(cartResponse))
  }, [])

  const bootstrapSession = useCallback(async () => {
    setBootstrapping(true)

    try {
      await refreshCatalog()
    } catch {
      setProducts({})
      setStore(DEFAULT_STORE)
    }

    const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!storedToken) {
      setAuthenticated(false)
      setUser(null)
      setToken(null)
      setCart({ items: [], itemCount: 0, subtotal: 0 })
      setBootstrapping(false)
      return
    }

    try {
      const [sessionUser, cartResponse] = await Promise.all([
        api.auth.session(storedToken),
        api.cart.get(storedToken),
      ])

      setAuthenticated(true)
      setUser(sessionUser)
      setToken(storedToken)
      setCart(normalizeCartResponse(cartResponse))
    } catch {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
      setAuthenticated(false)
      setUser(null)
      setToken(null)
      setCart({ items: [], itemCount: 0, subtotal: 0 })
    } finally {
      setBootstrapping(false)
    }
  }, [refreshCatalog])

  useEffect(() => {
    if (typeof window === 'undefined') {
      setBootstrapping(false)
      return
    }

    bootstrapSession()
  }, [bootstrapSession])

  const login = useCallback(
    async (phone) => {
      const cleanPhone = String(phone || '').trim()
      if (!cleanPhone) {
        throw new Error('رقم الهاتف مطلوب.')
      }

      const authPayload = await api.auth.login({ phone: cleanPhone })
      await applyAuthState(authPayload)
      return authPayload
    },
    [applyAuthState],
  )

  const register = useCallback(
    async ({ name, phone }) => {
      const cleanName = String(name || '').trim()
      const cleanPhone = String(phone || '').trim()

      if (!cleanName) {
        throw new Error('الاسم مطلوب.')
      }

      if (!cleanPhone) {
        throw new Error('رقم الهاتف مطلوب.')
      }

      const authPayload = await api.auth.register({
        name: cleanName,
        phone: cleanPhone,
      })
      await applyAuthState(authPayload)
      return authPayload
    },
    [applyAuthState],
  )

  const loginGuest = useCallback(
    async (name) => {
      const authPayload = await api.auth.guest({
        name: name ? String(name).trim() : undefined,
      })
      await applyAuthState(authPayload)
      return authPayload
    },
    [applyAuthState],
  )

  const logout = useCallback(async () => {
    if (token) {
      try {
        await api.auth.logout(token)
      } catch {
        // Ignore logout API failures and clear local state anyway.
      }
    }

    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    setAuthenticated(false)
    setUser(null)
    setToken(null)
    setCart({ items: [], itemCount: 0, subtotal: 0 })
  }, [token])

  const addItem = useCallback(
    async (id, qty = 1) => {
      if (!token) {
        throw new Error('يجب تسجيل الدخول أولاً.')
      }

      const cleanId = String(id || '').trim()
      const cleanQty = Math.max(0.01, numberValue(qty, 1))

      if (!cleanId) {
        throw new Error('معرف المنتج غير صالح.')
      }

      const cartResponse = await api.cart.addItem(token, {
        productId: cleanId,
        qty: cleanQty,
      })

      setCart(normalizeCartResponse(cartResponse))
    },
    [token],
  )

  const setQty = useCallback(
    async (id, qty) => {
      if (!token) {
        throw new Error('يجب تسجيل الدخول أولاً.')
      }

      const cleanId = String(id || '').trim()
      const cleanQty = Math.max(0, numberValue(qty, 0))

      if (!cleanId) {
        throw new Error('معرف المنتج غير صالح.')
      }

      const cartResponse = await api.cart.setQty(token, cleanId, cleanQty)
      setCart(normalizeCartResponse(cartResponse))
    },
    [token],
  )

  const clearCart = useCallback(async () => {
    if (!token) {
      return
    }

    const cartResponse = await api.cart.clear(token)
    setCart(normalizeCartResponse(cartResponse))
  }, [token])

  const checkoutOrder = useCallback(
    async ({ latitude, longitude }) => {
      if (!token) {
        throw new Error('يجب تسجيل الدخول أولاً.')
      }

      const lat = Number(latitude)
      const lng = Number(longitude)

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('موقع التوصيل غير صالح.')
      }

      const checkoutPayload = {
        latitude: lat,
        longitude: lng,
      }

      const checkoutResponse = await api.cart.checkout(token, checkoutPayload)

      if (checkoutResponse?.cart) {
        setCart(normalizeCartResponse(checkoutResponse.cart))
      } else {
        const cartResponse = await api.cart.get(token)
        setCart(normalizeCartResponse(cartResponse))
      }

      return checkoutResponse
    },
    [token],
  )

  const listOrders = useCallback(async () => {
    if (!token) {
      throw new Error('يجب تسجيل الدخول أولاً.')
    }

    return api.orders.mine(token)
  }, [token])

  const value = useMemo(
    () => ({
      isBootstrapping,
      products,
      store,
      isAuthenticated,
      user,
      cartItems: cart.items,
      itemCount: cart.itemCount,
      subtotal: cart.subtotal,
      refreshCatalog,
      bootstrapSession,
      login,
      register,
      loginGuest,
      logout,
      addItem,
      setQty,
      clearCart,
      checkoutOrder,
      listOrders,
      token,
    }),
    [
      addItem,
      bootstrapSession,
      cart.itemCount,
      cart.items,
      cart.subtotal,
      clearCart,
      checkoutOrder,
      isAuthenticated,
      isBootstrapping,
      listOrders,
      login,
      loginGuest,
      logout,
      products,
      store,
      refreshCatalog,
      register,
      setQty,
      token,
      user,
    ],
  )

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop() {
  const context = useContext(ShopContext)
  if (!context) {
    throw new Error('useShop must be used within ShopProvider')
  }
  return context
}

export function formatSar(value) {
  return `${numberValue(value, 0).toFixed(2)} ر.س`
}
