/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0B0F14',
        surface: '#121826',
        elevated: '#161C24',
        overlay: '#1A2230',
        border: {
          subtle: 'rgba(255,255,255,0.06)',
          default: 'rgba(255,255,255,0.10)',
          active: 'rgba(6,182,212,0.50)',
        },
        accent: {
          cyan: '#06B6D4',
          bright: '#22D3EE',
          dim: 'rgba(6,182,212,0.15)',
        },
        status: {
          critical: '#EF4444',
          warning: '#F59E0B',
          ok: '#10B981',
          info: '#06B6D4',
        },
        text: {
          primary: '#F1F5F9',
          secondary: '#94A3B8',
          muted: '#475569',
          accent: '#22D3EE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      animation: {
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'node-pulse': 'node-pulse 2s ease-in-out infinite',
        'dash-flow': 'dash-flow 1.2s linear infinite',
        'agent-glow': 'agent-glow 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        'number-pop': 'number-pop 0.4s ease-out',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        'cursor-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        'node-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.6)', opacity: '0.3' },
        },
        'dash-flow': {
          to: { strokeDashoffset: '-24' },
        },
        'agent-glow': {
          '0%, 100%': { boxShadow: '0 0 16px rgba(6,182,212,0.3)' },
          '50%': { boxShadow: '0 0 36px rgba(6,182,212,0.7)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-16px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'number-pop': {
          '0%': { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 24px rgba(6,182,212,0.4)',
        'glow-red': '0 0 24px rgba(239,68,68,0.4)',
        'glow-amber': '0 0 24px rgba(245,158,11,0.4)',
        'glow-green': '0 0 24px rgba(16,185,129,0.4)',
        'inner-subtle': 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
