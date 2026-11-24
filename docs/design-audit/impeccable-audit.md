# SODAX Scan explorer: design audit and critique

Method: impeccable audit + critique lens (Operate mode: a task tool where scanability outranks expression, brand lives in precise details). Target: `docs/design-system/SODAX-DESIGN-SYSTEM.md`. Evidence: source in `explorer/`, `docs/design-audit/code-map.md`, desktop and mobile screenshots. No PRODUCT.md or DESIGN.md exists; audit proceeded on the code. Audit only: nothing edited, built or committed. The impeccable detector was not run (it is a post-build step).

## Overall verdict

Brand skeleton is right, execution is half-migrated. The cherry hero, cream neutrals, Inter body and one yellow Shrikhand word already read as SODAX. The data surfaces underneath still read as a stock Tailwind/Flowbite explorer: off-brand status colours, no radius or shadow tokens, a desktop table forced onto phones, and column labels that do not describe what solver-fill rows contain. Brand alignment about 6/10, information design about 4/10, mobile 3/10.

Audit Health Score (impeccable rubric): Accessibility 2, Performance 3, Responsive 1, Theming 2, Implementation integrity 2. Total 10/20, "Acceptable, significant work needed". Almost all of it is fixable with styling and token work; no feature rewrite is needed.

Implementation integrity: partial pass. A coherent system is visible (cherry hero, cream rows, yellow accent) but hex values live in three places (`tailwind.config.js:20-53`, `globals.css:66-67`, `intent-siblings.jsx:66-71`) and token names diverge from the design system (`cherry`, `soda`, `soda-bright` vs `cherry-soda`, `yellow-soda`).

## Findings

Severity: P0 blocks use or fails WCAG A/AA in a core flow; P1 clear brand or usability defect; P2 polish.

### 1. Brand alignment vs design system

- **[P1] Inria Serif is absent.** The system makes it the display face for the single largest headline per page. `app/fonts.js` loads only Inter and Shrikhand; `components/page-title.js:9` sets the whole h1 in Inter. Fix: load Inria Serif Regular, set h1 (`h1` scale 40/36/32, line-height 48) in `serif-heading` colour `white` on cherry-soda hero, and keep Shrikhand as the single accent word.
- **[P1] Shrikhand rule broken.** `page-title.js:6-10` italicises the first word whatever its length: "Explore" (7), "Message" (7). Rule: one word, or two only if both are 4 characters or less, lowercase unless acronym, `yellow-soda`. Fix: accent only a short word, or let the title be an explicit prop `{lead, accent}` (e.g. "Every *hop* across networks"; "Message *detail*" is too long, so drop the accent on detail pages). Lowercase it.
- **[P1] Token names and values diverge.** `tailwind.config.js` uses `cherry`, `cherry.hover`, `soda`, `soda.bright`, `cream-white #EDE7E7` (system `#EDE6E6`), `disabled #D7CDB5` (system `disabled-cherry-grey #D7CDCB`), `soda.DEFAULT #ECC100` and `soda.bright #FFDA2F` (system: `yellow-dark` and `yellow-soda`). Fix: rename to system ids (`cherry-soda`, `cherry-dark`, `cherry-on-cherry`, `yellow-soda`, `yellow-dark`, `cream-white`...), add `error*`/`success*` scales, delete `brand-grey`, `light-grey` (not in system) or alias them to `cream-white` and `cherry-grey`.
- **[P1] No radius, stroke or shadow tokens.** Cards use `sm:rounded-lg` (8px, `list` and `detail`) and `shadow-md`. System: `borderRadius.regular` (16) for cards, `small` (8) for tags and tiles, pill for buttons; no drop-shadow vocabulary. Fix: add `borderRadius` extensions (`micro 2, xsmall 4, small 8, medium 12, regular 16, large 24, xlarge 32`) and drop `shadow-md` for a 1px `cream-white` border on an `almost-white`/`white` card (system: card = surface one step darker).
- **[P2] Footer and header are generic.** Footer is a bare GitHub icon and copyright (`components/footer.js`). System: `cherry-dark` footer strip with network icon row and the SODAX horizontal logo right-aligned. Header: system says logo left, links centre-right, CTA right; here the ticker sits where the nav would.
- **[P2] Naming drift.** "SODAXScan", "Sodax Scan", "SODAX Scan" across `app/(index)/layout.js:9-31`, footer and logo lockup. Pick "SODAX Scan" (matches the logo lockup).

