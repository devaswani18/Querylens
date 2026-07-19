/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ---------------------------------------------------------------------------
      // Custom color tokens
      // Added with extend so all default Tailwind colors (slate, indigo, etc.)
      // remain available — existing className usage is unaffected.
      // ---------------------------------------------------------------------------
      colors: {
        void:   '#0A0E14',  // deepest background
        ink:    '#141B24',  // elevated surface (panels, cards)
        steel:  '#232C38',  // borders, dividers
        fog:    '#8B94A3',  // muted text, labels
        signal: '#F2A93B',  // warning / highlight accent
        alert:  '#F0554D',  // error / danger
        pulse:  '#22D3AA',  // success / performance improvement
      },

      // ---------------------------------------------------------------------------
      // Custom font families
      // JetBrains Mono for code/SQL, Inter for UI prose.
      // Load both via index.html <link> or a @font-face in index.css.
      // ---------------------------------------------------------------------------
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
