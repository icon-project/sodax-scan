# Micro-animation baseline grading (2026-11-24)

> Note: the per-scenario filmstrips and raw data referenced below are archived outside the repo at `~/Github/_scratch-sodax-scan/animation-grading-archive/` (about 12 MB). Only the two `compare-new-row-*.png` images are kept here. Variant **a** shipped; variant b and the `?motion` toggle were removed.


Target: production build at `http://localhost:3100` (branch `design/refresh`, commit `cab9bae`). Measured with Playwright 1.64.0 (chromium-headless-shell 1248, WebKit 2370, headless), API frozen via `page.route` (real response saved once, new rows / status / total injected on demand, 350 ms latency on non-poll queries). Chromium 1440x900 and 375x812, WebKit both. Reduced-motion run: Chromium only. Raw numbers: `data/report-raw.txt`. Filmstrips: `<scenario>-<browser>-<viewport>.png` (labels are ms relative to the visible change).

Rubric (improve-animations / AUDIT.md): timing, easing, continuity / spatial logic, interruptibility, performance, reduced motion. Grades are for the animation as shipped, A = nothing to change.

## Summary

| # | Animation | Grade | Why |
|---|---|---|---|
| A | New row arrives (desktop table / mobile card) | **C+** (desktop C+, mobile C) | The fade and tint are fine, but every row below teleports 52 px (156 px for 3) in one frame; on mobile 32 px of the shift is also instant and the card shadow is clipped while it grows. |
| B1 | Counter first-load count-up | **B+** | Matches spec exactly (700 ms easeOutCubic, 60 fps), instant under reduced motion. |
| B2 | Counter increment tick | **B** | Spec-exact, but replays on the whole number every poll that adds a row. Slightly loud for an ambient element. |
| C | Filter / page change (dim + swap) | **C+** | Dim and swap are smooth and interruptible, but Chromium scroll anchoring throws the viewport 469 px (desktop) / 1234 px (mobile) up at the swap. Not present in WebKit. |
| D | Status pill pending to executed | **A-** | 300 ms colour crossfade on pill, text and dot, nothing else disturbed. Text label snaps (unavoidable). |
| E | Copy button click | **B-** (desktop B+, mobile C) | Press, icon pop and label are well timed, but the "Copied" label is in flow: the button jumps 46 px left on mobile and the hash reflows. Revert is a hard snap. |
| F | Row hover accent bar | **A-** | Bar and row background both fade in 150 ms (bar t90 = 83 ms), symmetrical exit. Mobile has no equivalent. |

## Performance and layout-shift (all scenarios)

| | Chromium | WebKit |
|---|---|---|
| rAF cadence | 16.7 ms mean everywhere; isolated 33 ms frames (1 each) in A3 desktop, D, B2/E mobile; 0 frames > 33.5 ms | 16.3-16.8 ms mean; hitches: F desktop 78 ms once, C2 mobile 37 ms, a few 22-26 ms frames |
| Long tasks | 0 in every run | not supported by WebKit (observer silently returns nothing), unmeasured |
| Layout shift (CLS in the 1.5 s window) | A1 desktop 0.020, A3 0.060; A1 mobile 0.082, A3 mobile 0.255; B1 0.005; E mobile 0.001; **C1 desktop 0.24, C1 mobile 1.00 (scroll jump, see C)**; others 0 | not supported, measured by row rect instead (below) |

Which properties animate (from `document.getAnimations()`):

| Animation | Properties | Compositor-only? |
|---|---|---|
| row-enter (desktop row) | opacity, background-color (1200 ms) | No: opacity is composited, background-color repaints the row. Cheap at 1 row, still the only paint-type animation in the list. |
| card-enter (mobile li) | grid-template-rows, margin-bottom, opacity, transform | No: layout runs every frame for 280 ms. |
| card `a` tint | background-color (1200 ms) | No (paint) |
| tick, icon-pop, button press | transform, opacity | Yes |
| status pill | background-color, color, 4 border colours (300 ms) | No (paint, tiny) |
| list dim | opacity on a wrapper (150 ms) | Yes |
| hover bar | opacity on `::before`, background-color on row | bar yes, row bg paint |
| counter first load | text content via rAF `setState` 700 ms | n/a (60 renders/s of one span, no dropped frames) |

