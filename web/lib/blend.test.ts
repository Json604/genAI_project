import { describe, it, expect } from "vitest";
import { blend } from "./blend";

describe("blend", () => {
  it("alpha=1 returns normalized image vector direction", () => {
    const out = blend([3, 4], [0, 1], 1);
    expect(out[0]).toBeCloseTo(0.6); expect(out[1]).toBeCloseTo(0.8);
  });
  it("alpha=0 returns normalized text vector direction", () => {
    const out = blend([0, 5], [6, 8], 0);
    expect(out[0]).toBeCloseTo(0.6); expect(out[1]).toBeCloseTo(0.8);
  });
  it("output is unit length", () => {
    const out = blend([1, 2], [3, 4], 0.5);
    const n = Math.hypot(...out); expect(n).toBeCloseTo(1);
  });
});
