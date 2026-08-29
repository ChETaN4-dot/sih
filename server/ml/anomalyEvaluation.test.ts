import { describe, expect, it } from "vitest";
import { evaluateModuleA } from "./anomalyEvaluation";

describe("Phase 4 — Live Tiered Anomaly Evaluation", () => {
  it("evaluates Module A against ground-truth benchmark and achieves >=90% recall on obvious anomalies", () => {
    const report = evaluateModuleA();

    expect(report.totalComponentsEvaluated).toBe(54);
    expect(report.totalInjectedAnomalies).toBe(12);

    // Assert >= 0.90 recall on Obvious tier only
    expect(report.strict.byTier.OBVIOUS.recall).toBeGreaterThanOrEqual(0.90);
    expect(report.loose.byTier.OBVIOUS.recall).toBeGreaterThanOrEqual(0.90);

    // Record live computed metrics for Moderate and Subtle tiers without artificial assertions
    console.log("Strict Evaluation Results:", JSON.stringify(report.strict.byTier, null, 2));
    console.log("Loose Evaluation Results:", JSON.stringify(report.loose.byTier, null, 2));
    console.log("Strict Missed Components (FN):", report.strict.falseNegatives);
  });
});
