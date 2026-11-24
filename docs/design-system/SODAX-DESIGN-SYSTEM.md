# SODAX Design System Reference

Pulled from the SODAX Marketing MCP on 2026-11-24

Source: Figma Design System - B2B World (https://www.figma.com/design/yvIOJVF69NF6aV5ItWUsGF/Design-system---B2B-world). Overview "Last Updated": 2026-11-24T11:24:37.558Z. Token file `meta.lastSynced`: 2026-07-10. Raw token file: `sodax-design-tokens.json` (same folder).

Tool status: all seven tools succeeded (design tokens, brand colors, typography, layout tokens, usage guidelines, logos, brand assets overview). Overview counts: 41 colors, 3 typefaces, 9 font sizes, 18 spacing steps, 7 border radii, 6 stroke widths, 3 logo variants, 8 usage-guideline sections.

Note: the MCP says to reference token ids, never hardcode hex values.

## 1. Brand colors

### Primary (group: primary). Description: "Cherry soda brand palette: primary CTA and brand moments"

| Name | Token id | Hex | Notes |
|---|---|---|---|
| Cherry Soda | `cherry-soda` | #A55C55 | Guidelines: primary brand surface (hero, section fills, card backgrounds) |
| Cherry Dark | `cherry-dark` | #964D48 | Guidelines: deeper cherry (darker hero, footer, announcement bar) |
| Hover Cherry Dark | `hover-cherry-dark` | #964D48 | Aliases cherry-dark 1:1 in Figma; no distinct hover value yet |
| Hover Cherry Soda | `hover-cherry-soda` | #A55C55 | Aliases cherry-soda 1:1 in Figma; no distinct hover value yet |
| Clicked Cherry On Cherry | `clicked-cherry-on-cherry` | #C36C65 | |
| Focused Cherry On Cherry | `focused-cherry-on-cherry` | #C36C65 | |
| Disabled Cherry Grey | `disabled-cherry-grey` | #D7CDCB | |

### Secondary (group: secondary). Description: "Yellow soda accent palette"

| Name | Token id | Hex | Notes |
|---|---|---|---|
| Yellow Dark | `yellow-dark` | #ECC100 | Guidelines: Shrikhand accent words and primary CTAs only, never a background |
| Yellow Soda | `yellow-soda` | #FFD92F | Same use as yellow-dark |
| Hover Yellow Dark | `hover-yellow-dark` | #ECC100 | Aliases yellow-dark 1:1 in Figma |
| Hover Yellow Soda | `hover-yellow-soda` | #FFD92F | Aliases yellow-soda 1:1 in Figma |
| Clicked Soda On Soda | `clicked-soda-on-soda` | #F6E799 | |
| Focused Soda On Soda | `focused-soda-on-soda` | #F6E799 | |
| Disabled Soda Grey | `disabled-soda-grey` | #D7D6CB | |

### Neutral, light (group: neutral). Description: "Light neutrals: backgrounds, surfaces, dividers"

| Name | Token id | Hex | Intended use (from usage guidelines, where stated) |
|---|---|---|---|
| Cherry On Cherry | `cherry-on-cherry` | #C36C65 | Cards/buttons nested inside cherry surfaces |
| Cherry Plus | `cherry-plus` | #AD635C | Token file: "matches hex previously hardcoded in build-section.tsx" |
| Cherry Bright | `cherry-bright` | #CC9E9A | not stated |
| Cherry Brighter | `cherry-brighter` | #E3BEBB | Secondary text on cherry backgrounds |
| Cream Cherry | `cream-cherry` | #E5D5D4 | not stated |
| Cream White | `cream-white` | #EDE6E6 | Bubble backgrounds, secondary text on dark; left-border accents |
| Light Cream | `light-cream` | #F0EAEB | not stated |
| Almost White | `almost-white` | #F8F3F3 | Subtle backgrounds, bubble/tag backgrounds on light surfaces |
| Vibrant White | `vibrant-white` | #F9F7F5 | Default page/slide background (Figma variable is named "Vibrat white", upstream typo) |
| Chalk | `chalk` | #FBFBFB | not stated |
| White | `white` | #FFFFFF | Text and elements on cherry/dark surfaces |

### Neutral, dark (group: neutral). Description: "Dark neutrals: text, borders, dark surfaces"

| Name | Token id | Hex | Intended use (from usage guidelines, where stated) |
|---|---|---|---|
| Charcoal | `charcoal` | #1D1414 | not stated |
| Espresso | `espresso` | #483434 | Dark text on light surfaces; dark accent surfaces |
| Clay Dark | `clay-dark` | #6B5C5B | Body text on light backgrounds |
| Clay | `clay` | #8E7E7D | Secondary labels, captions |
| Clay Light | `clay-light` | #B9ACAB | not stated |
| Cherry Grey | `cherry-grey` | #D7CDCB | not stated |

### Semantic (group: semantic)

Error ("Error/destructive states"):

| Name | Token id | Hex |
|---|---|---|
| Error Base | `error-base` | #FAECEC |
| Error Lighter | `error-lighter` | #F5DBDB |
| Error Light | `error-light` | #D8696C |
| Error | `error` | #CE4446 |
| Error Dark | `error-dark` | #A73639 |

Success ("Success/confirmation states"):

| Name | Token id | Hex |
|---|---|---|
| Success Base | `success-base` | #E6F8EC |
| Success Lighter | `success-lighter` | #CEF0DC |
| Success Light | `success-light` | #6DD696 |
| Success | `success` | #0ABA51 |
| Success Dark | `success-dark` | #089541 |

### Discrepancy to be aware of

The usage guidelines write `cherry-on-cherry` as `#c26c64`; the token file and colors tool give #C36C65. The token value (#C36C65) is the generated one.

## 2. Typography

### Families and roles

| Family | Stated role |
|---|---|
| Inter | body, labels, paragraph headings, UI, stats, card content |
| Inria Serif | display headings (all media). For primary display titles only: the largest headline on a page or slide. Never use it for subtitles, card titles, or body. Everything below the main title is Inter. |
| Shrikhand | only one word, but can use 2 if both are short (4 characters or less), never use Shrikhand for a long word, always lower cases unless it's an acronym. |

Token file font-family keys: `heading` = Inter, `body` = Inter, `serif-heading` = Inria Serif ("Display headings"), `playful-heading` = Shrikhand ("Single accent word per headline only").

How the fonts are obtained or licensed: the MCP responses do not state this. Not stated.

### Font size scale per breakpoint (px)

Figma Typography collection has three modes (Desktop / Tablet / Mobile); sizes genuinely change per device. Breakpoint widths (Device size collection): mobile 375, large-mobile 640, tablet 820, desktop 1440, large-desktop 2560.

| Style | Desktop | Tablet | Mobile |
|---|---|---|---|
| h1 | 40 | 36 | 32 |
| h2 | 32 | 28 | 24 |
| h3 | 28 | 24 | 22 |
| h4 | 24 | 22 | 20 |
| h5 | 22 | 20 | 18 |
| body-large | 18 | 18 | 16 |
| body-regular | 16 | 16 | 14 |
| body-small | 14 | 14 | 12 |
| body-xsmall | 12 | 12 | 10 |

### Font weights

Light, Regular, Medium, Bold, Black.

### Line heights (px)

h1 48, h2 40, h3 32, h4 32, h5 32, body-large 26, body-regular 22, body-small 18, body-xsmall 18.

Caveat from the token file: these are not Figma variables; they are hardcoded per composite font style at Desktop size and were not re-verified per breakpoint. Treat as approximate; confirm in Figma before using at Tablet/Mobile sizes.

### Usage-guideline type scale (by use case)

| Use case | Size | Weight | Font | On dark bg | On light bg |
|---|---|---|---|---|---|
| Hero / large display | 68-160px | Regular | Inria Serif / Inter | `yellow-soda` | `espresso` |
| Deck / doc title | 40-68px | Regular | Inria Serif | `yellow-soda` | `espresso` |
| Section heading | 32-40px | Bold | Inter | `yellow-soda` | `cherry-soda` |
| Panel / slide heading | 24px | Bold or Medium | Inter | `white` | `cherry-soda` or `espresso` |
| Card title | 20px | Bold | Inter | `white` | `espresso` |
| Body large | 18-24px | Light | Inter | `white` / `cream-white` | `clay-dark` |
| Body comfortable | 14-16px | Regular | Inter | `white` | `clay-dark` |
| Caption / label | 10-12px | Regular | Inter | `cherry-brighter` | `clay` |
| Stat large | 68-160px | Regular | Inter | `yellow-soda` | `yellow-dark` |
| Stat small | 32px | Bold | Inter | `white` | `espresso` |
| Stat label | 14-16px | Regular | Inter | `cherry-brighter` | `clay` |

Guideline line heights: display headlines 1.1-1.2; body 1.4; stat numbers 1.1-1.2; tight labels 1.3.

## 3. Layout tokens (px)

Spacing scale ("Universal Sizes", verified against the real Figma collection): 2, 4, 8, 12, 14, 16, 18, 22, 24, 26, 28, 32, 40, 44, 48, 56, 80, 120.

Border radius:

| Token | px |
|---|---|
| micro | 2 |
| xsmall | 4 |
| small | 8 |
| medium | 12 |
| regular | 16 |
| large | 24 |
| xlarge | 32 |

No "full/pill" radius token exists; pill shapes use an arbitrary large px value in code, not a variable.

Stroke widths:

| Token | px |
|---|---|
| xsmall | 1 |
| msmall | 1.5 |
| small | 2 |
| medium | 4 |
| large | 8 |
| xlarge | 12 |

Discrepancy: the usage guidelines' spacing table lists `spacing.64` (64px, website section padding) and `spacing.96` (96px, wide column gap, website), which are NOT in the token scale above (the token file notes the old scale values 1, 6, 10, 20, 64 "did not exist in Figma"). Guideline spacing uses, as stated:

| Token | px | Common use |
|---|---|---|
| `spacing.8` | 8 | Icon-to-label gap, tight gaps |
| `spacing.16` | 16 | Internal component gap |
| `spacing.24` | 24 | Card padding, column gap |
| `spacing.32` | 32 | Within-section gap |
| `spacing.40` | 40 | Section padding (slides/docs) |
| `spacing.48` | 48 | Headline-to-content gap |
| `spacing.56` | 56 | Section padding (decks) |
| `spacing.64` | 64 | Section padding (website) |
| `spacing.80` | 80 | Large section padding |
| `spacing.96` | 96 | Wide column gap (website) |
| `spacing.120` | 120 | Max section padding (docs) |

## 4. Usage guidelines and brand rules

(Reproduced from `sodax_get_usage_guidelines`; substance kept as authored.)

### Brand personality

SODAX is a B2B DeFi infrastructure product. These traits apply to everything: slides, websites, PDFs, social assets:

- Warm, not cold: palette built on cherry/terracotta reds and cream whites, never cold blues or dark neons.
- Confident, not loud: layouts breathe, hierarchy is clear, nothing competes.
- Technical, not sterile: precision in spacing and type, warmth in colour and texture.
- Playful accent: Shrikhand italic appears on one key word per headline. One word, never a sentence.

Do not produce work that feels generic, crypto-generic (dark + neon), or overly corporate.

### Colour

Always reference tokens from `sodax-tokens.json`. Never hardcode hex values.

| Token | Usage |
|---|---|
| `cherry-soda` | Primary brand surface: hero, section fills, card backgrounds |
| `cherry-dark` | Deeper cherry: darker hero, footer, announcement bar |
| `yellow-dark` / `yellow-soda` | Shrikhand accent words and primary CTAs only: never a background |
| `white` | Text and elements on cherry/dark surfaces |
| `almost-white` | Subtle backgrounds, bubble/tag backgrounds on light surfaces |
| `vibrant-white` | Default page/slide background |
| `cream-white` | Bubble backgrounds, secondary text on dark; left-border accents |
| `espresso` | Dark text on light surfaces; dark accent surfaces |
| `clay-dark` | Body text on light backgrounds |
| `clay` | Secondary labels, captions |
| `cherry-brighter` | Secondary text on cherry backgrounds |
| `cherry-on-cherry` (`#c26c64` as written in the guidelines) | Cards and buttons nested inside cherry surfaces |

Body font colour: ensure body or small texts use enough contrast within the palette.

CTA colour rule:
- On cherry/dark surface: `yellow-dark` bg, `cherry-dark` text.
- On light surface: `cherry-soda` bg, `white` text.
- Ghost/footer variant: `almost-white` bg, `cherry-soda` bold text.

Yellow rule: `yellow-dark` / `yellow-soda` is accent only, used only over cherry backgrounds. Never a surface background.

### Typography rules

- Inter: body, labels, paragraph headings, UI, stats, card content.
- Inria Serif: display headings (all media). For primary display titles only: the largest headline on a page or slide. Never use it for subtitles, card titles, or body. Everything below the main title is Inter.
- Shrikhand: only one word, but can use 2 if both are short (4 characters or less), never use Shrikhand for a long word, always lower cases unless it's an acronym.
- Shrikhand rule: one Shrikhand italic word per headline, always `yellow-dark` or `yellow-soda` regardless of background. Examples: *One* SDK. *instant* liquidity. *assets* across networks. *exercise*. *truth*.

### Buttons

| Variant | Background | Text | Radius | Height | Use when |
|---|---|---|---|---|---|
| Primary | `yellow-dark` | `cherry-dark` | pill | 48px | On cherry/dark surface |
| Primary | `cherry-soda` | `white` | pill | 48px | On light surface |
| Secondary | `cherry-on-cherry` | `white` | pill | 40px | Inside cherry card |
| Outline | `cherry-on-cherry` border 4px | `cherry-brighter` | pill | 40px | Coming soon / inactive |
| Ghost | `almost-white` | `cherry-soda` bold | pill | 48px | Deck/doc footer |

### Reusable patterns

These appear across all media; use them consistently regardless of medium.

- Shrikhand headline: one Inria Serif headline with one Shrikhand italic word in `yellow-dark` or `yellow-soda`. Sizes vary by medium (see scale).
- Social proof bubble: short customer result tag (slides, website panels, docs). Background `cream-white` (light surface) or `almost-white` (cherry surface). Small pill shape, `borderRadius.small`, comfortable horizontal padding. Left: small partner logo icon. Right: Inter Regular, `cherry-dark` or `espresso`. One per content block, below body text.
- Benchmark bubble: same structure as social proof bubble, but text is a threshold value. Examples: "10+ is diversified", "7 days is fast", "2 devs is lean". Icon: contextual system icon (network, droplet, zap, users).
- Colour tag / section label: small pill labelling a section, above the headline. Light surface: `almost-white` bg, `cherry-soda` text, Inter Medium, `borderRadius.small`. Cherry surface: `cherry-brighter` bg, `white` text.
- Comparison list (on cherry surface): equal columns comparing approaches with check/X items. Column title Inter Bold `white`. Icon bubble: small circle, `cherry-on-cherry` bg, check or X icon in white. Item text Inter Light, `almost-white`.
- Cards on light surface: informational, no button (docs and decks). Background matches the surface one step darker: `white` surface gets `almost-white` card; `almost-white` surface gets `cream-white` card. Border radius `borderRadius.regular`, generous padding. Bubble tag at top, Inter Medium title (`espresso`), Inter Light body (`clay-dark`).
- Cards on cherry surface: action-oriented (website and cherry deck slides). Background `cherry-soda`, border radius `borderRadius.regular`. Highlighted variant: `cherry-on-cherry` background. Outline/inactive variant: `cherry-on-cherry` border, no fill.
- Left-border body text: editorial long-form with a visual left border. Border solid `cream-white` on the left, comfortable left padding. Inter Light, `espresso`, line-height 1.4. For analytical/honest tone content, not bullet points.
- Question box: contained callout for a key framing question. Background `cream-white`, matching border, `borderRadius.regular`. Header strip `almost-white` bg, Inter Bold, `clay-dark`. Body Inter Light Italic, `clay-dark`. One per section max.
- Evaluation grid: checkerboard grid for comparing feature criteria. Container `almost-white` bg, matching border, `borderRadius.small`. Cells alternate `white` / `almost-white`: top-left and bottom-right are `white`. Each cell: small icon + Inter Bold label + Inter Light body text. White border between rows. No buttons: purely informational.
- Bracket display: decorative curly brackets flanking a large stat or headline. Light surfaces only. Bracket SVG assets flanking a large Inria Serif display number or word.
- Quoted callout bar: frosted glass insight strip at the base of a hero or intro section. Semi-transparent white with backdrop blur, top 3-sided border in `almost-white`, top corners rounded. Inter Light Italic, `espresso`.
- Hero stat display: large number opening a cherry-surface section. Very large Inter Regular number, `yellow-soda`, left-aligned. Soda pop watermark: decorative radial SVG shape at low opacity, right side, flipped vertically. Followed by comparison list columns below.
- Network icon tile: small square tile, `white` bg, `borderRadius.small`, network logo centred, small `clay` label below.
- Asset summary stat tile: `cream-white` bg, `borderRadius.small`. Large bold number + category label + row of overlapping circular asset logos.
- Footer icon strip: row of network/brand icons evenly spaced, SODAX horizontal logo right-aligned. Used on both cherry and white footers.

### Layout rules by medium

Use only the section relevant to the output.

Slides and decks:
- Padding generous: slides should breathe, not feel packed.
- One idea per slide: don't compress multiple sections onto one.
- Background choice is per-slide based on content intent: `vibrant-white` or `almost-white` default light content slides; `cherry-soda` or `cherry-dark` impact slides, openers, closers; `white` clean data or evaluation slides.
- Closing slide: `cherry-soda` bg with headline + CTA + icon strip + logo.
- Two-column layouts: equal columns with comfortable gap.

Documents and long-form PDFs:
- Generous horizontal and vertical padding: content should never feel tight.
- Sections stack vertically: use colour tags and headlines to signal transitions.
- Tip connector (SVG notch) between stacked sections to show continuation.
- Footer: `cherry-soda` strip with icon row + logo at end of document.

Website:
- Sections alternate backgrounds for rhythm: `almost-white`, `white`, `almost-white`, cherry.
- Two-column panels: text and visual alternate sides with wide gap between them.
- Navigation: top bar, logo left, links centre-right, CTA right.

Social and marketing assets:
- Use brand colours and typography only: no new colours or fonts.
- Shrikhand accent word on headlines where space allows.
- One message per asset.
- Preferred backgrounds: `cherry-soda`, `vibrant-white`, or `almost-white`.

Reference (as stated in the guidelines): Figma file `design/figma.url`; tokens `tokens/sodax-tokens.json`; components `components/index.md`.

## 5. Logos

The MCP says: never recreate or approximate the SODAX logo; always use official assets. The URLs returned are relative paths, with no host stated in the response; the base host is not stated by the tool.

| Variant | Description | SVG | PNG |
|---|---|---|---|
| SODAX Logo (Light on Dark) | White logo for dark backgrounds | `/images/SODAX-on-dark/SODAX white logo on dark.svg` | `/images/SODAX-on-dark/SODAX-white-logo-on-dark.png` |
| SODAX Logo (Dark on White) | Dark logo for light backgrounds | `/images/SODAX-on-white/SODAX-on-white.svg` | `/images/SODAX-on-white/SODAX-on-white.png` |
| SODA Token | SODA token symbol | `/images/SODA-token/soda-token.svg` | `/images/SODA-token/soda-token.png` |
