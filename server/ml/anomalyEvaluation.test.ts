import { describe, expect, it } from "vitest";
import { evaluateModuleA } from "./anomalyEvaluation";
import { analyzeLotAnomalies } from "./lotAnomaly";
import { readFileSync } from "fs";
import { join } from "path";

describe("Module A — Ground Truth Offline Evaluation & Metric Verification", () => {
  it("compares known anomalous components against predictions and calculates TP, TN, FP, FN, Precision, Recall, F1", () => {
    const report = evaluateModuleA();

    expect(report.totalComponentsEvaluated).toBe(54);
    expect(report.totalInjectedAnomalies).toBe(12);

    const strictOverall = report.strict.overall;

    // 1. Known anomalous components are compared against predictions
    expect(strictOverall.tp + strictOverall.fn).toBe(12);
    expect(strictOverall.tp + strictOverall.tn + strictOverall.fp + strictOverall.fn).toBe(54);

    // 2. TP/TN/FP/FN mathematical consistency
    expect(strictOverall.tp).toBeGreaterThanOrEqual(0);
    expect(strictOverall.tn).toBeGreaterThanOrEqual(0);
    expect(strictOverall.fp).toBeGreaterThanOrEqual(0);
    expect(strictOverall.fn).toBeGreaterThanOrEqual(0);

    // 3. Recall formula check: TP / (TP + FN)
    const expectedRecall = Number((strictOverall.tp / (strictOverall.tp + strictOverall.fn)).toFixed(4));
    expect(strictOverall.recall).toBe(expectedRecall);

    // 4. Precision formula check: TP / (TP + FP)
    const expectedPrecision = Number((strictOverall.tp / (strictOverall.tp + strictOverall.fp)).toFixed(4));
    expect(strictOverall.precision).toBe(expectedPrecision);

    // 5. F1 formula check: 2 * Precision * Recall / (Precision + Recall)
    const expectedF1 = Number(((2 * expectedPrecision * expectedRecall) / (expectedPrecision + expectedRecall)).toFixed(4));
    expect(strictOverall.f1).toBe(expectedF1);

    // 6. Explicit false negative accounting
    expect(report.strict.falseNegatives).toHaveLength(strictOverall.fn);

    // Tier-level checks: Obvious anomalies must achieve high recall
    expect(report.strict.byTier.OBVIOUS.recall).toBe(1.0);
    expect(report.strict.byTier.MODERATE.recall).toBe(1.0);
  });

  it("proves Data Separation: groundTruthAnomalies.json is NEVER imported or referenced by production scoring code", () => {
    // 7. Ground-truth labels cannot influence model inputs
    const productionFiles = [
      join(process.cwd(), "server", "ml", "lotAnomaly.ts"),
      join(process.cwd(), "server", "ml", "riskEngine.ts"),
      join(process.cwd(), "server", "ml", "driftModels.ts"),
      join(process.cwd(), "server", "screening.ts"),
      join(process.cwd(), "server", "ml", "unifiedExplanation.ts"),
    ];

    for (const file of productionFiles) {
      const content = readFileSync(file, "utf-8");
      expect(content).not.toContain("groundTruthAnomalies");
      expect(content).not.toContain("groundTruthData");
    }
  });

  it("proves production anomaly scoring operates independently without groundTruthAnomalies.json", () => {
    // 8. Production scoring works without ground truth
    const lotAResult = analyzeLotAnomalies("LOT-A");
    expect(lotAResult.sufficient).toBe(true);
    expect(lotAResult.components.length).toBeGreaterThan(0);
    
    // Confirm production result returns valid Robust Z & Isolation Forest scores without GT labels
    const firstComp = lotAResult.components[0];
    expect(firstComp.robustZScore).toBeDefined();
    expect(firstComp.isolationForestScore).toBeDefined();
    expect(typeof firstComp.status).toBe("string");
  });
});
