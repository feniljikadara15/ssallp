/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#f26222", 50: "#fef3ec", 100: "#fde3d3", 600: "#d9531a", 700: "#b44414" },
        secondary: { DEFAULT: "#292f45", 600: "#1f2436", 400: "#3a4260" },
        success: "#306b34",
        danger: "#590004",
        warning: "#cd6f00",
        info: "#33658a",
      },
      fontFamily: { sans: ["Roboto", "system-ui", "sans-serif"] },
      borderRadius: { xl2: "16px" },
    },
  },
  plugins: [],
};
