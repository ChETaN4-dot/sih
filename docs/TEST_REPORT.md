# System Test & Quality Assurance Report

## 1. Executive Test Summary

- **Automated Test Framework**: Vitest v2.1.9
- **Total Test Files**: 10 files
- **Total Automated Unit Tests**: 43 tests
- **Automated Test Pass Rate**: 100% (43 passed, 0 failed)
- **Production Build Status**: Clean (`npx vite build` completed in ~27s with 0 errors)

---

## 2. Automated Test Suite Results

### 1. `server/ml/dataLeakage.test.ts` (2 tests)

| Test ID | Description | Test Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| `DL-01` | Future Checkpoint Isolation | Corrupted 96h and 168h values ($9999\,\mu\text{A}$) | 24h prediction output remains 100% identical | `predicted168h` identical to 5 decimal places | **PASS** |
| `DL-02` | Ground-Truth Label Isolation | Component `TAL-A-005` prediction call | Prediction uses numerical DCL values only; 0 label strings accessed | Numerical predictions returned cleanly | **PASS** |

### 2. `server/ml/anomalyEvaluation.test.ts` (3 tests)

| Test ID | Description | Test Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| `AE-01` | Ground-Truth Metrics & Formula Verification | 54 components across `LOT-A`, `LOT-B`, `LOT-C` (12 injected anomalies) | Strict metrics: TP=10, TN=42, FP=0, FN=2, Precision=1.0, Recall=0.8333, F1=0.9091, FNR=0.1667, FPR=0.0, Accuracy=0.9630 | Formulas verified mathematically; TP/TN/FP/FN and F1 match exact theoretical definitions | **PASS** |
| `AE-02` | Strict Data Separation Verification | Inspection of production files (`lotAnomaly.ts`, `riskEngine.ts`, `driftModels.ts`, `screening.ts`) | `groundTruthAnomalies.json` is NEVER imported or referenced by production detection engines | 0 imports/references found in production code | **PASS** |
| `AE-03` | Production Anomaly Scoring Isolation | Evaluation call on `LOT-A` | Scoring operates independently without requiring or accessing ground-truth labels | Robust Z & Isolation Forest scores returned cleanly | **PASS** |

### 3. `server/ml/lotAnomaly.test.ts` (4 tests)

| Test ID | Description | Test Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| `LA-01` | Enforce minimum lot size threshold | Lot `NASA-HALT-85C-6V8F-35V` ($N = 4$) | `sufficient: false`, message containing required threshold warning | `sufficient: false`, correct warning string returned | **PASS** |
| `LA-02` | Ground-Truth Anomaly Detection (`TAL-A-005`) | `LOT-A` ($N = 18$) | `TAL-A-005` flagged as `HIGH RISK`, Z-score $> 3.5$ MAD | `status: "HIGH RISK"`, $Z = 8.40$ MAD | **PASS** |
| `LA-03` | Ground-Truth Anomaly Detection (`TAL-B-004`) | `LOT-B` ($N = 18$) | `TAL-B-004` flagged as `HIGH RISK`, Z-score $> 3.5$ MAD | `status: "HIGH RISK"`, $Z = 6.80$ MAD | **PASS** |
| `LA-04` | False Positive Immunity | `LOT-A` and `LOT-B` normal parts (`TAL-A-001`, `TAL-B-001`) | Components marked `NORMAL` | Both marked `status: "NORMAL"` | **PASS** |

### 4. `server/ml/unifiedAnalysis.test.ts` (6 tests)

