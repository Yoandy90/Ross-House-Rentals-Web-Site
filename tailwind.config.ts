import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ED1B33',
          dark: '#C41428',
          light: '#FF3D52',
        },
        charcoal: '#231F20',
        secondary: '#231F20',
        accent: '#ED1B33',
        warm: '#FFF5F5',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
