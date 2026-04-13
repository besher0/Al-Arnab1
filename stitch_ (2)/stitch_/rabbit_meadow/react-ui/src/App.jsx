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

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useShop()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace state={{ from: location.pathname }} />
  }

  return children
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated } = useShop()

  if (isAuthenticated) {
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
    addItem,
    setQty,
    logout,
    cartItems,
    itemCount,
    subtotal,
    isAuthenticated,
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

    function onMessage(event) {
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
        login(payload.phone || '05XXXXXXXX')
        navigate('/home', { replace: true })
        return
      }

      if (payload.type === 'auth-register') {
        register({
          name: payload.name || 'مستخدم جديد',
          phone: payload.phone || '05XXXXXXXX',
        })
        navigate('/home', { replace: true })
        return
      }

      if (payload.type === 'auth-guest') {
        register({ name: 'ضيف الأرنب', phone: 'guest' })
        navigate('/home', { replace: true })
        return
      }

      if (payload.type === 'add-item' && typeof payload.id === 'string') {
        const qty = Number.isFinite(Number(payload.qty)) ? Number(payload.qty) : 1
        addItem(payload.id, Math.max(1, qty))
        return
      }

      if (payload.type === 'set-qty' && typeof payload.id === 'string') {
        const qty = Number.isFinite(Number(payload.qty)) ? Number(payload.qty) : 0
        setQty(payload.id, Math.max(0, qty))
        return
      }

      if (payload.type === 'logout') {
        logout()
        navigate('/welcome', { replace: true })
      }
    }

    window.addEventListener('message', onMessage)
    syncCurrentFrame()
    const delayedSync = window.setTimeout(syncCurrentFrame, 120)

    return () => {
      window.removeEventListener('message', onMessage)
      window.clearTimeout(delayedSync)
    }
  }, [
    addItem,
    cartMap,
    cartItems,
    isAuthenticated,
    itemCount,
    location.pathname,
    login,
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
