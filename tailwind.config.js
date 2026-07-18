/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        panel: {
          DEFAULT: 'hsl(var(--panel))',
          muted: 'hsl(var(--panel-muted))',
        },
        overlay: 'hsl(var(--overlay))',
        'click-ring': 'hsl(var(--click-ring))',
        'editor-grid': 'hsl(var(--editor-grid))',
        'timeline-marker': 'hsl(var(--timeline-marker))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.6)', opacity: '0.9' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        'orb-drift': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(4%, 3%, 0) scale(1.06)' },
        },
        'orb-drift-slow': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(-3%, -4%, 0) scale(1.08)' },
        },
        'countdown-pop': {
          '0%': { opacity: '0', transform: 'scale(0.7)' },
          '40%': { opacity: '1', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out both',
        'fade-up': 'fade-up 0.65s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-ring': 'pulse-ring 0.55s ease-out',
        'orb-drift': 'orb-drift 14s ease-in-out infinite',
        'orb-drift-slow': 'orb-drift-slow 22s ease-in-out infinite',
        'countdown-pop': 'countdown-pop 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 2.8s linear infinite',
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
