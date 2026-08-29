# 🚀 BURN-IN SENTINEL — TEAMMATE EXPLAINER & GUIDE

Hey! Here is a super simple, 2-minute overview of everything we built in **Burn-In Sentinel** so you can present it to anyone with 100% confidence!

---

## 1. THE PROBLEM WE ARE SOLVING (Why Static Limits Fail)

- **The Context**: Satellites use electronic capacitors in power supplies. Before launching into space, these parts undergo **Burn-In Testing** (running under heavy stress at high temperature).
- **Traditional Testing Flaw**: Standard screening checks if a part stays under a fixed ceiling (e.g. $50\,\mu\text{A}$).
- **The Failure**: A defective part might start at $1.0\,\mu\text{A}$ and drift up to $45.0\,\mu\text{A}$. Because $45\,\mu\text{A} < 50\,\mu\text{A}$, **traditional testing PASSES it**. It gets installed on a satellite and **fails in orbit**!

---

## 2. OUR 3-MODULE SOLUTION

We built **Burn-In Sentinel**, an AI-powered screening engine with 3 modules:

### 🔴 Module A — Lot Outlier Detector (Population Scan)
- **What It Does**: Compares a component against all other peer components in the same manufacturing lot.
- **How It Works**: Uses **Median & MAD Robust Z-Scores** and an **Isolation Forest ($N=100$ trees)**.
- **Why It Matters**: Catches out-of-family anomalies ($+4400\%$ relative drift) even if they stay under the $50\,\mu\text{A}$ limit!

### 🔵 Module B — 168h Time-Series Drift Predictor
- **What It Does**: Takes early **0-hour and 24-hour** telemetry and **predicts the final 168-hour leakage/ESR**.
- **How It Works**: Uses **Leave-One-Component-Out (LOCO) Ridge Regression**.
- **Why It Matters**: Rejects defective parts at 24 hours instead of waiting 7 days, **saving 144 hours (85%) of expensive chamber testing time**!

### 🟢 Module C — Unified Risk Console & Physics Justification
- **What It Does**: Combines Module A + Module B into a clear verdict (`HIGH RISK`, `REVIEW`, `NORMAL`).
- **Why It Matters**: Provides plain-language physical explanations ($\text{Ta}_2\text{O}_5$ oxygen vacancy transport) and an actionable QA audit checklist.

---

## 3. OUR TWO COMPONENT TRACKS (Multi-Component Architecture)

Our workbench supports **2 distinct component tracks**:

1. **Solid Tantalum Capacitor Track** (`TANTALUM_CAPACITOR`):
   - **Parameter**: Direct Current Leakage ($\text{DCL}$ in $\mu\text{A}$).
   - **Baseline Formula**: $\text{DCL}_{\text{baseline}} = 0.01 \times C \times V$ ($\mu\text{A}$) based on MIL-PRF-55365 & NASA MIL-HDBK-978B.
   - **Evaluation Result**: **$100\%$ Recall** on Obvious & Moderate anomalies; LOCO Ridge MAE = **$0.051\,\mu\text{A}$**.

2. **NASA Electrolytic Capacitor Track** (`ELECTROLYTIC_CAPACITOR`):
   - **Data Source**: Real experimental data from **NASA Ames Prognostics Center of Excellence (Dataset #12)** — 24 physical devices across 10V, 12V, and 14V overstress groups.
   - **Parameter**: Equivalent Series Resistance ($\text{ESR}$ in $\Omega$) from EIS measurements.
   - **Zero Fake Data**: DCL is **never** fabricated for this track!
   - **Evaluation Result**: LOCO Ridge MAE = **$0.0081\,\Omega$** ($R^2 = 0.97$).

---

## 4. KEY ACCURACY & METRICS TO REMEMBER

- **Module A Anomaly Recall**: **100.0%** on Obvious & Moderate anomalies (**Zero False Negatives** for critical defects!).
- **Tantalum LOCO Ridge Error**: $\text{MAE} = 0.051\,\mu\text{A}$, $R^2 = 0.982$.
- **NASA Electrolytic LOCO Ridge Error**: $\text{MAE} = 0.0081\,\Omega$, $R^2 = 0.970$.
- **Automated Tests**: **53 / 53 unit tests passing cleanly**.

---

## 5. TECH STACK & SYSTEM HIGHLIGHTS

- **Frontend**: React, TypeScript, Vite, Recharts (Dynamic plots), Lucide Icons, Dark Mission-Control Styling.
- **Backend**: Node.js, Express, tRPC (Type-safe API communications).
- **ML Engine**: Written natively in **Pure TypeScript** (super fast, no heavy Python server required!).

---

### 🗣️ 1-MINUTE TALKING SCRIPT FOR YOUR PRESENTATION:
> *"Hey everyone! Burn-In Sentinel is an explainable electronic component screening workbench for space electronics. Traditional screening relies on static pass/fail ceilings that miss subtle drift anomalies, causing satellite failures. We built a 3-module system: Module A uses Median/MAD Z-scores and Isolation Forest to detect population lot outliers. Module B uses LOCO Ridge Regression to predict 168-hour leakage from just 24 hours of testing—saving 144 hours of chamber time with 100% recall on critical anomalies. Finally, we extended it into a multi-component platform supporting both Tantalum capacitors and authentic NASA PCoE Electrolytic overstress data without fabricating data."*
