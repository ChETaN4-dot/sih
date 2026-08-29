import { describe, expect, it } from "vitest";
import { evaluateScreening } from "./screening";

const base = {
  componentId: "U-04231",
  lotId: "LOT-07A",
  partNumber: "ASIC-001",
  parameterName: "Iddq",
  unit: "µA",
  checkpoints: [
    { timeH: 0, value: 10, absoluteLimit: 50 },
    { timeH: 24, value: 12, absoluteLimit: 50 },
  ],
  peerValuesAt24h: [10, 11, 12, 10.5, 11.4],
  safetySlope: 0.1,
};

describe("evaluateScreening", () => {
  it("accepts a component inside the peer envelope", () => {
    const result = evaluateScreening(base);
    expect(result.decision).toBe("ACCEPT");
    expect(result.absoluteLimitViolated).toBe(false);
    expect(result.modelVersion).toBe("robust-linear-v1");
  });

  it("rejects an absolute limit violation before dynamic scoring", () => {
    const result = evaluateScreening({ ...base, checkpoints: [{ timeH: 0, value: 48, absoluteLimit: 50 }, { timeH: 24, value: 56, absoluteLimit: 50 }] });
    expect(result.decision).toBe("REJECT");
    expect(result.reasonCode).toBe("ABSOLUTE_LIMIT_VIOLATED");
  });

  it("holds a peer-relative outlier even below the absolute limit", () => {
    const result = evaluateScreening({ ...base, checkpoints: [{ timeH: 0, value: 10, absoluteLimit: 50 }, { timeH: 24, value: 45, absoluteLimit: 50 }], peerValuesAt24h: [9.8, 10, 10.2, 10.1, 9.9], safetySlope: 2 });
    expect(result.decision).toBe("HOLD");
    expect(result.robustZ24h).toBeGreaterThan(3.5);
    expect(result.reasonCode).toBe("PEER_OUTLIER_REQUIRES_REVIEW");
  });

  it("holds when predicted drift slope exceeds the qualified safety slope", () => {
    const result = evaluateScreening({ ...base, checkpoints: [{ timeH: 0, value: 10, absoluteLimit: 50 }, { timeH: 24, value: 14, absoluteLimit: 50 }], peerValuesAt24h: [13.8, 14, 14.1, 13.9], safetySlope: 0.02 });
    expect(result.decision).toBe("HOLD");
    expect(result.reasonCode).toBe("FORECAST_SAFETY_SLOPE_EXCEEDED");
    expect(result.predictedSlope).toBeGreaterThan(0.02);
  });

  it("handles an exact zero-MAD peer group deterministically", () => {
    const result = evaluateScreening({ ...base, checkpoints: [{ timeH: 0, value: 10, absoluteLimit: 50 }, { timeH: 24, value: 12, absoluteLimit: 50 }], peerValuesAt24h: [12, 12, 12, 12], safetySlope: 0.1 });
    expect(result.peerMad24h).toBe(0);
    expect(result.robustZ24h).toBe(0);
    expect(result.decision).toBe("ACCEPT");
  });

  it("holds a higher value against an exact zero-MAD peer group", () => {
    const result = evaluateScreening({ ...base, checkpoints: [{ timeH: 0, value: 10, absoluteLimit: 50 }, { timeH: 24, value: 14, absoluteLimit: 50 }], peerValuesAt24h: [12, 12, 12, 12], safetySlope: 0.2 });
    expect(result.robustZ24h).toBe(Number.POSITIVE_INFINITY);
    expect(result.decision).toBe("HOLD");
  });

  it("handles a sparse peer group without throwing", () => {
    const result = evaluateScreening({ ...base, peerValuesAt24h: [12], safetySlope: 0.1 });
    expect(result.decision).toBe("ACCEPT");
    expect(result.robustZ24h).toBe(0);
  });

  it("uses the NASA-trained predictor when compatible training rows are supplied", () => {
    const result = evaluateScreening({ ...base, unit: "uA", nasaTrainingData: [
      { value0h: 10, value24h: 12, value168h: 18, parameterName: "Iddq", unit: "uA" },
      { value0h: 11, value24h: 13, value168h: 19, parameterName: "Iddq", unit: "uA" },
      { value0h: 12, value24h: 14, value168h: 20, parameterName: "Iddq", unit: "uA" },
    ] });
    expect(result.modelVersion).toBe("nasa-pcoe-ridge-v1");
    expect(result.predicted168h).toBeCloseTo(18.0, 5);
  });

  it("fails closed when an early checkpoint is missing", () => {
    expect(() => evaluateScreening({ ...base, checkpoints: [{ timeH: 24, value: 12, absoluteLimit: 50 }] })).toThrow("Missing valid 0h checkpoint");
  });

  it("proves 168h prediction is immune to data leakage (ignores 168h checkpoint in input array)", () => {
    const without168 = evaluateScreening({
      ...base,
      checkpoints: [
        { timeH: 0, value: 10, absoluteLimit: 50 },
        { timeH: 24, value: 12, absoluteLimit: 50 },
      ],
    });

    const with168 = evaluateScreening({
      ...base,
      checkpoints: [
        { timeH: 0, value: 10, absoluteLimit: 50 },
        { timeH: 24, value: 12, absoluteLimit: 50 },
        { timeH: 168, value: 9999, absoluteLimit: 50 }, // Intentionally extreme future value
      ],
    });

    expect(without168.predicted168h).toBe(with168.predicted168h);
    expect(without168.predicted168h).toBeCloseTo(24.0, 5);
  });
});
