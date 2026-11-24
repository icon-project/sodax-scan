// Content-sized cherry hero band. Sits directly under the header and bleeds to
// the viewport edges (cancels <main>'s horizontal padding). `HeroOverlap` wraps
// the card that floats over the band's lower edge: HERO_OVERLAP and the band's
// bottom padding are one pair, so every page overlaps by the same amount.
export function Hero({ children }) {
    return <div className="hero -mx-4 px-4 xl:-mx-24 xl:px-24 2xl:-mx-48 2xl:px-48 pb-14">{children}</div>
}

export function HeroOverlap({ children }) {
    return <div className="relative -mt-10">{children}</div>
}
