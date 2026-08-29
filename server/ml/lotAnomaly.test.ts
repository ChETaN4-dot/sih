import { describe, expect, it } from "vitest";
import { analyzeLotAnomalies, MIN_LOT_SIZE_FOR_ANOMALY_DETECTION } from "./lotAnomaly";

describe("Module A — Lot Anomaly Detection Engine", () => {
  it("enforces minimum lot size threshold of 10 components", () => {
    expect(MIN_LOT_SIZE_FOR_ANOMALY_DETECTION).toBe(10);

    // NASA real dataset lot has only 4 components
    const res = analyzeLotAnomalies("NASA-HALT-85C-6V8F-35V");
    expect(res.sufficient).toBe(false);
    expect(res.components).toHaveLength(0);
    expect(res.message).toContain("Lot-level anomaly detection requires at least 10 comparable components");
  });

  it("accurately detects injected anomaly TAL-A-005 in LOT-A as HIGH RISK", () => {
    const res = analyzeLotAnomalies("LOT-A");
    expect(res.sufficient).toBe(true);
    expect(res.totalComponentsInLot).toBeGreaterThanOrEqual(10);

    const anomalyComp = res.components.find((c) => c.componentId === "TAL-A-005");
    expect(anomalyComp).toBeDefined();
    expect(anomalyComp?.status).toBe("HIGH RISK");
    expect(anomalyComp?.robustZScore).toBeGreaterThan(3.5);
    expect(anomalyComp?.explanation).toContain("ANOMALY ≠ PHYSICAL FAILURE");
  });

  it("accurately detects injected anomaly TAL-B-004 in LOT-B as HIGH RISK", () => {
    const res = analyzeLotAnomalies("LOT-B");
    expect(res.sufficient).toBe(true);
    expect(res.totalComponentsInLot).toBeGreaterThanOrEqual(10);

    const anomalyComp = res.components.find((c) => c.componentId === "TAL-B-004");
    expect(anomalyComp).toBeDefined();
    expect(anomalyComp?.status).toBe("HIGH RISK");
    expect(anomalyComp?.robustZScore).toBeGreaterThan(3.5);
  });

  it("correctly identifies clean components in LOT-A and LOT-B as NORMAL (no false positives)", () => {
    const resA = analyzeLotAnomalies("LOT-A");
    const cleanCompA = resA.components.find((c) => c.componentId === "TAL-A-001");
    expect(cleanCompA).toBeDefined();
    expect(cleanCompA?.status).toBe("NORMAL");

    const resB = analyzeLotAnomalies("LOT-B");
    const cleanCompB = resB.components.find((c) => c.componentId === "TAL-B-001");
    expect(cleanCompB).toBeDefined();
    expect(cleanCompB?.status).toBe("NORMAL");
  });
});
