/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'false',
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
                // Cherry soda brand palette — primary CTA / brand moments
                cherry: {
                    DEFAULT: '#A55C55',
                    hover: '#964D48',
                    clicked: '#C36C65',
                    disabled: '#D7CDB5',
                    bright: '#CC9E9A',
                    brighter: '#E3BFBB'
                },
                // Yellow soda accent
                soda: {
                    DEFAULT: '#ECC100',
                    bright: '#FFDA2F',
                    clicked: '#F6E799'
                },
                // Light neutrals — backgrounds, surfaces
                'cream-cherry': '#E5D5D4',
                'cream-white': '#EDE7E7',
                'light-cream': '#F0EAEB',
                'almost-white': '#F8F3F3',
                'vibrant-white': '#F9F7F5',
                chalk: '#FBFBFB',
                // Dark neutrals — text, borders
                charcoal: '#1D1414',
                espresso: '#483434',
                'clay-dark': '#6B5C5B',
                clay: {
                    DEFAULT: '#8E7E7D',
                    light: '#B9ACAB'
                },
                'cherry-grey': '#D7CDCB',
                'brand-grey': '#DBD7D7',
                'light-grey': '#EDEBEB'
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