## A. New row arrives

Files: `A1-*.png`, `A3-*.png`. Easing/duration measured against spec.

**Measured (Chromium desktop).** New row opacity follows `cubic-bezier(0.23,1,0.32,1)` over the first 480 ms with zero residual: t10 17 ms, t50 67 ms, **t90 183 ms**, t99 317 ms. So the visible fade is over by ~200 ms; the other 280 ms of the 480 ms keyframe is a dead tail. Tint `#E5D5D4` (cream-cherry) fades to white over 1200 ms: rgb 229,213,212 at 0, 238,227,227 at 100 ms, 252,250,250 at 400 ms, white at 800 ms. At 11 % darkness it is barely perceptible after the first ~300 ms.
**Push-down.** Old top row top: 337.5 px before, **389.5 px on the very next frame and constant afterwards** (A3: 337.5 to 493.5). Pure teleport; no glide. The 52 px hole is empty (opacity 0) for the first frame, then fills (opacity 0.147 at +17 ms). CLS 0.02 / 0.06.
**Mobile.** `card-enter` starts at height **32 px, not 0** (the card's 16 px vertical padding cannot collapse inside `min-height:0; overflow:hidden`), so the card below moves 351 to 383 px instantly, then glides the remaining 102 px to 485 px: 71 % done at 50 ms, 95 % at 100 ms, done at 283 ms (grid-template-rows + margin + transform + opacity, layout-animated). `overflow:hidden` on the inner link clips `shadow-card` for the whole reveal (visible in the filmstrip: the new card has no shadow until it finishes). CLS 0.082 (1 row) / 0.255 (3 rows). Card opacity t90 = 117 ms.
**WebKit.** Same curves (desktop opacity residual 0.005, t90 185 ms), same 52 px teleport (336.81 to 388.81), same 32 px mobile initial jump. Table-row opacity and background-color animations work in WebKit.
**Dropped frames / long tasks.** None (A3 desktop one 33 ms frame).
**Reduced motion (Chromium).** Opacity stays 1 (no fade), tint fades linearly over 1200 ms as designed; rows still jump (a position change, not an animation); mobile card appears at full 126 px height. Pass.
**Interruptibility.** CSS animations on persistent keyed nodes, `fresh` set cleared at 1500 ms (> 1200 ms), so a second arrival neither restarts nor cuts the first. A second arrival inside 1.5 s would not re-trigger a shift animation if one were class-driven (see proposal).

Grade detail: timing B (fade tail too long), easing A, continuity **D** (teleport), interruptibility A, performance B (mobile layout animation), reduced motion A.

**Proposal (exact values).** Table rows accept `transform` in both engines (verified: `harness/diag-flip.js`, Chromium and WebKit move rows mid-animation), so rows below can glide with a FLIP on the existing rows, no layout animation:
```css
/* globals.css */
@keyframes row-shift { from { transform: translateY(calc(var(--shift) * -1)); } to { transform: none; } }
.row-shift-a { animation: row-shift 260ms var(--ease-out) backwards; }
.row-shift-b { animation: row-shift-b 260ms var(--ease-out) backwards; } /* duplicate keyframes named row-shift-b */
```
In `message-list.tsx` give every NON-fresh row `className="row-shift-a|b"` and `style={{ '--shift': `${freshCount * 52}px` }}` (desktop) while `freshIds.size > 0`; alternate a/b per arrival batch (counter in `useFreshIds`) so a second batch replays. Mobile: `--shift = freshCount * (measured card height + 8)` read from the new card ref in the layout effect. Then change the entrances:
- `.row-enter { animation: row-enter 240ms var(--ease-out) backwards, row-tint 1000ms var(--ease-out) backwards; }` with `row-enter` reduced to `from {opacity:0} to {opacity:1}` (the 480 ms keyframe is 90 % done at 183 ms, so 240 ms loses nothing).
- Delete `card-enter` grid/margin/transform keyframes; new card: `animation: row-enter 220ms var(--ease-out) backwards` on the `li`, remove `overflow:hidden` and `min-height:0` from `.card-enter > a` (restores the shadow), keep the 1000 ms tint on the `a`.
- 3 arrivals: stagger the new rows `animation-delay: calc(var(--i) * 40ms)`, shift all lower rows once by `3 * 52` px (one move, not three).
- Raise tint contrast so it reads: start colour `#F0DCDA` (about 18 % darker than white) instead of `#E5D5D4`'s subtle 11 %, only if the new row still looks unmarked on a real screen (feel-check).
- Reduced motion: keep as is; also give `.row-shift-*` `animation: none` under `prefers-reduced-motion`.

## B1. Counter first-load count-up

Files: `B1-*.png`. Value arrives 100 ms (Chromium) / 160-168 ms (WebKit) after navigation; the last real "0" shows for 5-6 frames before. Count-up 0 to 1,125,923 follows easeOutCubic over 700 ms exactly (residual 0.006 vs `1-(1-t)^3`): t10 33 ms, t50 150 ms, t90 383 ms, t100 700 ms. No dropped frames, no long tasks, CLS 0.003-0.005 (digit growth at the start). Reduced motion: value set immediately (t=0). WebKit identical (t50 135-147 ms).
Notes: a rAF-driven `setState` re-renders the span 42 times; fine here. A poll arriving during the count (slow API) cancels the rAF and snaps to the new value (no continuation). Grade B+: nothing wrong, rare-tier delight is appropriate.
Proposal: none required. Optional: keep as is.

## B2. Counter increment tick

Files: `B2-*.png`. `key={tick}` remount; `opacity .55 -> 1`, `translateY 6px -> 0`, 220 ms `cubic-bezier(.23,1,.32,1)`; measured exactly: opacity 0.689 at 17 ms, 0.931 at 67 ms, 0.994 at 133 ms, ends at 233 ms (transform and opacity only, compositor). Perf clean, CLS 0. Reduced motion: no tick. WebKit identical.
Problem: the key remounts the whole 7-digit number on every +1..+3 poll, so a busy chain makes the hero number dip to 55 % and bounce every couple of seconds. It is the largest-type element on the page.
Proposal: `opacity .75`, `translateY 4px`, 180 ms (`@keyframes tick { from {opacity:.75; transform:translateY(4px)} }`), and key only the last two digits (split `display` into `head` + keyed `tail`) so only the changing digits move. Grade B.

## C. Filter / page change (dim and swap)

Files: `C1-*.png`, `C2-*.png`. Real queries delayed 350 ms.
**Dim.** Wrapper opacity 1 to 0.6 with tailwind `ease-out` `cubic-bezier(0,0,.2,1)`, 150 ms: 0.868 at 33 ms, 0.65 at 100 ms, 0.60 at 150-167 ms (starts 1 frame after the click). **Swap**: the 20 rows are replaced in one frame while opacity is 0.6-0.73 (hidden under the dim, good), then back to 1 over ~150 ms (0.73 at +17 ms, 0.95 at +83 ms, 1 at 133 ms). No skeleton frames, wrapper height 1099-1100 px (mobile 2744-2772). Dim to full recovery: 480 ms after click for a 350 ms response.
**Interrupted (C2, second click at 120 ms).** Dim stays continuously at 0.6 (no flicker back), one swap at 517 ms for page 3 only, page 2 never shown. Good interruptibility. Mobile page height dips to 2688 (28-84 px) during the double change.
**Main problem: Chromium scroll anchoring.** At the swap commit `scrollY` goes **673 to 204 (desktop), 2495 to 1261 (mobile)** while the document height is unchanged (1573 to 1572), so the user who clicked "next" at the bottom of the list lands ~470 px (desktop) / ~1234 px (mobile) higher, mid-list, with content jumping. Layout-shift entries: 0.24 desktop, 1.00 mobile. Cause: all row keys change at once, Chrome re-anchors. `harness/diag-scroll.js` shows `*{overflow-anchor:none}` keeps scrollY at 672; **`[aria-busy]{overflow-anchor:none}` alone also keeps it at 672**. WebKit does not scroll (673 stays 672, mobile 2495 to 2467), so this is Chromium (and Firefox-class) only.
**Reduced motion.** Dim state retained (0.6 within 1-2 frames, effectively instant), no animation. Pass.
**Perf.** No dropped frames, 0 long tasks.
Grade detail: timing B, easing B, continuity C (scroll jump), interruptibility A, performance A, reduced motion A.

**Proposal.**
1. `page.tsx` wrapper: add `[overflow-anchor:none]` (Tailwind arbitrary property) to the `aria-busy` div. Fixes the jump (verified).
2. Avoid a 0.6 flash for fast responses: dim only if loading lasts > 100 ms: stale classes `opacity-60 pointer-events-none transition-opacity duration-150 ease-out delay-100`; not stale `opacity-100 transition-opacity duration-100 ease-out delay-0`. (Net: a response under 100 ms never dims; slower ones dim 100 ms later.)
3. Optional: scroll the list top into view smoothly when the page number changes (`scroll-margin` + `scrollIntoView({block:'start', behavior:'smooth'})`) so the page change is spatially explained; skip under reduced motion.

## D. Status pill pending to executed

Files: `D-*.png`. Transition `cubic-bezier(0.4,0,0.2,1)` 300 ms on pill background (rgb 248,243,243 to 230,248,236), text colour (107,92,91 to 72,52,52), border and dot. Measured: bg t10 50 ms, t50 117 ms, t90 200 ms, t99 250 ms (consistent with that curve: it is 83 % done at 150 ms). Dot background fades in from transparent; text label swaps at frame 0 (a text node cannot tween). The row is untouched (opacity 1, no animation replay), width stable (`min-w-24`). CLS 0. Perf clean. WebKit identical (t90 197-201 ms). Reduced motion: instant swap (one frame). Interruptibility: CSS transition, retargets naturally.
Note: the desktop and mobile markup are both in the DOM; probe selector must target `a.table-row` on desktop (the hidden mobile card would show no transition).
Grade A-. Proposal: none required. Optional `duration-200` (t90 would be ~133 ms) so the colour change lands closer to the label swap.

## E. Copy button click

Files: `E-*.png`.
Press: `active:scale-95`, 100 ms ease-out, reaches 0.95 (0.987 at 17 ms, 0.966 at 67 ms). Icon swap to the check: `icon-pop` scale 0.8 to 1 plus opacity, 160 ms `cubic-bezier(.23,1,.32,1)`: opacity t50 33 ms, t99 117 ms (transform and opacity, compositor). "Copied" label fade 150 ms. Revert after 1500 ms: icon and label disappear in a single frame (no exit animation).
**Layout shift.** The label goes from 1 px (`sr-only`) to 40.6 px in flow: desktop button moves 796.6 to 795.8 px (0.8 px); **mobile button moves 300.1 to 254.4 px (46 px left) and the hash text reflows/wraps** (see `E-chromium-mobile.png`), then snaps back at +1500 ms. WebKit identical.
**Reduced motion.** Press still scales to 0.95 instantly (state feedback, acceptable), pop and fade collapse to instant.
Grade detail: timing A, easing A, continuity C (reflow), interruptibility B (rapid second click: `copied` stays true, timer reset, fine), performance A, reduced motion B.
**Proposal.** Take the label out of flow: wrapper `relative`, label `absolute -top-8 right-0 rounded-small bg-espresso px-2 py-1 text-xs text-white whitespace-nowrap pointer-events-none` with `copied-fade` 150 ms and an exit `opacity 1 to 0, 120 ms` (keep mounted; toggle class), so nothing reflows on either viewport. Keep the `role="status"` text. Optional press scale 0.96 (0.95 is on the strong side for a 32 px target).

## F. Row hover accent bar

Files: `F-chromium-desktop.png`, `F-webkit-desktop.png` (desktop only; mobile cards have no hover bar). Bar `::before` opacity 0 to 1 and row background (255 to 248,243,243) both transition 150 ms: bar t10 17 ms, t50 ~35 ms, **t90 83 ms**, full at 117 ms (ease-out). Exit: bar below 90 % at +17 ms after the pointer leaves, below 10 % at ~100 ms. Chromium and WebKit identical (t90 83 ms; WebKit one 78 ms rAF hitch in the run, unrelated). Performance clean; bar is compositor, row bg is paint.
Reduced motion: fades collapse to instant (fine). Grade A-. Proposal: none required. (Optional: hover-capable gating `@media (hover:hover)` for the bar so it cannot stick after a tap on touch; not verified in this run.)

## WebKit findings

- Same curves and timings as Chromium for all keyframes and transitions; `opacity`/`background-color` animation on `display:table-row` works; `transform` on table rows works (needed for the proposed FLIP).
- `grid-template-rows` interpolation works (mobile card reveal measured, same 32 px initial height).
- No scroll-anchoring jump on page change (Chromium-only bug).
- `longtask` and `layout-shift` observers are unsupported: layout shift judged by row rects (teleport identical to Chromium).
- App hydrates slower: counter value arrives at 160-168 ms vs 100 ms.
- Isolated hitches (78 ms on hover, 37 ms in C2 mobile) in headless WebKit, not reproducible across runs; treat as noise unless seen in real Safari.

## Biggest problems, ranked

1. **Rows below the new row teleport** (52 px / 156 px in one frame, desktop and mobile; mobile also has a 32 px instant jump and clipped shadow). Evidence: row top 337.5 to 389.5 on frame 2, constant afterwards.
2. **Page-change scroll jump in Chromium** (scrollY 673 to 204 desktop, 2495 to 1261 mobile; CLS 0.24 / 1.0). Fix: `overflow-anchor:none` on the list wrapper (verified).
3. **"Copied" label reflows the row on mobile** (button 46 px left, hash re-wraps). Fix: take the label out of flow.

Secondary: tick replays on the whole number every poll; 480 ms row-enter opacity has a 280 ms dead tail; tint peak is only 11 % darker than white.

## Re-run

Harness lives outside the repo (persistent, with `node_modules` and the frozen API responses): `/Users/david/Github/_scratch-sodax-scan/anim-harness/`. A backup of the scripts is in `docs/design-audit/animation-grading/harness/` (needs `npm i playwright@1.64.0`, no browser download).

```
cd /Users/david/Github/_scratch-sodax-scan/anim-harness
node run.js                      # all scenarios, chromium+webkit, desktop+mobile, perf + probe passes, filmstrips
node run.js --browser chromium --vp mobile --only A1,E   # subset
node run.js --browser chromium --rm --only A1,B1,B2,C1,D,E   # reduced motion
./shrink.sh                      # keeps every filmstrip PNG under 1.4 MB
node report.js > out/report.txt  # numeric summary (per-frame curves, t10/t50/t90, residuals, CLS, dropped frames)
```
The server on :3100 must already be running (not started by the harness). `BASE_URL` overrides the origin, `DOCS_DIR` the filmstrip output. API responses are frozen in `frozen/` (delete the files to refetch). Filmstrips and `out/` are overwritten each run.
