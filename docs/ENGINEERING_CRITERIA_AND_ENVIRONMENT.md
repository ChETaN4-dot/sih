# Dynamic Engineering Criteria & Environmental Context Architecture

**System Name**: Burn-In Sentinel — Explainable Electronic Component Screening Workbench  
**Document Version**: 2.0.0 (Dynamic Resolution Architecture)  
**Last Audit Date**: August 29, 2026  

---

## 1. Architecture Overview

Burn-In Sentinel enforces a strict, data-driven resolution pipeline for engineering criteria and environmental factors. Hardcoded specification claims (such as a fixed universal $50\,\mu\text{A}$ ceiling) and fabricated environmental measurements have been eliminated.

```
Dataset (CSV / Telemetry)
         ↓
Selected Component Metadata (capacitance_uF, rated_voltage_V, test_temperature_C, test_voltage_V, time_h, component_type)
         ↓
┌──────────────────────────────────────────────┐       ┌──────────────────────────────────────────────┐
│     Engineering Reference & Criteria Resolver │       │     Environmental Context Resolver           │
│   DCL_baseline = 0.01 × C × V (µA)           │       │   Categorizes factor status into:            │
│   MIL-PRF-55365 & NASA MIL-HDBK-978B          │       │   - MEASURED (actual dataset telemetry)      │
│   Status: "Calculated Baseline Criterion"     │       │   - CONTEXT ONLY (standards context)         │
└──────────────────────────────────────────────┘       │   - NOT AVAILABLE (not measured in dataset)  │
                        │                              └──────────────────────────────────────────────┘
                        ↓                                                      │
             Module C Unified Risk Engine & ML Models ←────────────────────────┘
                        ↓
             Synthesized Explanation & UI Presentation
```

---

## 2. Dynamic Baseline DCL Criterion Resolution

### **Mathematical Formula**
For solid tantalum chip capacitors, the baseline Direct Current Leakage ($\text{DCL}$) criterion is calculated dynamically from component ratings:

$$\text{DCL}_{\text{baseline}} = 0.01 \times C \times V \quad (\mu\text{A})$$

where:
- $C = \text{Capacitance in } \mu\text{F}$
- $V = \text{Rated Working Voltage in V}$

### **Representative Examples**
1. **$47\,\mu\text{F} / 25\,\text{V}$ Solid Tantalum Capacitor** (Synthetic Dataset):
   $$\text{DCL}_{\text{baseline}} = 0.01 \times 47 \times 25 = 11.75\,\mu\text{A}$$
2. **$100\,\mu\text{F} / 25\,\text{V}$ Solid Tantalum Capacitor**:
   $$\text{DCL}_{\text{baseline}} = 0.01 \times 100 \times 25 = 25.00\,\mu\text{A}$$
3. **$6.8\,\mu\text{F} / 35\,\text{V}$ Solid Tantalum Capacitor** (NASA HALT Real Dataset):
   $$\text{DCL}_{\text{baseline}} = 0.01 \times 6.8 \times 35 = 2.38\,\mu\text{A}$$

### **Engineering Classification & Labeling**
- **Status Label**: `"Calculated Baseline Criterion"`
- **Honest Engineering Disclaimer**:  
  *"Based on the 0.01 × C × V DCL criterion used in applicable tantalum capacitor specifications/datasheets. Qualification/screening limits depend on the applicable part specification."*
- **Unconfigured Component Types**: If a component type is not configured (e.g., `Resistor` or `Transformer`), the resolver returns `configured: false` with label `"Engineering Criterion Not Configured"`. Zero fabricated limits are generated.

---

## 3. Authoritative Source Registry

The engineering reference resolver relies on verified, authoritative engineering standards:

1. **MIL-PRF-55365**: *Capacitors, Chip, Fixed, Tantalum, Established Reliability, General Specification For*. (Defines $0.01 \times C \times V$ baseline DCL calculation rules).
2. **NASA MIL-HDBK-978B**: *NASA Parts Application Handbook, Volume 1: Capacitors (Section 4.2 Tantalum Capacitors)*.
3. **NASA GSFC NTRS 20160001192**: *Burn-in and Reliability of Solid Tantalum Capacitors* (Dr. Alexander Teverovsky, NASA Goddard Space Flight Center).

---

## 4. Environmental Factor Status Definitions

Every environmental factor in the system is assigned an explicit, un-fabricated status badge:

| Status Badge | Definition | Example Factors | Display Value Format |
|:---:|:---|:---|:---:|
| 🟩 **`MEASURED`** | Actual in-situ telemetry measurements recorded in dataset | Test Temperature, Applied Voltage, Burn-In Duration | `125 °C`, `25 V`, `168 h` |
| 🟦 **`CONTEXT ONLY`** | Relevant reliability standards context (not measured in-situ) | Temperature Cycling, Thermal Shock | `Not measured` |
| ⬛ **`NOT AVAILABLE`** | Environmental parameter not measured or monitored in dataset bay | Vacuum, Humidity, TID Radiation, Random Vibration | `Not measured` |

---

## 5. Limitations & Synthetic Data Usage

1. **Calculated Baseline vs. Qualified Detail Limits**: The $0.01 \times C \times V$ formula provides a standard engineering reference baseline. Screening rejection limits for flight payloads must be confirmed against qualified detail specifications.
2. **No Data Fabrication**: Environmental context factors marked `CONTEXT ONLY` or `NOT AVAILABLE` provide domain knowledge without injecting false telemetry into ML feature vectors.
