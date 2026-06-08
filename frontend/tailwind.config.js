/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        dark: {
          base: '#070a13',      // Sleeker darker base background
          surface: '#0b101f',   // Dark dashboard panels
          panel: '#151c30',     // Inner surfaces / cards
          border: '#1e294b',    // Slate blue borders
          muted: '#64748b',
        },
        brand: {
          primary: '#10b981',   // Emerald primary
          hover: '#059669',
          dark: '#064e3b',
          glow: 'rgba(16, 185, 129, 0.15)',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.8', transform: 'scale(1) translate(-50%, -50%)' },
          '50%': { opacity: '1', transform: 'scale(1.05) translate(-50%, -50%)' },
        }
      },
      boxShadow: {
        'premium': '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 50px -10px rgba(16, 185, 129, 0.05)',
        'premium-glow': '0 0 30px 0 rgba(16, 185, 129, 0.25)',
      }
    },
  },
  plugins: [],
}
