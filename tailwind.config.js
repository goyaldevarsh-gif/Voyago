/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#102A43', 700: '#243B53', 500: '#486581' },
        teal: { DEFAULT: '#0D9488', 600: '#0B7F75', 50: '#E6F6F4' },
        mist: '#F4F8FA',
        slate2: '#627D98',
        ok: '#159C91',
        warn: '#E9A23B',
        danger: '#DC5A5A'
      },
      fontFamily: { sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(16,42,67,.06), 0 6px 20px rgba(16,42,67,.06)' },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem' }
    }
  },
  plugins: []
};
