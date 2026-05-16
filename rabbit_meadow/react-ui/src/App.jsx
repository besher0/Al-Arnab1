import { useEffect, useRef } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { ShopProvider, useShop } from './store/ShopContext'
import './App.css'

const INSTALL_GATE_REQUIRED_KEY_PREFIX = 'al-arnab-install-required:'

function getInstallGateStorageKey(user) {
  const userId = String(user?.id || '').trim()
  if (!userId) {
    return ''
  }

  return `${INSTALL_GATE_REQUIRED_KEY_PREFIX}${userId}`
}

function isPwaStandaloneMode() {
  if (typeof window === 'undefined') {
    return false
  }

  const mediaMatch =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false

  return Boolean(mediaMatch || window.navigator?.standalone === true)
}

function hasInstallGateRequired(user) {
  if (typeof window === 'undefined') {
    return false
  }

  const key = getInstallGateStorageKey(user)
  if (!key) {
    return false
  }

  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markInstallGateRequired(user) {
  if (typeof window === 'undefined') {
    return
  }

  const key = getInstallGateStorageKey(user)
  if (!key) {
    return
  }

  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // Ignore storage restrictions.
  }
}

function clearInstallGateRequired(user) {
  if (typeof window === 'undefined') {
    return
  }

  const key = getInstallGateStorageKey(user)
  if (!key) {
    return
  }

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage restrictions.
  }
}

function shouldShowInstallRequired(user) {
  return (
    user?.role === 'CUSTOMER' &&
    hasInstallGateRequired(user) &&
    !isPwaStandaloneMode()
  )
}

function clearInstallGateIfStandalone(user) {
  if (user?.role !== 'CUSTOMER') {
    return
  }

  if (!isPwaStandaloneMode()) {
    return
  }

  clearInstallGateRequired(user)
}

function LoadingShell() {
  return (
    <section className="single-view">
      <div className="frame-wrap loading-shell loading-shell--brand">
        <img
          src="/stitch/assets/arnab-logo.jpg"
          alt="الأرنب للتسوق"
          className="loading-shell__logo"
        />
        <p className="loading-shell__message">يتم الاتصال بالانترنت يرجى الانتظار قليلا</p>
      </div>
    </section>
  )
}

function roleHomePath(role) {
  if (role === 'ADMIN') return '/admin/dashboard'
  if (role === 'DELIVERY') return '/delivery/orders'
  return '/home'
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isBootstrapping, user } = useShop()
  const location = useLocation()

  if (isBootstrapping) {
    return <LoadingShell />
  }

  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace state={{ from: location.pathname }} />
  }

  if (shouldShowInstallRequired(user)) {
    return <Navigate to="/install-required" replace />
  }

  if (user?.role !== 'CUSTOMER') {
    return <Navigate to={roleHomePath(user?.role)} replace />
  }

  return children
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isBootstrapping, user } = useShop()
  const location = useLocation()

  if (isBootstrapping) {
    return children
  }

  // Allow opening /login even when already authenticated to switch accounts.
  if (location.pathname === '/login') {
    return children
  }

  if (isAuthenticated) {
    if (shouldShowInstallRequired(user)) {
      return <Navigate to="/install-required" replace />
    }
    return <Navigate to={roleHomePath(user?.role)} replace />
  }

  return children
}

function InstallRequiredRoute({ children }) {
  const { isAuthenticated, isBootstrapping, user } = useShop()

  if (isBootstrapping) {
    return <LoadingShell />
  }

  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace />
  }

  if (user?.role !== 'CUSTOMER') {
    return <Navigate to={roleHomePath(user?.role)} replace />
  }

  if (!shouldShowInstallRequired(user)) {
    return <Navigate to="/home" replace />
  }

  return children
}

function AdminRoute({ children }) {
  const { isAuthenticated, isBootstrapping, user } = useShop()

  if (isBootstrapping) {
    return <LoadingShell />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to={roleHomePath(user?.role)} replace />
  }

  return children
}

function DeliveryRoute({ children }) {
  const { isAuthenticated, isBootstrapping, user } = useShop()

  if (isBootstrapping) {
    return <LoadingShell />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'DELIVERY') {
    return <Navigate to={roleHomePath(user?.role)} replace />
  }

  return children
}

