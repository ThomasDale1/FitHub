/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ─── Colores de Fit Hub ───────────────────
        primary: {
          DEFAULT: "#6C63FF",
          dark: "#5A52E0",
          light: "#8B85FF",
        },
        background: {
          DEFAULT: "#0F0F1A",
          card: "#1A1A2E",
          elevated: "#252540",
        },
        success: "#00D48A",
        streak: "#FF6B35",
        text: {
          primary: "#FFFFFF",
          secondary: "#A0A0B0",
          muted: "#6B6B80",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-font"],
      },
    },
  },
  plugins: [],
};