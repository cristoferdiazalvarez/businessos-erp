# Contributing

BusinessOS is a portfolio/demo ERP. Please discuss architectural changes before implementation and preserve the Next.js/NestJS/Prisma separation.

1. Follow the [README](./README.md) and use fictional `.test` data only.
2. Keep business validation, authorization and tenant scoping in the API. Never trust organization IDs from a browser request.
3. Use the dedicated test database for integration/E2E checks; never point those checks at real customer data.
4. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e:prepare`, `pnpm test:e2e`, `pnpm check:production` and `pnpm check:publication`.
5. Document relevant migrations, behavior changes and actual verification results. Never claim a check passed if it was blocked or not run.

Do not submit `.env`, tokens, database dumps, user data, generated clients, build outputs or Playwright traces. The latter can contain session cookies and form submissions.

No project license has been chosen yet. Do not assume redistribution rights.

Production packaging and changes to deployment settings must preserve same-origin sessions, the private API/database boundary and read-only public-demo controls. See [deployment](./docs/deployment.md) and [third-party license notes](./docs/third-party-notices.md).
