# Security

BusinessOS is a demo with fictional data. Local runtime checks are documented in [PROGRESS.md](./PROGRESS.md); they are not a penetration test or production certification.

Do not disclose credentials, session cookies, reset tokens, database dumps or exploitable details in public issues. Use [private vulnerability reporting](https://github.com/cristoferdiazalvarez/businessos-erp/security/advisories/new), which is enabled for this repository; otherwise contact the repository owner privately before sharing details. No reporting inbox is configured in this local project.

The API uses Argon2id passwords, hash-only opaque sessions, HTTP-only cookies, request validation, role/tenant guards, exact mutation-origin checks and throttling. HTTPS production uses Secure cookies. E2E verifies local cookie attributes, server-side logout revocation, permissions and cross-tenant reads/writes. Production HTTPS/Secure cookie behavior has not been browser-tested here.

Non-production password recovery intentionally returns a demo token. Invitations also expose development-only tokens. Never expose the development/test API publicly. Production invitation delivery is unavailable until an email provider is configured; production recovery does not return tokens.

Before deployment, configure TLS, production origins and secrets, a shared throttling store for multiple instances, monitoring, database backups and restricted database roles. PostgreSQL development socket trust is only for a private developer machine. Audit metadata and errors must not contain bearer credentials. Keep dependencies patched and rerun `pnpm audit --prod`.

Public deployments should enable `PUBLIC_DEMO_MODE=true`, share only disposable employee access and keep admin/manager passwords private. This flag rejects non-session mutations before controller execution, including reset/invitation flows. `/api/health` returns a generic readiness response without connection details. The production API validates HTTPS origin and cookie configuration at startup. See [deployment requirements](./docs/deployment.md).
