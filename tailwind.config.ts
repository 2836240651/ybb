import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        foreground: "rgb(var(--color-base-text) / <alpha-value>)",
        background: "rgb(var(--color-base-background) / <alpha-value>)",
        highlight: "rgb(var(--color-base-highlight) / <alpha-value>)",
        button: {
          DEFAULT: "rgb(var(--color-base-button) / <alpha-value>)",
          foreground: "rgb(var(--color-base-button-text) / <alpha-value>)",
        },
        sale: {
          DEFAULT: "#D1BA98",
          foreground: "#171717",
        },
        rating: "#F59E0B",
        error: "#BE123C",
        border: "rgba(23,23,23,0.1)",
      },
      borderRadius: {
        button: "var(--rounded-button)",
        card: "var(--rounded-card)",
        input: "var(--rounded-input)",
        pill: "9999px",
      },
      maxWidth: {
        page: "var(--page-width)",
      },
      spacing: {
        topbar: "var(--topbar-height)",
        13: "3.25rem",
        14: "3.5rem",
        18: "4.5rem",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        nav: [
          "clamp(0.875rem,0.748rem+0.3174vw,1.125rem)",
          { lineHeight: "1.2", fontWeight: "500" },
        ],
        product: [
          "var(--font-product-size)",
          { lineHeight: "1.3", fontWeight: "500" },
        ],
        "title-md": [
          "var(--title-md)",
          { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "700" },
        ],
        "title-xl": [
          "var(--title-xl)",
          { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "700" },
        ],
      },
      transitionTimingFunction: {
        primary: "cubic-bezier(0.3, 1, 0.3, 1)",
        nav: "cubic-bezier(0.6, 0, 0.4, 1)",
        smooth: "cubic-bezier(0.7, 0, 0.3, 1)",
      },
    },
  },
};

export default config;
