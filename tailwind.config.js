/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#070B0A',
          900: '#0B100E',
          850: '#0F1714',
          800: '#13201B',
          750: '#182721',
          700: '#1F332C',
          600: '#2A463D',
        },
        emerald: {
          300: '#6ee7b7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c1e',
        },
        mint: {
          300: '#86efac',
          400: '#4ade80',
          500: '#10b981',
          600: '#059669',
          glowing: '#00ffaa',
        },
        danger: {
          soft: '#381c1c',
          border: '#682929',
          text: '#f87171',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(16, 185, 129, 0.15)',
        'glow-md': '0 0 24px rgba(16, 185, 129, 0.22)',
        'glow-emerald': '0 0 20px -3px rgba(16, 185, 129, 0.25)',
        'glow-mint-sm': '0 0 8px 1px rgba(0, 255, 170, 0.4)',
        'glow-inner': 'inset 0 1px 0 rgba(16, 185, 129, 0.25)',
        'card-ambient': '0 10px 30px -10px rgba(0,0,0,0.6)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounceSubtle 3s ease-in-out infinite',
        'glow-pulse': 'glow 2.5s ease-in-out infinite alternate',
      },
      keyframes: {
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 10px rgba(16, 185, 129, 0.2), inset 0 0 8px rgba(16, 185, 129, 0.1)' },
          '100%': { boxShadow: '0 0 24px rgba(16, 185, 129, 0.45), inset 0 0 14px rgba(16, 185, 129, 0.25)' },
        },
      },
    },
  },
  plugins: [],
}