### 2. Typography

- **[P1] Hierarchy flatness in the data views.** Everything below the h1 is 14-16px Inter at one weight; hashes use system mono (`globals.css:72`). Fix per scale: table header `body-xsmall` 12 Medium `clay`, row text `body-small` 14 Regular `espresso`, hashes `body-small` mono `clay-dark`, stat label `body-small` `cherry-brighter`.
- **[P1] Total-messages stat styling.** The big yellow number is good (stat large, `yellow-soda` on cherry) but it should be Inter Regular tabular (`font-variant-numeric: tabular-nums`) and the label should be `cherry-brighter` 14px, not near-white small caps.
- **[P2] Mono is a system stack.** `--font-mono` falls back differently per OS. Acceptable for hashes; if one is wanted, add a single mono via next/font, but it is not in the design system, so keep the stack and tabular figures.
- **[P2] Uppercase everywhere.** Table headers, status pills and badges all uppercase at 12px with wide tracking. Use sentence case for pills and badges (system pills and tags are Inter Medium, not caps); keep caps only for the 12px column labels if desired.
- **[P2] Detail labels carry trailing colons and 24px uppercase header** (`message-detail.js:37`, "Message Detail" hidden below xl). Drop colons, use `body-small` `clay` label over `body-regular` `espresso` value; panel heading `h5` 22 Bold Inter.

### 3. Colour

