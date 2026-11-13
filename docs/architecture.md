# Architecture

## System overview

```text
Browser
  └── Next.js App Router (apps/web, :3000)
        ├── public landing / login / demo password reset
        └── authenticated workspace
             ├── dashboard, customers, catalog, orders, invoices
             ├── team, reports, settings, audit
             └── TanStack Query client
                    │ credentialed JSON requests
                    ▼
             NestJS API (apps/api, :4000/api)
               ├── Helmet, CORS/origin checks, throttling
               ├── session authentication and role guards
               ├── Zod request validation and OpenAPI
               ├── tenant-scoped business services
               ├── transactions for orders, inventory, and invoices
               └── Prisma
                    │
                    ▼
                 PostgreSQL
```

`apps/web` owns presentation and client-side cache/state, not business authorization. `apps/api` is the authoritative boundary for identity, permissions, validation, calculations, tenant filters, audit events, and persistence. Prisma schema and migrations define the relational model.

## Identity and tenant boundaries

- `Organization` is the tenant root; `Membership` maps a user to an organization and role.
- A random opaque session token is sent in an HTTP-only cookie. Only its SHA-256 digest is persisted, so the raw bearer token is not stored in the database.
- Protected requests resolve the stored session, expiry, user, active membership, organization, and current role on the server.
- Business controllers pass `organizationId` from the authenticated principal. They do not accept tenant IDs as authority from request bodies or query strings.
- Organization-owned resource reads and writes constrain both record ID and organization ID to prevent IDOR/cross-tenant access.
- Employee role mutation and removal use serializable transactions to protect the invariant that an organization retains an admin.

## Data integrity and sensitive data

- Order prices/totals use decimal database values and are calculated by the API from current product records and organization tax settings.
- Product categories are organization-owned, uniquely named within their organization, and removable without deleting the associated products.
- Order creation and cancellation coordinate order state, inventory, invoice creation, inventory movements, and audit events in transactions.
- Inventory adjustments are conditional and reject negative stock and integer overflow.
- Invoice identifiers are unique per organization. PDF content includes only the fictional business/customer/order data required for the demo document and explicitly disclaims tax/legal use.
- CSV exports are tenant-scoped and neutralize spreadsheet-formula-leading values.
- Audit metadata records operational context only. Passwords, session cookies/tokens, and password reset tokens must never be copied into audit data.

## Security controls

- Argon2id password hashing; random opaque sessions with revocation and expiry.
- HTTP-only, SameSite=Lax cookies; production cookies use Secure.
- Credentialed CORS and exact-origin checks for browser mutations.
- NestJS throttling, including tighter authentication limits.
- Backend role guards, active membership resolution, Zod validation, and Helmet headers.
- Demo recovery/invitation flows do not send email. Reset tokens are returned only in non-production demo mode.

The in-memory throttler is suitable only for a single-instance demo. Multi-instance production requires a shared rate-limit store. Production deployment also needs TLS, secure secret management, configured origins, monitoring, and an email provider if recovery/invitations are enabled.

## Local runtime and delivery

PostgreSQL 17.12 from the official Postgres.app binary was verified locally without global services. Development and tests use separate databases and non-superuser owners; E2E requires a dedicated `_test` database and fresh web/API processes. Docker Compose offers independent development/test services on ports 5432/5433; Docker startup remains unverified locally. The web and API are separate Node applications. Both development servers and compiled server entry points passed the database-backed Playwright scenarios. GitHub Actions defines the same database preparation and checks but has not run remotely. See [local PostgreSQL](./local-postgresql.md) and [validation evidence](../PROGRESS.md).
