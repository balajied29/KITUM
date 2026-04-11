/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary:         '#0047AB',
        'primary-hover': '#003a8c',
        accent:          '#0ea5e9',
        'text-main':     '#0f172a',
        'text-muted':    '#64748b',
        'bg-card':       '#f8fafc',
        'border-default':'#e2e8f0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        '700': '700',
      },
      borderRadius: {
        card:  '16px',
        btn:   '12px',
        input: '8px',
        chip:  '999px',
      },
    },
  },
  plugins: [],
};
