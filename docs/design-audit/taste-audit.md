# SODAX Scan: taste audit (redesign-skill, audit phase only)

Date: 2026-11-24. Scope: look and feel only. No source touched. Inputs: SODAX-DESIGN-SYSTEM.md, code-map.md, 5 screenshots, explorer source.

## Brand-vs-taste-skill conflicts (brand wins)

- Taste-skill says "replace Inter, pick a font with character". Brand: Inter is the UI/stat font. Keep it. Craft comes from weights (Medium/Bold), `tabular-nums`, tracking, not a font swap.
- Taste-skill says "one accent, no purple/neon, no pure black". Brand already satisfies this (cherry + soda). Skip dark mode (Brand: warm, "never dark + neon"; `darkMode: 'false'` stays).
- Taste-skill suggests grain, glass, mesh. Allowed only where the brand has a pattern: quoted-callout frosted bar, soda-pop watermark on cherry hero. No new decorative systems.
- Taste-skill says "no pill badges". Brand mandates pill buttons and `borderRadius.small` tags. Status chips can stay pills but must use semantic tokens.
- Yellow is accent only over cherry, never a surface. Current `rollbacked` pill (`bg-soda-bright` on white table, lib/render.js:18) breaks this.
- Inria Serif is the display font for the page's single largest title; Shrikhand is one lowercase word. Explorer loads only Shrikhand and capitalises it ("Explore"), against "always lower case unless acronym".

## Verdict

Structurally clean and on-palette in the hero, but the body reads as a 2019 Tailwind admin template: a flat cherry slab with a white table dropped on it, stock green/blue/amber pills, loose text pagination, no numeral discipline, zero focus/hover craft, and a mobile table that simply clips. It is not "premium explorer" yet because hierarchy is flat (every row cell weighs the same), the main data (route, amount, status) is under-expressed, and states are missing. About 70% of the lift is token-level work, no redesign needed.

## Dated / generic signals found

1. Stock Tailwind status colors (`green-200/blue-200/amber-200/gray-200`, render.js:20-29) and ticker `green-500/red-500` (header.js:35): off-brand and the strongest "template" tell.
2. Uppercase `text-xs` pills on every row, fixed `w-24`; "SOLVER MARKETPLACE FILL" pill is louder than the data and sits in the wrong column (Serial No).
3. Raw identifiers shown as copy: `SolverMarketPlaceFill`, "1 minutes ago".
4. Numbers in proportional Inter; no `tabular-nums` anywhere (0 hits). Total count and time column jitter on refresh.
5. Hero: flat vertical gradient slab (`.hero`, globals.css:63) with a hard bottom edge cutting behind the table; no depth, no brand texture.
6. Table: `shadow-md sm:rounded-lg` on `bg-white` card with `table-cell` divs, 14px-tall rows with identical weight, no sticky header, no zebra/hover affordance beyond a barely visible `bg-almost-white`.
7. Pagination: bordered micro-buttons with `<`/`>` glyphs and a bare native select (pagination.js:31-60); no disabled state at page 1.
8. Filters: white text links with chevrons on cherry, no active-filter indication, no chips; overflow on mobile.
9. Zero `focus-visible` styles except the two inputs; no `active:` feedback; almost no `transition` (0 hits outside inputs).
10. Skeleton rows exist but do not match real row geometry; spinner leftovers; empty state is an unstyled absolute-positioned line (message-list.tsx:41); no error state.
11. Detail page: label/value two-column table with a grey header that says "MESSAGE DETAIL" and an empty right cell; hashes not copyable inline; no timeline hierarchy.
12. Header: yellow asterisk at far right has no function; ticker fades at edges; logo off-centre on mobile; ticker hidden <xl.
13. Leftover create-next-app CSS variables (globals.css:5-26), stray hex (`#A55C55` in `.hero`, intent-siblings.jsx:66-71), `bg-white` x25 outside the palette.

## Recommendations

### P0

