module.exports = {
  content: ['./public/stitch/product.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#87CEEB',
        'on-primary': '#FFFFFF',
        background: '#FFFFFF',
        surface: '#F0F8FF',
        'on-surface': '#1A365D',
        'on-surface-variant': '#718096',
        secondary: '#F5F5F5',
        outline: '#87CEEB',
      },
      borderRadius: {
        DEFAULT: '1rem',
        lg: '2rem',
        xl: '3rem',
        full: '9999px',
      },
      fontFamily: {
        headline: ['Tajawal', 'sans-serif'],
        body: ['Almarai', 'sans-serif'],
        label: ['Almarai', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};
