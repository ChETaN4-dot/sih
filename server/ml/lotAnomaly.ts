import { datasetStore, ComponentSummary } from "../data/datasetStore";
import { IsolationForest } from "./isolationForest";
import {
  ROBUST_Z_HIGH_RISK_THRESHOLD,
  ROBUST_Z_REVIEW_THRESHOLD,
  ISOLATION_FOREST_HIGH_RISK_THRESHOLD,
  ISOLATION_FOREST_REVIEW_THRESHOLD,
} from "./riskEngine";

/**
 * Minimum lot size required for statistically stable Median/MAD and Isolation Forest scoring.
 * Below 10 components, statistical dispersion metrics (MAD) and random tree splits become unstable.
 */
export const MIN_LOT_SIZE_FOR_ANOMALY_DETECTION = 10;

export type ComponentAnomalyResult = {
  componentId: string;
  lotId: string;
  componentType: string;
  capacitance_uF: number;
  rated_voltage_V: number;
  test_voltage_V: number;
  test_temperature_C: number;
  dataSource: string;
  dataType: string;

  // Measurement stats
  availableCheckpoints: number[];
  currentDcl: number;
  latestTimeH: number;
  dclChange: number;
  pctChange: number;
  earlySlope: number;
  lateSlope?: number;

  // Lot baseline comparison
  lotMedianDcl: number;
  lotMadDcl: number;
  deviationFromLotMedian: number;
  robustZScore: number;
  isolationForestScore: number;

  // Engineering & Status
  specLimit: number;
  specLimitExceeded: boolean;
  status: "NORMAL" | "REVIEW" | "HIGH RISK";
  reasonForFlag: string;
  explanation: string;
  observedTrend: string;
};

