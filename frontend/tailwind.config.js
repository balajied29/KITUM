/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary:         '#0037b0',
        'primary-hover': '#002d8c',
        accent:          '#0ea5e9',
        'text-main':     '#131b2e',
        'text-muted':    '#64748b',
        'text-body':     '#434655',
        'bg-page':       '#faf8ff',
        'bg-card':       '#f2f3ff',
        'bg-trust':      '#eff6ff',
        'border-default':'#e2e8f0',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
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
