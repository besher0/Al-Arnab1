module.exports = {
  content: ['./public/stitch/welcome.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#87CEEB',
        'on-primary': '#FFFFFF',
        background: '#FFFFFF',
        surface: '#FFFFFF',
        'on-background': '#1A365D',
        'on-surface-variant': '#718096',
        'outline-variant': '#87CEEB',
        'primary-container': '#E0F2F1',
        'secondary-container': '#87CEEB',
        'tertiary-container': '#FFFFFF',
        'surface-container': '#FFFFFF',
        'surface-container-high': '#F0F8FF',
      },
      borderRadius: {
        DEFAULT: '1rem',
        lg: '2rem',
        xl: '3rem',
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
