import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        inest: {
          black: '#050505',
          purple: '#7B2CFF',
          blue: '#5F7CFF',
          ice: '#F5F7FA',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Arial', 'sans-serif'],
        display: ['var(--font-montserrat)', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
