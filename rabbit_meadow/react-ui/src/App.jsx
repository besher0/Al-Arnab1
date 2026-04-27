import { useEffect, useMemo } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { ShopProvider, useShop } from './store/ShopContext'
import './App.css'

function LoadingShell() {
  return (
    <section className="single-view">
      <div className="frame-wrap loading-shell">جاري تحميل البيانات...</div>
    </section>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isBootstrapping } = useShop()
  const location = useLocation()

  if (isBootstrapping) {
    return <LoadingShell />
  }

  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace state={{ from: location.pathname }} />
  }

  return children
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isBootstrapping } = useShop()

  if (isBootstrapping) {
    return <LoadingShell />
  }

  if (isAuthenticated) {
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
    return <Navigate to="/home" replace />
  }

  return children
}

function FramePage({ src, title }) {
  return (
    <section className="single-view">
      <div className="frame-wrap">
        <iframe className="screen-frame" src={src} title={title} />
      </div>
    </section>
  )
}

function BridgeListener() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    login,
    register,
    loginGuest,
    addItem,
    setQty,
    logout,
    cartItems,
    itemCount,
    subtotal,
    isAuthenticated,
    isBootstrapping,
  } = useShop()

  const cartMap = useMemo(() => {
    return Object.fromEntries(cartItems.map((item) => [item.id, item.qty]))
  }, [cartItems])

  useEffect(() => {
    function syncState(targetWindow) {
      if (!targetWindow || typeof targetWindow.postMessage !== 'function') {
        return
      }

      targetWindow.postMessage(
        {
          source: 'react-shell',
          type: 'cart-state',
          isAuthenticated,
          itemCount,
          subtotal,
          cart: cartMap,
          items: cartItems.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            qty: item.qty,
            total: item.total,
            imageUrl: item.imageUrl,
            nameEn: item.nameEn,
          })),
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
      if (!targetWindow || typeof targetWindow.postMessage !== 'function') {
        return
      }

      targetWindow.postMessage(
        {
          source: 'react-shell',
          type: 'auth-error',
          message: message || 'تعذر إتمام العملية.',
        },
        window.location.origin,
      )
    }

    async function onMessage(event) {
      if (event.origin !== window.location.origin) {
        return
      }

      const payload = event.data
      if (!payload || payload.source !== 'stitch-frame') {
        return
      }

      if (payload.type === 'request-state') {
        syncState(event.source)
        return
      }

      if (payload.type === 'navigate' && typeof payload.to === 'string') {
        navigate(payload.to)
        return
      }

      if (payload.type === 'auth-login') {
        try {
          await login(payload.phone || '')
          navigate('/home', { replace: true })
        } catch (error) {
          sendAuthError(event.source, error?.message)
        }
        return
      }

      if (payload.type === 'auth-register') {
        try {
          await register({
            name: payload.name || '',
            phone: payload.phone || '',
          })
          navigate('/home', { replace: true })
        } catch (error) {
          sendAuthError(event.source, error?.message)
        }
        return
      }

      if (payload.type === 'auth-guest') {
        try {
          await loginGuest(payload.name || 'ضيف الأرنب')
          navigate('/home', { replace: true })
        } catch (error) {
          sendAuthError(event.source, error?.message)
        }
        return
      }

      if (payload.type === 'add-item' && typeof payload.id === 'string') {
        try {
          const qty = Number.isFinite(Number(payload.qty)) ? Number(payload.qty) : 1
          await addItem(payload.id, Math.max(1, qty))
        } catch (error) {
          sendAuthError(event.source, error?.message)
        }
        return
      }

      if (payload.type === 'set-qty' && typeof payload.id === 'string') {
        try {
          const qty = Number.isFinite(Number(payload.qty)) ? Number(payload.qty) : 0
          await setQty(payload.id, Math.max(0, qty))
        } catch (error) {
          sendAuthError(event.source, error?.message)
        }
        return
      }

      if (payload.type === 'logout') {
        await logout()
        navigate('/welcome', { replace: true })
      }
    }

    window.addEventListener('message', onMessage)

    const frame = document.querySelector('.screen-frame')
    function onFrameLoad() {
      syncCurrentFrame()
    }

    if (frame) {
      frame.addEventListener('load', onFrameLoad)
    }

    if (!isBootstrapping) {
      syncCurrentFrame()
    }
    const delayedSync = window.setTimeout(syncCurrentFrame, 120)
    const lateSync = window.setTimeout(syncCurrentFrame, 420)

    return () => {
      window.removeEventListener('message', onMessage)
      if (frame) {
        frame.removeEventListener('load', onFrameLoad)
      }
      window.clearTimeout(delayedSync)
      window.clearTimeout(lateSync)
    }
  }, [
    addItem,
    cartMap,
    cartItems,
    isAuthenticated,
    isBootstrapping,
    itemCount,
    location.pathname,
    login,
    loginGuest,
    logout,
    navigate,
    register,
    setQty,
    subtotal,
  ])

  return null
}

function AppRoutes() {
  return (
    <>
      <BridgeListener />
      <Routes>
        <Route path="/" element={<Navigate to="/welcome" replace />} />

        <Route
          path="/welcome"
          element={
            <PublicOnlyRoute>
              <FramePage src="/stitch/welcome.html" title="welcome" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <FramePage src="/stitch/login.html" title="login" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <FramePage src="/stitch/signup.html" title="signup" />
            </PublicOnlyRoute>
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
          path="/category-products"
          element={
            <ProtectedRoute>
              <FramePage src="/stitch/category-products.html" title="category-products" />
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
              <FramePage src="/stitch/cart.html" title="cart" />
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
        <Route path="/profile" element={<Navigate to="/orders" replace />} />

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
              <FramePage src="/admin/order-detail.html" title="admin-order-detail" />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <AdminRoute>
              <Navigate to="/admin/products/new" replace />
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
              <FramePage src="/admin/new-discount.html" title="admin-new-discount" />
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
