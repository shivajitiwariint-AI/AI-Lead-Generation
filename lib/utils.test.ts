import { describe, it, expect } from "vitest";

describe("cn utility", () => {
  it("merges class names correctly", async () => {
    const { cn } = await import("@/lib/utils");
    expect(cn("a", "b")).toBe("a b");
    expect(cn("a", undefined, null, false, "b")).toBe("a b");
    expect(cn("bg-red", "bg-blue")).toBe("bg-blue");
  });
});
