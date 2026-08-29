export type EngineeringCriterion = {
  criterion_id: string;
  criterion_name: string;
  value: number;
  unit: string;
  formula: string;
  component_applicability: string;
  source: string;
  document_ref: string;
  status_label: "Calculated Baseline Criterion" | "Prototype Screening Threshold" | "Qualified Specification Limit" | "Research/Dataset Degradation Criterion" | "Engineering Criterion Not Configured";
  description: string;
  qualified_limit_status: string;
  configured: boolean;
};

export type EngineeringReference = {
  componentType: string;
  parameter: string;
  formula: string;
  sourceName: string;
  sourceUrl: string;
  applicability: string;
  notes: string;
};

export const ENGINEERING_REFERENCES: EngineeringReference[] = [
  {
    componentType: "Solid Tantalum Capacitor (MnO2)",
    parameter: "Direct Current Leakage (DCL)",
    formula: "DCL_baseline = 0.01 × C × V (µA)",
    sourceName: "MIL-PRF-55365 & NASA MIL-HDBK-978B",
    sourceUrl: "https://ntrs.nasa.gov/citations/20160001192",
    applicability: "Established reliability solid tantalum chip capacitors",
    notes: "Calculated baseline criterion used in tantalum capacitor specifications. Qualification and rejection limits depend on the applicable detail specification.",
  },
];

export function getEngineeringCriterionForComponent(
  capacitance_uF?: number,
  rated_voltage_V?: number,
  componentType: string = "Tantalum MnO2 chip capacitor (solid)"
): EngineeringCriterion {
  const isTantalum = componentType.toLowerCase().includes("tantalum");

  if (!isTantalum) {
    return {
      criterion_id: "UNCONFIGURED",
      criterion_name: "Engineering Criterion Not Configured",
      value: 0,
      unit: "N/A",
      formula: "None",
      component_applicability: componentType,
      source: "System Registry",
      document_ref: "N/A",
      status_label: "Engineering Criterion Not Configured",
      description: `Engineering criterion not configured for component type '${componentType}'. No fabricated criterion applied.`,
      qualified_limit_status: "No engineering criterion configured.",
      configured: false,
    };
  }

  const cap = capacitance_uF ?? 47.0;
  const volt = rated_voltage_V ?? 25.0;

  // Calculate baseline DCL criterion using 0.01 × C × V (µA)
  const baselineDcl = Number((0.01 * cap * volt).toFixed(2));

  return {
    criterion_id: `BASELINE-DCL-${cap}UF-${volt}V`,
    criterion_name: "Calculated Baseline DCL Criterion",
    value: baselineDcl,
    unit: "µA",
    formula: "0.01 × C × V",
    component_applicability: `${cap} µF / ${volt}V Rated Solid Tantalum Capacitor`,
    source: "MIL-PRF-55365 & NASA MIL-HDBK-978B",
    document_ref: "MIL-PRF-55365 Section 3.14 / MIL-HDBK-978B Section 4.2",
    status_label: "Calculated Baseline Criterion",
    description: `Based on the 0.01 × C × V DCL criterion used in applicable tantalum capacitor specifications/datasheets. Qualification/screening limits depend on the applicable part specification.`,
    qualified_limit_status: "No component-specific qualified limit available in the current dataset. Displaying calculated baseline DCL criterion.",
    configured: true,
  };
}
