import Image from 'next/image'

// Network / coin icon on a round disc. In light the disc and ring are transparent
// (no visible change). In dark the disc is cream-white, so black-on-transparent
// glyphs (hedera, xrp, tron ...) stay visible, and a faint 1px ring defines the
// edge of near-black full-bleed icons (solana, stellar, kaia). Icons are never
// inverted or filtered (brand marks stay untouched). `disc={false}` keeps only the
// ring (ticker coins: arbitrary, mostly coloured images). See docs/design-audit/dark-mode-spec.md 2.9.
export default function NetworkIcon({ src, alt = '', size = 24, className = '', disc = true }) {
    const local = typeof src === 'string' && src.startsWith('/')
    return (
        <span className={`net-icon${disc ? '' : ' net-icon-nodisc'} ${className}`} style={{ width: size, height: size }}>
            {/* Local network icons are tiny static files: serve them as-is and load them
                eagerly. Lazy loading inside the closed filter dropdowns left empty discs
                until the menu was opened and the icon scrolled into view. */}
            <Image
                alt={alt}
                src={src}
                width={size}
                height={size}
                unoptimized={local}
                loading={local ? 'eager' : undefined}
            />
        </span>
    )
}
