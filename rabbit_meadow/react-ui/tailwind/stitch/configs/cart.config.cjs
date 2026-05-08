module.exports = {
  content: ['./public/stitch/cart.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#0096d6',
        'on-primary': '#ffffff',
        'primary-container': '#e0f2fe',
        'on-primary-container': '#0369a1',
        surface: '#ffffff',
        'on-surface': '#1e293b',
        'surface-variant': '#f1f5f9',
        'on-surface-variant': '#475569',
        outline: '#cbd5e1',
        background: '#f0f9ff',
      },
      borderRadius: {
        DEFAULT: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        full: '9999px',
      },
      fontFamily: {
        tajawal: ['Tajawal', 'sans-serif'],
        almarai: ['Almarai', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};
