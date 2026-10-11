# Pavielle — notes for Claude

Online women's fashion store (Sri Lanka). pnpm monorepo, TypeScript everywhere. Read README.md for architecture.

## Commands
- `pnpm install` · `pnpm typecheck` · `pnpm test` · `pnpm build` (run all three before saying work is done)
- API tests need Postgres 16 at `postgres://postgres@localhost:5432/pavielle_test` (override with `TEST_DATABASE_URL`)
- Dev: `pnpm dev:api` (8787), `pnpm dev:store` (3000), `pnpm dev:admin` (5173)
- Schema change: edit `services/api/src/db/schema.ts` → `pnpm --filter @pavielle/api db:generate --name <change>` → commit the SQL

## Rules that must not be broken
- Money is integer LKR cents (`rs()`, `formatLkr()` from `@pavielle/shared`). Never floats.
- Stock changes go through `modules/inventory/service.ts` only, inside a transaction, and always write a `movements` row.
- Order status changes go through `transitionOrder()` only. Update `TRANSITIONS` (and the admin's `NEXT` map) together.
- An order is marked paid only from the verified PayHere server notification, never from a browser redirect.
- Never store card data. Secrets come from SSM (`config.ts`), never from code or Terraform state.
- Migrations must be additive (they run before new code goes live).
- Keep hosting near-free: no NAT gateway, load balancer, RDS Proxy, Aurora, always-on containers or Secrets Manager.
  Don't add frequent scheduled DB jobs — Neon scales to zero after 5 idle minutes.
- Storefront is a static export (`output: "export"`): no server components that need a runtime, no API routes.

## Conventions
- API: Hono routes in `src/routes/`, business logic in `src/modules/<module>/service.ts`, validate input with zod.
- Each module owns its Postgres schema (catalog, inventory, sales, people, production). Don't join across modules in new code
  unless reading for display.
- Every behaviour change to checkout, stock, payments or order status gets an integration test in `services/api/test/`.
- Shared types/validation used by more than one app live in `packages/shared` (extensionless imports there).
- Any storefront or customer-facing UI follows the `pavielle-brand` skill (`.claude/skills/pavielle-brand/SKILL.md`).

## Local environment
- `docker-compose.yml` runs Postgres 16 (databases `pavielle` and `pavielle_test`, trust auth, port 5432); start it with `pnpm db:up`.
  If 5432 is taken, set `PAVIELLE_DB_PORT` in the root `.env` (gitignored) and use the same port in `services/api/.env`
  and `TEST_DATABASE_URL`.
- `services/api/.env` comes from `.env.example`; `apps/admin/.env.local` comes from its example.
- Fresh setup: `pnpm install` → `pnpm db:up` → migrate → seed → `pnpm typecheck && pnpm test && pnpm build`.

## Customer journeys
Three journeys every change must keep working: **browse** (home → product → bag, no purchase),
**cash on delivery** (bag → checkout → `AWAITING_CONFIRMATION` → staff call → `CONFIRMED` … `DELIVERED`, cash to courier),
**card** (bag → checkout → `PENDING_PAYMENT` → PayHere → verified notify → `CONFIRMED`). Bank transfer also exists
(`AWAITING_CONFIRMATION`, staff confirm), but the storefront shows no bank details yet.

Facts the journeys depend on (change them in one place only):
- Delivery: Rs. 400 flat, free from Rs. 15,000 (`DELIVERY_POLICY` in `packages/shared/src/pricing.ts`).
- Stock holds: 30 min for PayHere, 48 h for COD and bank transfer (`HOLD_MINUTES`). Expired holds are cancelled at the next
  checkout and by the hourly job.
- Checkout limits: 1–20 lines, quantity 1–10 per line, Sri Lankan mobile (`07XXXXXXXX` / `+947XXXXXXXX`).
- Customers are keyed by phone. `prepayOnly` customers cannot choose COD.

When a change touches checkout, stock, payments or order status, its tests must cover the cases that apply:
- several items, including the same SKU twice and a line that runs out of stock at checkout;
- COD: placed, confirmed, cancelled by staff, hold expired, delivery failed then returned, prepay-only rejected;
- card: paid, declined, cancelled on PayHere, tab closed (hold expires), paid after the hold expired (needs review),
  duplicate notification, wrong amount, chargeback.

## Launch priorities (Phase 1 "Not built yet" in README)
1. Product image upload — Cloudflare R2 presigned uploads (cheapest option).
2. Order confirmation emails — SES.
3. Policy and size-chart pages.
4. Cloudflare Turnstile on checkout.

Gaps found in the customer-journey walkthrough (2026-10-11), not yet scheduled:
- Card cancel/decline empties the bag and the order keeps holding stock for 30 min (most serious).
- No way to look up an order later (the API has `GET /store/orders/:ref?phone=`; the storefront has no page for it).
- Bank transfer can be chosen but no bank details are shown, so it can't be completed.
- Checkout errors show SKU codes ("Not enough stock for PV-SMD-01-BLS-M") and a network failure leaves the order state unknown.
- No contact / WhatsApp link; no categories, search or filters; delivery fee only visible in the bag.

## How we work
- Before changing anything, understand the stock-reservation and PayHere rules in `services/api/src/modules/`
  (inventory, orders, payments).
- One task at a time. Before coding, show a short plan: files you'll touch, schema changes, and tests you'll add.
  Wait for approval before building.
- Every change to checkout, stock, payments or order status needs an integration test.
- Don't add paid AWS services or anything always-on without asking first.
- Finish each task with typecheck, test and build all passing, and a suggested commit message.
