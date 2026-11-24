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
                display: ['var(--font-shrikhand)', 'cursive']
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
                // Warm espresso-tinted card shadow (espresso #483434)
                card: '0 1px 2px rgba(72, 52, 52, 0.06), 0 4px 16px rgba(72, 52, 52, 0.08)'
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
