# Pavielle

Customer storefront, staff admin and serverless API for Pavielle (online women's fashion, Sri Lanka).
Built to cost close to nothing at launch and grow without a rewrite.

```
Customers ──► Cloudflare Pages ── storefront (Next.js static export)
Staff     ──► Cloudflare Pages ── admin (React + Vite, Cognito login)
                    │
                    ▼  fetch
            API Gateway HTTP API ──► Lambda "api" (Hono, one app, many modules)
                                         │           ▲
          EventBridge Scheduler ──► Lambda "expire-holds" (hourly)  
                                         │
                                         ▼  pooled connection (PgBouncer)
                                   Neon Postgres
PayHere ──► POST /store/payments/payhere/notify  (server-to-server, signature checked)
```

| Path | What |
|---|---|
| `apps/storefront` | Next.js, `output: "export"`. Product pages are pre-built; stock, cart and checkout call the API. |
| `apps/admin` | Orders, COD confirmation, dispatch, inventory (receive, return, adjust, write off), products. |
| `services/api` | Hono on Lambda. Modules: catalog, inventory, orders, payments (PayHere/COD/bank transfer), staff. |
| `services/api/src/db/schema.ts` | Drizzle schema. One Postgres schema per module: `catalog`, `inventory`, `sales`, `people`, `production`. |
| `packages/shared` | Money helpers, delivery-fee rule, checkout validation, shared types. |
| `infra/terraform` | AWS: Lambdas, HTTP API, Cognito, scheduler, SSM parameters, budget alert. |

## Key design rules

- **Money** is integer LKR cents everywhere (`rs(11900)` → `1190000`).
- **Stock** has a ledger (`inventory.movements`) plus current levels (`inventory.levels`), updated in the same transaction.
  `available = on_hand − reserved`. Reserving is a conditional `UPDATE`, so concurrent checkouts can't oversell (tested).
- **Stock holds**: PayHere orders hold stock for 30 min, COD/bank-transfer for 48 h. Expired holds are released at the start of
  every checkout and by an hourly job (kept infrequent so Neon can scale to zero).
- **Orders** only change status through `transitionOrder()`, which keeps stock in step (confirm → sale; cancel → release/restock;
  failed delivery → returned restocks automatically; customer returns after delivery are restocked manually after inspection).
- **Payments**: an order is marked paid only by PayHere's signed server notification, never by the browser redirect.
  Duplicate notifications are harmless; amount mismatches and late payments on cancelled orders are flagged for review.
- **Staff auth**: Cognito verifies identity; the role (OWNER / ADMIN / PACKER / CUSTOMER_CARE) lives in `people.staff`.

## Local development

Requires Node 22, pnpm 10 and a local Postgres 16.

```bash
pnpm install
createdb pavielle && createdb pavielle_test

cp services/api/.env.example services/api/.env          # edit DATABASE_URL if needed
cp apps/admin/.env.example apps/admin/.env.local         # keep VITE_DEV_STAFF_EMAIL for local
pnpm --filter @pavielle/api db:migrate
pnpm --filter @pavielle/api db:seed                      # HOME location, owner@pavielle.test, 2 sample products

pnpm dev:api      # http://localhost:8787
pnpm dev:store    # http://localhost:3000
pnpm dev:admin    # http://localhost:5173
```

Locally the admin uses `DEV_AUTH=1` (header `x-dev-staff-email`) instead of Cognito. The API refuses to start with `DEV_AUTH` in `prod`.

```bash
pnpm typecheck && pnpm test && pnpm build
```

Schema change: edit `schema.ts`, then `pnpm --filter @pavielle/api db:generate --name <change>` and commit the SQL in `services/api/drizzle/`.
Keep migrations additive (add columns/tables first, remove old ones in a later release) because they run before new code is live.

## First deployment

1. **AWS account**: use a separate account for Pavielle. Create an S3 bucket for Terraform state and uncomment the backend in `versions.tf`.
   Create a GitHub OIDC deploy role and save its ARN as the `AWS_DEPLOY_ROLE_ARN` repo secret.
2. **Neon**: create a project in **AWS Singapore (`ap-southeast-1`)**, the same region as the Lambdas (Neon has no Mumbai region). Copy the **pooled** URL (host contains `-pooler`) and the **direct** URL.
3. **Terraform**: copy `infra/terraform/prod.tfvars.example`, fill it in, save the contents as the `PROD_TFVARS` repo secret.
   Build the API (`pnpm --filter @pavielle/api build`) then run `terraform apply` once locally or push to `main`.
4. **Secrets** (never in Terraform state):
   ```bash
   aws ssm put-parameter --overwrite --type SecureString --name /pavielle/prod/database-url        --value '<neon pooled url>'
   aws ssm put-parameter --overwrite --type SecureString --name /pavielle/prod/database-direct-url --value '<neon direct url>'
   aws ssm put-parameter --overwrite --type SecureString --name /pavielle/prod/payhere-merchant-secret --value '<secret>'
   aws ssm put-parameter --overwrite --type SecureString --name /pavielle/prod/storefront-deploy-hook-url --value '<pages deploy hook>'
   ```
5. **Cloudflare Pages**: connect the GitHub repo and create two projects.
   - Storefront: build `pnpm install && pnpm --filter @pavielle/storefront build`, output `apps/storefront/out`,
     env `API_URL` and `NEXT_PUBLIC_API_URL` = the `api_url` Terraform output. Create a deploy hook and store it in SSM (step 4)
     so product changes in the admin rebuild the storefront.
   - Admin: build `pnpm install && pnpm --filter @pavielle/admin build`, output `apps/admin/dist`,
     env `VITE_API_URL`, `VITE_COGNITO_AUTHORITY`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN` from Terraform outputs.
6. **First staff user**: create yourself in the Cognito user pool, then insert a row into `people.staff` with your Cognito `sub` and role `OWNER`.
   Add a stock location: `insert into inventory.locations (code, name) values ('HOME', 'Home studio');`
7. **PayHere**: start with sandbox (`payhere_sandbox = true`). Add your storefront domain in the PayHere merchant portal.
   Switch to live only after a full sandbox order → notify → confirmed test.

Deploys after that: push to `main`. CI runs typecheck, tests and builds. `deploy.yml` updates and runs the migration Lambda, then deploys the API.
Cloudflare Pages redeploys both frontends.

## Running cost (expected)

Near $0/month at launch: Lambda, HTTP API, scheduler, SSM standard parameters and Cognito (staff-sized) sit in free tiers or cost cents;
Neon free plan (0.5 GB), Cloudflare Pages free. The Terraform budget alert emails you at 50% of `monthly_budget_usd`.
Avoid adding: NAT gateways, load balancers, RDS Proxy, Aurora, always-on containers, Secrets Manager.

## Not built yet (next tasks)

- Product image upload (presigned upload to Cloudflare R2 or S3) — the admin currently takes image URLs
- Order emails (SES) and SMS/WhatsApp notifications
- Policy pages (delivery, returns, privacy, terms), size-chart display, SEO sitemap
- Cloudflare Turnstile on checkout to stop bot orders
- Production module endpoints (suppliers, batches → stock receipts with unit cost)
- Reports: sell-through by style/size/colour, margin, return rate, COD remittance reconciliation screen
- GA4 + Meta Pixel/Conversions API events
- Customer accounts, Mintpay/KOKO, discount and creator codes (Phase 3)
