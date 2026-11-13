# Local PostgreSQL on macOS

Verified on 2026-11-13: macOS 27.0.1, Apple Silicon, Node 26.5.0, pnpm 10.12.1, Prisma 6.19.3 and PostgreSQL 17.12 from Postgres.app 2.9.7. No Homebrew source compilation, global installation, launch agent, or existing service modification was needed.

Download the PostgreSQL 17-only universal binary from the [official Postgres.app releases](https://github.com/PostgresApp/PostgresApp/releases/tag/v2.9.7). It is about 120 MB, rather than the bundle containing every major version. Use a stable release. The following commands reproduce the binary route used here, from the repository root:

```sh
mkdir -p .local/bin
corepack enable --install-directory .local/bin
export PATH="$PWD/.local/bin:$PATH"
pnpm install --frozen-lockfile
pnpm env:local --single-cluster
curl -fL https://github.com/PostgresApp/PostgresApp/releases/download/v2.9.7/Postgres-2.9.7-17.dmg -o /tmp/businessos-postgres.dmg
hdiutil attach -nobrowse -readonly /tmp/businessos-postgres.dmg
codesign --verify --strict /Volumes/Postgres-2.9.7-17/Postgres.app
ditto /Volumes/Postgres-2.9.7-17/Postgres.app .local/Postgres.app
export PG_BIN="$PWD/.local/Postgres.app/Contents/Versions/17/bin"
codesign --verify --strict "$PG_BIN/postgres"
"$PG_BIN/initdb" -D "$PWD/.local/pgdata" -U businessos_local --auth-local=trust --auth-host=scram-sha-256
"$PG_BIN/pg_ctl" -D "$PWD/.local/pgdata" -l "$PWD/.local/postgres.log" -o "-h 127.0.0.1 -p 5432 -k /tmp" start
PSQL_BIN="$PG_BIN/psql" node scripts/local-databases.mjs
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm e2e:prepare
```

Run environment/cluster/database creation only on first setup; those commands deliberately fail instead of replacing existing data. `env:local` never overwrites `.env`. For this already configured workspace, skip creation and use the existing private `.env`. Port 5432 must be free; inspect `lsof -nP -iTCP:5432 -sTCP:LISTEN` before starting. If occupied, select another port and update both database URLs. Do not stop an unrelated service.

The cluster listens only on IPv4 loopback, uses SCRAM authentication for TCP and a local Unix socket for cluster administration. Application accounts are separate non-superuser owners of `businessos` and `businessos_test`. PUBLIC database access is revoked. The socket's trust authentication is appropriate only for a private developer machine; it is not a production setup.

Start and stop this cluster explicitly; no persistent macOS service was installed:

```sh
export PG_BIN="$PWD/.local/Postgres.app/Contents/Versions/17/bin"
"$PG_BIN/pg_ctl" -D "$PWD/.local/pgdata" -l "$PWD/.local/postgres.log" -o "-h 127.0.0.1 -p 5432 -k /tmp" start
"$PG_BIN/pg_ctl" -D "$PWD/.local/pgdata" stop -m fast
```

The coding-agent sandbox may require approval for `initdb`, listening ports and browser processes. The first sandboxed `initdb` attempt failed with `shmget: Operation not permitted`; the approved local invocation succeeded. This is an OS sandbox restriction, not a migration failure.

To run browser validation using an entirely project-local browser cache:

```sh
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/browsers"
pnpm --filter @businessos/web exec playwright install chromium
pnpm test:e2e
pnpm build
E2E_PRODUCTION=1 pnpm test:e2e
```

Stop manually started web/API servers first: Playwright refuses to reuse existing servers so it cannot accidentally test against the development database. The compiled-server run uses the test API environment and local HTTP cookies; it does not certify a deployed HTTPS environment.

Docker Compose remains an alternative. Its development and test services use ports 5432 and 5433 and separate volumes. Generate `.env` without `--single-cluster` for that route. Docker itself was unavailable in this environment, so Compose startup is not claimed as verified.