- **[P0] Status semantics fail brand and meaning.** `lib/render.js:15-29`: `failed` is a filled `cherry` pill, i.e. the brand colour doubles as the error colour; `rollbacked` is `soda-bright` fill (yellow as a surface, forbidden outside cherry backgrounds); `executed/delivered/attested` use stock `green-200/blue-200/amber-200`. A user cannot tell a brand accent from an error. Fix: `executed` = `success-base` bg + `success-dark` text (check 4.5:1; `success-dark` #089541 on #E6F8EC is about 3.8:1, so use text `espresso` or a darker success for 12px text); `failed` = `error-base` bg + `error-dark` text; `pending` = `cherry-grey`/`espresso` (keep); `delivered` and `attested` = `almost-white` bg + `cherry-soda` text (blue/amber leave the palette); `rollbacked` = `cream-white` bg + `espresso` text with a `yellow-dark` 4px dot only if an accent is wanted. Add a leading 8px dot so status does not depend on colour alone.
- **[P1] Ticker colours.** `header.js:35` `text-green-500/text-red-500` on `almost-white` (about 2.3:1 and 3.4:1). Fix: `success-dark` / `error-dark`, or colourless with arrow glyph.
- **[P1] Stock greys.** `text-gray-900` in `message-detail.js:35`, `mpc-timeline.js:30`, `render.js` copy icon, `dark:text-gray-400` in `searchbar.js:19`, 12 matches overall (excluding admin). Fix: `espresso` for text, `clay` for icons.
- **[P2] Three near-identical warm greys on one screen** (`almost-white` page, `cream-white` header row, `light-grey` borders, `white` rows). Fix: page `vibrant-white`, card `white`, header row `almost-white`, dividers `cream-white`; remove `light-grey`/`brand-grey`.
- **[P2] Hero gradient hard-coded** (`globals.css:66-67`, `#A55C55`→`#964D48`). Fix: `cherry-soda`→`cherry-dark` via tokens; the system names `cherry-dark` for darker hero, so a flat `cherry-soda` hero with a `cherry-dark` footer is also on-brand.
- **[P2] Leftover `globals.css` custom properties** (blue glow, tile and callout vars, body gradient to `214,219,220`) are unused and cold-blue-grey; delete.

### 4. Layout and spacing

- **[P1] Hero seam.** `layout.js:46` draws a fixed `h-72` absolute cherry block behind content. On desktop the table header straddles the hero edge (the list card spans cherry and almost-white), on the detail page the card cuts through it and on mobile the filter row and table fall off the block. Fix: make the hero a real section sized to its content (title, search, stat, filters) with `spacing.40` bottom padding, and let the table card start below it with a `-spacing.24` overlap or none. Remove the `-z-20` hack.
- **[P1] Spacing off-scale.** `py-1`, `px-1`, `p-3`, `gap-4`, `xl:px-24 2xl:px-48` mix arbitrary values. Fix: row padding `spacing.14`/`spacing.16` vertical, `spacing.16` horizontal; page gutter `spacing.24` mobile, `spacing.56` desktop; section gap `spacing.32`.
- **[P2] Content width.** At 2xl, `px-48` leaves a narrow table with long hashes truncated at 7+7 chars. Use `max-w-[1280px]` centred with `spacing.24` gutters.
- **[P2] Empty/no-results state** (`message-list.tsx:39-43`) is an absolutely positioned line of text. Give it a centred `body-regular` `clay-dark` block with a suggested action ("Clear filters").

### 5. Components

**Header and ticker**
- **[P1] Ticker is decorative noise.** CoinGecko prices with ICX/BNB fallback at 0.00 (`layout.js:35-37`), hidden below xl, edge-masked, constant motion. For a message explorer it competes with the title. Fix: keep but quiet it: `clay` text 12px, success/error tokens only for the delta, pause on hover/focus, static on `prefers-reduced-motion`; or move it into the footer icon strip. Decision for the product owner.
- **[P2] Unlabelled yellow asterisk** at the right edge (`header.js:48`) is a Flowbite dropdown trigger with no accessible name or visible affordance. Replace with a labelled "Network: Mainnet" `body-small` control, 40px pill secondary button.
- **[P2] Logo box.** `header.js:13` `w-64 min-w-64` forces 256px and shifts the logo off-centre on a 375px screen. Use `h-8 w-auto`.

**Search**
- **[P1] Placeholder is wrong job and weak contrast.** "Search by transaction hash / serial no" in `clay` placeholder on white (about 4.0:1) and a `clay`-light border (3:1 needs 3:1 only, ok). Fix: placeholder `clay-dark`; add a visible `label` or `aria-label`; input pill (radius full is allowed for buttons; for fields use `borderRadius.small`/`medium`), 48px height, focus ring `yellow-soda` 2px on cherry hero or `cherry-soda` on light, never a 0.5px ring (`searchbar.js:17`).
- **[P2] Enter-only submit** with no button and `required` that never validates. Add a 48px primary `cherry-dark` icon button (on cherry surface the system CTA is `yellow-dark` bg + `cherry-dark` text). Also `value` is not URL-encoded (`searchbar.js:11`).

**Filters**
- **[P1] Filters are bare white text links on cherry.** Six Flowbite dropdowns with no border, no applied state and no count; the active filter is invisible once the menu closes. Fix: pill buttons 40px, `cherry-on-cherry` fill with `white` text (Secondary); applied state `yellow-soda` outline or a `yellow-dark` dot plus value ("Status: Executed"); `Reset` as Ghost link, shown only when a filter is active. Selected menu rows use `almost-white` + `cherry-soda` check, not `soda-clicked` (yellow fill) (`message-filter.tsx:66,113,159`).
- **[P1] Mobile overflow** (see section 6).
- **[P2] Commented-out checkbox code and `onKeyPress` handlers** add noise; menus lack keyboard-visible focus. Add `focus-visible` rings.

**Table (list)**
- **[P0 info design] Column labels do not match contents.** "Source Tx Hash" / "Destination Tx Hash" show only a chain name for SolverMarketPlaceFill rows (the majority in the screenshot); "Serial No" shows a long "SOLVER MARKETPLACE FILL" badge (`render.js:36-40`, 5 of 11 visible rows); "Action" repeats the same string `SolverMarketPlaceFill` as raw camel-case. Same fact stated three times, real data absent. Fix with styling and label changes only: rename columns "From" and "To" (chain icon + name, tx hash secondary line in `clay` mono when present); replace the badge with a "Type" `almost-white`/`cherry-soda` tag pill (`borderRadius.small`, Inter Medium 12), shown as "Solver fill", and let Serial No show an em dash when absent; humanise Action ("Solver fill", "Deposit", "Transfer") with sentence case. This also stops 3-line wrapping on narrow widths.
- **[P1] Header row and zebra.** Cream header, white rows, `border-b` on every row, hover `almost-white`. Fix: sticky header `almost-white` with `clay` 12px labels; rows `white` with `cream-white` dividers; hover `almost-white` plus a 2px `cherry-soda` left border (system left-border accent uses `cream-white`; hover state may use `cherry-brighter`); `focus-visible` ring since each row is a link.
- **[P1] Time column grammar and precision.** "1 minutes ago" (`lib/time-ago.js` pluralisation) in `tracking-tighter` text; right-aligned and non-tabular so values jitter. Fix: singular/plural, `tabular-nums`, `clay` colour, absolute UTC time in `title`.
- **[P2] Row link semantics.** The whole row is an `<a>` with `display: table-row` (`message-list.tsx:25`), which breaks table semantics and screen-reader column association; use a real `<table>` with a stretched link on the first cell.
- **[P2] Copy affordance** is a `text-gray-900` clipboard icon at 75% opacity, only on detail pages, and the script uses `onclick` loops (`message-detail.js:128-132`). Fix: `clay` icon with `espresso` hover, 32px hit area, "Copied" toast in `success` tokens.

**Status pills** (see Colour P0)
- **[P1] Fixed `w-24` pill** (`render.js:15`) breaks at 3-4 character wider statuses ("rollbacked" fits, "hub-burned" does not) and wastes width on mobile. Use `px-3 py-1`, `borderRadius` pill (arbitrary large value is acceptable per system), Inter Medium 12px sentence case.

**Detail card**
- **[P1] Two-column key/value table at `text-base`** with 24px side padding, 384px label column (`xl:w-96`), `border-b` rows and a hidden "Message Detail" header below xl. Fix: card `white` on `vibrant-white`, `borderRadius.regular`, 1px `cream-white` border, `spacing.24` padding; group into "Route" (source, destination), "Transaction" (hash, fee, slippage), "Timing" (created, updated) with `almost-white` section tags (colour tag pattern); label column 160px `clay` 14px, value `espresso` 16px; stack label over value below `tablet` (820).
- **[P1] Long hash overflow on mobile.** Full 66-char hashes with a copy icon wrap mid-string (screenshot, mobile detail unverified; at 480px wide in `desktop-detail-transfer.jpg` they fit only by shrinking). Use `break-all` mono at 13px with the copy button on its own line below `large-mobile` (640).
- **[P2] Timestamps** "1 minutes ago (Tue, 24 Nov 2026 11:20:23 GMT)": put relative time first in `espresso`, UTC in `clay` on a second line.
- **[P2] "Back to Messages"** is a 12px grey link floating below the card (`desktop-detail-transfer.jpg`). Move it above the card as a ghost pill or breadcrumb in the hero (`white` on cherry).
- **[P2] MPC timeline** (`mpc-timeline.js`) reuses the same table; terminal step is marked only by plain text " (destination)". Give steps a vertical connector (`cream-white` 2px line), filled `success` dot for reached, hollow `clay-light` for pending, and `cherry-soda` ring for the destination step.

**Pagination**
- **[P1] Two implementations** (`pagination.js`, `message-pagination.js`) with different looks; the shipped one is tiny bordered links (`border-cherry-grey rounded-md px-2 py-1`, about 28px tall) and the bare select. Fix: single component, 40px controls (`borderRadius.small`, `cherry-grey` border), current page `cherry-soda` bg + `white` text (primary on light), disabled `disabled-cherry-grey` at first/last page (currently first/prev stay live on page 1), `aria-label`s and `aria-current="page"`; page-size select labelled "Rows".
- **[P2] "First/Last" text vs `<`/`>` glyphs** are mixed; use chevron icons with accessible names.

**Footer**: see Brand alignment P2. Also repo link points to `icon-project/xcallscan-v3` (`footer.js:8`), `alt` on an `<a>` is invalid and the SVG has no label.

### 6. Responsive and mobile

- **[P0] The table is a desktop table on a phone.** All six columns kept with `overflow-x-auto` (`message-list.tsx:10`); at 375px the Destination, Action and Created columns are off-screen, and cells wrap to 3 lines (`mobile-list.jpg`). Fix (styling plus markup): below `tablet` (820) render each message as a card, `white` on `vibrant-white`, `borderRadius.regular`: row 1 status pill + relative time; row 2 "From -> To" chain icons and names; row 3 Type tag and action; hash as tap-to-open secondary. Keep the table at `tablet` and up.
- **[P0] Filter row overflows** (`message-filter.tsx:46`, `flex-row-reverse` with no wrap): "Route" and "Status" are cut off and "Reset" is clipped (`mobile-list.jpg`). Fix: `flex-wrap gap-8` or a horizontal scroll strip with scroll-snap; or one "Filters" button opening a bottom sheet.
- **[P1] Total count hidden on mobile**; the hero stat is the strongest brand moment. Show it above the title at `h2` 24 Mobile, `yellow-soda`.
- **[P1] Breakpoint ladder.** Layout flips at `xl` (1280) only (163 uses), so tablets get phone layouts or clipped tables. Align to system breakpoints: 640 / 820 / 1440 via Tailwind `screens` (`sm: 640, md: 820, xl: 1440`).
- **[P2] Touch targets** under 44px: pagination (~28px), filter text links (~20px), search icon, dropdown asterisk (24px). Raise to 40-48px per button specs.

### 7. Accessibility

- **[P1] Missing alt or labels:** `header.js:13` (logo), `:33` (ticker icons, should be `alt=""`), `:48` (menu trigger); `footer.js:8` (`alt` on `<a>`), SVG unlabeled; network icon alts in `render.js` are numeric ids (`alt={String(network)}`), use the network name or `alt=""` when the name is adjacent.
- **[P1] Colour-only status** (see Colour P0): add dot/icon and keep text.
- **[P1] Contrast shortfalls:** `clay` #8E7E7D on white about 4.0:1 (placeholder, icons, any 12px label); use `clay-dark` for text below 14px bold; ticker green/red (above); hover `cherry-brighter` text on cherry (`message-filter.tsx:31,39`) is lower contrast than the resting white and reads as dimming.
- **[P1] Focus:** inputs use `focus:outline-none` with a thin ring; rows, pagination links and filter triggers have no visible `focus-visible` style. Fix: global `:focus-visible { outline: 2px solid yellow-soda (on cherry) / cherry-soda (on light); outline-offset: 2px }`.
- **[P1] Semantics:** `<div class="table">` list and detail (`message-list.tsx`, `message-detail.js`) lose table roles; the `h1` is the only heading; no `<nav>`/`<main>` landmarks beyond `main`; search input lacks a label; `lang` is set (good).
- **[P2] `darkMode: 'false'`** (`tailwind.config.js:3`) is an invalid value; set `'class'` off or remove. Dark mode is not a brand requirement.

### 8. Motion

- **[P1] Ticker autoplay** (`infinite-scroll 25s linear infinite`, `tailwind.config.js:55-62`) has no `prefers-reduced-motion` guard and no pause control (WCAG 2.2.2). Add `@media (prefers-reduced-motion: reduce) { animation: none }` and `:hover`/`:focus-within { animation-play-state: paused }`.
- **[P2] `fade-in` 1.5s** (`globals.css:59-61`) is slow for a data tool and unused for list updates. If used, cap at 200ms `ease-out` opacity only; skip it for table rows.
- **[P2] Missing feedback motion:** row hover, dropdown open, copy confirmation and skeleton shimmer are all abrupt. 120-160ms colour/opacity transitions only; keep the skeleton (`skeleton-table.js`) restyled in `cream-white`/`almost-white`.

## Positive findings

- Cherry hero with white Inter, yellow stat and one Shrikhand accent is recognisably SODAX and warm, not crypto-dark.
- Inter is wired through next/font with a CSS variable; table truncation (7...7 hash) with the full value in `data-hash` is a smart scanability choice.
- Network icons plus names give fast chain recognition; the `tx-hash` mono class keeps hashes aligned.
- Palette in `tailwind.config.js` already contains most system neutrals, so the migration is mostly renaming and removing stock colours.
- `lang="en"`, metadata and Open Graph are in place; the skeleton loader exists.

## Systemic patterns

1. Tokens exist, but components still use stock Tailwind classes (`gray-*`, `green-*`, `blue-*`, `amber-*`, `rounded-md/lg`, `shadow-md`) for 12+ call sites.
2. No component primitives: pill, tag, card, button and field are re-declared inline (25 `bg-white`, repeated `px-3 py-2 xl:px-6 xl:py-4`). One small primitive set would carry brand rules.
3. Layout breakpoint is a single `xl` switch; mobile is the desktop table squeezed.
4. Labels describe the legacy xCall data model, not the SODAX solver-fill reality.

## Shippable styling packages (each reviewable in one sitting)

**Package A: Tokens and status colour (smallest, highest return).**
Rename tailwind colours to design-system ids and add `error*`/`success*`, radius and spacing tokens; delete `globals.css` leftovers and stock greys; rebuild `renderMessageStatus` with success/error/neutral tokens plus status dot; fix ticker deltas; sentence-case pills; fix serial-no badge style. Files: `tailwind.config.js`, `globals.css`, `lib/render.js`, `header.js`. Risk: low; visual diff on pills and greys only.

**Package B: Mobile list and filters.**
Card layout below `tablet` (820) with status, From -> To, type tag, time; wrapping or scrolling filter strip; show total count on mobile; fix logo width; 44px touch targets. Files: `message-list.tsx` (new `message-card` markup), `message-filter.tsx`, `header.js`, `layout.js`. Risk: medium (markup in list); no data changes.

**Package C: Desktop table, hero and typography.**
Inria Serif h1 with a compliant Shrikhand accent word, content-sized hero (remove fixed `h-72` seam), table header/rows/hover/focus, From/To/Type column relabel (information design), time grammar and tabular numbers, filter pills with applied state, search with button and visible focus. Files: `fonts.js`, `page-title.js`, `layout.js`, `message-list.tsx`, `message-filter.tsx`, `searchbar.js`, `time-ago.js`. Risk: medium.

**Package D: Detail card, pagination, footer and a11y sweep.**
Detail card grouped sections, `borderRadius.regular`, stacked labels on mobile, hash wrapping and copy button, MPC timeline connector; single pagination with 40px controls and disabled states; `cherry-dark` footer with logo and icon strip; alt text, `focus-visible` global style, reduced-motion guard, ARIA labels. Files: `message-detail.js`, `mpc-timeline.js`, `pagination.js` (delete `message-pagination.js`), `footer.js`, `globals.css`. Risk: low-medium.

Suggested order: A, B, C, D (A unblocks every other package; B fixes the only P0 layout failures).