**R1. Replace stock status colors with brand/semantic tokens** (lib/render.js:14-30, header.js:35).
Chip = `rounded` (`borderRadius.small` 8 / `xsmall` 4), `text-xs font-medium` sentence case (not uppercase), 6px leading dot. Mapping: executed = `success-base` bg / `success-dark` text / `success` dot; failed = `error-base` / `error-dark` / `error`; pending = `almost-white` / `clay-dark` / `clay-light` (animated pulse dot); delivered = `cream-white` / `espresso` / `cherry-soda` dot; attested = `light-cream` / `espresso` / `cherry-bright` dot; rollbacked = `error-lighter` / `error-dark` (never soda-bright on a light surface). Drop `w-24`. Ticker deltas: `text-success-dark` / `text-error` with a small triangle, `tabular-nums`.

**R2. Numerals: enable tabular figures globally for data.** Add utility `.num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "cv11" 1 }` and apply to total-messages stat (page.tsx:48), Created column, serial no, pagination, ticker prices, amounts in detail. Stat stays Inter Regular `yellow-soda` per brand; add `tracking-tight` (-0.02em) and `leading-[1.1]`.

**R3. Row anatomy and hierarchy** (message-list.tsx:25-36, render.js:37-42).
Collapse the Source/Destination/Action trio into one "route" cell: `[src icon] Bsc  →  [dst icon] Tron` in `text-sm font-medium text-espresso`, with a second line `text-xs text-clay` showing human action ("Solver fill") or truncated hash in mono. Serial No becomes `text-clay tabular-nums` (a dash for solver fills, no pill). Map `action_type` to a human label ("SolverMarketPlaceFill" to "Solver fill"). Status first column stays. Time: `text-clay-dark tabular-nums`, "1 minute ago" pluralised, full timestamp in `title`. Row height 52px, cell padding `px-4 py-3` (16/12), header `text-xs font-medium text-clay tracking-wide` (not uppercase bold).

**R4. Mobile: card rows below `md`** (message-list.tsx, filter row, header). Replace the clipped 6-column table with a 2-line card per row: line 1 route + status chip, line 2 time + hash. Rows separated by `border-cream-white` 1px, no cards-in-cards. Filter bar becomes a horizontally scrollable chip row (`overflow-x-auto snap-x`, 8px gap, 40px chips) with total count restored under the title (currently `hidden md:block`, page.tsx:46). Center logo or left-align consistently.

### P1

**R5. Table container and header craft.** Container: `bg-white rounded-regular(16) border border-cream-white` and a tinted shadow `0 1px 2px rgba(72,52,52,.06), 0 8px 24px -12px rgba(72,52,52,.18)` (espresso-based, not black); drop `shadow-md`. Sticky header: `sticky top-0 bg-almost-white/90 backdrop-blur border-b border-cream-white`. Row dividers `border-cream-white`; hover `bg-almost-white` with a 2px `cherry-soda` inset left bar (`shadow-[inset_2px_0_0_theme(colors.cherry.DEFAULT)]`); `transition-colors duration-150`.

**R6. Focus, hover, active states everywhere.** Global: `:focus-visible { outline: 2px solid #A55C55; outline-offset: 2px }` (on cherry hero use `white`). Buttons/pagination/filter chips: `transition duration-150 ease-out active:scale-[.98]`. Rows are links: add `focus-visible:bg-almost-white` + the same left bar. Tokens: use `cherry-hover`, `cherry-clicked` already in tailwind.config.

**R7. Pagination rebuilt as a quiet footer.** Left: "Rows" + custom-styled select (`rounded-small border-cream-white bg-white text-sm`). Centre/right: `1–20 of 1,125,174` in `text-clay tabular-nums`, then icon-only prev/next buttons 32px, `rounded-small`, `disabled:text-clay-light disabled:pointer-events-none`. Drop "First" on mobile. Border-top `cream-white`, bg `almost-white`.

