# SODAX Scan explorer: dark mode design spec

Status: proposal, no source changed. Branch `design/dark-mode`. Scope: `/Users/david/Github/sodax-scan/explorer` (Next 13.2.1 app dir, Tailwind 3.2.7, flowbite-react 0.7).
Brand source: `docs/design-system/SODAX-DESIGN-SYSTEM.md` and `sodax-design-tokens.json`. There is no official dark palette, so every dark value below is either an existing brand token or an explicit blend of two existing brand tokens (named in the "from" column). No new hue is introduced: all neutrals sit on the charcoal / espresso / cherry axis, so nothing goes cold blue-grey or neon (design system, "warm, not cold").

Mode: Operate (data table, live list). Scanability and contrast outrank atmosphere; brand lives in the hero, the accents and the status colours.

Contrast figures are WCAG 2.x relative-luminance ratios, computed with a script over the exact hex values (not eyeballed). Thresholds: 4.5 normal text, 3.0 large text and UI graphics.

---

## 1. Architecture

### Recommendation: semantic CSS-variable tokens, wired into Tailwind

Define role-named colour variables on `:root` (light, byte-identical to today's rendering) and on `.dark`, store them as space-separated RGB channels, and expose them in `tailwind.config.js` as `rgb(var(--x) / <alpha-value>)` (supported since Tailwind 3.1; the repo is on 3.2.7). Components say what a colour is for (`bg-raised`, `text-muted`, `border-line`), never which brand swatch it happens to be today.

Why not `dark:` variants everywhere:
- 29 files carry the raw colour classes below. `dark:` variants would roughly double the colour tokens on each element (about 190 call sites), and every future component must remember the pair. One missing `dark:` is a white-flash bug in dark; one missing variable value is caught in one place.
- The new-row highlight (`row-tint` keyframes in `globals.css`), the hero gradient, the focus ring and the status-pill map in `lib/render.js` are not class-per-element; they are CSS and JS tables. Variables serve them directly (`background-color: rgb(var(--tint))`); `dark:` cannot reach into keyframes.
- Flowbite-react already ships `dark:` classes in its theme and `darkMode: 'class'` is on, so it flips with `html.dark` for free (see section 4 for the grey problem).

Brand-named tokens (`cherry-soda`, `yellow-soda`, `soda-bright`, `white`, ...) stay as they are, for things that are the same in both themes (white text on cherry, the yellow Shrikhand word, the yellow counter). The rule: if a colour changes with the theme it gets a semantic name; if it is a fixed brand fact it keeps the brand name.

Not recommended: re-pointing the existing names (`white`, `almost-white`, `cream-white`, `espresso`) at variables. It keeps 190 class names untouched, but then `bg-white` renders dark grey and `text-white` (which must stay white on cherry) becomes ambiguous. A mechanical rename (below) is cheap and leaves the code honest.

### Class-name migration (grep counts, `app/ components/ lib/`, includes `hover:` variants)

| Current usage | Count | New semantic class | Notes |
|---|---|---|---|
| `bg-vibrant-white` (3: three root layouts `<body>`) | 3 | `bg-surface` | page |
| `bg-almost-white` (14 + 6 `hover:`) | 20 | header band, pending pill: `bg-header`; row/button hover: `hover:bg-hover` | split by role, not blind replace |
| `bg-white` | 14 | `bg-raised` | cards, table rows, skeleton cards, menus |
| `bg-chalk` | 2 | `bg-sunken` | search input |
| `bg-cream-white` (13 + 1 `hover:`) | 14 | `bg-subtle` (chips, skeleton bars), `hover:bg-hover` (apps button) | |
| `bg-light-cream`, `bg-cream-cherry` | 1 + 1 | via status tokens (pill) | `lib/render.js` |
| `bg-soda-clicked` (selected dropdown row, admin banner) | 3 | `bg-selected` | yellow is never a dark surface |
| `text-espresso` (27 + 2 hover) | 29 | `text-fg` | body/heading text |
| `text-clay-dark` | 35 | `text-fg-muted` | secondary text, hashes |
| `text-clay-light`, `text-clay` | 8 | `text-fg-subtle` | decorative only in dark, see 2.2 |
| `border-cream-white` | 9 | `border-line` | hairlines, table rules |
| `border-clay-light` / `border-clay` | 5 / 1 | `border-line-strong` | inputs |
| `border-cherry-grey` | 3 | `border-line` (or `border-line-strong` for the pending pill) | |
| `shadow-card` | 11 | `shadow-card` (name kept; value now themed) | |
| `text-cherry` (links/errors), `text-cherry-soda` | 8 + 1 | `text-accent` | |
| `focus:ring-cherry`, `focus:border-cherry` | 4 | `ring-focus` / `border-focus` | |
| `text-success-dark`, `text-error-dark` (ticker arrows) | 3 + 2 | `text-trend-up`, `text-trend-down` | |
| `bg-success-*`, `bg-error-*` (+ `text-*-dark`) in `lib/render.js` | pill table | `bg-st-<status>`, `text-st-<status>-fg`, `bg-st-<status>-dot` | 2.4 |
| `bg-espresso` (tooltip, admin bar, 3) | 3 | unchanged (brand-fixed) | still reads on dark, 2.9 |
| `bg-cherry-soda` buttons, `hover:bg-cherry-dark` | 11 | unchanged | white text 4.93 / 6.08 in both themes |
| `text-white` (12), `bg-yellow/soda-bright`, `text-soda-bright` | 12 / 6 / 3 | unchanged | live on cherry surfaces only |
| `.hero`, footer `bg-cherry-dark` | 1 + 1 | `.hero` via `--hero-from/--hero-to`; footer `bg-footer` | 2.3 |
| `globals.css`: `row-tint` (`colors.cream-cherry` to `colors.white`), `:focus-visible` outline | 2 rules | `rgb(var(--tint))` to `rgb(var(--raised))`; `rgb(var(--focus))` | |
| `[mask-image:linear-gradient(... black ... transparent)]` on the ticker | 1 | unchanged | alpha mask, colour-independent |

No hex or `rgb()` literals exist in JS/TSX today (grep: none), so JS needs no changes beyond class names and the pill table. No `dark:` classes exist in the app.

### Variable plumbing (shape, not final code)

```
:root            { --surface: 249 247 245; --raised: 255 255 255; ... color-scheme: light; }
.dark            { --surface:  29  20  20; --raised:  45  32  32; ... color-scheme: dark;  }
tailwind: colors: { surface: 'rgb(var(--surface) / <alpha-value>)', raised: '...', fg: '...', 'fg-muted': '...', line: '...', ... }
```

Theme state lives on `<html>`: class `dark` when the resolved theme is dark, and `data-theme-pref="light|dark|system"` for the picker. The `.dark` selector (not `prefers-color-scheme`) is the single source of truth, so the picker and the OS preference go through one code path.

---

## 2. Dark palette

### 2.1 Surfaces, text, lines

"Blend" means a linear sRGB-channel mix of the two named brand tokens; the percentage is the share of the second token.

| Token | Role | Light (today, unchanged) | Dark | Dark derivation |
|---|---|---|---|---|
| `--surface` | page background | `#F9F7F5` vibrant-white | `#1D1414` | charcoal |
| `--header` | header band, pending pill | `#F8F3F3` almost-white | `#261B1B` | charcoal + 22% espresso |
| `--raised` | cards, table rows, menus-at-rest | `#FFFFFF` white | `#2D2020` | charcoal + 38% espresso |
| `--sunken` | search / text input field | `#FBFBFB` chalk | `#221818` | charcoal + 12% espresso |
| `--subtle` | chips, tag pills, skeleton-adjacent fills | `#EDE6E6` cream-white | `#352626` | charcoal + 55% espresso |
| `--hover` | row hover, ghost-button hover | `#F8F3F3` almost-white | `#3A2A2A` | charcoal + 68% espresso |
| `--selected` | selected menu row, admin banner | `#F6E799` soda-on-soda | `#52302E` | raised + 35% cherry-dark |
| `--line` | hairlines, table rules, card edge | `#EDE6E6` cream-white | `#422F2F` | charcoal + 85% espresso |
| `--line-strong` | input borders | `#B9ACAB` clay-light | `#8E7E7D` | clay |
| `--fg` | primary text | `#483434` espresso | `#F8F3F3` | almost-white |
| `--fg-muted` | secondary text, hashes, "x ago" | `#6B5C5B` clay-dark | `#B9ACAB` | clay-light |
| `--fg-subtle` | placeholder, disabled, dividers glyphs | `#8E7E7D` clay | `#8E7E7D` | clay (non-essential only) |
| `--accent` | links, inline accent text | `#A55C55` cherry-soda | `#CC9E9A` | cherry-bright |
| `--focus` | focus ring on page surfaces | `#A55C55` cherry-soda | `#CC9E9A` | cherry-bright |
| `--tint` | new-row highlight peak | `#E5D5D4` cream-cherry | `#52302E` | raised + 35% cherry-dark |
| `--skeleton` | shimmer bars | `#EDE6E6` | `#483434` | espresso |

Fixed (same in both themes): `cherry-soda #A55C55` buttons with `text-white`; `cherry-dark #964D48` button hover; `yellow-soda #FFD92F` accent word / counter over cherry; admin bar `espresso #483434`; tooltip `espresso`.

Elevation reads as lightness steps (surface < header < raised < hover) plus a hairline, not as shadow. The steps are deliberately small (about 1.15 to 1.2:1 between neighbours); legibility never depends on them because text contrast is measured against the actual background and the hairline (`--line`) carries the card edge.

### 2.2 Text contrast in dark (measured)

| Pair | Ratio | Verdict |
|---|---|---|
| `--fg #F8F3F3` on surface `#1D1414` | 16.44 | pass |
| `--fg` on header `#261B1B` / raised `#2D2020` / hover `#3A2A2A` | 15.22 / 14.27 / 12.37 | pass |
| `--fg-muted #B9ACAB` on surface / header / raised | 8.22 / 7.61 / 7.13 | pass |
| `--fg-muted` on hover / subtle / tint `#52302E` | 6.18 / 6.56 / 5.25 | pass |
| `--fg-muted` on `--tint` peak (new-row highlight) | **5.25** | pass, tightest text pair in the table body |
| `--accent #CC9E9A` on surface / header / raised | 7.68 / 7.11 / 6.67 | pass |
| `--fg` on selected `#52302E` | 10.49 | pass |
| `--fg` on sunken `#221818` (input text) | 15.77 | pass |
| `--fg-subtle #8E7E7D` on surface | 4.67 | pass |
| `--fg-subtle` on raised `#2D2020` | **4.06** | FAIL for text; so it is decorative-only in dark (separators, disabled icons), never copy |
| `--fg-subtle` as input placeholder on sunken | **4.48** | misses 4.5 by 0.02; placeholder uses `--fg-muted` in dark instead |
| `cherry-on-cherry #C36C65` as link text on raised | **4.22** | FAIL; rejected as link colour, hence `cherry-bright` |
| `--line-strong #8E7E7D` input border on sunken (UI boundary, needs 3.0) | 4.48 | pass |
| `--line #422F2F` vs raised (decorative hairline) | 1.25 | decorative, exempt |

Light-theme reference (unchanged): espresso on white 11.56, clay-dark on white 6.35, cherry-soda on white 4.93. Pre-existing light-theme finding, not caused by this work: the search input border (`clay-light #B9ACAB` on `chalk #FBFBFB`) is 2.12, under the 3.0 UI-boundary bar; dark uses `clay`, so dark is actually better here. Worth fixing separately.

### 2.3 Cherry hero and footer in dark

Light: `linear-gradient(180deg, #A55C55, #964D48)`, white text 4.93 to 6.08, yellow-soda stat.

Dark: keep the cherry identity but sink it toward charcoal so it is not the loudest object on a dark page.

| Token | Light | Dark | Derivation |
|---|---|---|---|
| `--hero-from` | `#A55C55` cherry-soda | `#783F3B` | cherry-dark + 25% charcoal |
| `--hero-to` | `#964D48` cherry-dark | `#5A312E` | cherry-dark + 50% charcoal |
| `--footer` | `#964D48` cherry-dark | `#5A312E` | same as hero-to (hero and footer bookend the page) |

Contrast on dark hero (top / bottom): white 8.16 / 10.97; cream-white secondary 6.63 / 8.92; **yellow-soda 5.92 (top) / 7.95 (bottom)**. White footer text on `#5A312E` 10.97. Yellow stat clears 4.5 everywhere, and the 68 to 160 px stat is large text anyway (3.0 needed).

Considered and rejected: `45%/70%` blend (`#603331` to `#412524`) gives contrast 10 to 14 but reads as brown-black and loses the cherry; `25%/50%` is the lightest blend that keeps the hue clearly cherry. The hero is still distinct from the header (`#261B1B`) and from the raised card that overlaps it.

On the hero the existing focus ring is already `yellow-soda`: 5.92 on the dark hero top, passes 3.0. The outlined filter chips use `border-cherry-bright/60` over the hero: blended border colour `#AA7874` on `#783F3B` is **2.20, below the 3.0 non-text bar** (light hero: passes). Dark change: raise the chip outline to `cherry-brighter/80` (`#E3BEBB`, measured 3.70 on the dark hero top, 4.77 at the bottom; at /70 it is 3.20, at /60 only 2.75). Active chip (white pill, cherry-dark text 6.08) is unchanged.

### 2.4 Status pills (success / error / neutral)

All pill text is at least 4.5:1 on its own background; backgrounds are alpha-free blends of charcoal with the existing semantic dark values so no new hue appears. The pill background vs the raised row is only 1.1 to 1.4:1, so the pill is identified by its text and dot, not by its fill (same as light, where `success-base` on white is also about 1.1:1).

| Status | Light pill bg / fg / dot | Dark pill bg | Dark fg | fg ratio | Dark dot | dot ratio |
|---|---|---|---|---|---|---|
| executed | `#E6F8EC` / `#483434` / `#0ABA51` | `#173821` (charcoal + 28% success-dark) | `#CEF0DC` success-lighter | 10.54 | `#6DD696` success-light | 7.21 |
| failed | `#FAECEC` / `#A73639` / `#CE4446` | `#512122` (charcoal + 38% error-dark) | `#F5DBDB` error-lighter | 10.08 | `#D8696C` error-light | 3.87 |
| rollbacked | `#F5DBDB` / `#A73639` / `#A73639` | `#692728` (charcoal + 55% error-dark) | `#F5DBDB` | 8.35 | `#D8696C` | **3.20** (graphic, passes 3.0 narrowly) |
| delivered | `#F0EAEB` / `#483434` / `#483434` | `#352626` | `#EDE6E6` cream-white | 11.71 | `#B9ACAB` | 6.56 |
| attested | `#E5D5D4` / `#483434` / `#A55C55` | `#472826` (charcoal + 35% cherry-dark) | `#E3BEBB` cherry-brighter | 7.72 | `#CC9E9A` | 5.58 |
| pending | `#F8F3F3` / `#6B5C5B` / outline `#8E7E7D`, border `#D7CDCB` | `#261B1B` (= header) | `#B9ACAB` | 7.61 | outline `#8E7E7D`, border `#422F2F` | n/a |
| fallback | `#EDE6E6` / `#6B5C5B` / `#B9ACAB` | `#352626` | `#B9ACAB` | 6.56 | `#B9ACAB` | n/a |

Rejected: `error-light #D8696C` as failed-pill *text* on `#512122` is 3.87 (fails). Light text must be the `lighter` step; the `light` step is for the dot only. Failed and rollbacked stay separable by fill depth (`#512122` vs `#692728`) and by dot, as today.

Implementation shape: `STATUS_PILL` in `lib/render.js` keeps its structure but references `bg-st-executed text-st-executed-fg` etc. (tokens above), so JS has no `dark:` logic. Pill `transition-colors duration-300` already exists and makes live status changes fade in both themes.

Ticker arrows (`▲ ▼`): `--trend-up` light `#089541` / dark `#6DD696` (9.33 on header); `--trend-down` light `#A73639` / dark `#D8696C` (4.91 on header). Figures stay `--fg`.

### 2.5 New-row highlight and hover

- Peak tint `#52302E` fading to raised `#2D2020` over the existing 1200 ms ease-in-out. Text on the peak: `--fg` 10.49, `--fg-muted` 5.25. Tint vs raised is 1.36:1, visibly warm-cherry; light is cream-cherry vs white at about 1.3:1, so perceived strength is matched.
- `row-tint` keyframes change from `theme('colors.cream-cherry')` / `theme('colors.white')` to `rgb(var(--tint))` / `rgb(var(--raised))`, so it themes with no JS and replays are unaffected (the `freshIds` logic is untouched). The reduced-motion fallback (tint only, no opacity) works as is.
- The mobile card tint (`.card-enter > a`) uses the same keyframes; no extra work.
- Row hover `#3A2A2A` (1.15:1 over raised) with the existing 3 px `cherry-soda` left accent bar doing the real work, as in light. Text on hover: 12.37 / 6.18.

### 2.6 Skeletons

`animate-pulse` bars use `--skeleton` (`#483434` espresso) on `--raised` cards: 1.37:1 at full opacity, pulsing down to about 50 percent opacity (Tailwind default), which still reads as a placeholder. Light is unchanged (`#EDE6E6` on white). The list wrapper that holds its height while stale needs no change.

### 2.7 Shadows become hairlines

Tailwind `boxShadow.card` becomes themed through a variable:

- Light: unchanged, `0 1px 2px rgba(72,52,52,.06), 0 4px 16px rgba(72,52,52,.08)`.
- Dark: `0 0 0 1px rgb(var(--line)), inset 0 1px 0 rgb(255 255 255 / 0.04)`; no drop shadow (a dark blur on `#1D1414` is invisible and only muddies). Cards are defined by the 1px `--line` ring plus the faint top highlight.
- Overlays (flowbite dropdown, tooltip) in dark: hairline plus `0 12px 32px rgb(0 0 0 / 0.45)` because they float over content and need real separation. The dropdown menu surface is espresso `#483434` (via the gray remap in section 4): `--fg` on it 10.52.
- The `rgba(72,52,52,...)` shadow tint stays espresso-warm in light; dark uses pure black alpha, the only place black appears, as a shadow never as a fill.

### 2.8 Yellow

Rule from the design system: yellow-soda / yellow-dark is an accent over cherry, never a surface, and the Shrikhand word is yellow in every context. In this app all 6 yellow uses are on the cherry hero (page-title accent word, the total counter, ring on filter chips) or the admin bar dot. They therefore need no change; the dark hero keeps yellow at 5.92 to 7.95. The only off-hero yellow today is the admin "pending, re-submit" banner (`bg-soda-clicked border-soda`, `bg-soda` button): in dark the banner becomes `--selected` (`#52302E`) with a `yellow-dark #ECC100` 1 px border and `--fg` text (10.49), and the button stays `yellow-dark` with `espresso` text (design system: yellow button, dark text). That honours "never a surface".

### 2.9 Network icons that vanish on dark

Measured the 34 PNGs in `public/images/` (alpha-weighted luminance and fill). Problem set:

| Icon | Why | Dark result today |
|---|---|---|
| `hedera` (PNG and SVG), `xrp`, `tron` | black glyph on transparent (mean luminance 0 / 41 / 59, only 24 to 30 percent opaque for xrp/tron) | glyph vanishes into `#2D2020` |
| `solana`, `stellar`, `kaia` | black or near-black full-bleed disc (luminance 29 / 39 / 41) | disc edge vanishes |
| `sonic`, `zcash`, `cardano`, `botanix` | dark or thin glyphs on transparent | low contrast |

Treatment (one rule for every network icon, no per-icon exceptions): render icons on a 24 px disc.

- Wrapper (a small shared `NetworkIcon` component replacing the 7 `<Image src=/images/network-...>` call sites in `lib/render.js` and `message-filter.tsx`) is `rounded-full` with background `--icon-disc`: light `transparent` (zero change), dark `#EDE6E6` cream-white at the same 24 px.
- Transparent-glyph icons now sit on cream-white (black hedera on `#EDE6E6` is 17.06:1; xrp and tron likewise). Coloured full-bleed icons cover the disc entirely, so nothing shows.
- Near-black full-bleed discs (solana, stellar, kaia) get a 1 px inner ring `ring-1 ring-inset ring-white/15` in dark (applies to all icons, invisible on coloured ones) so their edge is defined.
- Ticker coin images (external CoinGecko URLs, `header.js`): same `ring-1 ring-white/15` in dark; no disc, because the set is arbitrary and mostly coloured. If a black coin shows up, the ring still keeps it visible.
- Do not invert or filter icons: brand marks must not be altered.

---

## 3. Theme picker

### 3.1 Decision

Segmented pill with a sliding thumb and three icon-only radios (Sun = Light, Moon = Dark, Monitor = System). Chosen over a single morphing icon button because three modes are the whole point of the control (System is a first-class state) and a segmented control shows all three states and the current one without opening a popover. On a header that already carries a ticker, the compact 88 px pill costs less than a popover plus a menu.

### 3.2 Placement

Header right cluster, immediately left of the SODAX apps button, same row at every breakpoint (`header.js`, `flex items-center gap-2 shrink-0`). Order desktop: ticker, search (when shown), theme picker, apps button. Gap `gap-2` (8 px), then `gap-3` between picker and apps on `xl` to separate the two controls.

Mobile (`< md`): the picker stays in the header; it does not move into a menu, so it is reachable in one tap. Budget at 375 px: 16 + logo + 12 + picker + 8 + apps + 16. Logo shrinks from `w-44` (176 px) to `w-36` (144 px) at `max-md`, picker 116 px, apps 24 px: 16+144+12+116+8+24+16 = 336 px, fits 360 and 375 with slack.

### 3.3 Dimensions and shape

| | Desktop (`md+`) | Mobile (`< md`) |
|---|---|---|
| Track | 88 x 32 px, `rounded-full` (shape token: pill) | 116 x 40 px |
| Padding | 2 px | 2 px |
| Segment (hit target) | 28 x 28 px | 36 x 36 px, hit area extended to 44 px tall with a `::before` expanding vertically (negative inset), so adjacent segments never overlap horizontally |
| Thumb | 28 x 28 px, `rounded-full` | 36 x 36 px |
| Icon | 16 px, viewBox 24, stroke 1.75, round caps/joins, `currentColor` | 18 px |

All radii use the full-pill shape; the focus outline uses `rounded-full` too. (Design system radius scale has no pill step; pills already use Tailwind `rounded-full` across the app.)

### 3.4 Colours

| Part | Light | Dark |
|---|---|---|
| Track fill | `#EDE6E6` cream-white | `#1D1414` charcoal (= surface), plus `1px` `--line` `#422F2F` border |
| Thumb | `#FFFFFF`, shadow `0 1px 2px rgb(72 52 52 / .12)` | `#483434` espresso, `inset 0 0 0 1px rgb(255 255 255 / .06)` |
| Active icon | `#483434` espresso on thumb: 11.56 | `#F8F3F3` on `#483434`: 10.52 |
| Inactive icon | `#6B5C5B` clay-dark on track: 5.16 | `#B9ACAB` clay-light on track: 8.22 |
| Inactive hover | icon to espresso (light) / almost-white (dark), 150 ms | same |
| Focus ring | `2px` `--focus` `#A55C55`, offset 2 px | `2px` `#CC9E9A` (7.68 on surface), offset 2 px |

The picker sits on the header band (`#F8F3F3` / `#261B1B`); the track is distinguishable from it in both themes (cream-white on almost-white is subtle but the thumb and icons carry it; dark gets the hairline). All icon states clear 4.5:1 (graphics only need 3.0).

### 3.5 Icons (inline SVG, no dependency)

24 viewBox, `fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"`:
- Sun: `circle cx=12 cy=12 r=4` plus 8 short rays (`M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M4.93 19.07l1.41-1.41 M17.66 6.34l1.41-1.41`).
- Moon: crescent `M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z`.
- Monitor: `rect x=3 y=4 width=18 height=12 rx=2` plus `M8 20h8 M12 16v4`.

Match the existing icon style (`CheckIcon` in `copy-button.js` is inline SVG with `width/height` props).

### 3.6 Motion

- Thumb: `transform: translateX(index * segment)`, **240 ms `cubic-bezier(0.32, 0.72, 0, 1)`** (decelerating, no overshoot; Apple-style restraint). Moving two steps (Light to System) takes the same duration, so velocity scales naturally.
- Active icon: colour 150 ms ease-out (inherits the global interactive transition) plus the existing `.icon-pop` (160 ms scale .8 to 1) on the newly selected icon only, so the state change has a small confirm. Moon icon gets a 120 ms -12 degree to 0 rotate on entering; sun gets none (restraint).
- Press: thumb `scale(.94)` while `:active` on any segment, 100 ms.
- Reduced motion: the global `prefers-reduced-motion` rule already clamps all transitions to 0.01 ms, so the thumb snaps and `.icon-pop` does not play. No extra code; add the picker classes to the existing exclusions only if a bespoke transition property is used.
- No spring bounce and no theme-switch "wipe" by default (the page is a live data surface; motion should not compete with row animations).

### 3.7 Behaviour and accessibility

- Semantics: `<div role="radiogroup" aria-label="Theme">` containing three `<button type="button" role="radio" aria-checked aria-label="Light|Dark|System">`. No visible text; `title` tooltip as native hint. Pointer click selects.
- Roving tabindex: checked radio has `tabindex=0`, others `-1`, so Tab enters and leaves the group once.
- Keys: Left/Up = previous, Right/Down = next (wraps), Home/End = first/last. In a radiogroup, arrow keys move focus and select immediately (standard radio behaviour), so the theme previews as you arrow. Space/Enter select the focused radio.
- Focus: `:focus-visible` ring on the segment (not the track), 2 px, offset 2 px; mouse clicks show no ring (matches the global rule).
- Announce: radio state is announced natively; no extra live region.
- Hit targets: see 3.3 (36 px visual / 44 px hit on mobile, 28 px desktop; WCAG 2.2 target-size AA needs 24 px, passed).

### 3.8 State, persistence, system tracking

- Storage: `localStorage` key `sodax-scan-theme`, values `"light" | "dark"`. Absence of the key means System (so a fresh visitor, or someone who chose System, stores nothing). Choosing System removes the key. All reads/writes inside try/catch (private mode / blocked storage falls back to System, per-session only).
- Resolved theme: `dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)`.
- System follows the OS live: while pref is System, a `matchMedia('(prefers-color-scheme: dark)')` `change` listener re-resolves and re-applies; when pref is explicit, the listener is a no-op. Listener is attached in the picker's `useEffect` (and cleaned up).
- Cross-tab: a `storage` event listener applies a change made in another tab.
- Attributes written by the inline script and the picker: `html.classList.toggle('dark', dark)`, `html.dataset.themePref = pref`, `html.style.colorScheme = dark ? 'dark' : 'light'` (redundant with the CSS rule, but covers the pre-stylesheet frame), and the `theme-color` meta (section 4).

### 3.9 No flash of wrong theme

An inline blocking script runs before first paint, so SSR/static HTML is never painted light and then corrected.

Next 13.2 app dir specifics:
- This app has three root layouts (route groups): `app/(index)/layout.js`, `app/(messages)/messages/layout.js`, `app/(debug)/layout.js`. Each declares its own `<html>`/`<body>`, so the script must be in **each** of them, in `<head>` (the index layout already has an empty `<head></head>`). Put the script text in one shared module (for example `lib/theme-script.js` exporting a string) and render `<script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />` in all three heads, so they cannot drift.
- The script mutates `<html>` before hydration, so `<html suppressHydrationWarning>` is required on all three, otherwise React reports a class mismatch.
- `metadata.themeColor` support is not relied on (version-specific in 13.2); the meta tag is written manually in `<head>` and updated by the script.
- Script behaviour (tiny, about 400 bytes, no dependencies): read `localStorage['sodax-scan-theme']` in try/catch, resolve against `matchMedia`, set `class`, `data-theme-pref`, `style.colorScheme`, and set `<meta name="theme-color">` content (dark `#261B1B`, light `#F8F3F3`, matching the header band). It never adds the transition class (3.10).
- The picker is a client component. To avoid a hydration mismatch and any thumb jump, the thumb position and the active-icon styling are driven by CSS selectors on `html[data-theme-pref=...]` (so they are correct at first paint, zero JS), while `aria-checked` and roving `tabindex` are set after mount from storage. Before mount the server renders the System state as the default.
- If a CSP is added later, the inline script needs a nonce or a hash; none exists in `next.config.js` today.

### 3.10 The switch itself

When the user picks a theme: a 200 ms cross-fade, not a flash.
- Picker handler (and the system `change` listener) adds class `theme-switching` to `<html>`, applies the new theme on the next frame, and removes `theme-switching` after 220 ms.
- CSS: `html.theme-switching *, html.theme-switching *::before, html.theme-switching *::after { transition: background-color 200ms ease-out, color 200ms ease-out, border-color 200ms ease-out, fill 200ms ease-out, stroke 200ms ease-out, box-shadow 200ms ease-out !important; }`. Scoped to the switching window so steady-state transitions (the 150 ms interactive rule, 300 ms pill colour) are untouched, and `animation` is unaffected, so the ticker, FLIP and row-enter keep running without a stutter.
- Never on initial load or on route navigation: only a user action or an OS change while in System adds the class. The first paint is final.
- Reduced motion: skip adding the class entirely; the swap is instant.
- Optional later enhancement, not in this spec: View Transitions API radial reveal from the thumb; it is a larger statement than a live data table wants.

---

## 4. Risks and edge cases

1. **Flowbite dropdown (cold grey in dark).** `flowbite-react` 0.7 `Dropdown/theme.js` ships `dark:bg-gray-700`, `dark:hover:bg-gray-600`, `dark:text-gray-200`, `dark:text-white`, `dark:focus:...` from Tailwind's default cool slate-grey ramp (#374151 family) and `flowbite-react/**/*.js` is in `content`, so these utilities will activate the moment `html.dark` exists. That would be a cold blue-grey in a warm palette. Fix: extend `colors.gray` in `tailwind.config.js` with a warm ramp mapped to brand tokens (50 almost-white, 100 light-cream, 200 cream-white, 300 cherry-grey, 400 clay-light, 500 clay, 600 clay-dark, 700 espresso, 800 espresso-to-charcoal blend, 900 charcoal). The app has zero `gray-*` usages of its own (grep), so only flowbite is affected. Side effect to approve: in light, the dropdown text/hover shifts from cold grey (`text-gray-700`, `hover:bg-gray-100`) to warm brand neutrals; arguably a fix, but it is a visible light-mode change in two menus. Alternative that keeps light bit-identical: pass flowbite `theme` overrides (the filter already does for its chip) per Dropdown. Dark menu surface under the remap is espresso `#483434`; item text `#EDE6E6` 9.39.
2. **Flowbite forms plugin** (`flowbite/plugin`): base form styles ship `dark:` rules for inputs and checkboxes; the search input sets its own classes, but verify focus/border and any checkbox in the filter or debug login in dark.
3. **Logos (`next/image`, `<img>`).** `public/images/new_logo.svg` (header wordmark) fills the wordmark with espresso `#483534`; the other fills are cherry `#A55C55` and yellow `#ECC100`. On `#261B1B` the espresso wordmark is invisible. The design system lists an official "SODAX white logo on dark" (`/images/SODAX-on-dark/SODAX white logo on dark.svg`), which is **not in `explorer/public`**: it must be added (do not recolour by hand; design system: never recreate or approximate the logo). Render both and switch with CSS (`dark:hidden` / `hidden dark:block`) rather than JS, so there is no flash and no hydration dependency. `sodax_logo.svg` (apps button, yellow-only mark) works on both backgrounds as is. `link-preview.png` (OG image) is theme-independent, leave it.
4. **Ticker mask gradient.** The `mask-image` gradient uses `transparent` and `black` as alpha only, so it works on any header colour; verify the fade-out edge against the new header band `#261B1B` (no hard edge) and that the 20 px coin images keep their ring (2.9).
5. **Print.** Dark must not print dark. Add `@media print { :root, .dark { ...light variable values; color-scheme: light } }` (reusing the light block) and keep `.hero` printing its background (`print-color-adjust: exact`) as today; hide the picker in print.
6. **Debug / admin pages.** `app/(debug)/layout.js` is a separate root layout (needs the script and `suppressHydrationWarning` as in 3.9). It reuses Header, Hero and Footer so inherits the theme; check `debug-login` (cherry button with `text-white`, 4.93, fine), `admin-bar` (`bg-espresso text-cream-white` 9.39; on charcoal it is only 1.56 from the page, so keep the bar visually bounded with a bottom `--line` hairline) and the yellow admin banner (2.8). `robots noindex` is unrelated.
7. **`color-scheme`.** Set `:root { color-scheme: light }` and `.dark { color-scheme: dark }` (plus `<meta name="color-scheme" content="light dark">`). This themes native scrollbars, form controls, autofill and the selection UI; without it a dark page gets a bright white scrollbar and a white `<select>` popup. `html, body { overflow-x: hidden }` is already set; confirm the dark scrollbar track in Safari and Chrome.
8. **`meta theme-color`.** One meta, kept in sync by the script and picker (not two media-query metas, which would ignore an explicit in-app choice). Light `#F8F3F3`, dark `#261B1B` (header band; the hero sits just below).
9. **Selection and autofill.** Tailwind/browser default `::selection` is fine; verify Chrome's autofill (yellow/blue field tint) on the search input in dark; set `autofill` text colour via `-webkit-text-fill-color` only if it looks wrong.
10. **Live tint at the same time as a theme switch.** The `row-tint` animation uses variables resolved at animation time, so a row already mid-tint follows the new theme smoothly; confirmed by design, verify once visually.
11. **Hydration cost / bundle.** The picker is the only new client component; about 1.5 KB, no new dependency. The inline script is about 0.4 KB, shared by three layouts.
12. **Screenshot / OG tooling** and `docs/design-audit/screens` baselines: the light screenshots stay valid because light values are byte-identical. Add dark baselines per page (home, messages list, message detail, debug) in a second theme pass.

### Verification checklist (for the build)

- Computed light colours equal the current ones (visual diff against `docs/design-audit/screens`), except the two flowbite menus if the gray remap is accepted.
- All contrast rows above re-measured on rendered pixels.
- Cold-load with each of `pref = light | dark | system(os dark) | system(os light)`: no flash (record frames or throttle CPU).
- Toggle OS appearance while in System: the page follows live; while explicit: it does not.
- Keyboard: Tab into the group once, arrow through all three, Home/End, visible ring on both themes and over no hero overlap.
- Reduced motion: thumb snaps, no cross-fade, row tint still shown as colour only.
- Print preview from dark: light output.

---

## 5. Suggested build order

1. Tokens: variables in `globals.css`, Tailwind wiring, gray remap, `color-scheme`, print block (light identical).
2. Class migration (about 120 swaps in 29 files, split by role per the table), pill table, `row-tint`, hero, footer.
3. Inline script plus `suppressHydrationWarning` in the 3 root layouts; logo on-dark asset.
4. Picker component plus header integration; switch transition.
5. Network icon disc component; dark pass over detail pages, debug, admin; dark screenshot baselines.

---

## 6. Open questions

1. Official dark logo: can we get the official `SODAX white logo on dark` SVG into `explorer/public/images/`? It is listed in the design system but missing from the repo.
2. Flowbite grey remap changes two light-mode menus from cold grey to warm brand neutrals. Accept, or keep light bit-identical by per-component `theme` overrides?
3. Should the page default to System (recommended) or Light for first-time visitors? The spec assumes System, which means dark OS users get dark immediately.
4. Do you want a small resolved-theme indicator on the System thumb (a 4 px dot showing whether System currently resolves to light or dark), or is the monitor icon enough?
5. The hero is deepened in dark (cherry-dark 25 to 50 percent toward charcoal). Is the more subdued cherry acceptable brand-wise, or should the hero stay at full `cherry-soda` / `cherry-dark` (white 4.93 to 6.08, yellow 4.41 at the bottom) with only the surrounding surfaces going dark?
6. Chip outline on the hero in dark must move from `cherry-bright/60` to `cherry-brighter/80` to clear 3.0. OK to tweak the filter chips in dark only?
