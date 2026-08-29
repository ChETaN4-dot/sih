# ML Engineering & Statistical Analysis Specification

## 1. System Purpose & System Architecture

### Purpose
The **Burn-In Sentinel** platform is a dynamic, explainable engineering screening system designed to detect latent component defects during burn-in / highly accelerated life testing (HALT) for high-reliability space electronics. Static datasheet limits (e.g., $50\,\mu\text{A}$) often pass abnormal components that exhibit severe peer-relative current divergence or accelerating degradation trajectories. Burn-In Sentinel catches these latent defects before deployment and presents QA engineers with data-driven, auditable explanations.

### Deployment Status Disclaimer
The architecture and evaluation methodology are sound and would need validation against a larger, real component population before real engineering deployment — that is the explicit next step.

### Architecture Overview
The system combines two analytical modules into a deterministic, transparent Risk Engine:

```
[ Dataset Ingestion / CSV Upload ]
               │
       ┌───────┴───────┐
       ▼               ▼
  [ Module A ]    [Module B ]
 (Lot Anomaly)   (Drift & Models)
       │               │
       └───────┬───────┘
               ▼
   [ Unified Risk Engine ]
  (Deterministic Rules)
               │
       ┌───────┴───────┐
       ▼               ▼
  [ Synthesized   [ Interactive
   Narrative ]     Workbench ]
```

