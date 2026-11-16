/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#F32735',
          dark: '#D11F2C',
          light: '#FEE9EA',
        },
      },
    },
  },
  plugins: [],
}
