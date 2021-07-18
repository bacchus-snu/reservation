module.exports = {
  purge: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: false,
  theme: {
    extend: {
      gridTemplateColumns: {
        timetable: '6% repeat(7, 1px 1fr)',
      },
      gridTemplateRows: {
        timetable: 'minmax(3rem, max-content) repeat(30, 1.5rem)',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
