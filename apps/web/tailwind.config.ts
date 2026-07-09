import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './features/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        inest: {
          blue: '#5F7CFF',
          purple: '#7B2CFF',
          green: '#0EA371',
          bg: '#F4F7FB',
          surface: '#FFFFFF',
          soft: '#EDF1F7',
          line: '#DCE3EF',
          muted: '#667085',
          text: '#101828',
          dark: '#111318',
        },
      },
      borderRadius: {
        panel: '16px',
      },
      fontFamily: {
        sans: ['Inter', 'Montserrat', 'Arial', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 24px 60px rgba(25, 33, 52, 0.10)',
        soft: '0 12px 28px rgba(95, 124, 255, 0.22)',
      },
    },
  },
  plugins: [],
};

export default config;
