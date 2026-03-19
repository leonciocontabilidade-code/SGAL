/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          gold:    "#C6B185",
          dark:    "#08332C",
          cream:   "#EADAB8",
          teal:    "#0C483E",
          darkest: "#052B25",
        },
      },
    },
  },
  plugins: [],
};
