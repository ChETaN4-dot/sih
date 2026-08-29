import { describe, expect, it } from "vitest";
import { selectSampleState } from "./Home";

describe("decision console sample state", () => {
  it.each(["ACCEPT", "HOLD", "REJECT"] as const)("resets live evidence when selecting %s", (status) => {
    expect(selectSampleState(status)).toEqual({
      status,
      serverEvidence: null,
    });
  });
});
