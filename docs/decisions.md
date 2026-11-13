# Architecture Decisions

## ADR 001 — pnpm workspace with separately deployable web and API

Use Next.js App Router for the browser application and NestJS for the API, each in `apps/`. This keeps persistence and authorization inside a server boundary and makes the chosen portfolio stack explicit. Docker Compose provides the local PostgreSQL dependency.

## ADR 002 — PostgreSQL and Prisma as the source of truth

Use PostgreSQL for relational constraints, transactions, tenant data, and reporting aggregates. Prisma schema and committed migrations define the model. The dashboard and module pages query persisted data rather than copying demo constants into the UI.

## ADR 003 — Opaque, server-side sessions

Generate a cryptographically random session token, store only its SHA-256 digest, and resolve it on protected API requests. This supports revocation without persisting the raw bearer credential. Cookies are HTTP-only and SameSite=Lax; production cookies are Secure.

## ADR 004 — Tenant and role identity are server-derived

The client does not select tenant IDs on business requests. The API resolves current membership and role before authorizing a request, then applies the server-derived organization ID to every business-resource query. Role restrictions are duplicated in backend guards rather than relying on UI visibility.

## ADR 005 — Demo password reset and invitations without external email

No email provider or credentials are configured. In non-production mode, a password reset token may be returned for local demonstration; production never returns the token. Invitations are likewise demo tokens rather than email delivery. A provider and delivery process are required before these flows can be treated as production-ready.

## ADR 006 — Fictional demo records and explicit invoice limitations

Seeded people and organizations are fictitious and use reserved `.test` email addresses. Invoice records, numbering, and PDF output illustrate a workflow only and are not tax, accounting, or legal documents. No compliance claim is made.

## ADR 007 — Vertical slices are connected to persistence

Customer/catalog/inventory, sales/invoices, workforce, reporting, settings, and audit screens are backed by authenticated API routes and tenant-scoped persistence. A module is not considered delivered merely because it has a screen; loading/error/empty states, validation, authorization, and relevant activity recording are included in the workflow.

## ADR 008 — In-memory throttling is development-scale only

NestJS throttling provides baseline API and auth rate limits. Its in-memory state is not shared across replicas. A shared store is a production deployment requirement and must be selected for the deployment environment.

## ADR 009 — Server-derived decimal totals and transactional stock

Order unit prices, discounts, tax, and totals are calculated on the server from current persisted records using decimal values. Order, invoice, stock, inventory-movement, and audit writes are grouped in database transactions. Browser-provided totals are not accepted as authoritative.
