import { describe, expect, it } from "vitest";
import { getEngineeringCriterionForComponent } from "../data/engineeringCriteria";
import { getEnvironmentalContextForComponent } from "../data/environmentalContext";
import { analyzeLotAnomalies } from "./lotAnomaly";
import { analyzeComponentDrift } from "./driftModels";
import { evaluateUnifiedRisk } from "./riskEngine";

describe("Dynamic Engineering Criteria & Environmental Context Resolution", () => {
  it("1. Changing capacitance changes calculated baseline DCL criterion (0.01 × C × V)", () => {
    const c47 = getEngineeringCriterionForComponent(47, 25, "Tantalum MnO2 chip capacitor");
    expect(c47.value).toBe(11.75); // 47 * 25 * 0.01 = 11.75 uA
    expect(c47.criterion_name).toBe("Calculated Baseline DCL Criterion");

    const c100 = getEngineeringCriterionForComponent(100, 25, "Tantalum MnO2 chip capacitor");
    expect(c100.value).toBe(25.0); // 100 * 25 * 0.01 = 25.0 uA
    expect(c100.component_applicability).toContain("100 µF");
  });

  it("2. Changing rated voltage changes calculated baseline DCL criterion", () => {
    const v25 = getEngineeringCriterionForComponent(6.8, 25, "Tantalum MnO2 chip capacitor");
    expect(v25.value).toBe(1.7); // 6.8 * 25 * 0.01 = 1.7 uA

    const v35 = getEngineeringCriterionForComponent(6.8, 35, "Tantalum MnO2 chip capacitor");
    expect(v35.value).toBe(2.38); // 6.8 * 35 * 0.01 = 2.38 uA
  });

  it("3. Dataset temperature is reflected dynamically in environmental context", () => {
    const env85 = getEnvironmentalContextForComponent(85, 56, 168, "Tantalum capacitor");
    const tempFactor85 = env85.find((f) => f.factor_id === "TEMP");
    expect(tempFactor85?.value_display).toBe("85 °C");
    expect(tempFactor85?.status).toBe("MEASURED");

    const env125 = getEnvironmentalContextForComponent(125, 25, 168, "Tantalum capacitor");
    const tempFactor125 = env125.find((f) => f.factor_id === "TEMP");
    expect(tempFactor125?.value_display).toBe("125 °C");
    expect(tempFactor125?.status).toBe("MEASURED");
  });

  it("4. Dataset voltage is reflected dynamically in environmental context", () => {
    const env56 = getEnvironmentalContextForComponent(85, 56, 168, "Tantalum capacitor");
    const voltFactor56 = env56.find((f) => f.factor_id === "VOLT");
    expect(voltFactor56?.value_display).toBe("56 V");
    expect(voltFactor56?.status).toBe("MEASURED");

    const env25 = getEnvironmentalContextForComponent(125, 25, 168, "Tantalum capacitor");
    const voltFactor25 = env25.find((f) => f.factor_id === "VOLT");
    expect(voltFactor25?.value_display).toBe("25 V");
    expect(voltFactor25?.status).toBe("MEASURED");
  });

  it("5. No fixed 50 uA criterion is returned as a universal limit", () => {
    const criterion = getEngineeringCriterionForComponent(6.8, 35, "Tantalum capacitor");
    expect(criterion.value).not.toBe(50.0);
    expect(criterion.value).toBe(2.38);
    expect(criterion.status_label).toBe("Calculated Baseline Criterion");
  });

  it("6. Missing environmental measurements are explicitly marked NOT AVAILABLE or CONTEXT ONLY", () => {
    const env = getEnvironmentalContextForComponent(125, 25, 168, "Tantalum capacitor");

    const tempCyc = env.find((f) => f.factor_id === "TEMP_CYC");
    expect(tempCyc?.status).toBe("CONTEXT ONLY");
    expect(tempCyc?.value_display).toBe("Not measured");

    const vacuum = env.find((f) => f.factor_id === "VACUUM");
    expect(vacuum?.status).toBe("NOT AVAILABLE");
    expect(vacuum?.value_display).toBe("Not measured");
  });

  it("7. Component without an engineering configuration (e.g. Resistor) does not receive a fabricated criterion", () => {
    const resistor = getEngineeringCriterionForComponent(10, 50, "Metal Film Resistor");
    expect(resistor.configured).toBe(false);
    expect(resistor.criterion_name).toBe("Engineering Criterion Not Configured");
    expect(resistor.value).toBe(0);
    expect(resistor.status_label).toBe("Engineering Criterion Not Configured");
  });

  it("8. Module A and Module B continue using their existing ML logic", () => {
    const lotRes = analyzeLotAnomalies("LOT-A");
    expect(lotRes.sufficient).toBe(true);
    expect(lotRes.components.length).toBeGreaterThan(0);

    const compDrift = analyzeComponentDrift("TAL-A-001");
    expect(compDrift.sufficient).toBe(true);
    expect(compDrift.predictions.ridge.predicted168h).toBeDefined();
  });

  it("9. Unified risk evaluation operates dynamically with component spec baseline", () => {
    const verdict = evaluateUnifiedRisk({
      measuredDcl: 4.2,
      specLimit: 2.38,
      robustZScore: 4.2,
    });
    expect(verdict.specLimitExceeded).toBe(true);
    expect(verdict.status).toBe("HIGH RISK");
  });
});
