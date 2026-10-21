/** @type {import('tailwindcss').Config} */
// Design tokens. One place for every colour, shadow and radius; components use the
// classes in src/index.css built from these. Values with a reason carry it inline.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand orange split by job: `brand` is for text and filled buttons (white on it is 4.7:1),
        // `brand-fill` for bars, dots and the logo tile, where no text sits on it.
        brand: { DEFAULT: "#c94a12", dark: "#b44414", soft: "#fef3ec", line: "#fbd5bf", fill: "#f26222", light: "#f7a77c" /* on navy only: 6.2:1 */ },
        // Sidebar navy
        navy: { DEFAULT: "#292f45", dark: "#1f2436", light: "#3a4260" },
        // Neutrals by job (not a numeric ramp). Canvas is a cool grey, not a tinted brand wash.
        canvas: "#f5f6f8",
        surface: { DEFAULT: "#ffffff", alt: "#f9fafb" },
        line: { DEFAULT: "#e7e9ee", strong: "#d5d9e0", hover: "#9ca3af" },
        ink: "#111827",
        muted: "#4b5563", // secondary text, 7.5:1 on white
        faint: "#6b7280", // quietest legible text, 4.8:1 on white and surface-alt
        hover: "#f3f4f6",
        track: "#eef0f3",
        // Status: text tone (read), fill tone (dots, bars), soft ground, line.
        success: { DEFAULT: "#047857", fill: "#10b981", soft: "#ecfdf5", line: "#a7f3d0" },
        warning: { DEFAULT: "#92400e", fill: "#f59e0b", soft: "#fffbeb", line: "#fde68a" },
        danger: { DEFAULT: "#b91c1c", fill: "#ef4444", soft: "#fef2f2", line: "#fecaca" },
        info: { DEFAULT: "#0369a1", fill: "#0ea5e9", soft: "#f0f9ff", line: "#bae6fd" },
        // Legacy names still used by a few screens; same values as above.
        primary: { DEFAULT: "#f26222", 50: "#fef3ec", 100: "#fde3d3", 600: "#d9531a", 700: "#b44414" },
        secondary: { DEFAULT: "#292f45", 600: "#1f2436", 400: "#3a4260" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"] },
      fontSize: { xs: ["12.5px", "18px"], "2xs": ["11px", "15px"] },
      // Three elevations only: soft, layered, never a glow.
      boxShadow: {
        card: "0 1px 2px rgb(16 24 40 / 0.04), 0 1px 1px rgb(16 24 40 / 0.02)",
        pop: "0 12px 24px -6px rgb(16 24 40 / 0.14), 0 4px 8px -4px rgb(16 24 40 / 0.08)",
        dialog: "0 24px 48px -12px rgb(16 24 40 / 0.22), 0 8px 16px -8px rgb(16 24 40 / 0.10)",
        lift: "0 12px 24px -6px rgb(16 24 40 / 0.14), 0 4px 8px -4px rgb(16 24 40 / 0.08)",
      },
      borderRadius: { xl2: "12px" },
    },
  },
  plugins: [],
};
