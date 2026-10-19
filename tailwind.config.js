/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pulseBlue: '#0052FF',
        pulseDark: '#0F172A',
        riskRed: '#FEF2F2',
        riskRedBorder: '#FCA5A5',
      },
    },
  },
  plugins: [],
}