/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        claude: {
          orange: '#D97757',
          dark: '#1A1A1A',
          sidebar: '#111111',
          panel: '#1C1C1E',
          border: '#2C2C2E',
          hover: '#2C2C2E',
          text: '#F5F5F5',
          muted: '#8E8E93',
          accent: '#D97757'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'monospace']
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'pulse-dot': 'pulseDot 1.5s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideIn: { '0%': { transform: 'translateX(-8px)', opacity: 0 }, '100%': { transform: 'translateX(0)', opacity: 1 } },
        pulseDot: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } }
      }
    }
  },
  plugins: []
}
