module.exports = {
  purge: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: false,
  theme: {
    extend: {
      gridTemplateColumns: {
        timetable: '6% repeat(7, 1px 1fr)',
      },
      gridTemplateRows: {
        '31': 'repeat(31, 1fr)',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
