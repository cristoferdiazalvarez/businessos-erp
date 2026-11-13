import { validateDeploymentEnvironment } from "./deployment";

const valid = {
  NODE_ENV: "production", DATABASE_URL: "postgresql://db/businessos",
  WEB_ORIGIN: "https://demo.example.test", COOKIE_SECURE: "true", TRUST_PROXY_HOPS: "1",
};

describe("production deployment configuration", () => {
  it("accepts HTTPS and preserves local development defaults", () => {
    expect(() => validateDeploymentEnvironment(valid)).not.toThrow();
    expect(() => validateDeploymentEnvironment({ NODE_ENV: "test" })).not.toThrow();
  });
  it.each([
    { WEB_ORIGIN: "http://demo.example.test" }, { WEB_ORIGIN: "https://demo.example.test/path" },
    { COOKIE_SECURE: "false" }, { DATABASE_URL: "" }, { TRUST_PROXY_HOPS: "true" },
  ])("fails closed for unsafe production configuration %j", (override) => {
    expect(() => validateDeploymentEnvironment({ ...valid, ...override })).toThrow();
  });
});
