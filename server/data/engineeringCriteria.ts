export type EngineeringCriterion = {
  criterion_id: string;
  criterion_name: string;
  value: number;
  unit: string;
  component_applicability: string;
  source: string;
  document_ref: string;
  description: string;
};

export const ENGINEERING_CRITERIA: EngineeringCriterion[] = [
  {
    criterion_id: "SPEC-TANTALUM-STD-25V",
    criterion_name: "Standard Solid Tantalum ESS DCL Ceiling",
    value: 50.0,
    unit: "µA",
    component_applicability: "47µF / 25V Rated MnO2 Tantalum Capacitors (Synthetic/Commercial)",
    source: "MIL-PRF-55365 / Manufacturer Datasheet Standard",
    document_ref: "MIL-PRF-55365 Table I",
    description: "Maximum allowable direct current leakage (DCL) ceiling under 25V rated test conditions prior to screening nonconformance rejection.",
  },
  {
    criterion_id: "SPEC-TANTALUM-HALT-35V",
    criterion_name: "HALT Accelerated Life Test High-Rel DCL Ceiling",
    value: 1.7,
    unit: "µA",
    component_applicability: "6.8µF / 35V Rated MnO2 Tantalum Capacitors (NASA HALT Test Series)",
    source: "NASA GSFC / Teverovsky 2016 RAMS Proceedings",
    document_ref: "NASA GSFC NTRS 20160001192 Section 3",
    description: "Critical DCL parametric failure threshold under 85°C / 25V post-HALT stress monitoring.",
  },
];

export function getEngineeringCriterionForComponent(capacitance_uF: number, rated_voltage_V: number): EngineeringCriterion {
  if (capacitance_uF === 6.8 && rated_voltage_V === 35) {
    return ENGINEERING_CRITERIA[1];
  }
  return ENGINEERING_CRITERIA[0];
}
