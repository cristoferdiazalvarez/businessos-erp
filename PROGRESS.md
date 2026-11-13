# BusinessOS Progress

## Initial local validation — 2026-11-13

The initial local PostgreSQL-backed validation passed without changing the architecture. The sections below preserve that evidence. The GitHub delivery continuation at the end records the subsequent publication work and current remote status.

## Environment and local database

- macOS 27.0.1 (26A434), Darwin arm64; Node 26.5.0; Corepack/pnpm 10.12.1; Prisma client/CLI 6.19.3.
- Docker, psql and postgres were initially unavailable. Homebrew uses a custom prefix; no source compilation was attempted in this continuation.
- Downloaded the official PostgreSQL 17-only Postgres.app 2.9.7 disk image (119,766,608 bytes), PostgreSQL 17.12. Its SHA-256 matched the digest in the official GitHub release API.
- Mounted the image and copied the app into ignored `.local`. The original bundle and the individual postgres/initdb/pg_ctl/psql binaries passed signature verification outside the sandbox. Sandboxed signature checks returned invalid-signature errors. A deep check on the copied GUI bundle reports Finder metadata added during copying, including after removing FinderInfo; no copied GUI was launched. The verified individual command-line binaries were used.
- A sandboxed initdb failed at shmget with Operation not permitted and removed its incomplete cluster. Approved initdb and server startup succeeded outside the sandbox.
- PostgreSQL listens on 127.0.0.1:5432 with TCP SCRAM authentication, private data in `.local/pgdata`, and explicit pg_ctl lifecycle. No launch agent/global service was installed; existing MongoDB and other services were left alone.
- Created `businessos` and `businessos_test`, owned respectively by separate non-superuser roles without CREATEDB. PUBLIC database access was revoked. Local socket trust is developer-machine administration only.
- `.env` was generated mode 0600 with random passwords. No secret values were printed or included in documentation. `env:local` refuses overwrites.

## Executed verification

| Command/check | Actual result |
| --- | --- |
| `pnpm db:generate` | Prisma 6.19.3 client generated |
| `pnpm db:migrate` | Both committed migrations applied to development |
| `pnpm db:seed` | Fictional Northstar Studio data and three role accounts created |
| `pnpm e2e:prepare` | Both migrations, primary seed and second-tenant seed passed in businessos_test |
| `pnpm lint` | Both apps passed, rerun after final source/test changes |
| `pnpm typecheck` | Both apps passed, rerun after final source/test changes |
| `pnpm test` | API: 7 suites / 17 tests; web: 1 file / 2 tests; all passed |
| `pnpm build` | Prisma generation, NestJS and Next.js production builds passed after final application changes |
| `pnpm test:e2e` | Development servers: 2 scenarios passed |
| `E2E_PRODUCTION=1 pnpm test:e2e` | Final compiled servers: 2 scenarios passed in 12.6 seconds |
| `pnpm audit --prod --audit-level=high` | After fixes: no known vulnerabilities found |
| `pnpm install --lockfile-only --frozen-lockfile --ignore-scripts --offline` | Passed; lockfile consistency verified without replacing installed modules |
| `pnpm check:publication` | Publication candidates passed local-secret/signature/private-path scan |
| SQL role/database metadata inspection | Distinct owners; both application roles have rolsuper=false and rolcreatedb=false |
| Development compiled-server smoke | Web/login 200; auth/me 200; five seed customers; no E2E customers; revoked token 401 |

Commands used a project-local Corepack shim in `.local/bin`. Browser installation used `PLAYWRIGHT_BROWSERS_PATH=$PWD/.local/browsers`. A full offline install attempt prompted to replace modules and was not confirmed; the non-mutating frozen-lockfile validation above passed instead. Dependency installation after security fixes did complete successfully.

## Real workflows and security assertions

- Browser admin login, persisted dashboard and customer creation/search.
- Product creation/search, inventory adjustment, confirmed order, payment and persisted invoice.
- PDF download checked for its actual `%PDF-` signature; CSV download checked against the correctly quoted header.
- Real concurrent requests for the same last two units produce exactly one 201 and one 409; monetary total is 21.65 for 20.00 subtotal with seeded tax.
- Cancellation restores stock; repeating cancellation returns 409 and does not restore stock twice. Inventory movements reconcile to the expected balance.
- Invalid customer input returns 400; a disallowed browser origin returns 403.
- Admin session resolution, employee write denial, manager role-administration denial, and manager catalog read.
- HTTP-only/SameSite=Lax cookie attributes; logout revokes the stored token and replay returns 401.
- An isolated organization can read its own customer; another organization's customer is 404. Cross-tenant customer changes, inventory changes, order reads/creation and invoice PDF reads are rejected.
- Desktop 1440×1000 and mobile 390×844 captures for landing, login, dashboard, customers, products, sales, invoices, reports, team, settings and activity: 22 updated PNGs. Loading/error states, page-wide overflow and browser exceptions were checked. Representative captures were also visually inspected. Tables retain internal horizontal scrolling on narrow screens.
- No mocks replaced the database, HTTP endpoints or browser workflows. Unit tests remain distinct from real integration assertions.