function FramePage({ src, title, forwardSearch = false }) {
  const location = useLocation()
  const frameSrc = forwardSearch ? `${src}${location.search || ''}` : src
  const isAdminFrame =
    typeof src === 'string' && (src.startsWith('/admin/') || src.startsWith('/delivery/'))

  return (
    <section className={`single-view${isAdminFrame ? ' single-view-admin' : ''}`}>
      <div className={`frame-wrap${isAdminFrame ? ' frame-wrap-admin' : ''}`}>
        <iframe className="screen-frame" src={frameSrc} title={title} />
      </div>
    </section>
  )
}

function CartQuickCheckoutButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isBootstrapping, itemCount, user } = useShop()

  const hiddenPaths = ['/welcome', '/login', '/signup', '/cart', '/install-required']
  const isAdminPath = location.pathname.startsWith('/admin')
  const isHiddenPath = hiddenPaths.includes(location.pathname)
  const isHomePath = location.pathname === '/home'
  const canShow =
    !isBootstrapping &&
    isAuthenticated &&
    user?.role === 'CUSTOMER' &&
    isHomePath &&
    !isAdminPath &&
    !isHiddenPath &&
    Number(itemCount || 0) > 0

  if (!canShow) {
    return null
  }

  function openCart() {
    const fromPath = `${location.pathname}${location.search || ''}` || '/home'
    navigate(`/cart?from=${encodeURIComponent(fromPath)}`)
  }

  return (
    <button type="button" className="cart-quick-checkout" onClick={openCart} aria-label="اضغط لاستكمال الطلب">
      <span className="cart-quick-checkout__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="presentation" focusable="false">
          <path
            d="M7 4h-2l-1 2v2h1l2.1 8.4c.2.9 1 1.6 2 1.6h8.6c.9 0 1.7-.6 1.9-1.5l1.1-5.5c.2-1.1-.6-2.1-1.7-2.1h-10.9l-.4-2zm2.3 12-.3-1h9.1l-.2 1zm-.8 6a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zm8.9 0a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span>اضغط لاستكمال الطلب</span>
    </button>
  )
}

