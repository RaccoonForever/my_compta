import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4f46e5', // indigo-600
          50: '#eef2ff',
          100: '#e0e7ff',
          600: '#4f46e5',
          700: '#4338ca',
        },
        accent: {
          DEFAULT: '#10b981', // emerald-500
          500: '#10b981',
        },
        income: '#10b981',  // green
        expense: '#ef4444', // red
        transfer: '#6366f1', // indigo/blue
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Text', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
