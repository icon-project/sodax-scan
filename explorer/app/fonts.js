import { Inter, Shrikhand } from 'next/font/google'

// Brand body/UI typeface. Exposed as a CSS variable so Tailwind's
// `font-sans` (see tailwind.config.js) resolves to it everywhere.
export const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter'
})

// Brand accent display face — used for the single Shrikhand accent word in a
// headline (see `font-display` in tailwind.config.js). Single weight (400).
export const shrikhand = Shrikhand({
    weight: '400',
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-shrikhand'
})
