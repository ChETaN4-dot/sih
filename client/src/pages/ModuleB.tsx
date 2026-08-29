import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DatasetCascadeSelector from "@/components/DatasetCascadeSelector";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  FileText,
  CheckCircle,
  HelpCircle,
  BarChart2,
  Database,
  Layers,
  Upload,
} from "lucide-react";

export default function ModuleB() {
  const [, setLocation] = useLocation();
  const [selectedCompId, setSelectedCompId] = useState<string>("");
  const [showLimit, setShowLimit] = useState<boolean>(true);
  const [showPredictions, setShowPredictions] = useState<boolean>(true);

  // Queries
  const componentsQuery = trpc.analysis.getComponents.useQuery();
  const compList = componentsQuery.data ?? [];

  // Read componentId from URL parameter or state or fallback to first component
  const urlCompId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("componentId") : null;
  const currentCompId = selectedCompId || urlCompId || (compList.length > 0 ? compList[0].component_id : "");

  const driftQuery = trpc.analysis.analyzeDrift.useQuery(
    { componentId: currentCompId },
    { enabled: Boolean(currentCompId) },
  );

  const analysis = driftQuery.data;

  // Chart data transformation
  const chartData = useMemo(() => {
    if (!analysis || !analysis.checkpoints) return [];

    const result: Array<{
      time_h: number;
      actual_dcl?: number;
      linear_pred?: number;
      ridge_pred?: number;
      exp_pred?: number;
    }> = [];

    // Measured points
    for (const pt of analysis.checkpoints) {
      result.push({
        time_h: pt.time_h,
        actual_dcl: pt.dcl_uA,
      });
    }

    // Add 168h predictions if available and 168h checkpoint wasn't already in measurements
    if (analysis.predictions && showPredictions) {
      const predLinear = analysis.predictions.linear.predicted168h;
      const predRidge = analysis.predictions.ridge.predicted168h;
      const predExp = analysis.predictions.exponential.predicted168h;

      const has168Measured = analysis.checkpoints.some((c) => c.time_h === 168);

      if (has168Measured) {
        // Overlay prediction on existing 168h point for comparison
        const item168 = result.find((r) => r.time_h === 168);
        if (item168) {
          item168.linear_pred = predLinear;
          item168.ridge_pred = predRidge;
          item168.exp_pred = predExp;
        }
      } else {
        // Add 168h prediction point
        result.push({
          time_h: 168,
          linear_pred: predLinear,
          ridge_pred: predRidge,
          exp_pred: predExp,
        });
      }
    }

    return result.sort((a, b) => a.time_h - b.time_h);
  }, [analysis, showPredictions]);

  // Determine appropriate spec limit based on component rating
  const specLimit = useMemo(() => {
    if (!analysis?.component) return 50.0;
    const ratedV = analysis.component.rated_voltage_V;
    const cap = analysis.component.capacitance_uF;
    // Standard tantalum formula: DCL <= 0.01 * C * V (or 1.7 uA min for 6.8uF/25V)
    if (cap === 6.8 && ratedV === 35) return 1.7; // From NASA paper reference
    return 50.0;
  }, [analysis]);

  return (
    <div className="site-shell" style={{ background: "#111412", minHeight: "100vh", color: "#edf0e6", padding: "40px 6%" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334038", paddingBottom: "20px", marginBottom: "30px" }}>
        <div>
          <button
            onClick={() => setLocation("/")}
            style={{ background: "none", border: "none", color: "#9ba69b", display: "flex", alignItems: "center", gap: "6px", fontFamily: "IBM Plex Mono", fontSize: "12px", cursor: "pointer", marginBottom: "8px" }}
          >
            <ArrowLeft size={14} /> BACK TO DASHBOARD
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <h1 style={{ fontSize: "2.2rem", margin: 0, fontWeight: 600 }}>Module B — Component Drift Analysis</h1>
            <span style={{ background: "#d6f24a22", color: "#d6f24a", border: "1px solid #d6f24a44", padding: "4px 10px", borderRadius: "3px", fontFamily: "IBM Plex Mono", fontSize: "11px" }}>
              TIME-DEPENDENT BEHAVIOR
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setLocation("/upload")}
            className="button button--signal"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Upload size={15} /> Upload Dataset
          </button>
        </div>
      </header>

      {/* Hierarchical Dataset, Lot & Component Selector */}
      <DatasetCascadeSelector
        selectedCompId={currentCompId}
        onSelectComponent={(newCompId) => {
          setSelectedCompId(newCompId);
        }}
        showComponentSelector={true}
      />

      {/* Main Grid: Left Controls & Selector / Right Analysis Panel */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "30px" }}>
        {/* Left Column: Component Selection */}
        <div>

          {/* Component Metadata & Provenance Card */}
          {analysis?.component && (
            <div style={{ background: "#161a18", border: "1px solid #334038", padding: "20px", borderRadius: "4px" }}>
              <h4 style={{ margin: "0 0 15px", fontFamily: "IBM Plex Mono", fontSize: "12px", color: "#8a9588", display: "flex", alignItems: "center", gap: "8px" }}>
                <Database size={14} style={{ color: "#d6f24a" }} /> COMPONENT PROVENANCE
              </h4>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#8a9588" }}>Component ID:</span>
                  <strong style={{ fontFamily: "IBM Plex Mono" }}>{analysis.component.component_id}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#8a9588" }}>Lot ID:</span>
                  <strong style={{ fontFamily: "IBM Plex Mono" }}>{analysis.component.lot_id}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#8a9588" }}>Capacitance:</span>
                  <span>{analysis.component.capacitance_uF} µF</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#8a9588" }}>Rated / Test V:</span>
                  <span>{analysis.component.rated_voltage_V}V / {analysis.component.test_voltage_V}V</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#8a9588" }}>Test Temperature:</span>
                  <span>{analysis.component.test_temperature_C}°C</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #334038", paddingTop: "10px", marginTop: "5px" }}>
                  <span style={{ color: "#8a9588" }}>Data Type Tag:</span>
                  <span style={{
                    fontSize: "10px",
                    fontFamily: "IBM Plex Mono",
                    padding: "3px 8px",
                    borderRadius: "3px",
                    background: analysis.component.data_type.includes("REAL") ? "#e8a25333" : "#d6f24a22",
                    color: analysis.component.data_type.includes("REAL") ? "#e8a253" : "#d6f24a",
                    border: `1px solid ${analysis.component.data_type.includes("REAL") ? "#e8a25355" : "#d6f24a55"}`,
                  }}>
                    {analysis.component.data_type}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#68736b", lineHeight: "1.4", marginTop: "5px" }}>
                  Source: {analysis.component.data_source}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Recharts Graph & Model Comparisons */}
        <div>
          {/* Sufficiency Check / Warning */}
          {analysis && !analysis.sufficient && (
            <div style={{ background: "#251c1c", border: "1px solid #e57463", padding: "20px", borderRadius: "4px", marginBottom: "25px", display: "flex", gap: "15px", alignItems: "flex-start" }}>
              <AlertTriangle size={24} style={{ color: "#e57463", flexShrink: 0 }} />
              <div>
                <h3 style={{ margin: "0 0 5px", color: "#e57463", fontSize: "16px" }}>Insufficient Measurements for Drift Analysis</h3>
                <p style={{ margin: 0, color: "#f6c4ba", fontSize: "13px" }}>
                  {analysis.message}. Available checkpoints: [{analysis.checkpoints.map(c => `${c.time_h}h`).join(", ")}]. Missing checkpoints: [{analysis.missingCheckpoints.map(t => `${t}h`).join(", ")}].
                </p>
              </div>
            </div>
          )}

          {/* Early Rejection Flag & High Drift Warning Banner */}
          {analysis && analysis.sufficient && analysis.rejectionFlagged && (
            <div style={{ background: "#2a1515", border: "1px solid #e57463", padding: "18px 22px", borderRadius: "6px", marginBottom: "25px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <AlertTriangle size={24} style={{ color: "#e57463", flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: "0 0 4px", color: "#e57463", fontFamily: "IBM Plex Mono", fontSize: "14px", letterSpacing: "0.08em" }}>
                    ⚠️ EARLY REJECTION FLAG: HIGH DRIFT RATE DETECTED
                  </h4>
                  <p style={{ margin: 0, color: "#f6c4ba", fontSize: "12px", lineHeight: "1.4" }}>
                    {analysis.rejectionReason} (Calculated Dynamic Safety Slope = {analysis.dynamicSafetySlopeThreshold.toFixed(4)} µA/h).
                  </p>
                </div>
              </div>
              <span style={{ background: "#e57463", color: "#111412", fontWeight: 700, padding: "6px 12px", borderRadius: "4px", fontSize: "11px", fontFamily: "IBM Plex Mono", whiteSpace: "nowrap" }}>
                REJECT @ 24H
              </span>
            </div>
          )}

          {/* Interactive Recharts Graph */}
          {analysis && analysis.sufficient && (
            <div style={{ background: "#161a18", border: "1px solid #334038", padding: "25px", borderRadius: "4px", marginBottom: "30px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px" }}>DCL Leakage Current vs Burn-In Time</h3>
                  <span style={{ color: "#8a9588", fontSize: "12px", fontFamily: "IBM Plex Mono" }}>
                    Measured vs Predicted 168h Trajectories
                  </span>
                </div>

                <div style={{ display: "flex", gap: "15px", fontSize: "12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={showPredictions}
                      onChange={(e) => setShowPredictions(e.target.checked)}
                    />
                    <span>Show Predictions</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={showLimit}
                      onChange={(e) => setShowLimit(e.target.checked)}
                    />
                    <span>Show Spec Limit ({specLimit} µA)</span>
                  </label>
                </div>
              </div>

              <div style={{ width: "100%", height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2c3730" />
                    <XAxis
                      dataKey="time_h"
                      stroke="#8a9588"
                      tick={{ fill: "#8a9588", fontSize: 12, fontFamily: "IBM Plex Mono" }}
                      unit="h"
                    />
                    <YAxis
                      stroke="#8a9588"
                      tick={{ fill: "#8a9588", fontSize: 12, fontFamily: "IBM Plex Mono" }}
                      unit=" µA"
                    />
                    <Tooltip
                      contentStyle={{ background: "#1d2420", borderColor: "#526152", color: "#edf0e6", fontFamily: "IBM Plex Mono", fontSize: "12px" }}
                      formatter={(val: any) => [`${Number(val).toFixed(3)} µA`]}
                    />
                    <Legend wrapperStyle={{ fontFamily: "IBM Plex Mono", fontSize: "12px", paddingTop: "10px" }} />

                    {showLimit && (
                      <ReferenceLine
                        y={specLimit}
                        stroke="#e57463"
                        strokeDasharray="4 4"
                        label={{ value: `SPEC LIMIT (${specLimit} µA)`, fill: "#e57463", fontSize: 10, position: "top" }}
                      />
                    )}

                    {/* Actual Measured Line */}
                    <Line
                      type="monotone"
                      dataKey="actual_dcl"
                      name="Actual DCL Measurement"
                      stroke="#d6f24a"
                      strokeWidth={3}
                      dot={{ r: 6, fill: "#d6f24a" }}
                      activeDot={{ r: 8 }}
                    />

                    {/* Linear Prediction */}
                    {showPredictions && (
                      <Line
                        type="monotone"
                        dataKey="linear_pred"
                        name="Linear Extrapolation (0h+24h)"
                        stroke="#e8a253"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 5, fill: "#e8a253" }}
                      />
                    )}

                    {/* Ridge Prediction */}
                    {showPredictions && (
                      <Line
                        type="monotone"
                        dataKey="ridge_pred"
                        name="Ridge Regression (LOCO)"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        dot={{ r: 5, fill: "#60a5fa" }}
                      />
                    )}

                    {/* Exponential Fit Prediction */}
                    {showPredictions && (
                      <Line
                        type="monotone"
                        dataKey="exp_pred"
                        name="Exponential Curve Fit"
                        stroke="#a855f7"
                        strokeWidth={2}
                        strokeDasharray="2 2"
                        dot={{ r: 4, fill: "#a855f7" }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Model Comparison & Evaluation Metrics Panel */}
          {analysis?.predictions && (
            <div style={{ background: "#161a18", border: "1px solid #334038", padding: "25px", borderRadius: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <BarChart2 size={20} style={{ color: "#d6f24a" }} />
                <h3 style={{ margin: 0, fontSize: "18px" }}>Model Comparison & Early Prediction (24h → 168h)</h3>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "15px", marginBottom: "20px" }}>
                {/* 1. Linear Extrapolation */}
                <div style={{ background: "#1d2420", border: "1px solid #3a473d", padding: "15px", borderRadius: "4px" }}>
                  <div style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#e8a253", marginBottom: "5px" }}>
                    MODEL 1 — LINEAR BASELINE
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: "bold", fontFamily: "IBM Plex Mono", color: "#edf0e6", margin: "5px 0" }}>
                    {analysis.predictions.linear.predicted168h.toFixed(2)} µA
                  </div>
                  <div style={{ fontSize: "11px", color: "#8a9588", marginBottom: "10px" }}>Predicted 168h DCL</div>
                  <div style={{ fontSize: "11px", borderTop: "1px solid #334038", paddingTop: "8px", color: "#a6b0a2" }}>
                    <div>LOCO MAE: <strong>{analysis.predictions.linear.mae.toFixed(3)} µA</strong></div>
                    <div>LOCO RMSE: <strong>{analysis.predictions.linear.rmse.toFixed(3)} µA</strong></div>
                  </div>
                </div>

                {/* 2. Ridge Regression */}
                <div style={{ background: "#1d2420", border: "1px solid #3a473d", padding: "15px", borderRadius: "4px" }}>
                  <div style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#60a5fa", marginBottom: "5px" }}>
                    MODEL 2 — RIDGE REGRESSION
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: "bold", fontFamily: "IBM Plex Mono", color: "#edf0e6", margin: "5px 0" }}>
                    {analysis.predictions.ridge.predicted168h.toFixed(2)} µA
                  </div>
                  <div style={{ fontSize: "11px", color: "#8a9588", marginBottom: "10px" }}>
                    Trained on {analysis.predictions.ridge.trainedOnComponentsCount} held-out comps
                  </div>
                  <div style={{ fontSize: "11px", borderTop: "1px solid #334038", paddingTop: "8px", color: "#a6b0a2" }}>
                    <div>LOCO MAE: <strong>{analysis.predictions.ridge.mae.toFixed(3)} µA</strong></div>
                    <div>LOCO RMSE: <strong>{analysis.predictions.ridge.rmse.toFixed(3)} µA</strong></div>
                  </div>
                </div>

                {/* 3. Exponential Degradation */}
                <div style={{ background: "#1d2420", border: "1px solid #3a473d", padding: "15px", borderRadius: "4px" }}>
                  <div style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#a855f7", marginBottom: "5px" }}>
                    MODEL 3 — EXPONENTIAL FIT
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: "bold", fontFamily: "IBM Plex Mono", color: "#edf0e6", margin: "5px 0" }}>
                    {analysis.predictions.exponential.predicted168h.toFixed(2)} µA
                  </div>
                  <div style={{ fontSize: "11px", color: "#8a9588", marginBottom: "10px" }}>Curve Fit: I(t)=I0+a(1-e^-bt)</div>
                  <div style={{ fontSize: "11px", borderTop: "1px solid #334038", paddingTop: "8px", color: "#a6b0a2" }}>
                    <div>Fit RMSE: <strong>{analysis.predictions.exponential.rmse.toFixed(3)} µA</strong></div>
                    <div>Fit R²: <strong>{analysis.predictions.exponential.r2.toFixed(3)}</strong></div>
                  </div>
                </div>
              </div>

              {/* Comparison Conclusion */}
              <div style={{ background: "#1d2420", border: "1px solid #526152", padding: "15px", borderRadius: "4px", fontSize: "13px", color: "#d6f24a" }}>
                <strong>LOCO Cross-Validation Result:</strong> {analysis.predictions.comparisonSummary}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
