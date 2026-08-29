import { UnifiedRiskVerdict } from "./riskEngine";
import { EngineeringCriterion } from "../data/engineeringCriteria";

export type UnifiedExplanationInput = {
  componentId: string;
  lotId: string;
  currentDcl: number;
  latestTimeH: number;
  dclChange: number;
  pctChange: number;
  earlySlope: number;
  lotMedianDcl?: number;
  lotMadDcl?: number;
  robustZScore?: number;
  isolationForestScore?: number;
  predicted168hLinear?: number;
  predicted168hRidge?: number;
  ridgeMae?: number;
  specCriterion: EngineeringCriterion;
  verdict: UnifiedRiskVerdict;
};

export type ActionItem = {
  id: string;
  label: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  mandatory: boolean;
};

export type SynthesizedExplanation = {
  whatHappened: string;
  whyItOccurred: string;
  whatIsPredicted: string;
  whatEngineerShouldReview: string;
  fullSynthesisText: string;

  // Rich visual telemetry metadata
  riskScorePct: number;
  riskBadgeLabel: string;
  riskColorHex: string;
  mechanismCategory: string;
  actionItems: ActionItem[];
  specMarginPct: number;
  zScoreSeverity: "LOW" | "ELEVATED" | "SEVERE" | "CRITICAL";
};

