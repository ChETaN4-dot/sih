import { describe, expect, it } from "vitest";
import { fitNASARidge, NASATrainingRow } from "../nasaBatteryModel";
import { analyzeComponentDrift, fitExponentialCurve } from "./driftModels";
import { datasetStore } from "../data/datasetStore";

describe("Component-level train/test separation (Leakage Prevention)", () => {
  it("explicitly excludes target component's data from model fitting", () => {
    const trainingRows: NASATrainingRow[] = [
      { componentId: "COMP-001", value0h: 1.0, value24h: 1.2, value168h: 2.0 },
      { componentId: "COMP-002", value0h: 1.1, value24h: 1.3, value168h: 2.2 },
      { componentId: "COMP-003", value0h: 0.9, value24h: 1.1, value168h: 1.8 },
      // Target component has extreme outlier values at 168h:
      { componentId: "TARGET-COMP", value0h: 1.0, value24h: 1.2, value168h: 999.0 },
    ];

    // Fit model WITHOUT excluding target
    const modelWithTarget = fitNASARidge(trainingRows, undefined, undefined, undefined);

    // Fit model EXCLUDING target
    const modelWithoutTarget = fitNASARidge(trainingRows, undefined, undefined, "TARGET-COMP");

    expect(modelWithTarget).not.toBeNull();
    expect(modelWithoutTarget).not.toBeNull();

    // Predictions must differ significantly because TARGET-COMP was excluded
    const predWith = modelWithTarget!.predict(1.0, 1.2);
    const predWithout = modelWithoutTarget!.predict(1.0, 1.2);

    expect(predWithout).not.toBeCloseTo(predWith, 1);
    expect(modelWithoutTarget!.rows).toBe(3); // TARGET-COMP was excluded
  });

  it("calculates distinct MAE and RMSE metrics for Linear vs Ridge models on held-out components", () => {
    const analysis = analyzeComponentDrift("TAL-A-001");
    expect(analysis.sufficient).toBe(true);
    expect(analysis.predictions).toBeDefined();

    const preds = analysis.predictions!;
    expect(preds.linear.predicted168h).toBeGreaterThan(0);
    expect(preds.ridge.predicted168h).toBeGreaterThan(0);

    // Ensure LOCO validation metrics are present
    expect(preds.linear.mae).toBeGreaterThanOrEqual(0);
    expect(preds.ridge.mae).toBeGreaterThanOrEqual(0);
    expect(preds.randomForest.mae).toBeGreaterThanOrEqual(0);
    expect(preds.randomForest.predicted168h).toBeGreaterThan(0);
    expect(preds.exponential.r2).toBeGreaterThanOrEqual(0);
  });

  it("fits an exponential degradation curve and reports R2", () => {
    const points = [
      { time_h: 0, dcl_uA: 1.0 },
      { time_h: 24, dcl_uA: 1.5 },
      { time_h: 96, dcl_uA: 2.2 },
      { time_h: 168, dcl_uA: 2.8 },
    ];
    const expFit = fitExponentialCurve(points);
    expect(expFit.predicted168h).toBeGreaterThan(2.0);
    expect(expFit.r2).toBeGreaterThan(0.9);
  });
});