## Failures found and fixed

1. API startup attempted to load missing class-validator through an unused global ValidationPipe. Removed that pipe; every body/query input continues to use the existing ZodValidationPipe.
2. The API compiled start script pointed at dist/main.js; corrected it to the actual dist/src/main.js and verified compiled startup.
3. E2E previously reused development DATABASE_URL and existing servers. Added a guarded `_test` runner, explicit credential loading and fresh processes; development data remained untouched.
4. Existing CSV expectation omitted the exporter’s valid quoting. Corrected the assertion to verify the real full header.
5. Repeated test runs collided with fixed fixture identifiers, matched multiple audit events and eventually exceeded the first customer page. Added unique identifiers, explicit searches and an intentional first matching audit event.
6. Mobile login had no visible h1. The form title is now h1; desktop marketing copy is h2.
7. The app header always displayed Overview. It now follows the current route. Sales help text describes the user workflow without internal API implementation details.
8. Dependency audit initially found 5 production advisories (3 high, 2 moderate) in PostCSS and deepmerge-ts. Root overrides now pin postcss 8.5.32 and deepmerge-ts 8.0.2; lockfile updated; migrations, builds and tests exercised the changes; production audit is clean.
9. Initial screenshots captured the start of the Recharts animation. Updated capture timing and regenerated using compiled servers without Next.js development indicators.

## Repository and publication preparation

- Updated English README with verified setup, real screenshots, demo steps, architecture, test results and limitations.
- Added macOS binary setup/start/stop guide, CONTRIBUTING.md, SECURITY.md and publication scan script.
- Environment template contains placeholders only. Compose now describes separate loopback-bound development/test services and independent volumes; its runtime remains unverified.
- Git initialized locally on main. No files staged, no commits, no remote and no push/publication. There are no tracked files/history containing credentials; ignored `.env`, `.local`, generated outputs and traces are excluded from publication candidates. Prisma SQL migrations remain included.
- No license selected automatically. Owner decision remains necessary before claiming open-source redistribution rights.

## Remaining limitations

- Docker Compose could not be executed because Docker is not installed; the native PostgreSQL route is verified.
- GitHub Actions is configured but has not run remotely; publication requires owner authorization.
- No deployed environment, TLS/Secure-cookie browser check, production email provider, multi-instance throttling, backups/monitoring configuration or production certification.
- Browser validation uses Chromium desktop/mobile viewport sizes, not Safari, Firefox or physical mobile devices. No coverage percentage or full security audit is claimed.
- Demo recovery/invitations deliberately return tokens in non-production; do not publicly expose a development/test API. Invoices remain fictional workflow documents.

## Runtime at the end of initial validation

PostgreSQL and the compiled demo web/API are running locally against the development database. Web: http://localhost:3000; API docs: http://localhost:4000/api/docs. Passwords remain in the private local `.env`. Test servers were stopped by Playwright. Use the guide’s pg_ctl command to stop only this cluster; stop the demo processes before future E2E runs because server reuse is deliberately disabled.

## GitHub delivery continuation — 2026-11-13

The owner explicitly authorized the public `cristoferdiazalvarez/businessos-erp` repository, commits and pushes after security checks. No force push or paid hosting is authorized.

