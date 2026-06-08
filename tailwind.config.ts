import type { Config } from "tailwindcss";

// Ruhige, vertrauenswürdige Palette: Weiß/Hellgrau, Dunkelblau/Anthrazit,
// eine warme Akzentfarbe für wichtige Fristen.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1f2933", // Anthrazit für Text
          soft: "#3e4c59",
        },
        navy: {
          DEFAULT: "#1e3a5f", // Dunkelblau, Hauptfarbe
          dark: "#15293f",
        },
        accent: {
          DEFAULT: "#c2410c", // warmer Akzent für wichtige Fristen
          soft: "#fff7ed",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f4f6f8", // Hellgrau für Flächen
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
