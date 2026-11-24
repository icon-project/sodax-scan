# Explorer styling code map (2026-11-24, read-only survey)

Stack: Next 13.2 app dir, Tailwind 3, Flowbite (only Dropdown in header.js and message-filter.tsx; rest hand-rolled).

## Tokens
- tailwind.config.js: `darkMode: 'false'` (invalid string; dark mode off). Fonts: sans = Inter (var --font-inter), display = Shrikhand (var --font-shrikhand), both via next/font/google in app/fonts.js.
- Colors: cherry #A55C55 (hover #964D48, clicked #C36C65, disabled #D7CDB5, bright #CC9E9A, brighter #E3BFBB); soda #ECC100 (bright #FFDA2F, clicked #F6E799); neutrals cream-cherry #E5D5D4, cream-white #EDE7E7, light-cream #F0EAEB, almost-white #F8F3F3, vibrant-white #F9F7F5, chalk #FBFBFB, charcoal #1D1414, espresso #483434, clay-dark #6B5C5B, clay #8E7E7D, clay-light #B9ACAB, cherry-grey #D7CDCB, brand-grey #DBD7D7, light-grey #EDEBEB.
- app/globals.css: leftover create-next-app vars (blue glow, tiles, callouts) mostly unused; `.hero` hard-codes #A55C55→#964D48; `.tx-hash`/[data-hash] mono.

## Inconsistencies
- Stock Tailwind colors off-brand: status pills in lib/render.js (green/blue/amber/gray-200), ticker green-500/red-500, searchbar gray-400..900.
- Greys split between stock gray-* and brand greys; 3 near-identical warm light bgs; bg-white x25 not in palette; hex in components/intent-siblings.jsx:66-71 inline.
- Shrikhand only in components/page-title.js (first word of h1, italic, soda-bright).

## Components
header.js (logo, CoinGecko price ticker hidden <xl, search, Flowbite network dropdown), footer.js, searchbar.js, message-filter.tsx, message-list.tsx (div table), lib/render.js (status pills, serial badges, network icon+hash), message-pagination.js / pagination.js, message-detail.js, mpc-timeline.js, intent-siblings.jsx, page-title.js, skeleton-table.js, spinner.js, tx-hash-link.js, admin/debug components. Layouts: app/(index)/layout.js renders cherry .hero strip.

## Responsive
Main switch is `xl:` (163 uses). Table keeps all columns on mobile with overflow-x-auto; no card collapse. Filters overflow on mobile (see screens/mobile-list.jpg).

## A11y / assets
Missing alt: header.js:13, :33, :48; footer.js:8 alt on <a>, SVG unlabeled. Network logos /public/images/network-*.png. Logos new_logo.svg, sodax_logo.svg.

## Leftovers
package name @xcallscan/explorer; footer links icon-project/xcallscan-v3; ICX/BNB placeholder tickers; many unused legacy images (xcall-logo, gmp-logo, icon-logo-light, blurred-ellipses, connected-protocols/*); inconsistent title casing (SODAXScan / Sodax Scan / SODAX Scan).

## Observed in browser
- Columns "Source/Destination tx hash" show only network names for solver fills; "Serial no" column shows a "SOLVER MARKETPLACE FILL" pill — semantic mismatch.
- Action shows raw "SolverMarketPlaceFill"; "1 minutes ago" grammar.
- Pagination = tiny text links; page-size select bare.
- Header yellow asterisk at right edge has unclear purpose; ticker fades at edges.
- Mobile: total count hidden, filter row overflows, table clipped, logo off-centre.