**R8. Hero treatment.** Keep cherry (Brand: hero = `cherry-soda`). Add the brand's "soda pop watermark" radial SVG at 6-8% opacity right side, flipped vertically, behind the stat; fade the slab into the page with a 48px `to-almost-white` gradient or overlap the table by `-mt-6` so the card floats (depth through overlap). Title: Inria Serif (load via next/font) for "Explore Messages" display, Shrikhand lowercase single accent word "explore" in `yellow-soda`, remainder white, `tracking-tight leading-[1.1]`. Wrap with `text-wrap: balance`.

**R9. Filters as chips with active state** (message-filter.tsx:47-60). Each filter = 40px pill, `bg-cherry-on-cherry text-white` (Secondary button variant on cherry), chevron; when active show value + x in `yellow-soda` text. "Reset" becomes ghost text only when any filter is active. Dropdown panel: `rounded-regular bg-white border-cream-white`, items `text-sm`, selected `bg-almost-white` + check; fix `bg-soda-clicked` selected item (yellow as light-surface background, off-rule).

**R10. States: loading, empty, error.** Skeleton rows must use the same 52px geometry, `bg-cream-white` shimmer (`animate-pulse`, respect `prefers-reduced-motion`), not the current approximation. Empty: centered 160px block, small network-icon cluster, "No messages match these filters" + `Reset filters` secondary button (cherry-soda pill, white text). Error: inline `error-base` strip with `error-dark` text and Retry button; no raw failure text. Detail page "Related intent messages" empty copy: sentence case, `text-clay`.

### P2

**R11. Detail page.** Remove the empty-header-cell look: use a definition list in two columns with `text-xs text-clay` labels over `text-sm text-espresso` values (stacked on mobile), status chip in a header row beside the title. Hashes: `font-mono text-sm`, inline copy button (ghost icon, 24px) with 150ms "Copied" swap, middle-truncated with full value on hover/long-press. Timeline (mpc-timeline.js): vertical rail 2px `cream-white`, nodes 12px circles in semantic colors, current step with `yellow-dark` ring only on cherry surface (otherwise `cherry-soda`).

**R12. Header and ticker.** Remove or purpose the right-edge asterisk (brand mark used decoratively, no function). Ticker: pause on hover, `text-xs tabular-nums`, separate coins with 1px `cream-cherry` dividers, show on tablet too (`md:` not `xl:`). Search in header: `rounded-small` 40px, `border-cream-white`, `⌘K` hint chip `text-clay`.

**R13. Micro-interactions (transform/opacity only).** New rows from live polling slide in: `animate-[rowIn_240ms_ease-out]` (opacity 0 to 1, translateY(-4px) to 0), with a 1.2s `cherry-brighter`/10% background flash that fades. Stat counter: tween digits 300ms on change. Skip scroll/parallax effects (data tool; low value).

**R14. Housekeeping that affects polish.** Delete create-next-app vars and body gradient (globals.css:5-26, 40-43); replace `#A55C55/#964D48` literals with theme tokens (globals.css:66-67, intent-siblings.jsx:66-71); alt text on logos (header.js:13,33,48; footer.js:8); one title casing "SODAX Scan"; `text-wrap: pretty` on paragraphs; `min-h-[100dvh]` where 100vh used; replace remaining `bg-white` with `white` token alias and greys with `cream-white/cherry-grey`.

## Design-direction options

**A. "Warm ledger" (recommended).** Keep the cherry hero but lighten it: the table floats over it (overlap + tinted shadow), chips on `almost-white`, route-first rows, quiet cream dividers, tabular numerals. Feels like a premium fintech statement in brand colors. Lowest risk, mostly R1-R7, ships in small PRs.

**B. "Cherry console".** Treat the whole explorer as a cherry-surface product: cherry-dark page header band that stays sticky, filters and stats as cherry-on-cherry tiles, content in white cards with the brand's evaluation-grid/asset-stat-tile patterns, Shrikhand/Inria hero with soda-pop watermark. Bolder, more brand-forward and closer to sodax.com, but more layout change and yellow discipline needed (accent text only).
