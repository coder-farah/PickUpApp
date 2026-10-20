import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iPhone app", () => {
  it("uses the same API types as the server", () => {
    const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
    expect(read("../mobile/src/api/types.ts")).toBe(read("../src/lib/api-types.ts"));
  });
});
