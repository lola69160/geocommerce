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
         COLORS - Tech Premium Dark Mode
         ---------------------------------------- */
      colors: {
        // Surfaces
        surface: {
          950: '#050508',
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a24',
          600: '#24242e',
          500: '#2e2e3a',
          400: '#3a3a48',
        },
        // Accent Cyan
        cyan: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#00d4ff',
          600: '#0891b2',
          700: '#0e7490',
        },
        // Accent Violet
        violet: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed',
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
        'dark-sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
        'dark-md': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
        'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
        'dark-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
        'dark-2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
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
        'gradient-dark': 'linear-gradient(180deg, #0a0a0f 0%, #050508 100%)',
        'gradient-card': 'linear-gradient(135deg, #12121a 0%, #0a0a0f 100%)',
        'gradient-accent': 'linear-gradient(135deg, #00d4ff 0%, #a855f7 100%)',
        'gradient-accent-dim': 'linear-gradient(135deg, rgba(0, 212, 255, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%)',
        'gradient-mesh': 'radial-gradient(at 40% 20%, rgba(0, 212, 255, 0.12) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(168, 85, 247, 0.12) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(0, 212, 255, 0.12) 0px, transparent 50%)',
      },
    },
  },
  plugins: [],
}
