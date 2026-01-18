/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0b0d14',
        'dark-panel': '#11131a',
        'dark-border': '#1f2937',
      }
    },
  },
  plugins: [],
}