- GitHub CLI 2.104.0 installed project-locally from its official release; checksum matched. Browser login completed; authenticated identity verified as `cristoferdiazalvarez` (account ID 273074590). Repository lookup confirmed the target did not exist before publication.
- Empty Git history inspected before committing. Publication scan passed across the candidate files; private `.env`, database/browser stores, compiled artifacts and test traces remain ignored. Screenshots contain only fictional accounts/data; representative desktop/mobile images were inspected again.
- Added a database-backed readiness endpoint, graceful shutdown hooks, production HTTPS-origin/cookie validation, configurable trusted proxy hops, same-origin Next.js API rewrites and an opt-in public read-only write guard. Local full-feature mode is unchanged by default.
- Added `check:production`, which passed against the real isolated test database: health, authenticated employee reads, Secure/HttpOnly/SameSite cookie attributes, rejected public writes/recovery, rejected origin and revoked-session replay. Local HTTP inspection does not certify hosted HTTPS.
- Latest local unit suite: API 8 suites / 23 tests; web 1 file / 2 tests, all passed. Lint, typecheck, both builds and compiled E2E passed. Production dependency audit: no known vulnerabilities.
- Added multi-stage, non-root API/web Dockerfiles and a separate API operations target. API production dependency packaging, Prisma generation and Prisma/Argon2 imports passed locally. Docker itself is unavailable locally; all three Linux image targets subsequently passed in the hosted CI container job. Live deployment remains unverified.
- Added a Render Blueprint validated against the official JSON schema. It prepares public web, private API/database, pre-deploy migrations, generated credentials and manual deployment triggers. Nothing was provisioned.
- Render baseline estimate: about USD 20/month before tax/extra usage, not a purchase or guaranteed quote. See docs/deployment.md.
- Reviewed production dependency licenses. MIT is suggested for original BusinessOS code, subject to owner confirmation and the separate upstream obligations documented in docs/third-party-notices.md. No project license added.
- Linux CI now includes publication preflight, masked ephemeral passwords, PostgreSQL migrations/seeds, lint/types/unit tests/build, compiled browser E2E, production checks and container build validation.

### Publication evidence

- Public repository created: https://github.com/cristoferdiazalvarez/businessos-erp
- Initial commit: `45e77fd543a621180cf255bbeece000743aed54d`, pushed normally to `main`; local branch tracks `origin/main`. No force push.
- Description and all ten requested topics configured. Private vulnerability reporting enabled.
- Unauthenticated HTTP verification passed for the repository page, raw README and all 22 PNG screenshots. GitHub-rendered README HTML contains the title and five image elements, including the real CI badge.
- Git history/object scan found no local password values or recognized private-key/token signatures. No developer environments, database files, generated outputs or traces were committed.
- Linux verification job passed: install, publication preflight, PostgreSQL migration/seed, lint, typecheck, 25 unit tests, builds, same-origin proxy E2E and production API checks.
- Actions run: https://github.com/cristoferdiazalvarez/businessos-erp/actions/runs/43404172988 — **SUCCESS**. Both `verify` and `containers` passed. Linux built the API runtime, API operations and standalone web images. No workflow failure required a code fix. The runner emitted non-blocking action-runtime/image-transition notices.
- No hosted application or paid resource created. License choice and hosting approval remain separate owner decisions.

Final documentation synchronization records the successful run above. The documentation-only commit uses `[skip ci]` to avoid rebuilding unchanged application code/images; the validated application/workflow commit is `45e77fd543a621180cf255bbeece000743aed54d`. No environment files, secret values, generated outputs or private traces were added.

## Earlier private-network hosting review — 2026-11-13

Historical finding under the previous private-network design; superseded by the EUR 0 plan below.

- Re-read the published Blueprint, both Dockerfiles, production guards, readiness endpoint, environment templates, migration strategy and earlier validation evidence. No architecture or functional changes were needed.
- Confirmed authenticated GitHub identity and that public `main` is `8c69569ae24d591bdf2bf953e23ba8de65250f8a`. Read-only comparison confirms the published deployment files exactly match the local configuration.
- Rechecked official Render, Railway, Vercel and Neon pricing/limits. Render's current design costs USD 20/month baseline (7 web + 7 private API + 6 database), excluding taxes/extra usage; this is not a spending cap. Render Free has cold starts, no private API ingress and a 30-day database lifetime. Railway starts at USD 5 with usage billing; trial/Free credits do not verify an always-on free stack. Neon Free is card-free but its private networking is a paid Scale feature. Full comparison and source links added to docs/deployment.md.
- Blueprint schema and private PostgreSQL allowlist/manual activation settings passed review. Production migration remains `prisma migrate deploy` before rollout; seed is a deliberate once-only operator step with fictional data and new provider-generated passwords.
- Re-ran `pnpm check:production`: passed with real PostgreSQL, production cookie attributes, employee reads, blocked public writes/recovery, rejected origin and revoked session. Re-ran compiled E2E through the same-origin proxy: 2 scenarios passed in 13.7 seconds. Publication candidate scan passed for 146 files. Test-generated screenshot changes were discarded; the published captures were preserved.
- Existing Linux Actions verification and all container builds remain successful. No cloud resources, provider account, payment method, subscription or deployment were created or modified. GitHub was inspected read-only; this review's documentation changes remain local.
- **Blocked only on activation authorization/account access:** no permanently free, non-expiring option satisfying the private/persistent design was verified. Recommend the existing Render plan, conditional on owner approval of its paid budget and direct provider sign-in/payment setup. Stop before creating resources. Public DNS/TLS/login and provider-level resource/backup behavior remain unverified until a real deployment exists.

