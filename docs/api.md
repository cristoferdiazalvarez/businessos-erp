# API Reference

Base URL: `http://localhost:4000/api`

The running API provides Swagger UI at `/docs` and OpenAPI JSON at `/openapi.json` relative to the API origin. Authenticated requests use the `businessos_session` HTTP-only cookie; browser requests include credentials and mutations must come from the configured `WEB_ORIGIN`. Request bodies and query parameters are validated with Zod.

## Authentication

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Database-backed readiness: 200 or generic 503; no connection details. |
| `POST` | `/auth/demo` | Public, opt-in/read-only only | Creates a one-hour session for the seeded employee in Northstar Studio; no password or user/tenant selector; PostgreSQL-backed sign-in cap. |
| `POST` | `/auth/login` | Public, throttled | Accepts email/password; sets the session cookie and returns the user, organization, and role summary. |
| `POST` | `/auth/logout` | Public/idempotent | Revokes the stored session when present and clears the cookie. |
| `GET` | `/auth/me` | Session required | Returns the user, organization, and current membership role. |
| `POST` | `/auth/forgot-password` | Public, throttled | Returns a generic response; only non-production demo mode exposes a reset token. |
| `POST` | `/auth/reset-password` | Public, throttled | Consumes a single-use, expiring token and updates the password. |

## Dashboard and business resources

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| `GET` | `/dashboard/summary?days=30` | Session required | Period-based revenue, order/customer/product/low-stock KPIs, daily revenue, and recent orders from persisted tenant records. `days` is constrained to 7–90. |
| `GET`, `POST` | `/customers` | Read: all roles; write: admin/manager | Search/paginate; create. Query supports `search`, `page`, `limit`. |
| `GET`, `PATCH`, `DELETE` | `/customers/:id` | Read: all roles; write: admin/manager | Read, update, or remove a customer scoped to the current organization. |
| `GET` | `/products` | Session required | Search/paginate the current organization's products. |
| `GET` | `/products/categories` | Session required | List categories for the current organization. |
| `POST` | `/products/categories` | Admin/manager | Create an organization-scoped category. |
| `PATCH`, `DELETE` | `/products/categories/:id` | Admin/manager | Rename or remove an organization-scoped category. Removing a category leaves its products uncategorized. |
| `GET` | `/products/:id/movements` | Session required | Read recent inventory movements for an organization-scoped product. |
| `POST` | `/products` | Admin/manager | Create a product; initial stock is recorded as an inventory movement. |
| `PATCH`, `DELETE` | `/products/:id` | Admin/manager | Update or archive an organization-scoped product. |
| `POST` | `/products/:id/stock` | Admin/manager | Apply a nonzero stock adjustment and persist its reason and movement. Stock cannot become negative or exceed the supported integer range. |
| `GET` | `/orders` | Session required | Paginate orders; optional status filter. |
| `GET` | `/orders/:id` | Session required | Read order, items, and invoice in the current organization. |
| `POST` | `/orders` | Admin/manager | Create an order. The server validates products/customer, calculates monetary totals, reserves stock, and creates the invoice in a transaction. |
| `PATCH` | `/orders/:id/status` | Admin/manager | Mark an eligible order paid or cancel it; cancellation restores reserved stock transactionally. |
| `GET` | `/invoices` | Session required | List invoices for the current organization. |
| `GET` | `/invoices/:id/pdf` | Session required | Download a generated PDF for an organization-scoped invoice. The PDF is a fictional demo record, not a tax/legal document. |

## Team, reporting, settings, and audit

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| `GET` | `/employees` | Admin/manager | List organization members. |
| `POST` | `/employees/invitations` | Admin/manager | Create a development/demo invitation token; there is no email provider. |
| `PATCH` | `/employees/:id/role` | Admin | Change a membership role; the organization must retain an admin. |
| `DELETE` | `/employees/:id` | Admin | Remove another member; self-removal and removing the final admin are rejected. |
| `GET` | `/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` | Session required | Return date-filtered sales, product, and customer aggregates. |
| `GET` | `/reports/{sales,products,customers}.csv?from=...&to=...` | Session required | Download a tenant-scoped CSV; exported text is protected against spreadsheet formula injection. |
| `GET` | `/settings` | Session required | Read profile, organization settings, and preference values for the active user/tenant. |
| `PATCH` | `/settings/profile` | Session required | Update the caller's profile. |
| `PATCH` | `/settings/preferences` | Session required | Persist the caller's light/dark theme preference. |
| `PATCH` | `/settings/organization` | Admin | Update organization name, supported ISO currency, and tax rate. |
| `GET` | `/audit` | Session required | Read recent audit entries for the current organization. |

## Authorization summary

All business-resource reads are authenticated and tenant-scoped. Customers/products CRUD and inventory adjustments, order creation/status changes require admin or manager. Team listing/invitations require admin or manager; role changes and removal require admin. Organization settings require admin. Roles are enforced by the API, not just by UI controls.

## Errors and accounting behavior

Validation errors return HTTP 400 with message/field issues. Invalid credentials and missing/expired sessions return HTTP 401; role restrictions return HTTP 403; missing organization-scoped resources return HTTP 404; business conflicts such as duplicate SKUs or insufficient stock return HTTP 409.

Money is stored using decimal database columns. Order totals, discounts, and applicable organization tax are derived server-side. Revenue reporting includes paid and confirmed orders; order counts include all order states created in the selected period. These are demo workflow semantics, not accounting advice.
