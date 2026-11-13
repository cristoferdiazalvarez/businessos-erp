# Zero-cost public demo deployment

## Selected architecture and current status

**Budget: EUR 0/month.** Use two **Vercel Hobby** projects (Next.js web and the existing NestJS API) with one **Neon Free** PostgreSQL project. Do not select Pro, Launch, Scale, usage-billed integrations, paid add-ons, custom-domain purchases or trials. Never enter a card to bypass a setup gate.

The owner approved creation of these three free projects on 2026-11-13, conditional on successful checks and actual free-plan availability. Account plans were verified through authenticated CLI access: Vercel Hobby and Neon Free. The three approved resources are deployed. Public trusted-HTTPS acceptance passed on desktop/mobile Chromium.

- **Web:** https://businessos-web-five.vercel.app — choose **Explore demo**.
- **API readiness:** https://businessos-api-three.vercel.app/api/health
- **Database:** new `businessos-demo` Neon Free project, PostgreSQL 17, AWS Frankfurt; credentials remain private.

No card, paid integration, trial or paid plan was activated. Free quota exhaustion can still suspend availability.

```text
Browser --HTTPS--> Next.js / *.vercel.app
                       |
                       +-- same-origin /api/* rewrite --HTTPS--> NestJS / *.vercel.app
                                                                    |
                                                                    +-- authenticated TLS --> Neon PostgreSQL
```

