/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'medical-primary': '#2563eb',
        'medical-secondary': '#1d4ed8',
        'medical-accent': '#3b82f6',
        'medical-light': '#dbeafe',
        'medical-gray': '#f8fafc',
      },
    },
  },
  plugins: [],
}

