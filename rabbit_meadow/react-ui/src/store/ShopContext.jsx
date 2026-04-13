/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'

const products = {
  carrot: { id: 'carrot', name: 'جزر عضوي', price: 12.5, category: 'الخضروات' },
  lettuce: { id: 'lettuce', name: 'خس روماني', price: 4, category: 'الخضروات' },
  tomato: { id: 'tomato', name: 'طماطم كرزية حمراء', price: 14.5, category: 'الخضروات' },
  milk: { id: 'milk', name: 'حليب كامل الدسم عضوي', price: 12.5, category: 'الألبان والأجبان' },
  feta: { id: 'feta', name: 'جبنة فيتا يونانية', price: 24, category: 'الألبان والأجبان' },
  yogurt: { id: 'yogurt', name: 'زبادي يوناني', price: 5.75, category: 'الألبان والأجبان' },
  butter: { id: 'butter', name: 'زبدة طبيعية', price: 18.5, category: 'الألبان والأجبان' },
  labneh: { id: 'labneh', name: 'لبنة بلدية', price: 15, category: 'الألبان والأجبان' },
  grapes: { id: 'grapes', name: 'عنب أخضر طازج', price: 12.5, category: 'العروض' },
  bread: { id: 'bread', name: 'خبز ريفي', price: 5.5, category: 'العروض' },
}

const initialState = {
  isAuthenticated: false,
  user: null,
  cart: {
    carrot: 2,
    lettuce: 1,
  },
}

function getInitialState() {
  if (typeof window === 'undefined') {
    return initialState
  }

  const stored = window.localStorage.getItem('al-arnab-store')
  if (!stored) {
    return initialState
  }

  try {
    const parsed = JSON.parse(stored)
    return {
      ...initialState,
      ...parsed,
      cart: {
        ...initialState.cart,
        ...(parsed.cart ?? {}),
      },
    }
  } catch {
    return initialState
  }
}

function shopReducer(state, action) {
  const nextCart = { ...state.cart }

  if (action.type === 'LOGIN') {
    return {
      ...state,
      isAuthenticated: true,
      user: action.payload.user,
    }
  }

  if (action.type === 'REGISTER') {
    return {
      ...state,
      isAuthenticated: true,
      user: action.payload.user,
    }
  }

  if (action.type === 'LOGOUT') {
    return {
      ...state,
      isAuthenticated: false,
      user: null,
    }
  }

  if (action.type === 'ADD_ITEM') {
    const qty = Math.max(1, action.payload.qty ?? 1)
    nextCart[action.payload.id] = (nextCart[action.payload.id] ?? 0) + qty
    return { ...state, cart: nextCart }
  }

  if (action.type === 'SET_QTY') {
    const qty = Math.max(0, action.payload.qty)
    if (qty === 0) {
      delete nextCart[action.payload.id]
    } else {
      nextCart[action.payload.id] = qty
    }
    return { ...state, cart: nextCart }
  }

  if (action.type === 'CLEAR_CART') {
    return { ...state, cart: {} }
  }

  return state
}

const ShopContext = createContext(null)

export function ShopProvider({ children }) {
  const [state, dispatch] = useReducer(shopReducer, initialState, getInitialState)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      'al-arnab-store',
      JSON.stringify({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        cart: state.cart,
      }),
    )
  }, [state])

  const value = useMemo(() => {
    const cartItems = Object.entries(state.cart)
      .map(([id, qty]) => {
        const product = products[id]
        if (!product) return null
        return {
          ...product,
          qty,
          total: qty * product.price,
        }
      })
      .filter(Boolean)

    const itemCount = cartItems.reduce((sum, item) => sum + item.qty, 0)
    const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0)

    return {
      products,
      isAuthenticated: state.isAuthenticated,
      user: state.user,
      cartItems,
      itemCount,
      subtotal,
      login: (phone) =>
        dispatch({
          type: 'LOGIN',
          payload: {
            user: {
              name: 'مستخدم الأرنب',
              phone,
            },
          },
        }),
      register: ({ name, phone }) =>
        dispatch({
          type: 'REGISTER',
          payload: {
            user: {
              name: name || 'مستخدم جديد',
              phone,
            },
          },
        }),
      logout: () => dispatch({ type: 'LOGOUT' }),
      addItem: (id, qty = 1) => dispatch({ type: 'ADD_ITEM', payload: { id, qty } }),
      setQty: (id, qty) => dispatch({ type: 'SET_QTY', payload: { id, qty } }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' }),
    }
  }, [state])

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
  return `${value.toFixed(2)} ر.س`
}
