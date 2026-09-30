---
name: pavielle-brand
description: Pavielle brand colours, fonts and UI patterns. Use whenever you design, prototype, build or restyle any Pavielle storefront UI (apps/storefront pages and components, email templates, policy or size-chart pages, design canvases or mockups of the shop), or pick colours or fonts for anything customer-facing.
---

# Pavielle brand

Soft, feminine, timeless. Rose-gold foil on blush paper (from the logo). Tagline: "Timeless elegance. Softly yours."
Brand words: Elegant · Feminine · Timeless · Effortless.

Reference prototype (design canvas, source of truth for layout): https://claude.ai/artifact/Ezu1uvbrDFcZBzAh4ToWYr
The built storefront follows it; when in doubt, match `apps/storefront/app/globals.css`.

## Core palette

Use the CSS variables in code; never hard-code a new hex in the storefront.

| Token | Hex | Use |
|---|---|---|
| `--porcelain` | `#FBF7F4` | Page background |
| `--shell` | `#F6ECE8` | Section bands, cards, footer, "added" notices |
| `--veil` | `#EFD9D4` | Image placeholders, hero art. Only Cocoa Ink text on it |
| `--line` | `#E8D9D3` | Borders, dividers, input outlines |
| `--rose-gold` | `#B8876B` | Logo, ornaments, icons. **Decorative only** (2.9:1, fails for text) |
| `--accent` (Rose Gold Deep) | `#8A5C45` | Buttons, links, prices, wordmark. 5.3:1 on Porcelain; white on it 5.7:1 |
| `--ink` (Cocoa Ink) | `#3A2B28` | Headings, body text, announcement bar background |
| `--muted` (Taupe) | `#7A6660` | Secondary text, captions, eyebrows |

Status: `--success #4E7358` (in stock, paid), `--warning #92600F` (low stock, awaiting payment),
`--error #A0413C` (form errors, payment failed), `--info #4A6A86` (delivery notices).

## Fabric colourways

Product colour names map to swatch hexes in `apps/storefront/lib/colours.ts`. Add new colours there, never inline.

| Colour | Hex | Line |
|---|---|---|
| Blush | `#EBC9C4` | Soft Midi Dress · crepe |
| Ivory | `#F3ECE0` | Soft Midi Dress · crepe |
| Powder Blue | `#C8D7E5` | Flowing Maxi · georgette |
| Sage | `#C3CFBA` | Flowing Maxi · georgette |
| Peach | `#F1D3C1` | Proposed |
| Mint | `#CFE2D6` | Proposed |

Crepe is matte: show its colour solid. Georgette is sheer: show it at ~0.6–0.7 opacity over Porcelain.
Pastels are too light for text; label them in Cocoa Ink. Unknown colour names fall back to a text chip.

## Typography

- **Cormorant Garamond** (`--serif`, 400/500/600): headings, product names, the PAVIELLE wordmark
  (weight 500, letter-spacing ~0.32–0.34em, colour `--accent`).
- **Jost** (`--sans`, 300/400/500): body, buttons, labels. Spaced capitals for eyebrows, nav and buttons
  (0.75–0.8125rem, letter-spacing 0.2–0.3em, uppercase).
- **Pinyon Script** (`--script`): accent only, **one short phrase per page** ("Softly yours.").
- Loaded with `next/font/google` in `app/layout.tsx` (self-hosted at build; the site is a static export).
  Never Inter, Roboto or Arial.

## Patterns

- Announcement bar: Cocoa Ink background, Porcelain spaced capitals, 40px (36px mobile).
- Header: nav left, centred wordmark, bag icon with count right; hairline bottom border. Mobile: menu button (`<details>`).
- Buttons: `.btn` filled Rose Gold Deep with white spaced capitals, 52px tall, 2px radius; `.btn-outline` for secondary.
- Ornament divider: two 72px Rose Gold lines around a small rotated square (`.ornament`).
- Product tiles: 4:5, 4px radius, tinted with the colourway hex and a faint serif "P" until a real photo exists.
- One card per product colourway, with colour dots (selected dot has an accent ring).
- Size buttons: square chips; selected = Cocoa Ink fill. Colour swatches: 44px circles, selected ring in accent.
- Icons: thin line SVG (stroke ~1.3–1.4, currentColor), in `components/Icons.tsx`. Brand-word icons in Rose Gold. No emoji.
- Radii stay small (2–6px). No gradients, heavy shadows or left-border cards.
- Layout: max width 1440px, gutter `clamp(16px, 5.5vw, 80px)`; desktop 4-column product grid, 2 columns under 900px.

## Rules

- Text must pass contrast: body text 4.5:1, large (24px+) 3:1. Rose Gold and the pastels never carry text.
- Touch targets at least 44px. Real `<button>`/`<a>`; `aria-label` on icon-only controls; `aria-pressed` on swatches and sizes.
- Money is shown with `formatLkr()` ("Rs. 11,900"); never format prices by hand.
- No invented facts (delivery times, return terms, measurements, reviews). Use real data or a clear placeholder,
  and never ship dead links: say "Coming soon" until the page exists.
- Keep the storefront a static export: styling in `globals.css` with the tokens above, no CSS-in-JS runtime, no remote font requests.
- Logo: use the text wordmark until a transparent PNG/SVG of the P monogram is added to the repo.

## Design canvases and mockups

For a prototype outside the codebase, use the same hexes and load the fonts with
`https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500&family=Pinyon+Script&display=swap`.
Photos are labelled placeholders (`[PHOTO] Soft Midi Dress · Blush`) tinted with the colourway.
