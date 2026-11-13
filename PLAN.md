# BusinessOS Delivery Plan

## Goal

Build a deployable, portfolio-ready multi-tenant ERP SaaS with a Next.js web app, a NestJS API, PostgreSQL/Prisma persistence, documented interfaces, and reproducible validation. A feature is considered implemented only when its API, persistence, authorization, and user workflow are connected.

## Phases and acceptance criteria

### Phase 1 — Platform, identity, and operating dashboard
- [x] pnpm workspace with independently runnable web and API applications.
- [x] PostgreSQL schema, reproducible Prisma migrations/seed, Docker Compose, and secret-free `.env.example`.
- [x] Argon2id passwords, opaque revocable server-side sessions, cookie authentication, role guards, tenant isolation, Zod validation, and login throttling.
- [x] Responsive public landing and authenticated application shell.
- [x] Dashboard KPIs and chart series query persisted, tenant-scoped data.
- [x] Jest/Vitest tests, CI workflow, and OpenAPI documentation.
- [x] Apply both migrations and seed against local PostgreSQL 17.12 in development and isolated test databases.

### Phase 2 — Customer, catalog, and inventory
- [x] Tenant-scoped customer, product, and category CRUD; search, pagination, validation, and audit events.
- [x] Stock changes are persisted as inventory movements; low-stock alerts use current stock.
- [x] Authenticated UI includes loading, error, empty, and success states.

### Phase 3 — Orders and invoices
- [x] Order items, discounts, configurable tax, and totals are calculated and validated by the server.
- [x] Order and inventory writes are transactional and reject insufficient stock.
- [x] Invoice numbering is unique per organization; invoice lifecycle and downloadable PDF use persisted records.
- [x] Fictional invoices are labeled as demo records and make no tax/legal compliance claims.

### Phase 4 — Workforce and reporting
- [x] Employee/role administration, demo invitations, backend permission enforcement, and activity history.
- [x] Persisted sales/product/customer reports with date filters and CSV export.

### Phase 5 — Settings, quality, and delivery
- [x] Profile, organization settings, preferences, and persisted light/dark theme.
- [x] Relevant operations are audited without secrets.
- [x] Playwright scenarios cover login, role boundaries, CRUD, orders/stock, invoices, and cross-tenant isolation.
- [x] English README, screenshots, and architecture/API/decision docs describe the implementation and limitations.
- [x] Execute Playwright flows against migrated/seeded PostgreSQL using both development and compiled servers.
- [x] Lint, TypeScript checks, unit tests, and production builds pass in the available environment.

## Verification gate

Local acceptance passed on 2026-11-13: PostgreSQL 17.12 migration/seed, API integration assertions and Playwright browser workflows with development and compiled servers. Lint, TypeScript, 25 unit tests and both builds passed. Eleven views have current desktop/mobile captures. Production dependency audit reports no known vulnerabilities.

This is ready for owner review as a GitHub portfolio/demo repository, not a deployed production service. Remote GitHub Actions and Linux Docker image builds passed. Hosted container startup, HTTPS termination, additional browser engines and physical devices remain unverified. No project license has been selected.

## PostgreSQL and publication follow-through

- [x] Inspect macOS arm64, installed tools, listening ports and repository scripts.
- [x] Download official PostgreSQL 17-only Postgres.app binary; no compilation or global services.
- [x] Create separate development/test databases and non-superuser owners with random private credentials.
- [x] Enforce a dedicated `_test` URL and fresh API/web processes in the E2E runner.
- [x] Correct real API startup, compiled entry point, CSV assertion, repeatable test identifiers, mobile login heading and current-module header.
- [x] Verify transactional stock contention/cancellation, totals, sessions, roles and cross-tenant resource permissions.
- [x] Fix dependency security advisories and repeat audit.
- [x] Update English README, setup guide, security/contribution notes, `.gitignore` and secret-free environment template.
- [x] Initialize local Git `main`; inspect publication candidates without staging, commits or remote.
- [ ] Run Docker Compose on a Docker-capable machine (alternative only; native PostgreSQL path already verified).
- [x] Execute hosted CI: verification and container-build jobs passed on Linux.
- [x] Owner explicitly authorizes BusinessOS repository creation, commits and pushes after successful security checks.
- [ ] Owner chooses a project license (MIT suggested; third-party obligations documented).

## Execution notes

- Keep the existing Next.js/NestJS/Prisma architecture.
- The owner explicitly authorized creation of the public `cristoferdiazalvarez/businessos-erp` repository, commits and normal pushes on 2026-11-13 after security validation. No force push or paid hosting.
- Use only fictional data. Store local credentials in ignored `.env`; database/binary/browser files remain in ignored `.local`.
- See `PROGRESS.md` for exact results, initial failures, scope limits and current runtime state.

## GitHub and deployment delivery

- [x] Verify GitHub CLI identity as `cristoferdiazalvarez` and check target repository does not exist.
- [x] Review publication candidates and empty Git history; exclude local credentials, binaries, database files and traces.
- [x] Add production startup checks, private API proxy, readiness endpoint and opt-in read-only public demo.
- [x] Prepare Render Blueprint and non-root API/web Dockerfiles; no resources purchased.
- [x] Validate Blueprint with the official JSON schema and inspect dependency license metadata.
- [x] Extend Linux CI with production verification and container builds.
- [x] Create repository, push main and verify public README/screenshots.
- [x] Observe hosted CI: both jobs passed, including all container builds.
- [x] Record publication and final Actions evidence in PROGRESS.md.
