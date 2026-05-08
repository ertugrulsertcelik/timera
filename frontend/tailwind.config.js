/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
      },
      colors: {
        brand: {
          orange:  "#F4631E",
          red:     "#E8302A",
          amber:   "#F9A825",
          pink:    "#C2185B",
          purple:  "#7B1FA2",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        modal: "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)",
        popover: "0 10px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};
