/**
 * Centralized Threshold Constants for Anomaly and Risk Classification.
 * Each constant represents a statistically or scientifically calibrated boundary.
 */

// Robust Z-score thresholds (MAD-equivalent units from median)
// Z >= 3.5 corresponds to severe outlier status in non-Gaussian distribution
export const ROBUST_Z_HIGH_RISK_THRESHOLD = 3.5;
// Z >= 2.5 represents initial deviation from lot baseline envelope
export const ROBUST_Z_REVIEW_THRESHOLD = 2.5;

// Isolation Forest anomaly score thresholds (s in [0, 1])
// s >= 0.60 indicates strong multi-dimensional isolation in decision tree space
export const ISOLATION_FOREST_HIGH_RISK_THRESHOLD = 0.60;
// s >= 0.55 indicates moderate anomaly tendency
export const ISOLATION_FOREST_REVIEW_THRESHOLD = 0.55;

// Maximum degradation slope threshold (uA/hour) — initial engineering heuristic threshold, not independently validated against a real component-family degradation distribution — pending further calibration with additional real data.
export const SAFETY_SLOPE_THRESHOLD = 0.05;

// System Versioning Identifiers
export const VERSION_METADATA = {
  model_version: "isolation-forest-v1 / ridge-loco-v1",
  dataset_version: "synthetic-tantalum-v1 / real-nasa-2016",
  feature_version: "dcl-features-v1",
  logic_version: "unified-risk-engine-v1",
};

export type UnifiedRiskInput = {
  measuredDcl: number;
  specLimit: number;
  // Module A Evidence (optional)
  robustZScore?: number;
  isolationForestScore?: number;
  // Module B Evidence (optional)
  earlySlope?: number;
  predicted168hDcl?: number;
};

export type UnifiedRiskVerdict = {
  status: "NORMAL" | "REVIEW" | "HIGH RISK";
  specLimitExceeded: boolean;
  predictedLimitExceeded: boolean;
  safetySlopeExceeded: boolean;
  lotOutlierFlagged: boolean;
  reasonCode: string;
  verdictSummary: string;
  versionMetadata: typeof VERSION_METADATA;
  timestamp: string;
};

/**
 * Transparent Deterministic Rule Engine
 * Combines Module A anomaly evidence, Module B drift/prediction evidence, and Spec Limits.
 */
export function evaluateUnifiedRisk(input: UnifiedRiskInput): UnifiedRiskVerdict {
  const { measuredDcl, specLimit, robustZScore, isolationForestScore, earlySlope, predicted168hDcl } = input;

  const specLimitExceeded = measuredDcl > specLimit;
  const predictedLimitExceeded = Boolean(predicted168hDcl && predicted168hDcl > specLimit);
  const safetySlopeExceeded = Boolean(earlySlope && earlySlope > SAFETY_SLOPE_THRESHOLD);

  const z = robustZScore ?? 0;
  const ifScore = isolationForestScore ?? 0;

  const isHighRiskOutlier = z >= ROBUST_Z_HIGH_RISK_THRESHOLD || (ifScore >= ISOLATION_FOREST_HIGH_RISK_THRESHOLD && z >= ROBUST_Z_REVIEW_THRESHOLD);
  const isReviewOutlier = z >= ROBUST_Z_REVIEW_THRESHOLD || ifScore >= ISOLATION_FOREST_REVIEW_THRESHOLD;
  const lotOutlierFlagged = isHighRiskOutlier || isReviewOutlier;

  let status: "NORMAL" | "REVIEW" | "HIGH RISK" = "NORMAL";
  let reasonCode = "WITHIN_NORMAL_ENVELOPE";
  let verdictSummary = "Component operates within normal statistical lot baseline and specification limits.";

  if (specLimitExceeded) {
    status = "HIGH RISK";
    reasonCode = "SPEC_LIMIT_EXCEEDED";
    verdictSummary = `Measured DCL (${measuredDcl.toFixed(2)} µA) exceeds engineering spec limit (${specLimit} µA). Direct nonconformance.`;
  } else if (predictedLimitExceeded) {
    status = "HIGH RISK";
    reasonCode = "PREDICTED_SPEC_VIOLATION";
    verdictSummary = `Predicted 168h DCL (${predicted168hDcl?.toFixed(2)} µA) is forecast to cross engineering spec limit (${specLimit} µA).`;
  } else if (isHighRiskOutlier) {
    status = "HIGH RISK";
    reasonCode = "SEVERE_LOT_ANOMALY";
    verdictSummary = `Abnormal lot behavior detected (Z = ${z.toFixed(2)} MAD, IF = ${ifScore.toFixed(2)}). ANOMALY ≠ PHYSICAL FAILURE: requires engineering review.`;
  } else if (safetySlopeExceeded) {
    status = "REVIEW";
    reasonCode = "SAFETY_SLOPE_EXCEEDED";
    verdictSummary = `Degradation slope (${earlySlope?.toFixed(4)} µA/h) exceeds heuristic safety slope threshold (${SAFETY_SLOPE_THRESHOLD} µA/h). Requires engineering review.`;
  } else if (isReviewOutlier) {
    status = "REVIEW";
    reasonCode = "MODERATE_LOT_DEVIATION";
    verdictSummary = `Moderate lot-relative deviation (Z = ${z.toFixed(2)} MAD, IF = ${ifScore.toFixed(2)}). Recommended for engineering review.`;
  }

  return {
    status,
    specLimitExceeded,
    predictedLimitExceeded,
    safetySlopeExceeded,
    lotOutlierFlagged,
    reasonCode,
    verdictSummary,
    versionMetadata: VERSION_METADATA,
    timestamp: new Date().toISOString(),
  };
}