function BridgeListener() {
  const navigate = useNavigate()
  const location = useLocation()
  const lastOrdersSignatureRef = useRef('')
  const deferredInstallPromptRef = useRef(null)
  const isPwaInstalledRef = useRef(false)
  const {
    login,
    register,
    loginGuest,
    addItem,
    setQty,
    logout,
    checkoutOrder,
    listOrders,
    updateProfile,
    store,
    user,
    cartItems,
    itemCount,
    subtotal,
    isAuthenticated,
    isBootstrapping,
  } = useShop()

  useEffect(() => {
    isPwaInstalledRef.current = isPwaStandaloneMode()

    function syncState(targetWindow, cartSnapshot = null) {
      if (!targetWindow || typeof targetWindow.postMessage !== 'function') {
        return
      }

      const snapshotItems = Array.isArray(cartSnapshot?.items)
        ? cartSnapshot.items
        : cartItems
      const safeItems = snapshotItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        total: item.total,
        imageUrl: item.imageUrl,
        nameEn: item.nameEn,
        unit: item.unit,
      }))
      const fallbackItemCount = safeItems.reduce(
        (sum, item) => sum + (Number(item.qty) || 0),
        0,
      )
      const fallbackSubtotal = safeItems.reduce(
        (sum, item) => sum + (Number(item.total) || 0),
        0,
      )
      const nextItemCount = Number.isFinite(Number(cartSnapshot?.itemCount))
        ? Number(cartSnapshot.itemCount)
        : fallbackItemCount
      const nextSubtotal = Number.isFinite(Number(cartSnapshot?.subtotal))
        ? Number(cartSnapshot.subtotal)
        : fallbackSubtotal

      targetWindow.postMessage(
        {
          source: 'react-shell',
          type: 'cart-state',
          route: {
            pathname: location.pathname,
            search: location.search,
          },
          isAuthenticated,
          itemCount: nextItemCount,
          subtotal: nextSubtotal,
          cart: Object.fromEntries(safeItems.map((item) => [item.id, item.qty])),
          items: safeItems,
          store: {
            currency: store?.currency || 'SYP',
            usdSarRate: Number(store?.usdSarRate) >= 100 ? Number(store.usdSarRate) : 15000,
            isOpen: Boolean(store?.isOpen ?? true),
          },
          user: user
            ? {
                id: user.id || '',
                name: user.name || '',
                phone: user.phone || '',
                role: user.role || '',
              }
            : null,
        },
        window.location.origin,
      )
    }
    function syncCurrentFrame() {
      const frame = document.querySelector('.screen-frame')
      if (frame && frame.contentWindow) {
        syncState(frame.contentWindow)
      }
    }

    function sendAuthError(targetWindow, message) {
      sendFrameMessage(targetWindow, 'auth-error', {
        message: message || 'تعذر إتمام العملية.',
      })
    }

    function sendFrameMessage(targetWindow, type, payload = {}) {
      if (!targetWindow || typeof targetWindow.postMessage !== 'function') {
        return
      }

      targetWindow.postMessage(
        Object.assign({ source: 'react-shell', type }, payload),
        window.location.origin,
      )
    }

    function resolveTargetWindow(sourceWindow) {
      if (sourceWindow && typeof sourceWindow.postMessage === 'function') {
        return sourceWindow
      }

      const frame = document.querySelector('.screen-frame')
      return frame?.contentWindow || null
    }

    function sendPwaAvailability(targetWindow, extraPayload = {}) {
      sendFrameMessage(targetWindow, 'pwa-install-availability', {
        canInstall: Boolean(deferredInstallPromptRef.current),
        isInstalled: Boolean(isPwaInstalledRef.current),
        ...extraPayload,
      })
    }

    function releaseInstallGateIfInstalled() {
      if (!user || user.role !== 'CUSTOMER') {
        return
      }

      isPwaInstalledRef.current = isPwaStandaloneMode()
      if (!isPwaInstalledRef.current) {
        return
      }

      const hadGate = hasInstallGateRequired(user)
      clearInstallGateRequired(user)
      if (hadGate && location.pathname === '/install-required') {
        navigate('/home', { replace: true })
      }
    }

    function postAuthPath(authPayload, source = 'login') {
      const authUser = authPayload?.user
      if (authUser?.role !== 'CUSTOMER') {
        return roleHomePath(authUser?.role)
      }

      if (source === 'register' && !isPwaStandaloneMode()) {
        markInstallGateRequired(authUser)
      }

      clearInstallGateIfStandalone(authUser)
      return shouldShowInstallRequired(authUser) ? '/install-required' : '/home'
    }

    async function onMessage(event) {
      if (event.origin !== window.location.origin) {
        return
      }

      const payload = event.data
      if (!payload || payload.source !== 'stitch-frame') {
        return
      }
      const targetWindow = resolveTargetWindow(event.source)

      if (payload.type === 'request-state') {
        syncState(targetWindow)
        return
      }

      if (payload.type === 'pwa-install-query') {
        sendPwaAvailability(targetWindow)
        return
      }

      if (payload.type === 'pwa-install-trigger') {
        const promptEvent = deferredInstallPromptRef.current

        if (!promptEvent || isPwaInstalledRef.current) {
          sendFrameMessage(targetWindow, 'pwa-install-result', {
            accepted: false,
            installed: Boolean(isPwaInstalledRef.current),
            canInstall: false,
            isInstalled: Boolean(isPwaInstalledRef.current),
            reason: 'not-available',
          })
          return
        }

        try {
          await promptEvent.prompt()
          const choice = await promptEvent.userChoice
          const accepted = choice?.outcome === 'accepted'

          deferredInstallPromptRef.current = null
          if (accepted && isPwaStandaloneMode()) {
            isPwaInstalledRef.current = true
          }

          sendFrameMessage(targetWindow, 'pwa-install-result', {
            accepted,
            installed: Boolean(isPwaInstalledRef.current),
            canInstall: false,
            isInstalled: Boolean(isPwaInstalledRef.current),
            reason: accepted ? 'accepted' : 'dismissed',
          })
        } catch (_error) {
          sendFrameMessage(targetWindow, 'pwa-install-result', {
            accepted: false,
            installed: Boolean(isPwaInstalledRef.current),
            canInstall: Boolean(deferredInstallPromptRef.current),
            isInstalled: Boolean(isPwaInstalledRef.current),
            reason: 'prompt-failed',
            message: 'تعذر فتح نافذة التثبيت من المتصفح.',
          })
        }
        return
      }

      if (payload.type === 'navigate' && typeof payload.to === 'string') {
        navigate(payload.to)
        return
      }

      if (payload.type === 'auth-login') {
        try {
          const authPayload = await login(payload.phone || '')
          navigate(postAuthPath(authPayload, 'login'), { replace: true })
        } catch (error) {
          sendAuthError(targetWindow, error?.message)
        }
        return
      }

      if (payload.type === 'auth-register') {
        try {
          const authPayload = await register({
            name: payload.name || '',
            phone: payload.phone || '',
          })
          navigate(postAuthPath(authPayload, 'register'), { replace: true })
        } catch (error) {
          sendAuthError(targetWindow, error?.message)
        }
        return
      }

      if (payload.type === 'auth-guest') {
        try {
          const authPayload = await loginGuest(payload.name || 'ضيف الأرنب')
          navigate(postAuthPath(authPayload, 'guest'), { replace: true })
        } catch (error) {
          sendAuthError(targetWindow, error?.message)
        }
        return
      }

      if (payload.type === 'add-item' && typeof payload.id === 'string') {
        try {
          const qty = Number.isFinite(Number(payload.qty)) ? Number(payload.qty) : 1
          const nextCart = await addItem(payload.id, Math.max(0.01, qty))
          syncState(targetWindow, nextCart)
          sendFrameMessage(targetWindow, 'add-item-result', {
            success: true,
            itemCount: Number(nextCart?.itemCount || 0),
          })
        } catch (error) {
          const message = error?.message || 'تعذر إضافة المنتج إلى السلة.'
          sendFrameMessage(targetWindow, 'add-item-result', {
            success: false,
            message,
          })
        }
        return
      }

      if (payload.type === 'set-qty' && typeof payload.id === 'string') {
        try {
          const qty = Number.isFinite(Number(payload.qty)) ? Number(payload.qty) : 0
          const nextCart = await setQty(payload.id, Math.max(0, qty))
          syncState(targetWindow, nextCart)
        } catch (error) {
          sendAuthError(targetWindow, error?.message)
        }
        return
      }

      if (payload.type === 'checkout-order') {
        try {
          const checkoutResponse = await checkoutOrder({
            latitude: payload.latitude,
            longitude: payload.longitude,
            itemNotes: payload.itemNotes,
            notes: payload.notes,
            alternatePhone: payload.alternatePhone,
          })

          sendFrameMessage(targetWindow, 'checkout-result', {
            success: true,
            order: checkoutResponse?.order || null,
          })

          syncCurrentFrame()
        } catch (error) {
          sendFrameMessage(targetWindow, 'checkout-result', {
            success: false,
            message: error?.message || 'تعذر تأكيد الطلب.',
          })
        }
        return
      }

      if (payload.type === 'orders-list') {
        try {
          const orders = await listOrders()
          const safeOrders = Array.isArray(orders) ? orders : []
          lastOrdersSignatureRef.current = JSON.stringify(
            safeOrders.map((order) => ({
              id: order?.id || '',
              status: order?.status || '',
              updatedAt: order?.updatedAt || '',
            })),
          )
          sendFrameMessage(event.source, 'orders-result', {
            success: true,
            orders: safeOrders,
          })
        } catch (error) {
          sendFrameMessage(event.source, 'orders-result', {
            success: false,
            message: error?.message || 'تعذر تحميل الطلبات.',
            orders: [],
          })
        }
        return
      }

      if (payload.type === 'profile-update') {
        try {
          const updatedUser = await updateProfile({
            name: typeof payload.name === 'string' ? payload.name : undefined,
            phone: typeof payload.phone === 'string' ? payload.phone : undefined,
          })

          sendFrameMessage(targetWindow, 'profile-update-result', {
            success: true,
            user: updatedUser || null,
          })
          syncState(targetWindow)
        } catch (error) {
          sendFrameMessage(targetWindow, 'profile-update-result', {
            success: false,
            message: error?.message || 'تعذر تحديث بيانات الحساب.',
          })
          sendAuthError(targetWindow, error?.message)
        }
        return
      }

      if (payload.type === 'logout') {
        await logout()
        navigate('/welcome', { replace: true })
      }
    }

    function onBeforeInstallPrompt(event) {
      event.preventDefault()
      deferredInstallPromptRef.current = event
      sendPwaAvailability(resolveTargetWindow(null))
    }

    function onAppInstalled() {
      deferredInstallPromptRef.current = null
      isPwaInstalledRef.current = true
      clearInstallGateRequired(user)
      sendPwaAvailability(resolveTargetWindow(null), { installed: true })
      sendFrameMessage(resolveTargetWindow(null), 'pwa-install-result', {
        accepted: true,
        installed: true,
        canInstall: false,
        isInstalled: true,
        reason: 'installed',
      })
      if (location.pathname === '/install-required') {
        navigate('/home', { replace: true })
      }
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    window.addEventListener('message', onMessage)

    const frame = document.querySelector('.screen-frame')
    function onFrameLoad() {
      releaseInstallGateIfInstalled()
      syncCurrentFrame()
      sendPwaAvailability(resolveTargetWindow(null))
    }

    if (frame) {
      frame.addEventListener('load', onFrameLoad)
    }

    function onWindowFocus() {
      releaseInstallGateIfInstalled()
      syncCurrentFrame()
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        releaseInstallGateIfInstalled()
        syncCurrentFrame()
      }
    }

    window.addEventListener('focus', onWindowFocus)
    window.addEventListener('online', onWindowFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    if (!isBootstrapping) {
      releaseInstallGateIfInstalled()
      syncCurrentFrame()
      sendPwaAvailability(resolveTargetWindow(null))
    }
    const delayedSync = window.setTimeout(syncCurrentFrame, 120)
    const lateSync = window.setTimeout(syncCurrentFrame, 420)
    const delayedInstallSync = window.setTimeout(() => {
      sendPwaAvailability(resolveTargetWindow(null))
    }, 800)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
      window.removeEventListener('message', onMessage)
      if (frame) {
        frame.removeEventListener('load', onFrameLoad)
      }
      window.removeEventListener('focus', onWindowFocus)
      window.removeEventListener('online', onWindowFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearTimeout(delayedSync)
      window.clearTimeout(lateSync)
      window.clearTimeout(delayedInstallSync)
    }
  }, [
    addItem,
    checkoutOrder,
    cartItems,
    isAuthenticated,
    isBootstrapping,
    itemCount,
    listOrders,
    location.pathname,
    location.search,
    login,
    loginGuest,
    logout,
    navigate,
    register,
    setQty,
    updateProfile,
    store,
    subtotal,
    user,
  ])

  useEffect(() => {
    if (isBootstrapping || !isAuthenticated || location.pathname !== '/orders') {
      return undefined
    }

    let cancelled = false
    let intervalId = null

    function sendOrdersResult(payload) {
      const frame = document.querySelector('.screen-frame')
      const targetWindow = frame?.contentWindow
      if (!targetWindow || typeof targetWindow.postMessage !== 'function') {
        return
      }

      targetWindow.postMessage(
        Object.assign({ source: 'react-shell', type: 'orders-result' }, payload),
        window.location.origin,
      )
    }

    async function fetchOrders(force = false) {
      try {
        const orders = await listOrders()
        if (cancelled) {
          return
        }

        const safeOrders = Array.isArray(orders) ? orders : []
        const nextSignature = JSON.stringify(
          safeOrders.map((order) => ({
            id: order?.id || '',
            status: order?.status || '',
            updatedAt: order?.updatedAt || '',
          })),
        )

        if (!force && nextSignature === lastOrdersSignatureRef.current) {
          return
        }

        lastOrdersSignatureRef.current = nextSignature
        sendOrdersResult({
          success: true,
          orders: safeOrders,
        })
      } catch (error) {
        if (cancelled || !force) {
          return
        }

        sendOrdersResult({
          success: false,
          message: error?.message || 'تعذر تحميل الطلبات.',
          orders: [],
        })
      }
    }

    void fetchOrders(true)
    intervalId = window.setInterval(() => {
      void fetchOrders(false)
    }, 5000)

    return () => {
      cancelled = true
      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [isAuthenticated, isBootstrapping, listOrders, location.pathname])

  return null
}

function AppRoutes() {
  const authUiVersion = '20260516-3'

  return (
    <>
      <BridgeListener />
      <CartQuickCheckoutButton />
      <Routes>
        <Route path="/" element={<Navigate to="/welcome" replace />} />

        <Route
          path="/welcome"
          element={
            <PublicOnlyRoute>
              <FramePage src={`/stitch/welcome.html?v=${authUiVersion}`} title="welcome" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <FramePage src={`/stitch/login.html?v=${authUiVersion}`} title="login" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <FramePage src={`/stitch/signup.html?v=${authUiVersion}`} title="signup" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/install-required"
          element={
            <InstallRequiredRoute>
              <FramePage
                src={`/stitch/install-required.html?v=${authUiVersion}`}
                title="install-required"
              />
            </InstallRequiredRoute>
          }
        />

        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <FramePage src="/stitch/home.html" title="home" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              <FramePage src="/stitch/categories.html" title="categories" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <FramePage src="/stitch/search.html" title="search" forwardSearch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home-offers"
          element={
            <ProtectedRoute>
              <FramePage src="/stitch/home-offers.html" title="home-offers" forwardSearch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/category-products"
          element={
            <ProtectedRoute>
              <FramePage
                src="/stitch/category-products.html"
                title="category-products"
                forwardSearch
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/product"
          element={
            <ProtectedRoute>
              <FramePage src="/stitch/product.html" title="product" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/product/:id"
          element={
            <ProtectedRoute>
              <FramePage src="/stitch/product.html" title="product" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cart"
          element={
            <ProtectedRoute>
              <FramePage src="/stitch/cart.html" title="cart" forwardSearch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <FramePage src="/stitch/orders.html" title="orders" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <FramePage src="/stitch/notifications.html" title="notifications" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <FramePage src="/stitch/profile.html" title="profile" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/delivery"
          element={
            <DeliveryRoute>
              <Navigate to="/delivery/orders" replace />
            </DeliveryRoute>
          }
        />
        <Route
          path="/delivery/orders"
          element={
            <DeliveryRoute>
              <FramePage src="/delivery/orders.html" title="delivery-orders" />
            </DeliveryRoute>
          }
        />
        <Route
          path="/delivery/*"
          element={
            <DeliveryRoute>
              <Navigate to="/delivery/orders" replace />
            </DeliveryRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Navigate to="/admin/dashboard" replace />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <FramePage src="/admin/dashboard.html" title="admin-dashboard" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <AdminRoute>
              <Navigate to="/admin/orders/current" replace />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/orders/current"
          element={
            <AdminRoute>
              <FramePage src="/admin/current-orders.html" title="admin-current-orders" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/orders/completed"
          element={
            <AdminRoute>
              <FramePage src="/admin/completed-orders.html" title="admin-completed-orders" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/orders/detail"
          element={
            <AdminRoute>
              <FramePage
                src="/admin/order-detail.html"
                title="admin-order-detail"
                forwardSearch
              />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <AdminRoute>
              <Navigate to="/admin/products/list" replace />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/products/list"
          element={
            <AdminRoute>
              <FramePage src="/admin/products-list.html" title="admin-products-list" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/products-list"
          element={
            <AdminRoute>
              <FramePage src="/admin/products-list.html" title="admin-products-list" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/products-list.html"
          element={
            <AdminRoute>
              <FramePage src="/admin/products-list.html" title="admin-products-list" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/products/new"
          element={
            <AdminRoute>
              <FramePage src="/admin/add-product.html" title="admin-add-product" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/discounts"
          element={
            <AdminRoute>
              <Navigate to="/admin/discounts/list" replace />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/discounts/list"
          element={
            <AdminRoute>
              <FramePage src="/admin/discounts-list.html" title="admin-discounts-list" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/discounts-list"
          element={
            <AdminRoute>
              <FramePage src="/admin/discounts-list.html" title="admin-discounts-list" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/discounts-list.html"
          element={
            <AdminRoute>
              <FramePage src="/admin/discounts-list.html" title="admin-discounts-list" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/categories/new"
          element={
            <AdminRoute>
              <FramePage src="/admin/add-category.html" title="admin-add-category" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/discounts/new"
          element={
            <AdminRoute>
              <FramePage
                src="/admin/new-discount.html"
                title="admin-new-discount"
                forwardSearch
              />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/reports/sales"
          element={
            <AdminRoute>
              <FramePage src="/admin/sales-report.html" title="admin-sales-report" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <AdminRoute>
              <FramePage src="/admin/notifications.html" title="admin-notifications" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <Navigate to="/admin/dashboard" replace />
            </AdminRoute>
          }
        />

        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <ShopProvider>
      <AppRoutes />
    </ShopProvider>
  )
}

export default App
