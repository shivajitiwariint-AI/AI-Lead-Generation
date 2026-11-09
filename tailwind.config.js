/** @type {import('tailwindcss').Config} */
const {
  green,
  blue,
  amber,
  purple,
  indigo,
  emerald,
  red,
  orange,
  gray,
} = require("tailwindcss/colors");

// Keep the full default palette but add a DEFAULT shade so bare color
// utilities used across the app (e.g. `text-green`, `bg-blue/10`) resolve.
const palette = (scale) => ({ ...scale, DEFAULT: scale[500] });

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        green: palette(green),
        blue: palette(blue),
        amber: palette(amber),
        purple: palette(purple),
        indigo: palette(indigo),
        emerald: palette(emerald),
        red: palette(red),
        orange: palette(orange),
        gray: palette(gray),
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(99,102,241,0.4)" },
          "50%": { boxShadow: "0 0 24px 4px rgba(99,102,241,0.25)" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "blink": {
          "0%, 50%": { opacity: "1" },
          "50.01%, 100%": { opacity: "0" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "scan": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        "drift": {
          "0%": { transform: "translate(0,0)" },
          "25%": { transform: "translate(10px,-15px)" },
          "50%": { transform: "translate(-8px,10px)" },
          "75%": { transform: "translate(12px,5px)" },
          "100%": { transform: "translate(0,0)" },
        },
        "flow": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "20%": { opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { transform: "translateX(100%)", opacity: "0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.6" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float": "float 6s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        "gradient-shift": "gradient-shift 8s ease infinite",
        "shimmer": "shimmer 3s linear infinite",
        "fade-up": "fade-up 0.6s ease-out both",
        "blink": "blink 1s steps(2) infinite",
        "spin-slow": "spin-slow 12s linear infinite",
        "scan": "scan 6s linear infinite",
        "drift": "drift 8s ease-in-out infinite",
        "flow": "flow 4s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.5s ease-out infinite",
      },
    },
  },
  plugins: [],
}

module.exports = config;
