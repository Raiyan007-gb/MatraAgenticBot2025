// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)", // Keep if you use these vars elsewhere
        foreground: "var(--foreground)", // Keep if you use these vars elsewhere
        'accent-gold': '#CAA72F', //  <-- ADD THIS LINE (adjust hex if needed)
      },
       // Keep custom min/max heights if you added them before
      minHeight: {
        '[60px]': '60px',
      },
      maxHeight: {
        '[200px]': '200px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    //require('@tailwindcss/scrollbar'),
  ],
};
export default config;