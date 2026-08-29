import { analyzeLotAnomalies } from "./lotAnomaly";
import groundTruthData from "../data/groundTruthAnomalies.json";

export type GroundTruthItem = {
  component_id: string;
  lot_id: string;
  severity_level: "OBVIOUS" | "MODERATE" | "SUBTLE";
  injected_behavior: string;
};

export type TierEvaluationResult = {
  tier: "OBVIOUS" | "MODERATE" | "SUBTLE" | "ALL";
  totalInjected: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  recall: number;
  precision: number;
  f1: number;
  fnr: number;
  fpr: number;
  accuracy: number;
};

export type EvaluationReport = {
  evaluationDataset: string;
  totalComponentsEvaluated: number;
  totalInjectedAnomalies: number;
  strict: {
    overall: TierEvaluationResult;
    byTier: Record<"OBVIOUS" | "MODERATE" | "SUBTLE", TierEvaluationResult>;
    falseNegatives: Array<{ componentId: string; lotId: string; tier: string; zScore: number; ifScore: number; currentDcl: number }>;
    falsePositives: Array<{ componentId: string; lotId: string; zScore: number; ifScore: number; currentDcl: number }>;
  };
  loose: {
    overall: TierEvaluationResult;
    byTier: Record<"OBVIOUS" | "MODERATE" | "SUBTLE", TierEvaluationResult>;
    falseNegatives: Array<{ componentId: string; lotId: string; tier: string; zScore: number; ifScore: number; currentDcl: number }>;
    falsePositives: Array<{ componentId: string; lotId: string; zScore: number; ifScore: number; currentDcl: number }>;
  };
  timestamp: string;
};

export function evaluateModuleA(): EvaluationReport {
  const groundTruth: GroundTruthItem[] = groundTruthData as GroundTruthItem[];
  const groundTruthMap = new Map<string, GroundTruthItem>();
  groundTruth.forEach((item) => groundTruthMap.set(item.component_id, item));

  // Run existing unchanged Module A detection on all 3 synthetic lots
  const lots = ["LOT-A", "LOT-B", "LOT-C"];
  const allAnalyzedComps: any[] = [];

  for (const lotId of lots) {
    const lotRes = analyzeLotAnomalies(lotId);
    if (lotRes.sufficient) {
      allAnalyzedComps.push(...lotRes.components);
    }
  }

  const totalComponents = allAnalyzedComps.length;

  function runEvaluation(isStrict: boolean) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    const tierStats = {
      OBVIOUS: { total: 0, tp: 0, fp: 0, tn: 0, fn: 0 },
      MODERATE: { total: 0, tp: 0, fp: 0, tn: 0, fn: 0 },
      SUBTLE: { total: 0, tp: 0, fp: 0, tn: 0, fn: 0 },
    };

    const falseNegatives: Array<{ componentId: string; lotId: string; tier: string; zScore: number; ifScore: number; currentDcl: number }> = [];
    const falsePositives: Array<{ componentId: string; lotId: string; zScore: number; ifScore: number; currentDcl: number }> = [];

    // Count injected totals per tier
    groundTruth.forEach((gt) => {
      tierStats[gt.severity_level].total++;
    });

    allAnalyzedComps.forEach((comp) => {
      const gt = groundTruthMap.get(comp.componentId);
      const isFlagged = isStrict ? comp.status === "HIGH RISK" : comp.status === "HIGH RISK" || comp.status === "REVIEW";

      if (gt) {
        // True Anomaly
        if (isFlagged) {
          tp++;
          tierStats[gt.severity_level].tp++;
        } else {
          fn++;
          tierStats[gt.severity_level].fn++;
          falseNegatives.push({
            componentId: comp.componentId,
            lotId: comp.lotId,
            tier: gt.severity_level,
            zScore: comp.robustZScore,
            ifScore: comp.isolationForestScore,
            currentDcl: comp.currentDcl,
          });
        }
      } else {
        // Normal component
        if (isFlagged) {
          fp++;
          falsePositives.push({
            componentId: comp.componentId,
            lotId: comp.lotId,
            zScore: comp.robustZScore,
            ifScore: comp.isolationForestScore,
            currentDcl: comp.currentDcl,
          });
        } else {
          tn++;
        }
      }
    });

    const calcTierResult = (tName: "OBVIOUS" | "MODERATE" | "SUBTLE" | "ALL", stats: { total: number; tp: number; fp: number; tn: number; fn: number }): TierEvaluationResult => {
      const recall = stats.tp + stats.fn > 0 ? stats.tp / (stats.tp + stats.fn) : 0;
      const precision = stats.tp + stats.fp > 0 ? stats.tp / (stats.tp + stats.fp) : 0;
      const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
      const fnr = stats.tp + stats.fn > 0 ? stats.fn / (stats.tp + stats.fn) : 0;
      const fpr = stats.fp + stats.tn > 0 ? stats.fp / (stats.fp + stats.tn) : 0;
      const totalPop = stats.tp + stats.tn + stats.fp + stats.fn;
      const accuracy = totalPop > 0 ? (stats.tp + stats.tn) / totalPop : 0;

      return {
        tier: tName,
        totalInjected: stats.total,
        tp: stats.tp,
        fp: stats.fp,
        tn: stats.tn,
        fn: stats.fn,
        recall: Number(recall.toFixed(4)),
        precision: Number(precision.toFixed(4)),
        f1: Number(f1.toFixed(4)),
        fnr: Number(fnr.toFixed(4)),
        fpr: Number(fpr.toFixed(4)),
        accuracy: Number(accuracy.toFixed(4)),
      };
    };

    const overall = calcTierResult("ALL", { total: groundTruth.length, tp, fp, tn, fn });
    const byTier = {
      OBVIOUS: calcTierResult("OBVIOUS", tierStats.OBVIOUS),
      MODERATE: calcTierResult("MODERATE", tierStats.MODERATE),
      SUBTLE: calcTierResult("SUBTLE", tierStats.SUBTLE),
    };

    return { overall, byTier, falseNegatives, falsePositives };
  }

  return {
    evaluationDataset: "synthetic_tantalum_dcl.csv (54 components across LOT-A/LOT-B/LOT-C)",
    totalComponentsEvaluated: totalComponents,
    totalInjectedAnomalies: groundTruth.length,
    strict: runEvaluation(true),
    loose: runEvaluation(false),
    timestamp: new Date().toISOString(),
  };
}