export type LotAnomalyAnalysisResult = {
  lotId: string;
  totalComponentsInLot: number;
  dataType: string;
  sufficient: boolean;
  message?: string;

  lotBaseline?: {
    medianDcl: number;
    madDcl: number;
    medianEarlySlope: number;
    minDcl: number;
    maxDcl: number;
    timePoints: Array<{
      time_h: number;
      median: number;
      q25: number;
      q75: number;
      min: number;
      max: number;
    }>;
  };

  components: ComponentAnomalyResult[];
  flaggedCount: number;
  highRiskCount: number;
  reviewCount: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mad(values: number[], center: number): number {
  return median(values.map((v) => Math.abs(v - center)));
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function analyzeLotAnomalies(lotId: string): LotAnomalyAnalysisResult {
  const allComps = datasetStore.getComponentList();
  const lotComps = allComps.filter((c) => c.lot_id === lotId);

  if (lotComps.length === 0) {
    throw new Error(`Lot with ID ${lotId} not found`);
  }

  const dataType = lotComps[0].data_type;

  // Minimum lot size check (Requires at least 2 components to compare)
  if (lotComps.length < 2) {
    return {
      lotId,
      totalComponentsInLot: lotComps.length,
      dataType,
      sufficient: false,
      message: `Lot-level anomaly detection requires at least 2 components (this lot has ${lotComps.length}).`,
      components: [],
      flaggedCount: 0,
      highRiskCount: 0,
      reviewCount: 0,
    };
  }

  // 1. Calculate time-point lot baseline stats for chart bounds
  const allTimePoints = Array.from(
    new Set(lotComps.flatMap((c) => c.available_checkpoints)),
  ).sort((a, b) => a - b);

  const timePointsStats = allTimePoints.map((t) => {
    const vals = lotComps
      .flatMap((c) => c.measurements)
      .filter((m) => m.time_h === t)
      .map((m) => m.dcl_uA);

    const med = median(vals);
    const q25 = quantile(vals, 0.25);
    const q75 = quantile(vals, 0.75);
    const min = vals.length > 0 ? Math.min(...vals) : 0;
    const max = vals.length > 0 ? Math.max(...vals) : 0;

    return { time_h: t, median: med, q25, q75, min, max };
  });

  // Extract Latest DCL and Early Slopes for all lot components
  const latestDclVals = lotComps.map((c) => c.measurements[c.measurements.length - 1].dcl_uA);
  const lotMedianDcl = median(latestDclVals);
  const lotMadDcl = mad(latestDclVals, lotMedianDcl);

  const earlySlopes = lotComps.map((c) => {
    if (c.measurements.length >= 2) {
      return (c.measurements[1].dcl_uA - c.measurements[0].dcl_uA) / (c.measurements[1].time_h - c.measurements[0].time_h);
    }
    return 0;
  });
  const medianEarlySlope = median(earlySlopes);

  // 2. Prepare feature vectors for Isolation Forest
  // Features: [latestDcl, dclChange, pctChange, earlySlope, robustZScore]
  const featureMatrix: number[][] = [];
  const compMetrics: Array<{
    comp: ComponentSummary;
    currentDcl: number;
    latestTimeH: number;
    dclChange: number;
    pctChange: number;
    earlySlope: number;
    lateSlope?: number;
    deviationFromLotMedian: number;
    robustZScore: number;
    specLimit: number;
  }> = [];

  for (const c of lotComps) {
    const m = c.measurements;
    const first = m[0];
    const latest = m[m.length - 1];

    const currentDcl = latest.dcl_uA;
    const dclChange = currentDcl - first.dcl_uA;
    const pctChange = first.dcl_uA > 0 ? (dclChange / first.dcl_uA) * 100 : 0;
    const earlySlope = m.length >= 2 ? (m[1].dcl_uA - m[0].dcl_uA) / (m[1].time_h - m[0].time_h) : 0;
    const lateSlope = m.length >= 4 ? (m[3].dcl_uA - m[1].dcl_uA) / (m[3].time_h - m[1].time_h) : undefined;

    const dev = currentDcl - lotMedianDcl;
    const zScore = lotMadDcl > 0 ? dev / (1.4826 * lotMadDcl) : dev === 0 ? 0 : Math.sign(dev) * 999.0;

    // Spec limit logic (1.7 uA for 6.8uF/35V NASA parts, 50 uA for standard 47uF/25V parts)
    const specLimit = c.capacitance_uF === 6.8 && c.rated_voltage_V === 35 ? 1.7 : 50.0;

    compMetrics.push({
      comp: c,
      currentDcl,
      latestTimeH: latest.time_h,
      dclChange,
      pctChange,
      earlySlope,
      lateSlope,
      deviationFromLotMedian: dev,
      robustZScore: zScore,
      specLimit,
    });

    featureMatrix.push([currentDcl, dclChange, pctChange, earlySlope, zScore]);
  }

  // 3. Train Isolation Forest on lot feature matrix
  const iforest = new IsolationForest(100, Math.min(256, lotComps.length));
  iforest.fit(featureMatrix);
  const ifScores = iforest.predictScores(featureMatrix);

  // 4. Assign status, reason, and data-driven explanations
  const results: ComponentAnomalyResult[] = compMetrics.map((item, idx) => {
    const ifScore = ifScores[idx] ?? 0.5;
    const { comp, currentDcl, latestTimeH, dclChange, pctChange, earlySlope, lateSlope, deviationFromLotMedian, robustZScore, specLimit } = item;

    const specLimitExceeded = currentDcl > specLimit;

    let status: "NORMAL" | "REVIEW" | "HIGH RISK" = "NORMAL";
    let reasonForFlag = "Behavior is consistent with lot baseline";

    if (specLimitExceeded) {
      status = "HIGH RISK";
      reasonForFlag = `Measured DCL (${currentDcl.toFixed(2)} µA) directly exceeds qualified spec limit (${specLimit} µA)`;
    } else if (robustZScore >= ROBUST_Z_HIGH_RISK_THRESHOLD || (ifScore >= ISOLATION_FOREST_HIGH_RISK_THRESHOLD && robustZScore >= ROBUST_Z_REVIEW_THRESHOLD)) {
      status = "HIGH RISK";
      reasonForFlag = `Abnormal lot outlier behavior detected (Z = ${robustZScore.toFixed(2)} MAD, IF = ${ifScore.toFixed(2)}) requiring engineering review`;
    } else if (robustZScore >= ROBUST_Z_REVIEW_THRESHOLD || ifScore >= ISOLATION_FOREST_REVIEW_THRESHOLD) {
      status = "REVIEW";
      reasonForFlag = `Mild lot-relative deviation (Z = ${robustZScore.toFixed(2)} MAD, IF = ${ifScore.toFixed(2)}) requires engineering review`;
    }

    // Generate specific data-driven explanation
    const pctDiffMedian = lotMedianDcl > 0 ? ((currentDcl - lotMedianDcl) / lotMedianDcl) * 100 : 0;
    const trendText = dclChange > 0 ? `upward drift of +${dclChange.toFixed(2)} µA (+${pctChange.toFixed(1)}%)` : `stable trend (${dclChange.toFixed(2)} µA change)`;

    let explanation = `Component ${comp.component_id} exhibits a current DCL of ${currentDcl.toFixed(2)} µA at ${latestTimeH}h (${pctDiffMedian >= 0 ? "+" : ""}${pctDiffMedian.toFixed(1)}% relative to lot median ${lotMedianDcl.toFixed(2)} µA). `;
    explanation += `Degradation slope is ${earlySlope.toFixed(4)} µA/hour vs lot median slope of ${medianEarlySlope.toFixed(4)} µA/hour. `;

    if (specLimitExceeded) {
      explanation += `CRITICAL: Measurement directly violates component specification ceiling of ${specLimit} µA (nonconformance).`;
    } else if (status === "HIGH RISK") {
      explanation += `Component shows severe statistical divergence (Robust Z-score = ${robustZScore.toFixed(2)} MAD, Isolation Forest score = ${ifScore.toFixed(2)}). ANOMALY ≠ PHYSICAL FAILURE: requires engineering review to verify dielectric degradation.`;
    } else if (status === "REVIEW") {
      explanation += `Component shows moderate deviation from lot envelope (Robust Z-score = ${robustZScore.toFixed(2)} MAD, Isolation Forest score = ${ifScore.toFixed(2)}). Recommended for engineering review before release.`;
    } else {
      explanation += `Within normal statistical boundaries of the lot (Robust Z-score = ${robustZScore.toFixed(2)} MAD, Isolation Forest score = ${ifScore.toFixed(2)}). Applicable spec limit is ${specLimit} µA.`;
    }

    return {
      componentId: comp.component_id,
      lotId: comp.lot_id,
      componentType: comp.component_type,
      capacitance_uF: comp.capacitance_uF,
      rated_voltage_V: comp.rated_voltage_V,
      test_voltage_V: comp.test_voltage_V,
      test_temperature_C: comp.test_temperature_C,
      dataSource: comp.data_source,
      dataType: comp.data_type,
      availableCheckpoints: comp.available_checkpoints,
      currentDcl,
      latestTimeH,
      dclChange,
      pctChange,
      earlySlope,
      lateSlope,
      lotMedianDcl,
      lotMadDcl,
      deviationFromLotMedian,
      robustZScore,
      isolationForestScore: ifScore,
      specLimit,
      specLimitExceeded,
      status,
      reasonForFlag,
      explanation,
      observedTrend: trendText,
    };
  });

  // Sort components by risk status (HIGH RISK > REVIEW > NORMAL) then by Z-score
  const statusRank = { "HIGH RISK": 0, REVIEW: 1, NORMAL: 2 };
  results.sort((a, b) => statusRank[a.status] - statusRank[b.status] || b.robustZScore - a.robustZScore);

  const highRiskCount = results.filter((r) => r.status === "HIGH RISK").length;
  const reviewCount = results.filter((r) => r.status === "REVIEW").length;
  const flaggedCount = highRiskCount + reviewCount;

  return {
    lotId,
    totalComponentsInLot: lotComps.length,
    dataType,
    sufficient: true,
    lotBaseline: {
      medianDcl: lotMedianDcl,
      madDcl: lotMadDcl,
      medianEarlySlope,
      minDcl: Math.min(...latestDclVals),
      maxDcl: Math.max(...latestDclVals),
      timePoints: timePointsStats,
    },
    components: results,
    flaggedCount,
    highRiskCount,
    reviewCount,
  };
}
