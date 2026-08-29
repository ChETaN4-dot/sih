export type FactorStatus = "MEASURED" | "CONTEXT ONLY" | "NOT AVAILABLE";

export type EnvironmentalFactor = {
  factor_id: string;
  name: string;
  category: "Thermal" | "Electrical" | "Mechanical" | "Atmospheric" | "Radiation" | "Contamination";
  status: FactorStatus;
  value_display: string;
  ML_feature: boolean;
  why_it_matters: string;
  source: string;
  standard_ref: string;
};

export function getEnvironmentalContextForComponent(
  temperatureC?: number,
  voltageV?: number,
  burnInHours?: number,
  componentType: string = "Tantalum MnO2 chip capacitor (solid)"
): EnvironmentalFactor[] {
  const isTantalum = componentType.toLowerCase().includes("tantalum");

  const tempVal = temperatureC !== undefined ? `${temperatureC} °C` : "Not measured";
  const tempStatus: FactorStatus = temperatureC !== undefined ? "MEASURED" : "NOT AVAILABLE";

  const voltVal = voltageV !== undefined ? `${voltageV} V` : "Not measured";
  const voltStatus: FactorStatus = voltageV !== undefined ? "MEASURED" : "NOT AVAILABLE";

  const durationVal = burnInHours !== undefined ? `${burnInHours} h` : "Not measured";
  const durationStatus: FactorStatus = burnInHours !== undefined ? "MEASURED" : "NOT AVAILABLE";

  const factors: EnvironmentalFactor[] = [
    {
      factor_id: "TEMP",
      name: "Test Temperature",
      category: "Thermal",
      status: tempStatus,
      value_display: tempVal,
      ML_feature: temperatureC !== undefined,
      why_it_matters: "Active thermal stress condition. Higher temperature accelerates oxygen vacancy mobility in dielectric.",
      source: temperatureC !== undefined ? "Dataset / Chamber Telemetry" : "System Registry",
      standard_ref: "MIL-STD-883 Method 1015 / ECSS-Q-ST-60-05C",
    },
    {
      factor_id: "VOLT",
      name: "Applied Bias Voltage",
      category: "Electrical",
      status: voltStatus,
      value_display: voltVal,
      ML_feature: voltageV !== undefined,
      why_it_matters: "Active electrical stress condition. Electric field across anodic oxide layer accelerates dielectric degradation.",
      source: voltageV !== undefined ? "Dataset / Power Supply Telemetry" : "System Registry",
      standard_ref: "MIL-PRF-55365 Voltage Acceleration Rules",
    },
    {
      factor_id: "DURATION",
      name: "Burn-In Duration",
      category: "Electrical",
      status: durationStatus,
      value_display: durationVal,
      ML_feature: burnInHours !== undefined,
      why_it_matters: "Recorded test elapsed time checkpoints for time-dependent DCL drift prediction.",
      source: burnInHours !== undefined ? "Dataset / Test Checkpoints" : "System Registry",
      standard_ref: "NASA EEE-INST-002 Table 2A",
    },
  ];

  if (isTantalum) {
    factors.push(
      {
        factor_id: "TEMP_CYC",
        name: "Temperature Cycling",
        category: "Thermal",
        status: "CONTEXT ONLY",
        value_display: "Not measured",
        ML_feature: false,
        why_it_matters: "Thermal expansion mismatch screening context for package integrity.",
        source: "NASA EEE-INST-002 / MIL-STD-883",
        standard_ref: "MIL-STD-883K Method 1010 Condition B",
      },
      {
        factor_id: "THERMAL_SHOCK",
        name: "Thermal Shock",
        category: "Thermal",
        status: "CONTEXT ONLY",
        value_display: "Not measured",
        ML_feature: false,
        why_it_matters: "Liquid-to-liquid rapid thermal change qualification reference.",
        source: "ECSS Standards",
        standard_ref: "ECSS-Q-ST-60C Rev.4 Section 6.2",
      },
      {
        factor_id: "HUMIDITY",
        name: "Moisture Sensitivity / Humidity",
        category: "Atmospheric",
        status: "NOT AVAILABLE",
        value_display: "Not measured",
        ML_feature: false,
        why_it_matters: "Moisture ingress degradation context for non-hermetic packaging.",
        source: "MIL Standards",
        standard_ref: "MIL-STD-202 Method 103",
      },
      {
        factor_id: "VACUUM",
        name: "Vacuum / Ambient Pressure",
        category: "Atmospheric",
        status: "NOT AVAILABLE",
        value_display: "Not measured",
        ML_feature: false,
        why_it_matters: "High-altitude outgassing context for orbital operations.",
        source: "NASA Outgassing Guidelines",
        standard_ref: "ASTM E595 / ECSS-Q-ST-60-15C",
      },
      {
        factor_id: "VIBRATION",
        name: "Random Vibration",
        category: "Mechanical",
        status: "NOT AVAILABLE",
        value_display: "Not measured",
        ML_feature: false,
        why_it_matters: "Launch mechanical stress environment context.",
        source: "MIL Standards",
        standard_ref: "MIL-STD-202 Method 214",
      },
      {
        factor_id: "TID",
        name: "Total Ionizing Dose (TID)",
        category: "Radiation",
        status: "NOT AVAILABLE",
        value_display: "Not measured",
        ML_feature: false,
        why_it_matters: "Orbital radiation environment context.",
        source: "NASA GSFC Radiation Group",
        standard_ref: "MIL-STD-883 Method 1019",
      }
    );
  }

  return factors;
}