## Current EUR 0/month demo preparation — 2026-11-13

The owner set an absolute EUR 0 monthly budget and explicitly approved two new Vercel Hobby projects plus one Neon Free project, conditional on successful checks and verified free plans. No card, paid integration, Pro trial, auto-overage, subscription, existing-service change or paid fallback is authorized. Account connection is pending; **no public demo URL or hosted certificate is claimed**.

- Researched all requested providers and Railway using primary documentation. Findings, card/eligibility uncertainty, cold starts, expiry, resource quotas and portfolio restrictions are recorded in docs/free-hosting-research.md. Vercel documents native NestJS support, so no backend rewrite or mock is needed. Neon Free provides persistent authenticated PostgreSQL TLS, with public-network rather than private-VPC connectivity.
- Prepared per-app Vercel manifests (correct monorepo roots, Frankfurt region, manual Git deployment, 30-second API function limit), free environment templates, a Prisma RHEL/OpenSSL engine target, and an operator-only direct database URL. CLI generation and runtime pooling remain separate; the E2E runner forces both URLs onto its isolated database.
- Moved the old paid Render Blueprint to deploy/render.paid.reference.yaml so it is not the default deployment target. It remains expressly non-authorized under this budget.
- Added POST /api/auth/demo and the opt-in Explore demo button. Only the seeded employee membership in northstar-studio can receive a one-hour opaque session. Admin/manager identities, arbitrary organization selection, public password disclosure and business writes are excluded. Normal local password authentication remains available with demo mode off.
- Added an additive DemoAuthWindow migration and an atomic PostgreSQL sign-in counter shared by independent serverless instances. It stores no IPs, admits 30 attempts/minute, bounds its counter and removes expired sessions on accepted sign-in. This does not guarantee protection against exhausting all free read quotas.
- Added demo:prepare:free: validates a direct Neon TLS URL, avoids loading developer credentials, migrates and seeds two fictional organizations with new unprinted private passwords. Local --local-test uses only the isolated local _test database. Nothing runs on a cold start and nothing creates a provider resource itself.
- Updated CI to run the runtime trace and local HTTPS browser acceptance after existing real E2E/production checks. The trace includes a Vercel-compatible Prisma engine, native Argon2 and PDF fonts; local traced runtime measured 43.2 MiB, below the standard 250 MiB limit. This is not a provider-packaging certification.
- Initial checks passed: lint, typecheck, API 8 suites/25 tests and web 2 tests; both builds passed. Existing compiled E2E passed 2 scenarios in 12.7s. Production checks passed real password/demo login, employee module reads, role/tenant/write restrictions, logout and concurrent shared admission (30 accepted, 5 rejected). A Chromium test over local self-signed HTTPS verified the passwordless button, actual Secure cookies, real data/PDF and revoked logout. Hosted trusted-certificate and Neon-pooler checks remain pending account connection.
- Vercel manifest constraints were checked against the published schema (the schema mixes draft metadata; current constraints were evaluated with compatible Ajv interpretation). Actual provider acceptance still needs a linked free project.
- Official Vercel/Neon integrations were discovered and suggested for safe account authorization; neither connection has been confirmed and no hosting resource has been created. GitHub commit/push preparation proceeds independently under the explicit repository-only authorization.

Final local gate: after removing only duplicated generated Next.js type files from .next, a clean build and typecheck passed. Lint, API 25 tests/web 2 tests, the three additive migrations in development/test, the free preparation script with both fictional organizations, compiled E2E, production concurrency/security checks, HTTPS Chromium demo and the runtime trace all passed. Production dependency audit returned no known vulnerabilities. Publication scanning now checks both working files and index blobs, including direct database passwords and available provider-token values, without printing them. The two login screenshots were refreshed for the real demo button; unrelated generated captures were preserved.

The previous paid-hosting review above is historical. Current remaining intervention is Vercel/Neon account connection; free project creation is already authorized and will not be requested again. No account/card/plan assumptions override the EUR 0 constraint.
