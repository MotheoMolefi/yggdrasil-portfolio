/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'yggdrasil': {
          'dark': '#0a0e1a',
          'bark': '#3d2817',
          'leaf': '#4a7c59',
          'gold': '#d4af37',
          'rune': '#8b9dc3',
        }
      },
      fontFamily: {
        'norse': ['Cinzel', 'serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
