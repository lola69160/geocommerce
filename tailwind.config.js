/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* ----------------------------------------
         FONT FAMILIES
         ---------------------------------------- */
      fontFamily: {
        display: ['Sora', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        body: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },

      /* ----------------------------------------
         COLORS - Gojiberry Light Mode + Dark Mode
         ---------------------------------------- */
      colors: {
        // Surfaces (Light Mode - Gojiberry)
        surface: {
          50: '#fefefe',
          100: '#faf8f5',
          200: '#f5f3f0',
          300: '#f0ede8',
          400: '#e8e4df',
          500: '#d4d0ca',
          600: '#b8b4ae',
        },
        // Primary (Coral/Orange - Gojiberry)
        primary: {
          50: '#fff5f0',
          100: '#ffe8db',
          200: '#ffd1b8',
          300: '#ffb494',
          400: '#ff8a66',
          500: '#FF6B4A',
          600: '#FF5733',
          700: '#e64920',
          800: '#cc3d1a',
          900: '#b33315',
        },
        // Text colors
        text: {
          primary: '#1f2937',
          secondary: '#374151',
          tertiary: '#6b7280',
          disabled: '#9ca3af',
          inverse: '#ffffff',
        },
        // Accent Colors (Pastel - Gojiberry)
        'accent-cyan': {
          50: '#f0fdff',
          100: '#e0fafe',
          200: '#baf5fc',
          300: '#67e8f9',
          400: '#22d3ee',
        },
        'accent-yellow': {
          50: '#fffef0',
          100: '#fefce8',
          200: '#fef9c3',
          300: '#fde68a',
          400: '#fcd34d',
        },
        'accent-violet': {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#c4b5fd',
          400: '#a78bfa',
        },
        'accent-pink': {
          50: '#fef5fa',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
        },
        // Semantic Colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },

      /* ----------------------------------------
         BOX SHADOW
         ---------------------------------------- */
      boxShadow: {
        'glow-sm': '0 0 10px rgba(0, 212, 255, 0.2)',
        'glow-md': '0 0 20px rgba(0, 212, 255, 0.3)',
        'glow-lg': '0 0 40px rgba(0, 212, 255, 0.4)',
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.35)',
        'glow-violet': '0 0 20px rgba(168, 85, 247, 0.35)',
        'glow-success': '0 0 15px rgba(16, 185, 129, 0.3)',
        'glow-danger': '0 0 15px rgba(239, 68, 68, 0.3)',
      },

      /* ----------------------------------------
         BORDER RADIUS
         ---------------------------------------- */
      borderRadius: {
        'none': '0',
        'sm': '0.25rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem',
        'full': '9999px',
      },

      /* ----------------------------------------
         SPACING
         ---------------------------------------- */
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '88': '22rem',
        '100': '25rem',
        '104': '26rem',
        '108': '27rem',
        '112': '28rem',
        '116': '29rem',
        '120': '30rem',
      },

      /* ----------------------------------------
         WIDTH
         ---------------------------------------- */
      width: {
        'sidebar': '420px',
        'sidebar-collapsed': '60px',
        'modal-sm': '400px',
        'modal-md': '560px',
        'modal-lg': '720px',
        'modal-xl': '900px',
      },

      /* ----------------------------------------
         MAX WIDTH
         ---------------------------------------- */
      maxWidth: {
        'modal-sm': '400px',
        'modal-md': '560px',
        'modal-lg': '720px',
        'modal-xl': '900px',
        'modal-full': '95vw',
      },

      /* ----------------------------------------
         Z-INDEX
         ---------------------------------------- */
      zIndex: {
        'base': '0',
        'elevated': '10',
        'dropdown': '100',
        'sticky': '200',
        'fixed': '300',
        'overlay': '400',
        'modal': '500',
        'popover': '600',
        'tooltip': '700',
        'toast': '800',
        'max': '9999',
      },

      /* ----------------------------------------
         ANIMATIONS
         ---------------------------------------- */
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'fade-out': 'fadeOut 0.25s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.25s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.25s ease-out forwards',
        'fade-in-left': 'fadeInLeft 0.25s ease-out forwards',
        'fade-in-right': 'fadeInRight 0.25s ease-out forwards',
        'scale-in': 'scaleIn 0.15s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'scale-out': 'scaleOut 0.15s ease-out forwards',
        'pop-in': 'popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'bounce-in': 'bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-in-left': 'slideInLeft 0.25s ease-out forwards',
        'slide-out-left': 'slideOutLeft 0.25s ease-out forwards',
        'slide-in-right': 'slideInRight 0.25s ease-out forwards',
        'slide-out-right': 'slideOutRight 0.25s ease-out forwards',
        'slide-in-up': 'slideInUp 0.25s ease-out forwards',
        'slide-in-down': 'slideInDown 0.25s ease-out forwards',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'glow-pulse-cyan': 'glowPulseCyan 2s ease-in-out infinite',
        'glow-pulse-violet': 'glowPulseViolet 2s ease-in-out infinite',
        'border-glow': 'borderGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
      },

      /* ----------------------------------------
         KEYFRAMES
         ---------------------------------------- */
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          from: { opacity: '0', transform: 'translateY(-20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInLeft: {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        fadeInRight: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.95)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '70%': { transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutLeft: {
          from: { transform: 'translateX(0)', opacity: '1' },
          to: { transform: 'translateX(-100%)', opacity: '0' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          from: { transform: 'translateX(0)', opacity: '1' },
          to: { transform: 'translateX(100%)', opacity: '0' },
        },
        slideInUp: {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        slideInDown: {
          from: { transform: 'translateY(-100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 212, 255, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 212, 255, 0.4)' },
        },
        glowPulseCyan: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 212, 255, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 212, 255, 0.5)' },
        },
        glowPulseViolet: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(168, 85, 247, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(168, 85, 247, 0.5)' },
        },
        borderGlow: {
          '0%, 100%': { borderColor: 'rgba(0, 212, 255, 0.3)' },
          '50%': { borderColor: 'rgba(0, 212, 255, 0.7)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        },
      },

      /* ----------------------------------------
         TRANSITION
         ---------------------------------------- */
      transitionDuration: {
        'instant': '75ms',
        'fast': '150ms',
        'normal': '250ms',
        'slow': '400ms',
        'slower': '600ms',
      },

      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },

      /* ----------------------------------------
         BACKDROP BLUR
         ---------------------------------------- */
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
      },

      /* ----------------------------------------
         BACKGROUND IMAGE (Gradients)
         ---------------------------------------- */
      backgroundImage: {
        // Gradients removed - using Gojiberry light mode only
      },
    },
  },
  plugins: [],
}
