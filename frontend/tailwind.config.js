module.exports = {
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      gridTemplateColumns: {
        timetable: '6% repeat(7, 1px 1fr)',
      },
      gridTemplateRows: {
        timetable: 'max-content repeat(30, 1.5rem)',
      },
    },
  },
  plugins: [],
}
