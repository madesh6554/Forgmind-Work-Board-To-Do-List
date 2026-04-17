/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "#0a0a0d",
          1: "#111116",
          2: "#1a1a22",
          3: "#22222c",
        },
        line: "#2a2a36",
        muted: "#9b9ba8",
        brand: {
          red: "#e10b1f",
          bright: "#ff2a3d",
          deep: "#8b0714",
          soft: "rgba(225, 11, 31, 0.15)",
        },
      },
      boxShadow: {
        brand: "0 10px 30px rgba(0, 0, 0, 0.55)",
        "brand-glow": "0 6px 18px rgba(225, 11, 31, 0.4)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease",
      },
      fontFamily: {
        sans: ["Segoe UI", "Roboto", "system-ui", "-apple-system", "sans-serif"],
        mono: ["Consolas", "Courier New", "monospace"],
      },
    },
  },
  plugins: [],
};
