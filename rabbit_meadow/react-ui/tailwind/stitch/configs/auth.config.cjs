module.exports = {
  content: ['./public/stitch/login.html', './public/stitch/signup.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#3fa8d1',
        secondary: '#f97316',
        background: '#f4fbff',
        surface: '#ffffff',
        ink: '#14324a',
        muted: '#59748a',
      },
      fontFamily: {
        headline: ['Tajawal', 'sans-serif'],
        body: ['Almarai', 'sans-serif'],
      },
      boxShadow: {
        card: '0 20px 50px rgba(20, 50, 74, 0.12)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};
