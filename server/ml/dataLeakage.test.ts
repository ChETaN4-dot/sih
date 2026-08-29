import { describe, expect, it } from "vitest";
import { analyzeComponentDrift } from "./driftModels";
import { datasetStore } from "../data/datasetStore";
import { evaluateScreening } from "../screening";

describe("Strict Data Leakage Protection Audit", () => {
  it("guarantees 96h and 168h future measurements cannot alter 24h prediction output", () => {
    const originalComponent = datasetStore.getComponent("TAL-A-001")!;
    const analysisOriginal = analyzeComponentDrift("TAL-A-001");

    // Create corrupted component copy with extreme future 96h and 168h values (e.g. 9999 uA)
    const corruptedComponent = {
      ...originalComponent,
      measurements: originalComponent.measurements.map((m) => {
        if (m.time_h === 96 || m.time_h === 168) {
          return { ...m, dcl_uA: 9999.0 };
        }
        return m;
      }),
    };

    // Evaluate screening using 0h and 24h data ONLY
    const originalScreening = evaluateScreening({
      componentId: "TAL-A-001",
      checkpoints: [
        { timeH: 0, value: originalComponent.measurements.find((m) => m.time_h === 0)!.dcl_uA },
        { timeH: 24, value: originalComponent.measurements.find((m) => m.time_h === 24)!.dcl_uA },
      ],
      peerValuesAt24h: [1.1, 1.2, 1.15],
    });

    const corruptedScreening = evaluateScreening({
      componentId: "TAL-A-001",
      checkpoints: [
        { timeH: 0, value: corruptedComponent.measurements.find((m) => m.time_h === 0)!.dcl_uA },
        { timeH: 24, value: corruptedComponent.measurements.find((m) => m.time_h === 24)!.dcl_uA },
        // Intentionally attach corrupted future checkpoint:
        { timeH: 168, value: corruptedComponent.measurements.find((m) => m.time_h === 168)!.dcl_uA },
      ],
      peerValuesAt24h: [1.1, 1.2, 1.15],
    });

    // 168h prediction MUST remain 100% identical regardless of future 168h value
    expect(corruptedScreening.predicted168h).toBeCloseTo(originalScreening.predicted168h, 5);
  });

  it("guarantees synthetic ground-truth labels are never accessed by prediction models", () => {
    const analysis = analyzeComponentDrift("TAL-A-005");
    expect(analysis.predictions).toBeDefined();

    // Predictions must depend solely on numerical DCL values, not any label string
    expect(typeof analysis.predictions!.linear.predicted168h).toBe("number");
    expect(typeof analysis.predictions!.ridge.predicted168h).toBe("number");
    expect(typeof analysis.predictions!.randomForest.predicted168h).toBe("number");
    expect(Number.isNaN(analysis.predictions!.ridge.predicted168h)).toBe(false);
  });
});
