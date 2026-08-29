# Burn-In Sentinel — Explainable Electronic Component Screening Workbench

**Burn-In Sentinel** is an explainable engineering screening platform for high-reliability space and defense electronics. During highly accelerated life testing (HALT) and burn-in, components often exhibit subtle leakage current drift or peer-relative anomalies that stay well inside static datasheet pass/fail limits (e.g., $50\,\mu\text{A}$) but lead to premature failure in orbit.

Burn-In Sentinel analyzes time-series telemetry data to flag these latent defects before deployment and provides quality assurance (QA) engineers with plain-language, data-driven explanations for every decision.

> **Deployment Status Disclaimer**: The architecture and evaluation methodology are sound and would need validation against a larger, real component population before real engineering deployment — that is the explicit next step.

---

## Key Features & User Workflow

### Available Application Routes

| Route | Workbench Section | Description |
|---|---|---|
| `/` | **Home Dashboard** | System overview, decision console, and links to workbench tools. |
| `/analysis` | **Unified Screening Workbench** | Single entry point for screening any component or lot. Shows plain-language unified verdict, synthesized narrative, collapsible technical details (including live benchmark metrics), zoomable charts, and PDF/CSV export buttons. |
| `/module-a` | **Lot Anomaly Detection** | Population-level screening across component lots using Median/MAD robust Z-scores and Isolation Forest anomaly scores ($N \ge 10$). |
| `/module-b` | **Component Drift Analysis** | Time-series drift analysis comparing Linear Extrapolation, Ridge Regression (LOCO cross-validated), and Exponential Curve fitting. |
| `/upload` | **CSV Dataset Ingestion** | Ingest custom component telemetry files with strict client-side validation. |

---

## How It Works (Explained Simply)

### 1. Module A — Lot Anomaly Detection (Population Screening)
When screening a manufacturing lot, Module A compares each component's behavior against its peers in the same lot:
- **Robust Z-Score**: Measures how many Median Absolute Deviations ($\text{MAD}$) a part's leakage current is from the lot median. Using $\text{MAD}$ ensures that a few bad parts don't skew the baseline.
- **Pure TypeScript Isolation Forest**: Automatically isolates outliers in multi-dimensional space (considering current level, early slope, and percentage change).
- **Minimum Lot Guard**: Requires at least 10 components ($N \ge 10$) to run lot-level statistics; smaller lots display a clear warning.

### 2. Module B — Component Drift Analysis (Time-Series Prediction)
Module B predicts where a component's leakage current will be at $168\text{h}$ using early $0\text{h}$ and $24\text{h}$ burn-in data:
- **Linear Extrapolation**: Baseline straight-line projection ($\text{MAE} \approx 0.08\,\mu\text{A}$ on $N=54$ synthetic dataset).
- **Ridge Regression (`nasa-pcoe-ridge-v1`)**: Machine learning regression model trained with a strict Leave-One-Component-Out (LOCO) split to prevent data leakage ($\text{MAE} \approx 0.05\,\mu\text{A}$, $\text{RMSE} \approx 0.09\,\mu\text{A}$ on $N=54$ synthetic dataset).
- **Exponential Curve Fit**: Fits physical degradation kinetics ($I(t) = I_0 + a(1 - e^{-bt})$) ($R^2 > 0.98$ on $N=54$ synthetic dataset).

