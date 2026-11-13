import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  it("allows a principal whose server-side role is permitted", () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN", "MANAGER"]);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: "MANAGER" } }) }),
    };

    expect(guard.canActivate(context as never)).toBe(true);
  });

  it("rejects roles not permitted by the endpoint", () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"]);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: "EMPLOYEE" } }) }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it("does not block endpoints without a role restriction", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = { getHandler: jest.fn(), getClass: jest.fn() };

    expect(guard.canActivate(context as never)).toBe(true);
  });
});
