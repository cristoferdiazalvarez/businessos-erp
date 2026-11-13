import type { NextFunction, Request, Response } from "express";

export function validateDeploymentEnvironment(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== "production") return;
  for (const name of ["DATABASE_URL", "WEB_ORIGIN"]) {
    if (!env[name]) throw new Error(`${name} is required in production`);
  }
  for (const name of ["WEB_ORIGIN", "API_ORIGIN"]) {
    const value = env[name] ?? env.WEB_ORIGIN!;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== value || url.username || url.password) {
      throw new Error(`${name} must be an exact HTTPS origin in production`);
    }
  }
  if (env.COOKIE_SECURE === "false") throw new Error("Production cookies must be Secure");
  const hops = Number(env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(hops) || hops < 0 || hops > 5) throw new Error("Invalid TRUST_PROXY_HOPS");
}

export function publicDemoWriteGuard(request: Request, response: Response, next: NextFunction): void {
  const readOnly = process.env.PUBLIC_DEMO_MODE === "true";
  const read = ["GET", "HEAD", "OPTIONS"].includes(request.method);
  const session = request.method === "POST" && ["/api/auth/login", "/api/auth/logout"].includes(request.path);
  if (readOnly && !read && !session) {
    response.status(403).json({ statusCode: 403, message: "This public demo is read-only" });
    return;
  }
  next();
}
