/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './node_modules/flowbite-react/**/*.js',
        './app/**/*.{js,ts,jsx,tsx}',
        './pages/**/*.{js,ts,jsx,tsx}',
        './components/**/*.{js,ts,jsx,tsx}',
        './lib/**/*.{js,ts,jsx,tsx}',

        // Or if using `src` directory:
        './src/**/*.{js,ts,jsx,tsx}'
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                display: ['var(--font-shrikhand)', 'cursive'],
                'serif-heading': ['var(--font-inria-serif)', 'Georgia', 'serif']
            },
            colors: {
                // ---- Design-system tokens (source: docs/design-system/sodax-design-tokens.json) ----
                // Primary: cherry soda
                'cherry-soda': '#A55C55',
                'cherry-dark': '#964D48',
                'cherry-on-cherry': '#C36C65',
                'cherry-plus': '#AD635C',
                'cherry-bright': '#CC9E9A',
                'cherry-brighter': '#E3BEBB',
                // Secondary: yellow soda (accent only, over cherry; never a surface)
                'yellow-dark': '#ECC100',
                'yellow-soda': '#FFD92F',
                'soda-on-soda': '#F6E799',
                // Light neutrals
                'cream-cherry': '#E5D5D4',
                'cream-white': '#EDE6E6',
                'light-cream': '#F0EAEB',
                'almost-white': '#F8F3F3',
                'vibrant-white': '#F9F7F5',
                chalk: '#FBFBFB',
                // Dark neutrals
                charcoal: '#1D1414',
                espresso: '#483434',
                'clay-dark': '#6B5C5B',
                clay: {
                    DEFAULT: '#8E7E7D',
                    light: '#B9ACAB'
                },
                'cherry-grey': '#D7CDCB',
                // Semantic: error
                error: {
                    base: '#FAECEC',
                    lighter: '#F5DBDB',
                    light: '#D8696C',
                    DEFAULT: '#CE4446',
                    dark: '#A73639'
                },
                // Semantic: success
                success: {
                    base: '#E6F8EC',
                    lighter: '#CEF0DC',
                    light: '#6DD696',
                    DEFAULT: '#0ABA51',
                    dark: '#089541'
                },

                // ---- Semantic theme tokens (values live in app/globals.css: :root = light, .dark = dark) ----
                surface: 'rgb(var(--surface) / <alpha-value>)',
                header: 'rgb(var(--header) / <alpha-value>)',
                raised: 'rgb(var(--raised) / <alpha-value>)',
                sunken: 'rgb(var(--sunken) / <alpha-value>)',
                subtle: 'rgb(var(--subtle) / <alpha-value>)',
                hover: 'rgb(var(--hover) / <alpha-value>)',
                selected: 'rgb(var(--selected) / <alpha-value>)',
                line: 'rgb(var(--line) / <alpha-value>)',
                'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
                fg: 'rgb(var(--fg) / <alpha-value>)',
                'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
                'fg-subtle': 'rgb(var(--fg-subtle) / <alpha-value>)',
                accent: 'rgb(var(--accent) / <alpha-value>)',
                focus: 'rgb(var(--focus) / <alpha-value>)',
                tint: 'rgb(var(--tint) / <alpha-value>)',
                skeleton: 'rgb(var(--skeleton) / <alpha-value>)',
                footer: 'rgb(var(--footer) / <alpha-value>)',
                'trend-up': 'rgb(var(--trend-up) / <alpha-value>)',
                'trend-down': 'rgb(var(--trend-down) / <alpha-value>)',
                'picker-track': 'rgb(var(--picker-track) / <alpha-value>)',
                'picker-track-border': 'rgb(var(--picker-track-border) / <alpha-value>)',
                'picker-thumb': 'rgb(var(--picker-thumb) / <alpha-value>)',
                'picker-icon': 'rgb(var(--picker-icon) / <alpha-value>)',
                'picker-icon-active': 'rgb(var(--picker-icon-active) / <alpha-value>)',
                'picker-icon-hover': 'rgb(var(--picker-icon-hover) / <alpha-value>)',
                'st-executed': 'rgb(var(--st-executed) / <alpha-value>)',
                'st-executed-fg': 'rgb(var(--st-executed-fg) / <alpha-value>)',
                'st-executed-dot': 'rgb(var(--st-executed-dot) / <alpha-value>)',
                'st-failed': 'rgb(var(--st-failed) / <alpha-value>)',
                'st-failed-fg': 'rgb(var(--st-failed-fg) / <alpha-value>)',
                'st-failed-dot': 'rgb(var(--st-failed-dot) / <alpha-value>)',
                'st-rollbacked': 'rgb(var(--st-rollbacked) / <alpha-value>)',
                'st-rollbacked-fg': 'rgb(var(--st-rollbacked-fg) / <alpha-value>)',
                'st-rollbacked-dot': 'rgb(var(--st-rollbacked-dot) / <alpha-value>)',
                'st-delivered': 'rgb(var(--st-delivered) / <alpha-value>)',
                'st-delivered-fg': 'rgb(var(--st-delivered-fg) / <alpha-value>)',
                'st-delivered-dot': 'rgb(var(--st-delivered-dot) / <alpha-value>)',
                'st-attested': 'rgb(var(--st-attested) / <alpha-value>)',
                'st-attested-fg': 'rgb(var(--st-attested-fg) / <alpha-value>)',
                'st-attested-dot': 'rgb(var(--st-attested-dot) / <alpha-value>)',
                'st-fallback': 'rgb(var(--st-fallback) / <alpha-value>)',
                'st-fallback-fg': 'rgb(var(--st-fallback-fg) / <alpha-value>)',
                'st-fallback-dot': 'rgb(var(--st-fallback-dot) / <alpha-value>)',
                'st-pending': 'rgb(var(--st-pending) / <alpha-value>)',
                'st-pending-fg': 'rgb(var(--st-pending-fg) / <alpha-value>)',
                'st-pending-border': 'rgb(var(--st-pending-border) / <alpha-value>)',

                // ---- DEPRECATED aliases: kept so existing classes keep working. ----
                // Migrate to the design-system ids above, then delete.
                cherry: {
                    DEFAULT: '#A55C55', // -> cherry-soda
                    hover: '#964D48', // -> cherry-dark
                    clicked: '#C36C65', // -> cherry-on-cherry
                    disabled: '#D7CDCB', // -> cherry-grey (design system value)
                    bright: '#CC9E9A', // -> cherry-bright
                    brighter: '#E3BEBB' // -> cherry-brighter
                },
                soda: {
                    DEFAULT: '#ECC100', // -> yellow-dark
                    bright: '#FFD92F', // -> yellow-soda
                    clicked: '#F6E799' // -> soda-on-soda
                },
                'brand-grey': '#DBD7D7', // legacy, not in design system
                'light-grey': '#EDEBEB' // legacy, not in design system
            },
            // Design-system radius scale (Figma names). Pill shapes use rounded-full.
            borderRadius: {
                micro: '2px',
                xsmall: '4px',
                small: '8px',
                medium: '12px',
                regular: '16px',
                large: '24px',
                xlarge: '32px'
            },
            boxShadow: {
                // Themed: warm espresso-tinted drop shadow in light, 1px hairline ring in dark (see globals.css)
                card: 'var(--shadow-card)',
                overlay: 'var(--shadow-overlay)'
            },
            animation: {
                'infinite-scroll': 'infinite-scroll 25s linear infinite'
            },
            keyframes: {
                'infinite-scroll': {
                    from: { transform: 'translateX(0)' },
                    to: { transform: 'translateX(-100%)' }
                }
            },
            screens: {
                '3xl': '1920px'
            }
        }
    },
    plugins: [require('flowbite/plugin')]
}
