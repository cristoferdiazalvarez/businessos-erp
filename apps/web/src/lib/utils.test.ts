import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate } from "./utils";

describe("display formatting", () => {
  it("formats a persisted currency value using the requested ISO currency", () => {
    expect(formatCurrency(1234.5, "USD")).toBe("$1,235");
  });

  it("formats a valid timestamp as a readable date", () => {
    expect(formatDate("2026-03-12T12:00:00.000Z")).toBe("Mar 12, 2026");
  });
});
