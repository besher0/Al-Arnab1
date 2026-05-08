module.exports = {
  content: ['./public/stitch/profile.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#87CEEB',
        'on-primary': '#FFFFFF',
        surface: '#F0F8FF',
        'surface-card': '#FFFFFF',
        'surface-soft': '#EAF5FF',
        'on-surface': '#1A365D',
        'on-surface-variant': '#718096',
        outline: '#C6DFF2',
        danger: '#B02500',
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
