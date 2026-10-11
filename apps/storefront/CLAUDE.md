@AGENTS.md

# Storefront — notes for Claude

Static export (`output: "export"`, served from Cloudflare Pages). The catalogue is fetched at build time; stock, checkout and
order status come from the API in the browser. Design follows the `pavielle-brand` skill.

## Where each journey lives
| Step | File | Notes |
|---|---|---|
| Browse | `app/page.tsx`, `components/ProductCard.tsx` | One card per product colour; links carry `?colour=` |
| Product | `app/products/[slug]/page.tsx`, `components/ProductDetail.tsx` | Live stock from `/store/availability`; sold-out sizes disabled |
| Bag | `lib/cart.ts`, `app/cart/page.tsx`, `components/CartLink.tsx` | `localStorage` key `pavielle.cart`, this device only |
| Checkout | `app/checkout/page.tsx` | Posts `/store/checkout`; PayHere is a hidden auto-submitted form |
| Order status | `app/order/page.tsx` | Needs `?ref=` plus `pavielle.lastOrder` in `sessionStorage`; polls while `PENDING_PAYMENT` |

## Rules
- Never treat the PayHere return URL as proof of payment. The order page only shows what the API reports.
- Don't clear or rebuild the bag in a way that loses items before an order is confirmed. Today it is cleared before the
  PayHere redirect (a known gap). Fix it rather than copying the pattern.
- Bag prices are a display copy; the API reprices at checkout. Show the API's total when it differs.
- Customer-facing messages name the product, colour and size, never SKU codes or raw API errors.
  Every error says what the customer can do next.
- No dead ends: every page has a way back to shopping, and links to pages that don't exist yet say "Coming soon" instead.
- Payment options shown at checkout must be completable: don't offer a method without its instructions.
- Form fields have visible labels (not only placeholders) and correct `autoComplete`.
- Static export limits: no API routes, no server actions, no `useSearchParams` without a `<Suspense>` boundary.
  Read search params in the browser (see `ProductDetail.tsx`).
- `pnpm test` has no storefront tests yet. Behaviour that matters (checkout, payments, stock) is tested in `services/api/test/`.
  Check UI changes in a browser at desktop (1440px) and phone (390px) widths.

## Known gaps (customer-journey walkthrough, 2026-10-11)
- **Card:** cancel or decline on PayHere returns to an empty bag (`/checkout/?cancelled=` is ignored). A slow notify leaves
  the order page on "Waiting…" after polling stops. Paying after the hold expired shows "cancelled".
- **After ordering:** no order lookup page (reference + phone), no confirmation emails, no contact or WhatsApp link.
- **Checkout:** bank transfer shows no bank details; district is free text; out-of-stock errors show SKU codes;
  a network error doesn't say whether the order was placed.
- **Browsing:** no categories, search, filters or real photos; size chart, delivery and returns pages are "Coming soon";
  the delivery fee and free-delivery threshold only appear in the bag.