export function generateUnifiedExplanation(input: UnifiedExplanationInput): SynthesizedExplanation {
  const {
    componentId,
    lotId,
    currentDcl,
    latestTimeH,
    dclChange,
    pctChange,
    earlySlope,
    lotMedianDcl,
    lotMadDcl,
    robustZScore,
    isolationForestScore,
    predicted168hLinear,
    predicted168hRidge,
    specCriterion,
    verdict,
  } = input;

  const status = verdict.status;

  // Determine Spec Margin
  const specValue = specCriterion.value;
  const specMarginPct = Math.max(0, ((specValue - currentDcl) / specValue) * 100);

  // Determine Z-Score Severity
  let zScoreSeverity: "LOW" | "ELEVATED" | "SEVERE" | "CRITICAL" = "LOW";
  const zVal = robustZScore ?? 0;
  if (zVal >= 8.0) zScoreSeverity = "CRITICAL";
  else if (zVal >= 5.0) zScoreSeverity = "SEVERE";
  else if (zVal >= 2.5) zScoreSeverity = "ELEVATED";

  // Determine Risk Score & Theme Color
  let riskScorePct = 15;
  let riskBadgeLabel = "NOMINAL RELEASE";
  let riskColorHex = "#d6f24a"; // Chartreuse
  let mechanismCategory = "STABLE DIELECTRIC STOICHIOMETRY";

  if (status === "HIGH RISK") {
    riskScorePct = Math.min(98, Math.max(75, Math.round(zVal * 8 + (verdict.specLimitExceeded ? 30 : 15))));
    riskBadgeLabel = verdict.specLimitExceeded ? "CRITICAL SPEC VIOLATION" : "HIGH RISK ANOMALY";
    riskColorHex = "#e57463"; // Crimson
    mechanismCategory = "ACCELERATED OXYGEN-VACANCY MIGRATION & LOCAL THICKNESS VARIATION";
  } else if (status === "REVIEW") {
    riskScorePct = Math.min(74, Math.max(42, Math.round(zVal * 7 + earlySlope * 100)));
    riskBadgeLabel = "MODERATE DRIFT REVIEW";
    riskColorHex = "#f3b145"; // Amber
    mechanismCategory = "THERMALLY ACTIVATED VACANCY MOBILITY & DRIFT ELEVATION";
  }

  // 1. DYNAMIC "WHAT HAPPENED"
  let whatHappened = "";
  if (status === "HIGH RISK") {
    whatHappened = `CRITICAL DIVERGENCE DETECTED: Component ${componentId} (Lot ${lotId}) recorded a leakage current of ${currentDcl.toFixed(2)} ${specCriterion.unit} at ${latestTimeH}h checkpoint (${dclChange >= 0 ? "+" : ""}${dclChange.toFixed(2)} ${specCriterion.unit}, ${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}% trajectory change). `;
    if (lotMedianDcl !== undefined && robustZScore !== undefined) {
      const pctDiff = lotMedianDcl > 0 ? ((currentDcl - lotMedianDcl) / lotMedianDcl) * 100 : 0;
      whatHappened += `This part deviates by +${pctDiff.toFixed(1)}% from the lot median baseline (${lotMedianDcl.toFixed(2)} ${specCriterion.unit}, MAD = ${lotMadDcl?.toFixed(3)} ${specCriterion.unit}), registering an extreme Robust Z-score of ${robustZScore.toFixed(2)} MAD (Isolation Forest Anomaly Score = ${isolationForestScore?.toFixed(2)}).`;
    }
  } else if (status === "REVIEW") {
    whatHappened = `MODERATE DRIFT WATCH: Component ${componentId} (Lot ${lotId}) exhibits an elevated DCL reading of ${currentDcl.toFixed(2)} ${specCriterion.unit} at ${latestTimeH}h (${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}% change over interval). `;
    if (lotMedianDcl !== undefined && robustZScore !== undefined) {
      whatHappened += `The part exhibits a moderate baseline divergence (Robust Z = ${robustZScore.toFixed(2)} MAD relative to lot median ${lotMedianDcl.toFixed(2)} ${specCriterion.unit}), requiring engineering verification prior to flight integration.`;
    }
  } else {
    whatHappened = `NOMINAL BASELINE ALIGNMENT: Component ${componentId} (Lot ${lotId}) recorded a stable DCL value of ${currentDcl.toFixed(2)} ${specCriterion.unit} at ${latestTimeH}h (${dclChange >= 0 ? "+" : ""}${dclChange.toFixed(2)} ${specCriterion.unit} change). `;
    if (lotMedianDcl !== undefined && robustZScore !== undefined) {
      whatHappened += `Current evolution remains fully tightly bounded within the statistical lot median envelope (Robust Z = ${robustZScore.toFixed(2)} MAD, Isolation Forest Score = ${isolationForestScore?.toFixed(2)}).`;
    }
  }

  // 2. DYNAMIC "WHY IT OCCURRED" (Hedged physics)
  let whyItOccurred = "";
  if (status === "HIGH RISK") {
    whyItOccurred = `PHYSICAL MECHANISM ANALYSIS: The observed severe DCL divergence is consistent with high electric-field-induced oxygen vacancy mobility within the amorphous Ta2O5 dielectric layer. Under 125°C thermal and rated voltage stress, positively charged oxygen vacancies drift toward the MnO2 cathode interface, lowering the Schottky barrier height and elevating electron injection. The high Z-score indicates potential anode pellet micro-porosity variation or localized thin spots in the anodic oxide layer.`;
  } else if (status === "REVIEW") {
    whyItOccurred = `PHYSICAL MECHANISM ANALYSIS: The measured current trajectory reflects thermally activated oxygen vacancy redistribution under applied electric field. While current levels remain under absolute limits, early slope elevation indicates subtle dielectric state changes that warrant observation across remaining burn-in checkpoints.`;
  } else {
    whyItOccurred = `PHYSICAL MECHANISM ANALYSIS: Dielectric current transport is dominated by normal Poole-Frenkel conduction across a uniform amorphous Ta2O5 dielectric barrier with negligible oxygen vacancy drift or barrier degradation.`;
  }

  // 3. DYNAMIC "WHAT IS PREDICTED"
  let whatIsPredicted = "";
  if (predicted168hLinear !== undefined && predicted168hRidge !== undefined) {
    whatIsPredicted = `FORECAST & PROJECTION: Early 0h→24h linear extrapolation predicts 168h DCL of ${predicted168hLinear.toFixed(2)} ${specCriterion.unit} (early slope = ${earlySlope.toFixed(4)} ${specCriterion.unit}/h). Regularized LOCO Ridge Regression forecasts 168h DCL at ${predicted168hRidge.toFixed(2)} ${specCriterion.unit}. `;
    if (verdict.predictedLimitExceeded) {
      whatIsPredicted += `CRITICAL WARNING: Forecasted 168h value exceeds the specification ceiling (${specValue} ${specCriterion.unit}).`;
    } else {
      whatIsPredicted += `Forecasted 168h DCL remains within qualified specification limits (${specValue} ${specCriterion.unit}, remaining margin = ${specMarginPct.toFixed(1)}%).`;
    }
  }

  // 4. DYNAMIC "ENGINEERING REVIEW GUIDANCE"
  let whatEngineerShouldReview = "";
  const actionItems: ActionItem[] = [];

  if (status === "HIGH RISK") {
    whatEngineerShouldReview = `DISPOSITION GUIDANCE: HIGH RISK ANOMALY — Hold component from payload assembly. Perform thermal chamber log audit, verify burn-in power supply ripple, and submit to Materials Review Board (MRB) for destruct-physical-analysis (DPA) evaluation. MANDATORY POLICY: ANOMALY ≠ PHYSICAL FAILURE.`;
    actionItems.push(
      { id: "mrb", label: "Route Component to Materials Review Board (MRB) Hold", severity: "CRITICAL", mandatory: true },
      { id: "logs", label: "Audit 125°C Burn-in Chamber Thermal Logs & Power Ripple", severity: "WARNING", mandatory: true },
      { id: "anneal", label: "Verify Post-Bake Annealing & Room Temperature Recovery", severity: "WARNING", mandatory: false },
      { id: "policy", label: "Policy Reminder: Statistical Anomaly ≠ Physical Component Failure", severity: "INFO", mandatory: true },
    );
  } else if (status === "REVIEW") {
    whatEngineerShouldReview = `DISPOSITION GUIDANCE: MODERATE DRIFT — Hold for 96h/168h verification. Confirm whether leakage slope flattens or continues accelerating before final flight clearance.`;
    actionItems.push(
      { id: "monitor", label: "Monitor 96h & 168h Intermediate Burn-In Checkpoints", severity: "WARNING", mandatory: true },
      { id: "slope", label: "Verify Drift Rate Remains Below Safety Slope (0.005 µA/h)", severity: "WARNING", mandatory: true },
      { id: "retest", label: "Perform Post-Burn-In 25°C Parametric Verification", severity: "INFO", mandatory: false },
    );
  } else {
    whatEngineerShouldReview = `DISPOSITION GUIDANCE: ACCEPT / NOMINAL — Component complies with both dynamic lot baseline envelope and static MIL-PRF specification limits. Authorized for immediate flight integration.`;
    actionItems.push(
      { id: "release", label: "Authorize Component Release for Flight Payload Integration", severity: "INFO", mandatory: true },
      { id: "record", label: "Log Screening Data in Quality Assurance Reliability Record", severity: "INFO", mandatory: true },
    );
  }

  const fullSynthesisText = `${whatHappened}\n\n${whyItOccurred}\n\n${whatIsPredicted}\n\n${whatEngineerShouldReview}`;

  return {
    whatHappened,
    whyItOccurred,
    whatIsPredicted,
    whatEngineerShouldReview,
    fullSynthesisText,
    riskScorePct,
    riskBadgeLabel,
    riskColorHex,
    mechanismCategory,
    actionItems,
    specMarginPct,
    zScoreSeverity,
  };
}
