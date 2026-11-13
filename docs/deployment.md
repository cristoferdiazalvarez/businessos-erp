# Public demo deployment

## Recommended platform and budget

Use **Render** for a small demo: one public Next.js service, a private NestJS service and managed PostgreSQL in the same region. This minimizes server administration while preserving the existing application boundaries. Estimated baseline is **about USD 20/month**: two USD 7 services and a USD 6 database, before tax, extra storage, traffic or build usage. This is an estimate from [Render pricing](https://render.com/pricing) and its [small-application cost example](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses), checked on 2026-11-13; confirm the actual quote before approval. The small instance sizes have not been load-tested.

A small VPS can cost less, but requires OS updates, TLS proxy operation and database backup/restore management. Free database tiers and sleeping web instances are not the reliability baseline for this demo. No hosting account, resource, subscription or paid deployment has been created.

## Prepared topology

```text
Browser --HTTPS--> Render web / Next.js
                       |
                       +-- /api/* rewrite --> private NestJS :4000
                                                  |
                                                  +--> private PostgreSQL 17
```

The browser always uses `/api` on the web origin. Next.js proxies to the private API using [external rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites). This avoids third-party cookie dependencies between unrelated hosting domains. Render terminates HTTPS; cookies are host-only, HTTP-only, Secure and SameSite=Lax. The API permits browser mutations only from the configured exact origin. The private API is not directly exposed publicly.

`WEB_ORIGIN` must be the exact final HTTPS web origin without a trailing slash or path. `API_ORIGIN` defaults to that same origin in production. The API refuses production startup with missing database/origin values, insecure origins, disabled secure cookies or invalid proxy-hop configuration. `PORT` supports hosting-provider injection. `TRUST_PROXY_HOPS=1` is intended for the private Next.js hop: verify the actual forwarded header chain before opening traffic; do not use an unrestricted trust-proxy setting or expose this API directly.

`GET /api/health` performs a real database query and returns 200 or a generic 503. The web health check goes through the proxy so it also checks API/database reachability. SIGTERM/SIGINT shutdown hooks disconnect Prisma cleanly.

## Blueprint and rollout

[`render.yaml`](../render.yaml) is a prepared Blueprint, validated against Render's official JSON schema. **Applying it provisions paid resources and requires separate owner approval.** Automatic deploys are disabled. It uses the native Node 22 runtime; the Dockerfiles are an alternative packaging route, not a simultaneous deployment requirement.

After hosting/cost approval:

1. Connect the published GitHub repository to Render and review the Blueprint's resource quote. Keep all services in Frankfurt and keep the database's external IP allowlist empty.
2. Set the API's `WEB_ORIGIN` to the actual web URL. Render supplies the private database connection and API host/port references. It generates fresh demo passwords; never upload the developer `.env`.
3. Deploy the API. The pre-deploy command runs `prisma migrate deploy`; a migration failure must block rollout. Deploy the web after its private API reference is available. Proxy targets and browser API settings are build-time configuration, so rebuild the web when changing them.
4. From the API's private operator shell, run `corepack pnpm db:seed` **once** to populate fictional data. Do not seed on every deploy: the demo seed intentionally restores some demo values and passwords. Do not run it against customer data.
5. Keep `PUBLIC_DEMO_MODE=true`. Share only the disposable **employee** demo account through the chosen demo-access channel after authorization. Keep admin/manager passwords private. No visitor signup is configured.
6. Confirm the public HTTPS URL, proxied health check, login/logout, Secure cookies, employee read access, blocked writes/reset/invitations, tenant isolation and downloads. Check provider logs, actual client-IP forwarding, memory and database connections. Remote TLS/browser behavior has not been verified locally.
7. Confirm provider backup retention and perform a restore exercise before claiming recoverability. Use backward-compatible migrations and retain a previous application version for rollback. Reverting an image does not roll back the database schema.

The public demo guard permits business reads and session login/logout but rejects other writes, including password recovery, invitations, organization changes and profile/theme persistence. It is off by default locally. The employee role also independently restricts sensitive modules. Production mail delivery remains unconfigured. A single API instance is intentional because throttling is in memory; configure a shared limiter before scaling to multiple instances.

## Container packaging

Both Dockerfiles use the repository root as build context, a frozen pnpm lockfile and a non-root runtime user. `.dockerignore` excludes local environments, database files, Git state, browser caches, test traces and build outputs. No secret build arguments are declared.

```sh
docker build -f apps/api/Dockerfile --target runtime -t businessos-api:local .
docker build -f apps/api/Dockerfile --target operations -t businessos-operations:local .
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=/api \
  --build-arg API_INTERNAL_ORIGIN=http://api:4000 \
  -t businessos-web:local .
```

The API runtime contains deployed production dependencies and a generated Prisma client. Use the separate operations target for migrations/seeding in a private environment, not the public runtime. The web uses Next.js standalone output only when `NEXT_STANDALONE=true`, as configured in its Dockerfile. Native builds continue to use `next start`.

API runtime variables are documented in [api.env.example](../deploy/api.env.example); web variables are in [web.env.example](../deploy/web.env.example). Keep the API/database on an internal network; terminate HTTPS at a trusted proxy or managed provider. Do not publish PostgreSQL ports. Health checks are built into both images.

Docker is unavailable on the local macOS machine. Local API runtime packaging/imports were checked. The [Linux Actions run](https://github.com/cristoferdiazalvarez/businessos-erp/actions/runs/43404172988) successfully built the API runtime, API operations and standalone web images. This verifies image construction; hosted startup, TLS and a deployed container smoke test remain separate checks.

## Local checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e:prepare
E2E_PRODUCTION=1 pnpm test:e2e
pnpm check:production
pnpm check:publication
```

`check:production` boots a temporary production API against the isolated `_test` database and checks database readiness, Secure-cookie attributes, employee reads, read-only demo enforcement, origin rejection and token revocation. It does not provision TLS or replace the final hosted-browser checks.
