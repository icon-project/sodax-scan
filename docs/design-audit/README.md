# SODAX Scan design audit (2026-11-24)

Sources: [impeccable-audit.md](impeccable-audit.md), [taste-audit.md](taste-audit.md), [code-map.md](code-map.md), screenshots in `screens/`.
The target is the SODAX design system from the Marketing MCP: [../design-system/SODAX-DESIGN-SYSTEM.md](../design-system/SODAX-DESIGN-SYSTEM.md).

## Verdict
The brand skeleton is right: cherry hero, cream neutrals, Inter, a yellow accent word. Everything that holds data is still a stock Tailwind/Flowbite admin template: off-brand status colors, no tabular numerals, flat rows, no focus or hover craft, and a broken mobile layout. Impeccable scores it 10/20. All of it is styling work; it doesn't need a redesign.

## Where the two audits agree (P0)
1. **Status pills are off-brand.** Executed, delivered and attested use stock green, blue and amber; failed is solid cherry; rollbacked is yellow, which brand rules ban as a surface. Move them to the `success-*` / `error-*` / neutral tokens, in sentence case with a status dot (`lib/render.js:14-30`).
2. **Mobile is broken.** The filter row overflows, the table clips at 6 columns, cells wrap to 3 lines, and the total count disappears. Fix with card rows on small screens, a scrolling filter strip and the total restored (`message-list.tsx`, `message-filter.tsx:46`, `page.tsx:46`).
3. **Columns don't match their contents.** The "Source/Destination Tx Hash" columns show chain names for solver fills, "Serial No" shows a SOLVER MARKETPLACE FILL pill, and Action shows raw `SolverMarketPlaceFill`. Fix with From → To route cells, a Type column, human labels, and "1 minute" instead of "1 minutes". *These are small copy and render changes, not pure CSS.*
4. **No tabular numerals.** The total, times, serials, pagination and ticker all jitter.

## P1
- **Typography:** Inria Serif (the display face) isn't loaded. Shrikhand is used on long words ("Explore", "Message"), which breaks the rule that it goes on one short word, in lowercase (`page-title.js`).
- **Tokens:** rename to the design-system ids (`cherry-soda`, `yellow-dark`…) and add the radius scale (cards `regular` = 16px), the semantic scales and an espresso-tinted shadow. Remove hardcoded hex, `bg-white`, stock `gray-*` and the leftover create-next-app CSS variables.
- **Hero:** a fixed `h-72` slab; the table and card straddle its edge (`layout.js:46`).
- **Accessibility and states:** missing alt text (`header.js:13,33,48`, `footer.js:8`), no `:focus-visible`, `clay` on white is about 4.0:1, the ticker has no reduced-motion guard, and loading/empty/error states are weak.
- **Pagination and filters:** tiny text links; filters have no active state.

## P2
Detail page grouping and hash copy, header/ticker cleanup, row-in motion, xcallscan leftovers (package name, footer GitHub link, ICX placeholders, unused legacy images, title casing).

## Brand overrides taste-skill defaults
No dark mode, no font swap away from Inter for the UI, and yellow stays accent-only.

## Proposed packages (each fits one sitting)
| | Package | Contents | Risk |
|---|---|---|---|
| A | Tokens and status | design-system token names in Tailwind, semantic scales, radius/shadow, new pills, tabular nums, CSS cleanup | low |
| B | Mobile | card rows, scrolling filter strip, mobile total, 44px touch targets | low–med |
| C | Table, hero and type | Inria Serif headline + short Shrikhand word, content-sized hero, From/To/Type columns, row hover, filter chips, search focus | med |
| D | Detail, pagination, a11y | grouped detail card, one pagination component, alt/focus/reduced-motion, xcallscan leftovers | low |

Direction: **"Warm ledger"**, recommended by taste-skill and consistent with impeccable: a floating table over a lighter cherry hero, cream dividers and route-first rows. The alternative is the "cherry console" (whole product on cherry surfaces), which is more brand-forward but means more layout change.
