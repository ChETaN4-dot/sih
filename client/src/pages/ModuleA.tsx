import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DatasetCascadeSelector from "@/components/DatasetCascadeSelector";
import {
  ComposedChart,
  Line,
  Area,
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
  Radar,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  BarChart2,
  Database,
  Layers,
  Search,
  ChevronRight,
  Info,
} from "lucide-react";

export default function ModuleA() {
  const [, setLocation] = useLocation();
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [showSpecLimit, setShowSpecLimit] = useState<boolean>(true);
  const [showEnvelope, setShowEnvelope] = useState<boolean>(true);

  // Queries
  const lotsQuery = trpc.analysis.getLots.useQuery();
  const lotList = lotsQuery.data ?? [];

  // Read lotId from URL parameter or state or fallback to first lot
  const urlLotId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("lotId") : null;
  const currentLotId = selectedLotId || urlLotId || (lotList.length > 0 ? lotList[0].lot_id : "");

  const lotAnalysisQuery = trpc.analysis.analyzeLot.useQuery(
    { lotId: currentLotId },
    { enabled: Boolean(currentLotId) },
  );

  const analysis = lotAnalysisQuery.data;

  // Auto select top flagged component or first component when analysis loads
  const activeComp = useMemo(() => {
    if (!analysis?.components || analysis.components.length === 0) return null;
    if (selectedCompId) {
      const found = analysis.components.find((c) => c.componentId === selectedCompId);
      if (found) return found;
    }
    return analysis.components[0];
  }, [analysis, selectedCompId]);

  // Chart data: combines time-series lot baseline median/min/max with selected component's trajectory
  const chartData = useMemo(() => {
    if (!analysis?.lotBaseline?.timePoints) return [];

    const compMeasurements = activeComp
      ? datasetStoreMeasurements(activeComp.componentId, analysis.components)
      : [];

    return analysis.lotBaseline.timePoints.map((tp) => {
      const compPt = compMeasurements.find((m) => m.time_h === tp.time_h);
      return {
        time_h: tp.time_h,
        median: tp.median,
        min: tp.min,
        max: tp.max,
        rangeBand: [tp.min, tp.max],
        selected_dcl: compPt?.dcl_uA,
      };
    });
  }, [analysis, activeComp]);

  // Helper to extract component checkpoints for chart
  function datasetStoreMeasurements(compId: string, comps: any[]) {
    const found = comps.find((c) => c.componentId === compId);
    if (!found) return [];
    return found.availableCheckpoints.map((t: number, idx: number) => ({
      time_h: t,
      dcl_uA: idx === found.availableCheckpoints.length - 1 ? found.currentDcl : found.currentDcl * (t / found.latestTimeH), // rough placement for intermediate if needed
    }));
  }

  const specLimit = activeComp?.specLimit ?? 50.0;

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
            <h1 style={{ fontSize: "2.2rem", margin: 0, fontWeight: 600 }}>Module A — Lot Anomaly Detection</h1>
            <span style={{ background: "#d6f24a22", color: "#d6f24a", border: "1px solid #d6f24a44", padding: "4px 10px", borderRadius: "3px", fontFamily: "IBM Plex Mono", fontSize: "11px" }}>
              POPULATION BEHAVIOR
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setLocation("/module-b")}
            className="button button--dark"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "auto" }}
          >
            Switch to Module B (Drift)
          </button>
        </div>
      </header>

      {/* Hierarchical Dataset, Lot & Component Selector */}
      <DatasetCascadeSelector
        selectedLotId={currentLotId}
        selectedCompId={selectedCompId || undefined}
        onSelectLot={(newLotId) => {
          setSelectedLotId(newLotId);
          setSelectedCompId(null);
        }}
        onSelectComponent={(newCompId) => {
          setSelectedCompId(newCompId);
        }}
        showComponentSelector={true}
      />

      {/* Insufficient Lot Size Warning Callout */}
      {analysis && !analysis.sufficient && (
        <div style={{ background: "#251c1c", border: "1px solid #e57463", padding: "25px", borderRadius: "4px", marginBottom: "30px", display: "flex", gap: "15px", alignItems: "flex-start" }}>
          <AlertTriangle size={28} style={{ color: "#e57463", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: "0 0 8px", color: "#e57463", fontSize: "18px" }}>Insufficient Population for Lot Anomaly Scoring</h3>
            <p style={{ margin: 0, color: "#f6c4ba", fontSize: "14px", lineHeight: "1.5" }}>
              {analysis.message}
            </p>
            <p style={{ margin: "0 0 15px", color: "#a6b2a5", fontSize: "13px", lineHeight: "1.5" }}>
              Note: A single component or small batch cannot independently establish a lot-level baseline (N ≥ 10 required for Isolation Forest & Median/MAD robust scoring). However, you can analyze these components individually in Module B.
            </p>
            {analysis.components && analysis.components.length > 0 && (
              <button
                onClick={() => setLocation(`/module-b?componentId=${analysis.components[0].componentId}`)}
                style={{
                  background: "#1a221d",
                  border: "1px solid #d6f24a66",
                  color: "#d6f24a",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  fontFamily: "IBM Plex Mono",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                Analyze Component {analysis.components[0].componentId} in Module B <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Analysis Views (Only rendered if lot population >= 10) */}
      {analysis && analysis.sufficient && (
        <>
          {/* Summary Stat Banner */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px", marginBottom: "30px" }}>
            <div style={{ background: "#161a18", border: "1px solid #334038", padding: "18px", borderRadius: "4px" }}>
              <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>POPULATION SIZE</span>
              <div style={{ fontSize: "28px", fontWeight: "bold", color: "#edf0e6", margin: "4px 0" }}>{analysis.totalComponentsInLot}</div>
              <span style={{ fontSize: "11px", color: "#68736b" }}>components analyzed</span>
            </div>

            <div style={{ background: "#161a18", border: "1px solid #334038", padding: "18px", borderRadius: "4px" }}>
              <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>FLAGGED ANOMALIES</span>
              <div style={{ fontSize: "28px", fontWeight: "bold", color: analysis.flaggedCount > 0 ? "#e57463" : "#d6f24a", margin: "4px 0" }}>
                {analysis.flaggedCount}
              </div>
              <span style={{ fontSize: "11px", color: "#68736b" }}>
                {analysis.highRiskCount} High Risk, {analysis.reviewCount} Review
              </span>
            </div>

            <div style={{ background: "#161a18", border: "1px solid #334038", padding: "18px", borderRadius: "4px" }}>
              <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>LOT MEDIAN DCL</span>
              <div style={{ fontSize: "28px", fontWeight: "bold", color: "#d6f24a", margin: "4px 0" }}>
                {analysis.lotBaseline?.medianDcl.toFixed(2)} <small style={{ fontSize: "14px" }}>µA</small>
              </div>
              <span style={{ fontSize: "11px", color: "#68736b" }}>robust central tendency</span>
            </div>

            <div style={{ background: "#161a18", border: "1px solid #334038", padding: "18px", borderRadius: "4px" }}>
              <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>LOT DISPERSION (MAD)</span>
              <div style={{ fontSize: "28px", fontWeight: "bold", color: "#e8a253", margin: "4px 0" }}>
                {analysis.lotBaseline?.madDcl.toFixed(3)} <small style={{ fontSize: "14px" }}>µA</small>
              </div>
              <span style={{ fontSize: "11px", color: "#68736b" }}>median absolute deviation</span>
            </div>
          </div>

          {/* Grid Layout: Left Component Table / Right Graph & Data Explanation */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "30px" }}>
            {/* Left: Ranked Component Anomaly Table */}
            <div style={{ background: "#161a18", border: "1px solid #334038", padding: "22px", borderRadius: "4px" }}>
              <h3 style={{ margin: "0 0 15px", fontSize: "18px", display: "flex", alignItems: "center", gap: "10px" }}>
                <Radar size={18} style={{ color: "#d6f24a" }} /> Ranked Component Anomaly List
              </h3>

              <div style={{ maxHeight: "540px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "IBM Plex Mono" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334038", color: "#8a9588", textAlign: "left" }}>
                      <th style={{ padding: "10px 8px" }}>COMPONENT</th>
                      <th style={{ padding: "10px 8px" }}>DCL</th>
                      <th style={{ padding: "10px 8px" }}>ROBUST Z</th>
                      <th style={{ padding: "10px 8px" }}>IF SCORE</th>
                      <th style={{ padding: "10px 8px" }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.components.map((c) => {
                      const isSelected = activeComp?.componentId === c.componentId;
                      const statusColor = c.status === "HIGH RISK" ? "#e57463" : c.status === "REVIEW" ? "#e8a253" : "#d6f24a";
                      return (
                        <tr
                          key={c.componentId}
                          onClick={() => setSelectedCompId(c.componentId)}
                          style={{
                            borderBottom: "1px solid #232d27",
                            background: isSelected ? "#243026" : "transparent",
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                        >
                          <td style={{ padding: "10px 8px", fontWeight: isSelected ? "bold" : "normal", color: isSelected ? "#d6f24a" : "#edf0e6" }}>
                            {c.componentId}
                          </td>
                          <td style={{ padding: "10px 8px" }}>{c.currentDcl.toFixed(2)} µA</td>
                          <td style={{ padding: "10px 8px" }}>{c.robustZScore.toFixed(2)}</td>
                          <td style={{ padding: "10px 8px" }}>{c.isolationForestScore.toFixed(2)}</td>
                          <td style={{ padding: "10px 8px" }}>
                            <span style={{
                              padding: "2px 6px",
                              borderRadius: "2px",
                              fontSize: "10px",
                              background: `${statusColor}22`,
                              color: statusColor,
                              border: `1px solid ${statusColor}44`,
                            }}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Graph & Data-Driven Explanation */}
            <div>
              {/* Interactive Lot Trajectory & Envelope Graph */}
              <div style={{ background: "#161a18", border: "1px solid #334038", padding: "20px", borderRadius: "4px", marginBottom: "25px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px" }}>Lot Trajectory & Baseline Band</h3>
                    <span style={{ color: "#8a9588", fontSize: "11px", fontFamily: "IBM Plex Mono" }}>
                      Selected: {activeComp?.componentId ?? "None"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                      <input type="checkbox" checked={showEnvelope} onChange={(e) => setShowEnvelope(e.target.checked)} />
                      <span>Lot Envelope</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                      <input type="checkbox" checked={showSpecLimit} onChange={(e) => setShowSpecLimit(e.target.checked)} />
                      <span>Spec Limit</span>
                    </label>
                  </div>
                </div>

                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2c3730" />
                      <XAxis dataKey="time_h" stroke="#8a9588" tick={{ fill: "#8a9588", fontSize: 11, fontFamily: "IBM Plex Mono" }} unit="h" />
                      <YAxis stroke="#8a9588" tick={{ fill: "#8a9588", fontSize: 11, fontFamily: "IBM Plex Mono" }} unit=" µA" />
                      <Tooltip contentStyle={{ background: "#1d2420", borderColor: "#526152", color: "#edf0e6", fontFamily: "IBM Plex Mono", fontSize: "11px" }} />
                      <Legend wrapperStyle={{ fontFamily: "IBM Plex Mono", fontSize: "11px" }} />

                      {showSpecLimit && (
                        <ReferenceLine y={specLimit} stroke="#e57463" strokeDasharray="4 4" label={{ value: `LIMIT (${specLimit} µA)`, fill: "#e57463", fontSize: 9 }} />
                      )}

                      {/* Lot Envelope Band (Min to Max) */}
                      {showEnvelope && (
                        <Area type="monotone" dataKey="rangeBand" name="Lot Dispersion Band (Min-Max)" fill="#d6f24a" fillOpacity={0.08} stroke="#d6f24a33" />
                      )}

                      {/* Lot Median Line */}
                      <Line type="monotone" dataKey="median" name="Lot Median" stroke="#8a9588" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />

                      {/* Selected Component Trajectory */}
                      {activeComp && (
                        <Line type="monotone" dataKey="selected_dcl" name={`${activeComp.componentId} Trajectory`} stroke={activeComp.status === "NORMAL" ? "#d6f24a" : "#e57463"} strokeWidth={3} dot={{ r: 5 }} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Data-Driven Explanation Panel */}
              {activeComp && (
                <div style={{ background: "#161a18", border: `1px solid ${activeComp.status === "HIGH RISK" ? "#e57463" : activeComp.status === "REVIEW" ? "#e8a253" : "#334038"}`, padding: "20px", borderRadius: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h4 style={{ margin: 0, fontFamily: "IBM Plex Mono", fontSize: "13px", color: "#8a9588", letterSpacing: "0.08em" }}>
                      DATA-DRIVEN EXPLANATION — {activeComp.componentId}
                    </h4>
                    <span style={{
                      padding: "3px 8px",
                      borderRadius: "2px",
                      fontSize: "10px",
                      fontFamily: "IBM Plex Mono",
                      fontWeight: "bold",
                      background: activeComp.status === "HIGH RISK" ? "#e5746333" : activeComp.status === "REVIEW" ? "#e8a25333" : "#d6f24a22",
                      color: activeComp.status === "HIGH RISK" ? "#e57463" : activeComp.status === "REVIEW" ? "#e8a253" : "#d6f24a",
                    }}>
                      {activeComp.status}
                    </span>
                  </div>

                  <p style={{ fontSize: "13px", color: "#edf0e6", lineHeight: "1.6", margin: "0 0 15px", background: "#1d2420", padding: "15px", borderLeft: "3px solid #d6f24a" }}>
                    {activeComp.explanation}
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#a6b0a2" }}>
                    <div>Robust Z-Score: <strong style={{ color: "#edf0e6" }}>{activeComp.robustZScore.toFixed(2)} MAD</strong></div>
                    <div>Isolation Forest Score: <strong style={{ color: "#edf0e6" }}>{activeComp.isolationForestScore.toFixed(2)}</strong></div>
                    <div>Current DCL: <strong style={{ color: "#edf0e6" }}>{activeComp.currentDcl.toFixed(2)} µA</strong></div>
                    <div>Lot Median DCL: <strong style={{ color: "#edf0e6" }}>{activeComp.lotMedianDcl.toFixed(2)} µA</strong></div>
                    <div>Early Slope: <strong style={{ color: "#edf0e6" }}>{activeComp.earlySlope.toFixed(4)} µA/h</strong></div>
                    <div>Observed Trend: <strong style={{ color: "#edf0e6" }}>{activeComp.observedTrend}</strong></div>
                  </div>

                  <div style={{ marginTop: "15px", paddingTop: "12px", borderTop: "1px solid #334038", display: "flex", gap: "8px", alignItems: "center", fontSize: "11px", color: "#8a9588" }}>
                    <Info size={14} style={{ color: "#d6f24a" }} />
                    <span><strong>Engineering Policy Notice:</strong> Anomaly detection flags statistical divergence from lot baseline behavior. ANOMALY ≠ PHYSICAL FAILURE unless specification limit ({specLimit} µA) is violated.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