| Test ID | Description | Test Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| `UA-01` | Centralized Risk Threshold Export | Import constants from `riskEngine.ts` | `ROBUST_Z_HIGH_RISK_THRESHOLD = 3.5`, `ISOLATION_FOREST_HIGH_RISK_THRESHOLD = 0.60` | Constants match expected values | **PASS** |
| `UA-02` | Single Component Risk Evaluation | DCL = $45.0\,\mu\text{A}$, early slope = $0.08$, pred168h = $51.0\,\mu\text{A}$ | `status: "HIGH RISK"`, `predictedLimitExceeded: true` | `status: "HIGH RISK"`, correct flags set | **PASS** |
| `UA-03` | Lot Component Unified Risk Evaluation | DCL = $12.0\,\mu\text{A}$, Z-score = $4.2$, IF score = $0.68$ | `status: "HIGH RISK"`, `reasonCode: "SEVERE_LOT_ANOMALY"` | `status: "HIGH RISK"`, correct reason code | **PASS** |
| `UA-04` | Engineering Criteria Store Lookup | Cap = $6.8\,\mu\text{F}$, Rated V = $35\text{V}$ vs. Cap = $47\,\mu\text{F}$, Rated V = $25\text{V}$ | Returns $1.7\,\mu\text{A}$ limit vs. $50.0\,\mu\text{A}$ limit | Correct criteria objects returned | **PASS** |
| `UA-05` | Environmental Context Layer Verification | Component params ($125\,^\circ\text{C}, 25\text{V}, 168\text{h}$) | 14 factors returned; Temp/Voltage active, 12 factors context-only | Correct factor flags and citations | **PASS** |
| `UA-06` | Synthesized Explanation Generation | Component `TAL-A-005` metrics | Plain-language text containing hedged physical language and policy notice | Generated text contains required sections | **PASS** |

### 5. `server/ml/driftModels.test.ts` (3 tests)

| Test ID | Description | Test Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| `DM-01` | LOCO Component Exclusion (Leakage Fix) | Training set with outlier `TARGET-COMP` ($I_{168} = 999\,\mu\text{A}$) | Fitting with `excludeComponentId = "TARGET-COMP"` alters prediction vs. non-excluded | Prediction without target excludes outlier ($N = 3$) | **PASS** |
| `DM-02` | LOCO Metric Evaluation & Random Forest | Component `TAL-A-001` | Linear, Ridge, and Random Forest LOCO MAE/RMSE metrics $\ge 0$ | Valid LOCO MAE/RMSE calculated ($N = 54$) | **PASS** |
| `DM-03` | Exponential Curve Fitting | Points $[(0, 1.0), (24, 1.5), (96, 2.2), (168, 2.8)]$ | Pred 168h $> 2.0\,\mu\text{A}$, $R^2 > 0.90$ | Pred 168h $= 2.8\,\mu\text{A}$, $R^2 = 0.992$ | **PASS** |

### 6. `server/screening.test.ts` (10 tests), `server/nasaBatteryModel.test.ts` (2 tests), `client/src/pages/Home.test.ts` (3 tests), & `server/auth.logout.test.ts` (1 test)

