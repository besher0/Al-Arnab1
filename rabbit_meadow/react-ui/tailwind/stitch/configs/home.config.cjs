module.exports = {
  content: ['./public/stitch/home.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#87CEEB',
        'on-primary': '#FFFFFF',
        surface: '#FFFFFF',
        background: '#F0F8FF',
        'surface-container': '#F5F5F5',
        'on-surface': '#1A365D',
        'on-surface-variant': '#718096',
        outline: '#E2E8F0',
        secondary: '#87CEEB',
        'on-secondary': '#FFFFFF',
      },
      borderRadius: {
        DEFAULT: '1rem',
        lg: '1.5rem',
        xl: '2rem',
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
