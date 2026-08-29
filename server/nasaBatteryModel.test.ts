import { describe, expect, it } from "vitest";
import { fitNASARidge, parseNASATrainingCsv } from "./nasaBatteryModel";

describe("NASA PCoE drift model", () => {
  it("parses normalized NASA training exports", () => {
    const rows = parseNASATrainingCsv("parameter,unit,value_0h,value_24h,value_168h\nImpedance,mOhm,10,12,18");
    expect(rows).toEqual([{ parameterName: "Impedance", unit: "mOhm", value0h: 10, value24h: 12, value168h: 18 }]);
  });

  it("fits an explainable forecast from compatible rows", () => {
    const model = fitNASARidge([
      { value0h: 10, value24h: 12, value168h: 18, parameterName: "Iddq", unit: "uA" },
      { value0h: 11, value24h: 13, value168h: 19, parameterName: "Iddq", unit: "uA" },
      { value0h: 12, value24h: 14, value168h: 20, parameterName: "Iddq", unit: "uA" },
    ], "Iddq", "uA");
    expect(model?.version).toBe("nasa-pcoe-ridge-v1");
    expect(model?.rows).toBe(3);
    expect(model?.predict(13, 15)).toBeCloseTo(21, 5);
    expect(model?.mae).toBeCloseTo(0, 5);
  });
});