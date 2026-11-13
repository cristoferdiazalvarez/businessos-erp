import type { Role } from "@prisma/client";
import type { Request as ExpressRequest } from "express";

export interface AuthPrincipal {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: Role;
  theme: "light" | "dark";
}

export interface AuthenticatedRequest extends ExpressRequest {
  user: AuthPrincipal;
  cookies: Record<string, string>;
}
