/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        surface: "#1A1A1A",
        border: "#262626",
        primary: "#3DFF6B",
        accent: "#A855F7",
        muted: "#8F8F8F",
      },
      fontFamily: {
        teko: ["Teko", "sans-serif"],
        urbanist: ["Urbanist", "sans-serif"],
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        draw: {
          to: { strokeDashoffset: "0" },
        },
        grow: {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        acceptPulse: {
          "0%": { transform: "scale(1)", borderColor: "#3DFF6B", backgroundColor: "rgba(61, 255, 107, 0.1)" },
          "50%": { transform: "scale(1.02)", borderColor: "#3DFF6B", backgroundColor: "rgba(61, 255, 107, 0.2)" },
          "100%": { transform: "scale(1)", borderColor: "#262626", backgroundColor: "transparent" },
        },
        dismissFade: {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(0.95)", height: "0px", margin: "0", padding: "0" },
        }
      },
      animation: {
        rise: "rise 0.4s ease-out forwards",
        draw: "draw 1.2s ease-out forwards 0.2s",
        grow: "grow 1s ease-out forwards",
        acceptPulse: "acceptPulse 0.3s ease-out forwards",
        dismissFade: "dismissFade 0.25s ease-out forwards",
      },
    },
  },
  plugins: [],
};
