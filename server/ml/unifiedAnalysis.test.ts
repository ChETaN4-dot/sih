import { describe, expect, it } from "vitest";
import {
  evaluateUnifiedRisk,
  ROBUST_Z_HIGH_RISK_THRESHOLD,
  ROBUST_Z_REVIEW_THRESHOLD,
  ISOLATION_FOREST_HIGH_RISK_THRESHOLD,
  ISOLATION_FOREST_REVIEW_THRESHOLD,
  VERSION_METADATA,
} from "./riskEngine";
import { getEngineeringCriterionForComponent } from "../data/engineeringCriteria";
import { getEnvironmentalContextForComponent } from "../data/environmentalContext";
import { generateUnifiedExplanation } from "./unifiedExplanation";

describe("Phase 3 — Unified Risk Engine & Systems Verification", () => {
  it("exports centralized threshold constants from riskEngine.ts", () => {
    expect(ROBUST_Z_HIGH_RISK_THRESHOLD).toBe(3.5);
    expect(ROBUST_Z_REVIEW_THRESHOLD).toBe(2.5);
    expect(ISOLATION_FOREST_HIGH_RISK_THRESHOLD).toBe(0.60);
    expect(ISOLATION_FOREST_REVIEW_THRESHOLD).toBe(0.55);
  });

  it("evaluates unified risk for single component (Module B only)", () => {
    const verdict = evaluateUnifiedRisk({
      measuredDcl: 45.0,
      specLimit: 50.0,
      earlySlope: 0.08, // Exceeds SAFETY_SLOPE_THRESHOLD (0.05)
      predicted168hDcl: 51.0, // Exceeds specLimit (50.0)
    });

    expect(verdict.status).toBe("HIGH RISK");
    expect(verdict.predictedLimitExceeded).toBe(true);
    expect(verdict.safetySlopeExceeded).toBe(true);
    expect(verdict.versionMetadata).toEqual(VERSION_METADATA);
  });

  it("evaluates unified risk for lot component (Module A + B)", () => {
    const verdict = evaluateUnifiedRisk({
      measuredDcl: 12.0,
      specLimit: 50.0,
      robustZScore: 4.2, // Exceeds Z >= 3.5
      isolationForestScore: 0.68,
      earlySlope: 0.01,
      predicted168hDcl: 14.0,
    });

    expect(verdict.status).toBe("HIGH RISK");
    expect(verdict.lotOutlierFlagged).toBe(true);
    expect(verdict.reasonCode).toBe("SEVERE_LOT_ANOMALY");
  });

  it("matches engineering criteria store correctly by capacitance and voltage", () => {
    const nasaCrit = getEngineeringCriterionForComponent(6.8, 35);
    expect(nasaCrit.value).toBe(2.38); // 6.8 * 35 * 0.01 = 2.38 uA
    expect(nasaCrit.unit).toBe("µA");
    expect(nasaCrit.criterion_name).toBe("Calculated Baseline DCL Criterion");

    const stdCrit = getEngineeringCriterionForComponent(47, 25);
    expect(stdCrit.value).toBe(11.75); // 47 * 25 * 0.01 = 11.75 uA
    expect(stdCrit.unit).toBe("µA");
  });

  it("verifies environmental context layer active vs context-only flags", () => {
    const envFactors = getEnvironmentalContextForComponent(125, 25, 168);
    expect(envFactors.length).toBeGreaterThan(0);

    const tempFactor = envFactors.find((f) => f.factor_id === "TEMP");
    expect(tempFactor?.status).toBe("MEASURED");
    expect(tempFactor?.ML_feature).toBe(true);

    const radFactor = envFactors.find((f) => f.factor_id === "TID");
    expect(radFactor?.status).toBe("NOT AVAILABLE");
    expect(radFactor?.ML_feature).toBe(false);
  });

  it("generates a synthesized plain-language explanation with hedged language", () => {
    const specCrit = getEngineeringCriterionForComponent(47, 25);
    const verdict = evaluateUnifiedRisk({ measuredDcl: 45.0, specLimit: 50.0, robustZScore: 8.4, isolationForestScore: 0.65 });
    const exp = generateUnifiedExplanation({
      componentId: "TAL-A-005",
      lotId: "LOT-A",
      currentDcl: 48.2,
      latestTimeH: 168,
      dclChange: 47.1,
      pctChange: 4280.0,
      earlySlope: 0.306,
      lotMedianDcl: 2.65,
      lotMadDcl: 0.15,
      robustZScore: 8.4,
      isolationForestScore: 0.65,
      predicted168hLinear: 48.2,
      predicted168hRidge: 45.0,
      specCriterion: specCrit,
      verdict,
    });

    expect(exp.whatHappened).toContain("TAL-A-005");
    expect(exp.whyItOccurred).toContain("consistent with");
    expect(exp.whatEngineerShouldReview).toContain("ANOMALY ≠ PHYSICAL FAILURE");
  });
});
