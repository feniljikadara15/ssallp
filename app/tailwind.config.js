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
      fontFamily: { sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"] },
      fontSize: { xs: ["12.5px", "18px"], "2xs": ["11px", "15px"] },
      boxShadow: { card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.03)", lift: "0 8px 24px -6px rgba(16,24,40,0.12)" },
      borderRadius: { xl2: "10px" },
    },
  },
  plugins: [],
};