This preserves Next.js, NestJS, Prisma, PostgreSQL and database sessions. [Vercel supports native NestJS entrypoints](https://vercel.com/docs/frameworks/backend/nestjs), including the existing `src/main.ts`. No mock API, SQLite replacement or browser-only simulation is used. [Neon Free](https://neon.com/pricing) provides persistent PostgreSQL with scale-to-zero; the database is not bundled inside a function.

**Network distinction:** Neon Free uses a password-authenticated TLS endpoint over the public network, not a private VPC. Database credentials live only in the API/operator environment. No database URL is sent to the browser or web project. Private networking is not included in the zero-cost design. The earlier fully private Render design has been retired as the default because it costs money; its non-authorized reference is [render.paid.reference.yaml](../deploy/render.paid.reference.yaml).

See [hosting research](./free-hosting-research.md) for all six requested platforms, sources, limits and remaining eligibility checks.

## Cost and authorization safeguards

- Use a personal, non-commercial portfolio on Hobby; do not deploy a real paying ERP business on that plan. Verify the account is actually Hobby before creating projects.
- Verify Neon is actually Free before creating its project. Create it directly in Neon, not through an automatically billed Marketplace integration.
- Stop if a provider asks for payment, a card, a paid organization, an upgrade or a trial. User approval of three free projects does not authorize any of those actions.
- Resource creation is limited to the two new BusinessOS Vercel projects and one new Neon project. Do not change account billing, existing services, databases or deployments.
- Free quota exhaustion must reduce availability or suspend the demo; do not upgrade automatically. No uptime-ping jobs or synthetic traffic to defeat provider sleeping rules.
- Git deployment triggers are disabled in both manifests; deployments are deliberate after CI. Preview databases/projects are not created automatically.

## Repository configuration

| New project | Root directory | Runtime | Configuration |
| --- | --- | --- | --- |
| BusinessOS web | `apps/web` | Next.js / Node 22 | [vercel.json](../apps/web/vercel.json), [web environment template](../deploy/vercel-web-free.env.example) |
| BusinessOS API | `apps/api` | NestJS / Node 22 | [vercel.json](../apps/api/vercel.json), [API environment template](../deploy/vercel-api-free.env.example) |
| BusinessOS database | New Neon Free project | PostgreSQL 17 | [operator environment template](../deploy/neon-free.env.example) |

Use the published repository `cristoferdiazalvarez/businessos-erp`, branch `main`, with workspace source files outside each project root available to the monorepo build. Both builds install the frozen pnpm lockfile with build dependencies enabled. The API build runs Prisma generation on every build to avoid stale cached clients. Prisma includes the Linux/OpenSSL engine needed by Vercel. A runtime trace preflight also checks native Argon2 and invoice font assets against the standard function size ceiling.

Set the API/web in Frankfurt (`fra1`) and choose the corresponding Neon AWS Frankfurt region if available on Free. Never pay to obtain a preferred region. The API function maximum duration is 30 seconds, configured in the project’s `resourceConfig.functionDefaultTimeout`. The native NestJS builder rejected a manual `functions.src/main.ts` pattern; that pattern was removed from the manifest after the first deployment failed. Both production builds subsequently succeeded. No background worker or long-lived in-process state is required by the application.

`.vercelignore`, `.gitignore` and publication checks exclude local environments, generated artifacts, browser traces and Vercel account linkage. Environment templates contain placeholders only. CLI/connection metadata and local test certificates belong in ignored `.local`/`.vercel` directories.

## Database preparation and migration strategy

1. After account/plan verification, create only the approved new Neon Free project. Store its direct and pooled URLs privately, never in GitHub files, logs or chat. Do not import any real customer database.
2. Run `pnpm demo:prepare:free` once from a private operator environment with `DIRECT_DATABASE_URL`. It validates that the target is a direct Neon TLS URL, executes committed `prisma migrate deploy`, then seeds fictional organizations/users/catalog/sales. It never creates a cloud resource or subscription itself.
3. The setup script generates private random passwords in the child environment and never prints them. Visitors do not need those passwords. Re-running the seed deliberately resets some fixture values; do not execute it on every request, cold start or deployment.
4. Runtime API uses the **pooled** `DATABASE_URL` with `connection_limit=1`, TLS certificate validation and bounded connection/pool timeouts. Prisma CLI uses `DIRECT_DATABASE_URL` when present. This separates migrations from transaction pooling. See [Neon pooling](https://neon.com/docs/connect/connection-pooling).
5. Keep direct/migration URLs out of the web project. Future migrations run as an explicit operator step before a compatible API rollout, never from an anonymous route. Migrations are additive; there is no automatic destructive reset.

`pnpm demo:prepare:free --local-test` validates the same migration/seed sequence against the isolated local `_test` database. The E2E runner forces both pooled/direct variables to its test URL so a saved production direct URL cannot redirect tests into the public database.

## HTTPS, authentication and visitor access

- Web browser API URL is `/api`; the Next.js rewrite targets the actual API HTTPS URL. Cookies are therefore first-party on the web hostname, including browsers that block third-party cookies.
- API `WEB_ORIGIN` and `API_ORIGIN` are the exact final web HTTPS origin. Production startup rejects insecure origins and disabled Secure cookies. Set only one trusted proxy hop and verify provider forwarding behavior before opening the demo.
- `PUBLIC_DEMO_MODE=true` makes business operations read-only on the API. `NEXT_PUBLIC_DEMO_MODE=true` exposes the **Explore demo** button.
- The button calls `POST /api/auth/demo`. The API looks up only the seeded `EMPLOYEE` membership in `northstar-studio`; it cannot choose an arbitrary user/organization or issue an admin session. The real opaque session expires in one hour; only its digest is stored.
- No shared password is displayed or committed. Admin/manager passwords remain private and public invitations, reset, role changes, settings writes and business mutations are blocked.
- An atomic PostgreSQL counter caps demo/password sign-ins at 30 per minute across instances; expired sessions are removed on accepted sign-in. No visitor IP is persisted. In-memory throttling is an additional local layer, not the authoritative distributed limit.
- These controls reduce abuse; they do not provide an uptime guarantee against someone exhausting free request/compute quotas. Only fictional demo records are exposed to employee read access.

## Health and hosted acceptance

`GET /api/health` returns a database-backed 200 or generic 503 without connection details. Test it through the final web proxy and directly on the API. Do not run constant public health probes: unnecessary queries can keep Neon compute awake and consume the free allowance.

After deployment, verify the real URLs from the internet without provider-owner authentication: trusted HTTPS certificate/chain, public landing/login, passwordless employee session, actual customer/product/inventory/order/invoice reads and PDF downloads, denied administrative writes, tenant isolation and logout/token revocation. Ensure Vercel authentication is not blocking the production API proxy or recruiters. Production preview protection and routing must be inspected on the actual new projects.

Only after those checks pass should README contain a real Live Demo link. Local TLS tests use a temporary self-signed localhost certificate and cannot certify a provider URL or a trusted public certificate.

## Validation and limitations

```sh
pnpm db:generate
pnpm e2e:prepare
pnpm lint
pnpm typecheck
pnpm test
NEXT_PUBLIC_API_URL=/api NEXT_PUBLIC_DEMO_MODE=true API_INTERNAL_ORIGIN=http://localhost:4000 pnpm build
pnpm check:api-bundle
E2E_PRODUCTION=1 pnpm test:e2e
pnpm check:production
pnpm check:demo-browser
pnpm check:publication
```

Set `PLAYWRIGHT_BROWSERS_PATH` consistently if using the project-local browser cache. Stop only your own local web/API processes before browser verification.

Vercel and Neon cold starts, monthly quotas, account restrictions and terms can affect availability. Free services are not an SLA or permanent contractual promise. Neon compute suspends when idle while storage persists; exceeding free compute/transfer limits can suspend access until reset. The Free database is not a substitute for a verified backup/restore policy. No paid upgrade, anti-sleep traffic, trial renewal or automatic billing is authorized.

Provider-native Node 22 packaging, Neon TLS/pooling and public HTTPS were verified against the deployed application. Both production projects have public access without Vercel owner authentication. Native Prisma, Argon2 and PDF font handling worked in the hosted NestJS function.

Re-run the non-destructive public acceptance deliberately, rather than as a periodic keepalive:

```sh
node scripts/verify-hosted-demo.mjs https://businessos-web-five.vercel.app https://businessos-api-three.vercel.app
```

This uses normal trusted TLS (no certificate bypass), two isolated browser sessions and only fictional data. It checks desktop/mobile login, persisted modules and inventory, invoice PDFs, rejected tenant/admin/business-write access and logout. Screenshots are saved under docs/screenshots/hosted-demo-*.png. CI remains on its isolated PostgreSQL service; public traffic is not part of routine CI.

Deployments were performed deliberately with the official Vercel CLI from this repository, using the per-project roots above. Git auto-deployment remains disabled; no additional marketplace/GitHub integration was activated. Future deployment operators must authenticate their CLI and select the existing BusinessOS project IDs before deploying, never create replacement resources by default.