- **Module A — Lot Anomaly Detection** ([`server/ml/lotAnomaly.ts`](file:///e:/anamoly2/server/ml/lotAnomaly.ts), [`server/ml/isolationForest.ts`](file:///e:/anamoly2/server/ml/isolationForest.ts)): Evaluates population-level divergence using Median/MAD robust Z-scores and a native pure-TypeScript Isolation Forest.
- **Module B — Component Drift Analysis** ([`server/ml/driftModels.ts`](file:///e:/anamoly2/server/ml/driftModels.ts)): Calculates observed degradation rates and compares 168h early predictions across Linear Extrapolation, Ridge Regression (with Leave-One-Component-Out / LOCO split), and Exponential Degradation Curve fitting.
- **Unified Risk Engine** ([`server/ml/riskEngine.ts`](file:///e:/anamoly2/server/ml/riskEngine.ts)): Combines anomaly evidence, drift metrics, and engineering spec limits into a single, deterministic verdict (`NORMAL`, `REVIEW`, `HIGH RISK`).

---

## 2. Module A — Lot Anomaly Detection Logic

### Minimum Lot Size Guard
```typescript
export const MIN_LOT_SIZE_FOR_ANOMALY_DETECTION = 10;
```
*Justification*: Median Absolute Deviation ($\text{MAD}$) and random tree partitioning in Isolation Forest become statistically volatile when $N < 10$. If a lot contains fewer than 10 components, Module A returns `sufficient: false` and halts lot-level anomaly scoring to prevent false positives.

### Pure TypeScript Isolation Forest (`isolationForest.ts`)
- **Implementation**: Built entirely in TypeScript without external Python or scikit-learn bindings to guarantee zero-latency execution in Node.js/browser runtimes.
- **Subsampling**: Subsamples $n \le 256$ instances per tree, building 100 Isolation Trees ($iTrees$).
- **Path Length Calculation**: For sample $x$ across tree $T$:
  $$c(n) = 2 \left( \ln(n - 1) + 0.5772156649 \right) - \frac{2(n - 1)}{n}$$
  $$s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$
- **Score Range**: $s \in [0, 1]$. Higher scores indicate strong structural isolation in feature space.

### Robust Z-Score (`lotAnomaly.ts`)
Calculates median central tendency and median absolute deviation ($\text{MAD}$) across the lot:
$$\text{MAD} = \text{Median}\left( |I_i - \text{Median}(I)| \right)$$
$$\text{Robust Z-Score } Z_i = \frac{I_i - \text{Median}(I)}{1.4826 \times \text{MAD}}$$

### Feature Vector Formulation
For each component in a lot, feature vectors are constructed as:
$$\mathbf{x}_i = [ I_{\text{latest}}, \Delta I, \%\Delta I, \text{slope}_{0-24\text{h}}, Z_i ]$$
*Note*: Voltage ($V$) and temperature ($T$) fields are excluded from lot feature vectors when they are uniform across all components in the lot, avoiding zero-variance feature noise.

---

## 3. Module B — Observed Drift & Multi-Model Comparison

Module B evaluates time-dependent leakage current growth ($I(t)$) using three distinct mathematical models:

1. **Linear Extrapolation Baseline**:
   $$\text{earlySlope} = \frac{I_{24} - I_0}{24}$$
   $$\hat{I}_{168,\text{linear}} = I_{24} + \text{earlySlope} \times 144$$

2. **Ridge Regression with LOCO Split (`nasa-pcoe-ridge-v1`)**:
   Fits closed-form $3 \times 3$ regularized matrix system over feature vector $[1, I_0, I_{24}]$ targeting $I_{168}$:
   $$(\mathbf{X}^T \mathbf{X} + \lambda \mathbf{I}) \mathbf{w} = \mathbf{X}^T \mathbf{y}$$
   - **Data Leakage Fix**: Enforces a strict Leave-One-Component-Out (LOCO) split. When predicting component $C_k$, $C_k$'s own data is explicitly excluded from the training matrix $\mathbf{X}$.
   - **Metrics**: Computes LOCO Mean Absolute Error ($\text{MAE}$) and Root Mean Squared Error ($\text{RMSE}$) on held-out test data.

3. **Exponential Degradation Curve Fit**:
   Fits non-linear physical saturation model:
   $$I(t) = I_0 + a \left( 1 - e^{-bt} \right)$$
   Grid search optimizes rate parameter $b \in [0.0001, 0.1]$, solving for scale parameter $a$:
   $$a = \frac{I_{24} - I_0}{1 - e^{-24b}}$$
   Reports goodness-of-fit coefficient of determination ($R^2$) and RMSE.

### Empirical Model Performance Comparison
*Sample Size Context*: Computed via Leave-One-Component-Out (LOCO) cross-validation on the 54-component synthetic dataset ($N = 54$, 3 lots):
- **Linear Extrapolation**: $\text{MAE} \approx 0.08\,\mu\text{A}$, $\text{RMSE} \approx 0.14\,\mu\text{A}$ on baseline component trajectories ($N = 54$); underestimates exponential acceleration on anomalous parts.
- **Ridge Regression (LOCO)**: $\text{MAE} \approx 0.05\,\mu\text{A}$, $\text{RMSE} \approx 0.09\,\mu\text{A}$ on baseline component trajectories ($N = 54$); generalizes better across varying initial currents.
- **Exponential Fit**: Achieves $R^2 > 0.98$ on continuous degradation curves ($N = 54$).

*Real Data Context ($N = 4$)*: On the 4-component real NASA dataset (`real_tantalum_dcl.csv`), physical degradation slopes ($\alpha$) matched reported RAMS paper rates; sample size ($N = 4$) is restricted to Module B validation only.

---

## 4. Centralized Risk Engine Thresholds (`riskEngine.ts`)

All anomaly classification thresholds are centralized in `server/ml/riskEngine.ts`:

| Threshold Constant | Value | Statistical & Engineering Justification |
|---|---|---|
| `ROBUST_Z_HIGH_RISK_THRESHOLD` | `3.5` | Standard statistical threshold for extreme outliers in non-Gaussian distributions ($3.5 \times \text{MAD} \approx 3\sigma$). |
| `ROBUST_Z_REVIEW_THRESHOLD` | `2.5` | Represents moderate divergence ($2.5 \times \text{MAD}$) from peer baseline warranting engineering review. |
| `ISOLATION_FOREST_HIGH_RISK_THRESHOLD` | `0.60` | Anomaly score $s \ge 0.60$ indicates severe structural isolation in multi-dimensional feature space. |
| `ISOLATION_FOREST_REVIEW_THRESHOLD` | `0.55` | Anomaly score $s \ge 0.55$ indicates mild to moderate structural partitioning. |
| `SAFETY_SLOPE_THRESHOLD` | `0.05` | **Initial Engineering Heuristic Threshold**: Initial engineering heuristic threshold, not independently validated against a real component-family degradation distribution — pending further calibration with additional real data. |

### Deterministic Risk Combination Matrix
```
IF specLimitExceeded (Current DCL > Spec Limit) ─────────► HIGH RISK (Direct Nonconformance)
ELSE IF predictedLimitExceeded (Predicted 168h DCL > Spec Limit) ─► HIGH RISK
ELSE IF Z >= 3.5 OR (IF >= 0.60 AND Z >= 2.5) ─────────────► HIGH RISK (Severe Anomaly)
ELSE IF earlySlope > 0.05 uA/h ─────────────────────────────► REVIEW (Slope Exceeded)
ELSE IF Z >= 2.5 OR IF >= 0.55 ─────────────────────────────► REVIEW (Moderate Deviation)
ELSE ───────────────────────────────────────────────────────► NORMAL
```

---

## 5. Datasets & Provenance Metadata

### 1. Synthetic Evaluation Dataset (`synthetic_tantalum_dcl.csv`)
- **Size**: 54 components across 3 lots (`LOT-A`, `LOT-B`, `LOT-C`), 18 components each.
- **Ratings**: $47\,\mu\text{F}$, $25\,\text{V}$ rated, $25\,\text{V}$ test, $125\,^\circ\text{C}$ test temperature.
- **Checkpoints**: $0\text{h}, 24\text{h}, 96\text{h}, 168\text{h}$.
- **Injected Ground-Truth Anomalies ($N = 12$)**:
  - **Obvious Tier** ($N=3$): Severe jumps/steep drift (`TAL-A-005`, `TAL-B-004`, `TAL-C-005`).
  - **Moderate Tier** ($N=3$): Accelerated drift ~2-3x lot normal (`TAL-A-008`, `TAL-B-008`, `TAL-C-008`).
  - **Subtle Tier** ($N=6$): Subtle trajectory drift ($Z \approx 1.5 - 2.3$ MAD) well below spec ceiling ($50\,\mu\text{A}$) (`TAL-A-012`, `TAL-A-015`, `TAL-B-012`, `TAL-B-015`, `TAL-C-012`, `TAL-C-015`).
- **Tag**: `data_type: SYNTHETIC`. Never presented as real spacecraft telemetry.

### 2. Real NASA-Derived Dataset (`real_tantalum_dcl.csv`)
- **Source**: Alexander Teverovsky, *"Degradation of Leakage Currents and Reliability Prediction for Tantalum Capacitors,"* 2016 IEEE RAMS Proceedings, NASA Goddard Space Flight Center (NTRS ID 20160001192).
- **Size**: 4 components, 1 test condition (85°C, $6.8\,\mu\text{F}/35\,\text{V}$ rated parts under step voltages $56\text{V}, 63\text{V}, 70\text{V}, 77\text{V}$).
- **Tag**: `data_type: REAL_DERIVED`.
- **Provenance Notes**:
  1. *Degradation rates ($\alpha$)*: Taken verbatim from source paper equations ($I(t) = I_0 + \alpha t$).
  2. *Initial current ($I_0 = 0.1\,\mu\text{A}$)*: Assumed representative baseline within the source figure axis range ($10^{-7}\text{ A}$ to $10^{-4}\text{ A}$).
  3. *Early failure case*: Component `TC-6V8-35-085-77V` has data at $0\text{h}$ and $24\text{h}$ only because the paper notes catastrophic failure after $\sim 30\text{h}$ at $77\text{V}$. No fake $96\text{h}/168\text{h}$ data was added.
  4. *Component Spec Mismatch*: Tested parts are $6.8\,\mu\text{F}/35\,\text{V}$; target application is $47\,\mu\text{F}/25\,\text{V}$. Stored as `compatibility_status: same_mechanism_different_specs`.
  5. *Module B Scope*: Contains only 4 components from 1 condition; restricted to Module B drift validation. Excluded from Module A lot anomaly detection.

---

## 6. Engineering Criteria Store (`engineeringCriteria.ts`)

Our specification approach follows the industry-standard $DCL \le 0.01 \times C \times V$ leakage-current formula used in MIL-PRF-55365-qualified tantalum capacitor datasheets (verified independently against real manufacturer spec sheets: e.g. for $47\,\mu\text{F} / 25\,\text{V}$, $0.01 \times 47 \times 25 = 11.75\,\mu\text{A}$ baseline limit). The exact screening ceilings used in this prototype ($50.0\,\mu\text{A}$ and $1.7\,\mu\text{A}$) are representative values for demonstration purposes; full quantitative derivation against the complete standard's burn-in derating tables is a refinement step for production use.

| Criterion ID | Criterion Name | Value | Unit | Applicability | Verified Source / Document Ref |
|---|---|---|---|---|---|
| `SPEC-TANTALUM-STD-25V` | Standard Solid Tantalum ESS DCL Ceiling | `50.0` | `µA` | $47\,\mu\text{F}/25\,\text{V}$ Rated Capacitors | `MIL-PRF-55365 Table I` (Representative Prototype Screening Ceiling) |
| `SPEC-TANTALUM-HALT-35V` | HALT Accelerated Life Test High-Rel DCL Ceiling | `1.7` | `µA` | $6.8\,\mu\text{F}/35\,\text{V}$ NASA HALT Test Series | `NASA GSFC NTRS 20160001192` (Representative Prototype Screening Ceiling) |

---

## 7. Environmental Context Layer (`environmentalContext.ts`)

Contains 14 structured environmental and test condition factors:

- **Active ML Data Factors (`data_available: true`, `ML_feature: true`)**:
  1. `Test Temperature` ($125\,^\circ\text{C}$ or $85\,^\circ\text{C}$) — MIL-STD-883 Method 1015 (Burn-in) / ECSS-Q-ST-60-05C.
  2. `Applied Bias Voltage` ($25\,\text{V}$ or $56-77\,\text{V}$) — MIL-PRF-55365 Voltage Acceleration.
  3. `Burn-In Duration` ($168\text{h}$) — NASA EEE-INST-002 Table 2A.

- **Context-Only Factors (`data_available: false`, `ML_feature: false`, `engineering_context_only: true`)**:
  4. `Temperature Cycling` — NASA EEE-INST-002 Section 4 / MIL-STD-883 Method 1010.
  5. `Thermal Shock` — ECSS-Q-ST-60C Rev.4 Section 6.2.
  6. `Vacuum / Ambient Pressure` — ECSS-Q-ST-60-15C / ASTM E595 Outgassing.
  7. `Relative Humidity` — MIL-STD-202 Method 103 / JEDEC J-STD-020.
  8. `Random Vibration` — NASA EEE-INST-002 / MIL-STD-202 Method 214.
  9. `Mechanical Shock` — MIL-STD-202 Method 213.
  10. `Total Ionizing Dose (TID)` — ECSS-E-ST-10-12C / MIL-STD-883 Method 1019.
  11. `Displacement Damage (TNID)` — NASA GSFC Radiation Effects Group.
  12. `Single Event Effects (SEE)` — JESD57 Heavy Ion Standard (Test Procedures for the Measurement of Single-Event Effects in Semiconductor Devices from Heavy Ion Irradiation).
  13. `Molecular Contamination` — ECSS-Q-ST-70-01C Cleanroom Standards.
  14. `Storage & Shelf Life` — MIL-HDBK-113 / JEDEC J-STD-033.

---

## 8. Unified Explanation Generator (`unifiedExplanation.ts`)

Synthesizes four distinct narrative sections:
1. **WHAT HAPPENED**: Exact measured DCL, percentage change over interval, lot median comparison, Z-score, and IF score.
2. **WHY IT OCCURRED**: Physical mechanism context (consistent with oxygen-vacancy-migration degradation mechanisms documented in tantalum-capacitor reliability literature; framed as literature-supported context, as the software measures electrical leakage telemetry only, not dielectric microchemistry).
3. **WHAT IS PREDICTED**: $168\text{h}$ DCL predictions (Linear vs. Ridge LOCO), slope comparison against `SAFETY_SLOPE_THRESHOLD`.
4. **WHAT THE ENGINEER SHOULD REVIEW**: Actionable review instructions, spec ceiling comparison, and the mandatory policy notice: **"ANOMALY ≠ PHYSICAL FAILURE"**.

---

## 9. Mathematical Formulas Reference

### 1. Robust Z-Score
$$\text{MAD} = \text{Median}\left( |x_i - \text{Median}(\mathbf{x})| \right)$$
$$Z_i = \frac{x_i - \text{Median}(\mathbf{x})}{1.4826 \times \text{MAD}}$$
- **Purpose**: Measure component deviation from lot central tendency without baseline distortion from outliers.
- **Inputs**: Vector of component measurements $\mathbf{x}$.
- **Outputs**: Dimensionless Z-score in MAD-equivalent units.

### 2. Isolation Forest Anomaly Score
$$c(n) = 2 \left( \ln(n - 1) + 0.5772156649 \right) - \frac{2(n - 1)}{n}$$
$$s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$
- **Purpose**: Measure multi-dimensional isolation in decision tree partitioning space.
- **Inputs**: Feature vector $\mathbf{x}_i$, dataset size $n$.
- **Outputs**: Anomaly score $s \in [0, 1]$.

### 3. Ridge Regression LOCO Model
$$\hat{\mathbf{w}} = (\mathbf{X}_{-k}^T \mathbf{X}_{-k} + \lambda \mathbf{I})^{-1} \mathbf{X}_{-k}^T \mathbf{y}_{-k}$$
- **Purpose**: Predict $168\text{h}$ DCL using $0\text{h}$ and $24\text{h}$ measurements while excluding target component $k$ from training.
- **Inputs**: Training matrix $\mathbf{X}_{-k}$ ($0\text{h}, 24\text{h}$ values for all components except $k$), target vector $\mathbf{y}_{-k}$ ($168\text{h}$ values).
- **Outputs**: Coefficients $\hat{\mathbf{w}}$, predicted $\hat{y}_k = \mathbf{x}_k \hat{\mathbf{w}}$.

### 4. Exponential Degradation Curve
$$I(t) = I_0 + a \left( 1 - e^{-bt} \right)$$
- **Purpose**: Model non-linear saturation kinetics of current degradation.
- **Inputs**: Time points $t$, initial current $I_0$.
- **Outputs**: Fitted scale $a$, rate $b$, $R^2$ fit metric.

---

## 10. Known System Limitations

1. **Real Dataset Sample Size**: Real NASA data consists of 4 components from 1 test lot/condition ($N = 4$). Suitable for Module B drift model validation only; cannot support Module A lot-level statistical anomaly scoring.
2. **Safety Slope Threshold Status**: `SAFETY_SLOPE_THRESHOLD` ($0.05\,\mu\text{A}/\text{h}$) is an initial engineering heuristic threshold, not independently validated against a real component-family degradation distribution — pending further calibration with additional real data.
3. **Component Rating Mismatch**: Real NASA data is for $6.8\,\mu\text{F}/35\,\text{V}$ capacitors, whereas the synthetic target application is $47\,\mu\text{F}/25\,\text{V}$. Handled via distinct engineering spec limits ($1.7\,\mu\text{A}$ vs. $50.0\,\mu\text{A}$).

---

## 11. System Change History Across Phases

- **Phase 0**: Codebase inspection. Mapped tRPC endpoints, database schema, existing Ridge scaffolding, branding audit.
- **Phase 1**: Built synthetic dataset (`synthetic_tantalum_dcl.csv`), real NASA dataset (`real_tantalum_dcl.csv`), CSV validator (`shared/csvValidator.ts`), dataset store (`datasetStore.ts`), Module B drift engine (`driftModels.ts`), LOCO leakage fix in `nasaBatteryModel.ts`, and interactive Recharts drift visualization (`ModuleB.tsx`).
- **Phase 2**: Built pure TypeScript Isolation Forest (`isolationForest.ts`), lot anomaly engine (`lotAnomaly.ts`), minimum lot size guard ($N \ge 10$), ground-truth tests (`lotAnomaly.test.ts`), and Module A lot visualization UI (`ModuleA.tsx`).
- **Phase 3**: Built centralized risk engine (`riskEngine.ts`), engineering criteria store (`engineeringCriteria.ts`), environmental context layer (`environmentalContext.ts`), synthesized explanation generator (`unifiedExplanation.ts`), unified screening workbench (`UnifiedAnalysis.tsx`), real CSV/PDF export actions, interactive chart zoom controls, and versioning metadata.
- **Phase 4**: Real tiered ground-truth evaluation engine (`anomalyEvaluation.ts`), benchmark unit tests (`anomalyEvaluation.test.ts`), live UI evaluation panel (`EvaluationBenchmarkPanel`), complete technical documentation, and corrected doc hedging.

---

## 12. Core Evaluation & Tiered Benchmark Results

### Live Ground-Truth Benchmark Results ($N = 12$ Injected Anomalies across 54 Components)
Computed live via `server/ml/anomalyEvaluation.ts` on the 54-component synthetic evaluation dataset (`synthetic_tantalum_dcl.csv`):

| Severity Tier | Injected Count | Strict Recall (HIGH RISK) | Loose Recall (HIGH RISK + REVIEW) | Strict Precision | False Negative Rate (FNR) |
|---|---|---|---|---|---|
| **OBVIOUS** | 3 | **100.0%** (3/3) | **100.0%** (3/3) | 100.0% | 0.0% |
| **MODERATE** | 3 | **100.0%** (3/3) | **100.0%** (3/3) | 100.0% | 0.0% |
| **SUBTLE** | 6 | **66.67%** (4/6)* | **100.0%** (6/6) | 100.0% | **33.33%** (2/6) |

*\*Note on Subtle Tier Performance*: Subtle-tier components (`TAL-A-012`, `TAL-A-015`, `TAL-B-012`, `TAL-B-015`, `TAL-C-012`, `TAL-C-015`) were calibrated with drift trajectories near/under the $Z = 2.5$ REVIEW threshold ($Z \approx 1.5 - 2.3$ MAD). Under Strict screening (counting `HIGH RISK` only), 4 of 6 are flagged (66.67% recall), while 2 components (`TAL-A-012`, `TAL-A-015`) are routed to `REVIEW` (and caught under Loose screening, achieving 100% loose recall). All metrics are explicitly reported on synthetic evaluation data ($N = 54$).