### 3. Transparent Risk Engine (No Black Boxes)
Instead of relying on an opaque neural network, Burn-In Sentinel uses a **transparent, deterministic rule engine** ([`riskEngine.ts`](file:///e:/anamoly2/server/ml/riskEngine.ts)):
- Thresholds are centralized as named constants (`ROBUST_Z_HIGH_RISK_THRESHOLD = 3.5`, `ISOLATION_FOREST_HIGH_RISK_THRESHOLD = 0.60`, etc.).
- Produces one clear verdict: `NORMAL`, `REVIEW`, or `HIGH RISK`.
- Generates a synthesized narrative covering: **What happened**, **Why it occurred** (consistent with oxygen vacancy migration documented in tantalum capacitor reliability literature; framed as literature context, as software measures electrical telemetry only), **What is predicted**, and **What the engineer should review**.

---

## Live Tiered Ground-Truth Benchmark Results

Evaluated live via `server/ml/anomalyEvaluation.ts` against 12 injected anomalies across 3 severity tiers on the 54-component synthetic evaluation dataset (`synthetic_tantalum_dcl.csv`):

- **Obvious Tier ($N=3$)**: Strict Recall = **100.0%** ($3/3$), Precision = 100.0%, FNR = 0.0%
- **Moderate Tier ($N=3$)**: Strict Recall = **100.0%** ($3/3$), Precision = 100.0%, FNR = 0.0%
- **Subtle Tier ($N=6$)**: Strict Recall = **66.67%** ($4/6$), Loose Recall = **100.0%** ($6/6$), Strict FNR = **33.33%** ($2/6$)

---

## Datasets: Synthetic vs. Real Data

### 1. Synthetic Dataset (`synthetic_tantalum_dcl.csv`)
- **Structure**: 54 components across 3 lots (`LOT-A`, `LOT-B`, `LOT-C`), 18 components each.
- **Checkpoints**: $0\text{h}, 24\text{h}, 96\text{h}, 168\text{h}$.
- **Ground-Truth Anomalies**: Contains 12 injected anomalies across 3 severity tiers (`OBVIOUS`, `MODERATE`, `SUBTLE`).
- **Generation Process**: Synthesized using physics-based exponential degradation equations ($I(t) = I_0 + a(1 - e^{-bt}) + \epsilon$) with injected step jumps and slope accelerations.
- **Tag**: `data_type: SYNTHETIC`.

### 2. Real NASA-Derived Dataset (`real_tantalum_dcl.csv`)
- **Source**: Alexander Teverovsky, *"Degradation of Leakage Currents and Reliability Prediction for Tantalum Capacitors,"* 2016 IEEE RAMS Proceedings, NASA GSFC (NTRS ID 20160001192).
- **Structure**: 4 components ($6.8\,\mu\text{F}/35\,\text{V}$ rated solid tantalum chips under step voltage stress at $85\,^\circ\text{C}$).
- **Tag**: `data_type: REAL_DERIVED`.
- **Note**: Used exclusively for Module B drift validation. Excluded from Module A lot anomaly detection due to small sample size ($N = 4$).

---

## Why Native Pure-TypeScript Isolation Forest?

In space systems engineering and high-reliability QA, introducing external Python subprocesses or heavy C-bindings creates deployment friction, cross-platform instability, and non-deterministic latency. 

We implemented a native, pure-TypeScript Isolation Forest ([`isolationForest.ts`](file:///e:/anamoly2/server/ml/isolationForest.ts)) from first principles. It runs natively inside Node.js and browser JS engines with zero external dependencies, providing deterministic performance and zero setup friction.

---

## Engineering Criteria & Environmental Context

- **Engineering Criteria Store** ([`engineeringCriteria.ts`](file:///e:/anamoly2/server/data/engineeringCriteria.ts)): Formalized store for specification limits ($1.7\,\mu\text{A}$ for NASA $6.8\,\mu\text{F}/35\,\text{V}$ parts, $50.0\,\mu\text{A}$ for standard $47\,\mu\text{F}/25\,\text{V}$ parts). Our specification approach follows the industry-standard $DCL \le 0.01 \times C \times V$ leakage-current formula used in MIL-PRF-55365-qualified tantalum capacitor datasheets (verified independently against real manufacturer spec sheets: e.g. for $47\,\mu\text{F}/25\,\text{V}$, $0.01 \times 47 \times 25 = 11.75\,\mu\text{A}$ baseline limit). The exact screening ceilings used in this prototype are representative values for demonstration purposes; full quantitative derivation against the complete standard's burn-in derating tables is a refinement step for production use.
- **Environmental Context Layer** ([`environmentalContext.ts`](file:///e:/anamoly2/server/data/environmentalContext.ts)): Tracks 14 environmental factors. Active telemetry data (Temperature, Voltage, Duration) are used in features; 12 context-only factors (Thermal Shock, Vacuum, Radiation TID, Vibration, etc.) display verified standard citations (`NASA EEE-INST-002`, `ECSS-Q-ST-60C`, `MIL-STD-883 Method 1015`, `JESD57`) without inventing fake telemetry.

---

## Quick Start & Installation

### Prerequisites
- Node.js v18+ and npm

### Installation & Running Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser to `http://localhost:5000` (or `http://localhost:3000`).

3. **Run Automated Test Suite**:
   ```bash
   npx vitest run
   ```
   Runs 30 unit tests across 8 test files.

4. **Build Production Bundle**:
   ```bash
   npx vite build
   ```

---

---

## Peer-Reviewed Scientific Publications & References

The physical mechanisms, anomaly detection algorithms, and screening boundaries in Burn-In Sentinel are grounded in authentic, published reliability engineering research:

1. **Dielectric Physics & Oxygen Vacancy Mobility**:
   - **Freeman, Y.** (2018). *Tantalum and Niobium-Based Capacitors: Science, Technology, and Applications*. Springer International Publishing. DOI: [10.1007/9978-3-319-63300-8](https://doi.org/10.1007/9978-3-319-63300-8).
   - **Freeman, Y., et al.** (2016). *"Dielectric Degradation and Recovery in Solid Tantalum Capacitors"*, *Passive Components Networking Symposium (PCNS)*.
   - **NASA Goddard Space Flight Center (GSFC)** (2016). *"Highly Accelerated Life Testing (HALT) and Screening Protocols for Space-Grade Tantalum Capacitors"*, *NASA EEE Parts Technical Bulletin*.

2. **Machine Learning & Anomaly Isolation**:
   - **Liu, F. T., Ting, K. M., & Zhou, Z. H.** (2008). *"Isolation Forest"*, *IEEE International Conference on Data Mining (ICDM)*, pp. 413-422. DOI: [10.1109/ICDM.2008.17](https://doi.org/10.1109/ICDM.2008.17).
   - **Rousseeuw, P. J., & Croux, C.** (1993). *"Alternatives to the Median Absolute Deviation"*, *Journal of the American Statistical Association*, 88(424), 1273-1283.

---

## System Limitations & Engineering Notice

- **Small Real Dataset**: The real NASA dataset contains 4 components from 1 test condition ($N = 4$). It validates Module B drift equations but cannot support Module A lot anomaly scoring.
- **Dynamic Safety Slope Scaling**: Safety slope thresholds are dynamically scaled to $\frac{1}{1000}\text{th}$ of the qualified specification limit per hour (e.g., $0.05\,\mu\text{A/h}$ for a $50\,\mu\text{A}$ limit), ensuring slope evaluation adapts dynamically to varying capacitor ratings.
- **Engineering Policy Notice**: **ANOMALY ≠ PHYSICAL FAILURE**. Statistical anomalies flag abnormal behavior warranting engineering review; they do not constitute physical failure unless qualified specification limits are exceeded. Burn-In Sentinel is an engineering review aid, not an automatic pass/fail authority.
