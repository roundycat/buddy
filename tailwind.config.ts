import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/frontend/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-noto-sans-kr)",
          "var(--font-plus-jakarta)",
          "system-ui",
          "sans-serif",
        ],
        display: ["var(--font-plus-jakarta)", "var(--font-noto-sans-kr)", "sans-serif"],
      },
      colors: {
        bedi: {
          slate: "#334155",
          background: "#F8FAFC",
          card: "#FFFFFF",
          sage: "#94A37E",
          rose: "#C5A3A3",
          /** Parent experience — soft healthcare calm */
          softBlue: "#A8C5D4",
          softBlueDeep: "#6B93A8",
          cream: "#F7F3EA",
          creamDeep: "#EDE6D9",
          mist: "#E8F1F5",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "0 4px 24px -4px rgba(51, 65, 85, 0.08)",
        softer: "0 2px 12px -2px rgba(51, 65, 85, 0.06)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
