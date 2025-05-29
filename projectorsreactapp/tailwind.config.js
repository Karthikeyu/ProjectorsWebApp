/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // Points to your main HTML file
    "./src/**/*.{js,ts,jsx,tsx}", // Scans all relevant files in your src folder
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'], // This is for the Inter font used in the code
      },
    },
  },
  plugins: [],
}