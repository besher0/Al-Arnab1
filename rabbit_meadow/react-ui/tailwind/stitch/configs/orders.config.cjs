module.exports = {
  content: ['./public/stitch/orders.html', './public/stitch/notifications.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#87CEEB',
        'on-primary': '#ffffff',
        'on-background': '#1A365D',
        'on-surface': '#1A365D',
        'on-surface-variant': '#718096',
        'surface-container': '#E0F2FF',
        'surface-container-low': '#EAF5FF',
        'surface-container-lowest': '#ffffff',
        background: '#F0F8FF',
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