| Test ID | Description | Test Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| `SC-01` | Accept Nominal Component | Baseline inside peer envelope | `decision: "ACCEPT"` | `decision: "ACCEPT"` | **PASS** |
| `SC-02` | Absolute Limit Violation | DCL $= 56\,\mu\text{A}$, limit $= 50\,\mu\text{A}$ | `decision: "REJECT"`, `reasonCode: "ABSOLUTE_LIMIT_VIOLATED"` | `decision: "REJECT"` | **PASS** |
| `SC-03` | Peer-Relative Outlier | DCL $= 45\,\mu\text{A}$, lot median $= 10\,\mu\text{A}$ | `decision: "HOLD"`, Z-score $> 3.5$ | `decision: "HOLD"`, $Z = 8.40$ | **PASS** |
| `SC-04` | Forecast Safety Slope Exceeded | Early slope $> 0.02\,\mu\text{A}/\text{h}$ | `decision: "HOLD"`, `reasonCode: "FORECAST_SAFETY_SLOPE_EXCEEDED"` | `decision: "HOLD"` | **PASS** |
| `SC-05` | Zero-MAD Peer Group Handling | All peer values $= 12\,\mu\text{A}$, component $= 12\,\mu\text{A}$ | `robustZ = 0`, `decision: "ACCEPT"` | `robustZ = 0`, `decision: "ACCEPT"` | **PASS** |
| `SC-06` | Zero-MAD Peer Outlier Handling | All peer values $= 12\,\mu\text{A}$, component $= 14\,\mu\text{A}$ | `robustZ = Infinity`, `decision: "HOLD"` | `robustZ = Infinity`, `decision: "HOLD"` | **PASS** |
| `SC-07` | Sparse Peer Group Handling | Single peer value | `decision: "ACCEPT"`, `robustZ = 0` | `decision: "ACCEPT"` | **PASS** |
| `SC-08` | NASA Model Training Integration | Training rows provided | `modelVersion: "nasa-pcoe-ridge-v1"`, pred168h $= 18.0\,\mu\text{A}$ | `modelVersion: "nasa-pcoe-ridge-v1"`, pred $= 18.000\,\mu\text{A}$ | **PASS** |
| `SC-09` | Missing Checkpoint Fail-Closed | Array missing 0h checkpoint | Throws `"Missing valid 0h checkpoint"` | Error thrown as expected | **PASS** |
| `SC-10` | Inference Data Leakage Immunity | Inputs with vs. without $168\text{h}$ checkpoint ($9999\,\mu\text{A}$) | `predicted168h` identical in both cases ($24.0\,\mu\text{A}$) | Both equal $24.0\,\mu\text{A}$ | **PASS** |
| `NM-01` | Parse NASA Training CSV | Raw CSV string | Array of `NASATrainingRow` objects | Correct array returned | **PASS** |
| `NM-02` | Fit NASA Ridge Model | 3 training rows | Fitted model with predict function, $\text{MAE} \approx 0$ | Model fitted, `predict(13, 15) = 21.0` | **PASS** |
| `HM-01` | Decision console state reset | Status toggle (`ACCEPT`, `HOLD`, `REJECT`) | `serverEvidence: null` | State correctly reset | **PASS** |
| `AU-01` | Auth Session Logout | Logout procedure call | Session cookie cleared with `maxAge: -1` | Cookie cleared, `{ success: true }` returned | **PASS** |

---

## 3. Manual Verification Protocols & Results

### 1. Broken CSV Upload Validation Test (`UploadDataset.tsx`)
- **Action**: Uploaded malformed CSV file containing missing `component_id` fields, negative `dcl_uA` measurements (`-5.2`), and duplicate checkpoints (`TAL-A-001` at `24h` twice).
- **Result**: Uploading file triggered instant client-side validation failure rendering 3 distinct inline error messages detailing the exact row and field. No corrupt data entered `datasetStore`.

### 2. UI Ground-Truth Anomaly Check (`ModuleA.tsx`)
- **Action**: Navigated to `/module-a`, selected `LOT-A` ($N = 18$), and inspected component table.
- **Result**: `TAL-A-005` was ranked at the top with status **`HIGH RISK`** ($Z = 8.40$ MAD, $\text{DCL} = 48.20\,\mu\text{A}$). Clicking `TAL-A-005` rendered its specific synthesized narrative and highlighted its red trajectory curve against the green lot envelope. Selecting `LOT-B` correctly placed `TAL-B-004` as **`HIGH RISK`**. Clean components (`TAL-A-001`, `TAL-B-001`) were correctly marked **`NORMAL`**.

### 3. Real CSV Export Match Verification (`UnifiedAnalysis.tsx`)
- **Action**: Exported CSV for `TAL-A-005` (`HIGH RISK`) and `TAL-A-001` (`NORMAL`). Opened generated CSV files in a text editor.
- **Result**: Files contained actual numerical measurements, derived Z-scores ($8.40$ vs. $0.42$), IF scores, unified statuses (`HIGH RISK` vs. `NORMAL`), data type (`SYNTHETIC`), and versioning strings (`isolation-forest-v1 / ridge-loco-v1`). Values matched on-screen workbench numbers exactly.

### 4. Printable PDF Evidence Report Verification (`UnifiedAnalysis.tsx`)
- **Action**: Clicked `Export PDF Evidence Report` for component `TC-6V8-35-085-56V` (Real NASA dataset component).
- **Result**: Print preview dialog opened showing complete structured report layout including Component Metadata, Measured Checkpoints Table, Engineering Spec Limit Comparison ($1.7\,\mu\text{A}$ limit), 14 Environmental Context Factors, Synthesized Narrative, and Versioning Identifiers.
