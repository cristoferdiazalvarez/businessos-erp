import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthPrincipal, AuthenticatedRequest } from "./auth.types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
