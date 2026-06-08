import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: '#C9A84C', light: '#F0DFA0', dark: '#9A7A30' },
      },
    },
  },
  plugins: [],
}
export default config
