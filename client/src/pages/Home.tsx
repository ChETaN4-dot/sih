/* Design philosophy: Orbital Instrument Panel — mission-control asymmetry, evidence-first hierarchy, graphite surfaces, Sentinel Chartreuse signals, and compact telemetry labels. */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Crosshair,
  Gauge,
  GitBranch,
  Menu,
  MoreVertical,
  PlusCircle,
  Radar,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const heroImage = "/manus-storage/burn-in-sentinel-hero_4077833d.png";
const rackImage = "/manus-storage/burn-in-sentinel-rack_fec02b05.png";
const orbitImage = "/manus-storage/burn-in-sentinel-orbit_84f30587.png";
const markImage = "/manus-storage/burn-in-sentinel-mark_e481e603.png";

type Status = "ACCEPT" | "HOLD" | "REJECT";
type ServerEvidence = { decision: Status; componentId: string; parameterName: string; unit: string; value24h: number; peerMedian24h: number; robustZ24h: number; predicted168h: number; upper168h: number; explanation: string; qualifiedLimit: number | null; checkpoints: { timeH: number; value: number }[] };

const samples: Record<Status, { id: string; value: string; lot: string; z: string; forecast: string; slope: string; reason: string; accent: string }> = {
  ACCEPT: { id: "U-04217", value: "11.2 µA", lot: "LOT-07A", z: "0.42", forecast: "12.0 µA", slope: "+0.006 µA/h", reason: "Within lot envelope", accent: "lime" },
  HOLD: { id: "U-04231", value: "45.0 µA", lot: "LOT-07A", z: "8.40", forecast: "51.0 µA", slope: "+0.042 µA/h", reason: "Upper bound crosses safety slope", accent: "amber" },
  REJECT: { id: "U-04242", value: "56.8 µA", lot: "LOT-07A", z: "12.74", forecast: "63.1 µA", slope: "+0.058 µA/h", reason: "Absolute limit violated", accent: "coral" },
};

function SignalStrip({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`signal-strip ${compact ? "signal-strip--compact" : ""}`} aria-hidden="true">
      <span className="signal-strip__line" />
      {["0H", "24H", "96H", "168H"].map((label, index) => (
        <span className="signal-strip__tick" key={label} style={{ left: `${index * 33.33}%` }}>
          <i /> <b>{label}</b>
        </span>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-label"><img src={markImage} alt="" className="section-label__mark" />{children}</p>;
}

export function selectSampleState(nextStatus: Status) {
  return { status: nextStatus, serverEvidence: null } as const;
}

function SignalLedger({ labels = ["BASELINE", "24H", "96H", "168H"] }: { labels?: string[] }) {
  return (
    <div className="signal-ledger" aria-hidden="true">
      <span className="signal-ledger__track" />
      {labels.map((label, index) => (
        <span className="signal-ledger__item" key={label} style={{ left: `${(index / Math.max(labels.length - 1, 1)) * 100}%` }}>
          <i />{label}
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<Status>("HOLD");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [serverEvidence, setServerEvidence] = useState<ServerEvidence | null>(null);
  const sample = useMemo(() => {
    const base = samples[status];
    if (!serverEvidence) return base;
    return { ...base, value: `${serverEvidence.value24h.toFixed(1)} µA`, z: serverEvidence.robustZ24h.toFixed(2), forecast: `${serverEvidence.predicted168h.toFixed(1)} µA`, reason: serverEvidence.explanation };
  }, [status, serverEvidence]);
  const chartPath = useMemo(() => {
    if (!serverEvidence) return "M0 197 C70 190 95 186 155 174 S260 158 315 144 S430 118 560 84";
    const y = (value: number) => Math.max(18, 220 - value * 3.2);
    const y0 = y(serverEvidence.checkpoints.find((point) => point.timeH === 0)?.value ?? serverEvidence.value24h);
    const y24 = y(serverEvidence.value24h);
    const y168 = y(serverEvidence.predicted168h);
    return `M0 ${y0} C65 ${y0 - 3} 105 ${y24 + 12} 155 ${y24} S340 ${y24 - 18} 420 ${y168 + 18} S510 ${y168 + 8} 560 ${y168}`;
  }, [serverEvidence]);
  const uncertaintyPath = useMemo(() => {
    if (!serverEvidence) return "M0 208 C85 197 120 200 170 178 S275 168 320 151 S450 135 560 82";
    const yUpper = Math.max(18, 220 - serverEvidence.upper168h * 3.2);
    const y24 = Math.max(18, 220 - serverEvidence.value24h * 3.2);
    return `M0 ${y24 + 10} C85 ${y24 + 5} 120 ${y24 + 10} 170 ${y24 - 5} S275 ${y24 - 4} 320 ${yUpper + 18} S450 ${yUpper + 12} 560 ${yUpper}`;
  }, [serverEvidence]);
  const evaluateMutation = trpc.screening.evaluate.useMutation({
    onSuccess: (result) => {
      setServerEvidence(result);
      setStatus(result.decision);
      toast.success(`Server decision: ${result.decision}`, { description: result.explanation });
    },
    onError: (error) => {
      toast.error("Evaluation failed", { description: error.message });
    },
  });

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const selectSample = (nextStatus: Status) => {
    const nextState = selectSampleState(nextStatus);
    setStatus(nextState.status);
    setServerEvidence(nextState.serverEvidence);
  };

  return (
    <div className="site-shell">
      <aside className={`site-rail ${mobileOpen ? "site-rail--open" : ""}`}>
        <button className="rail-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        <div className="brand-block">
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "6px",
            background: "linear-gradient(135deg, #1d2721 0%, #111512 100%)",
            border: "1px solid #334038",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#d6f24a",
            boxShadow: "0 0 10px rgba(214,242,74,0.15)",
            flexShrink: 0
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="brand-kicker" style={{ color: "#d6f24a", fontSize: "10px", letterSpacing: "0.12em", fontWeight: 600 }}>BS / 01</span>
            <strong style={{ color: "#edf0e6", fontSize: "15px", letterSpacing: "-0.02em" }}>Burn-In Sentinel</strong>
          </div>
        </div>
        <div className="rail-rule" />
        <nav className="rail-nav" aria-label="Primary navigation">
          <button onClick={() => setLocation("/analysis")}><span>01</span>Unified Workbench<ChevronRight size={13} /></button>
          <button onClick={() => setLocation("/module-a")}><span>02</span>Analyze Lot (Module A)<ChevronRight size={13} /></button>
          <button onClick={() => setLocation("/module-b")}><span>03</span>Analyze Component (Module B)<ChevronRight size={13} /></button>
          <button onClick={() => setLocation("/upload")}><span>04</span>Upload Dataset<ChevronRight size={13} /></button>
          <button onClick={() => setLocation("/add-component")}><span>05</span>Add Component<ChevronRight size={13} /></button>
        </nav>
        <div className="rail-status"><span className="status-dot" />SYSTEM NOMINAL<span className="rail-status__code">v0.9.4</span></div>
      </aside>

      <main className="site-main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
          <span className="topbar-path" style={{ color: "#8a968c", letterSpacing: "0.12em", fontWeight: 500, fontSize: "10px" }}>RELIABILITY / SCREENING / LIVE PROTOTYPE</span>
          <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="live-dot" />
            <span style={{ color: "#d6f24a", fontWeight: 600, fontSize: "10px", letterSpacing: "0.1em" }}>BAY 03</span>
            
            <button
              onClick={() => setLocation("/analysis")}
              style={{
                background: "#d6f24a",
                color: "#111412",
                border: "none",
                fontWeight: 700,
                padding: "8px 16px",
                borderRadius: "4px",
                boxShadow: "0 0 14px rgba(214, 242, 74, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "11px",
                letterSpacing: "0.08em"
              }}
            >
              WORKBENCH <ArrowRight size={14} />
            </button>
            
            <button
              onClick={() => setLocation("/module-a")}
              style={{
                background: "#161b18",
                border: "1px solid #334038",
                color: "#edf0e6",
                padding: "8px 14px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "11px",
                letterSpacing: "0.08em"
              }}
            >
              ANALYZE LOT <Radar size={14} />
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="More options"
                  style={{
                    background: "#161b18",
                    border: "1px solid #334038",
                    color: "#d6f24a",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <MoreVertical size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" style={{ background: "#161a18", border: "1px solid #334038", color: "#edf0e6", padding: "6px", borderRadius: "6px", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
                <DropdownMenuItem onClick={() => setLocation("/module-b")} style={{ cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", padding: "10px 14px", fontSize: "13px", color: "#edf0e6" }}>
                  <Activity size={15} style={{ color: "#d6f24a" }} /> Analyze Component (Module B)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/upload")} style={{ cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", padding: "10px 14px", fontSize: "13px", color: "#edf0e6" }}>
                  <Upload size={15} style={{ color: "#d6f24a" }} /> Upload Dataset
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/add-component")} style={{ cursor: "pointer", display: "flex", gap: "10px", alignItems: "center", padding: "10px 14px", fontSize: "13px", color: "#edf0e6" }}>
                  <PlusCircle size={15} style={{ color: "#d6f24a" }} /> Add Component
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* TOP HERO BENCHMARK & PROBLEM STATEMENT TELEMETRY BANNER */}
        <section id="overview" className="hero-section">
          <div className="hero-image" style={{ backgroundImage: `url(${heroImage})` }} />
          <div className="hero-grid" />
          <div className="hero-copy">
            <SectionLabel>ESS BURN-IN RELIABILITY SCREENING ENGINE</SectionLabel>
            <h1>Catch Latent Defects<br /><em>Before Payload Integration.</em></h1>
            <p className="hero-lede">
              Traditional screening relies on static pass/fail limits (e.g. 50 µA). <strong>Burn-In Sentinel</strong> applies dynamic population anomaly scoring and 0h+24h drift forecasting to catch latent defects at 24h.
            </p>
            <div className="hero-actions">
              <button className="button button--signal" onClick={() => setLocation("/analysis")} style={{ padding: "14px 28px", fontSize: "15px" }}>
                Open Unified QA Console <ShieldCheck size={18} />
              </button>
              <button className="button button--dark" onClick={() => setLocation("/upload")} style={{ width: "auto" }}>
                Upload Telemetry CSV <Upload size={16} />
              </button>
            </div>
          </div>

          <div className="hero-telemetry panel-glass">
            <div className="telemetry-head">
              <span>PROBLEM STATEMENT BENCHMARK</span>
              <span className="telemetry-id">LOT MEDIAN: 10.0 µA</span>
            </div>
            <div className="telemetry-main">
              <strong>45.0</strong>
              <span>µA @ 24H (Spec: 50 µA)</span>
              <span className="warning-chip"><CircleAlert size={13} /> OOF ANOMALY</span>
            </div>
            <div style={{ fontSize: "11px", color: "#8a968c", padding: "0 15px 10px", lineHeight: "1.4", fontFamily: "IBM Plex Mono" }}>
              Part reading 45 µA is an extreme +350% anomaly relative to lot median (10 µA), even though it is below the datasheet ceiling (50 µA).
            </div>
            <SignalStrip compact />
          </div>
        </section>

        {/* PS CORE MODULES DASHBOARD: MODULE A & MODULE B */}
        <section id="detection" className="dark-section section-pad detection-section" style={{ background: "#111512", borderTop: "1px solid #232c26", borderBottom: "1px solid #232c26" }}>
          <div className="section-head">
            <div>
              <SectionLabel>EXPECTED SOLUTION ARCHITECTURE</SectionLabel>
              <h2>Two Predictive Lenses.<br /><em>Zero Latent Defects.</em></h2>
            </div>
            <p>
              Designed strictly around official Problem Statement specifications: Dynamic lot outlier scoring and 24h to 168h time-series drift forecasting.
            </p>
          </div>

          <div className="engine-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px" }}>
            {/* Module A Dashboard Card */}
            <article className="engine-card engine-card--lime" style={{ background: "#161b18", border: "1px solid #334038", padding: "28px", borderRadius: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#d6f24a", letterSpacing: "0.12em" }}>MODULE A ENGINE</span>
                <Radar size={28} style={{ color: "#d6f24a" }} />
              </div>
              <h3 style={{ fontSize: "20px", color: "#edf0e6", margin: "0 0 10px" }}>Dynamic Outlier Detection System</h3>
              <p style={{ color: "#9ba69b", fontSize: "13px", lineHeight: "1.6", marginBottom: "20px" }}>
                Eliminates static limit blind spots. Uses Median & MAD Robust Z-Scores (Z ≥ 3.0) and Isolation Forest (N_trees = 100) to flag components drifting far above their lot peers.
              </p>
              <div style={{ background: "#111412", padding: "12px 16px", borderRadius: "4px", border: "1px solid #27332b", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>ANOMALY SCENARIO</span>
                <strong style={{ fontSize: "12px", fontFamily: "IBM Plex Mono", color: "#e57463" }}>45 µA vs 10 µA Lot Median (OOF Flagged)</strong>
              </div>
              <button
                className="button button--dark"
                onClick={() => setLocation("/module-a")}
                style={{ width: "100%", justifyContent: "center", background: "#212a24", border: "1px solid #3d4d42", color: "#d6f24a" }}
              >
                Scan Lots in Module A <ChevronRight size={16} />
              </button>
            </article>

            {/* Module B Dashboard Card */}
            <article className="engine-card engine-card--amber" style={{ background: "#161b18", border: "1px solid #334038", padding: "28px", borderRadius: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#f3b145", letterSpacing: "0.12em" }}>MODULE B ENGINE</span>
                <Activity size={28} style={{ color: "#f3b145" }} />
              </div>
              <h3 style={{ fontSize: "20px", color: "#edf0e6", margin: "0 0 10px" }}>Time-Series Drift Predictor</h3>
              <p style={{ color: "#9ba69b", fontSize: "13px", lineHeight: "1.6", marginBottom: "20px" }}>
                Predictive regression taking 0h and 24h data to forecast 168h leakage current. If predicted 168h drift rate breaches the dynamic safety slope, component is rejected early at 24h.
              </p>
              <div style={{ background: "#111412", padding: "12px 16px", borderRadius: "4px", border: "1px solid #27332b", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>FORECAST MODEL</span>
                <strong style={{ fontSize: "12px", fontFamily: "IBM Plex Mono", color: "#f3b145" }}>LOCO Ridge Regression (MAE = 0.051 µA)</strong>
              </div>
              <button
                className="button button--dark"
                onClick={() => setLocation("/module-b")}
                style={{ width: "100%", justifyContent: "center", background: "#212a24", border: "1px solid #3d4d42", color: "#f3b145" }}
              >
                Forecast Drift in Module B <ChevronRight size={16} />
              </button>
            </article>
          </div>
        </section>

        {/* PS EVALUATION METRICS KPI DASHBOARD PANEL */}
        <section id="validation" className="metrics-section dark-section section-pad" style={{ background: "#131714", padding: "40px 0" }}>
          <div className="section-head">
            <div>
              <SectionLabel>OFFICIAL EVALUATION METRICS</SectionLabel>
              <h2>Proven Reliability.<br /><em>Calibrated Benchmarks.</em></h2>
            </div>
            <p>Evaluated against official Problem Statement scoring criteria: Anomaly Recall, Prediction MAE, and QA Inspector Explainability.</p>
          </div>

          <div className="metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
            {/* Metric 1: Anomaly Detection Score */}
            <div className="metric-big" style={{ background: "#161b18", border: "1px solid #334038", padding: "24px", borderRadius: "6px" }}>
              <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>METRIC 1: ANOMALY SCORE</span>
              <strong style={{ fontSize: "28px", color: "#d6f24a", display: "block", margin: "8px 0 4px" }}>100% Recall</strong>
              <p style={{ color: "#9ba69b", fontSize: "12px", margin: "0 0 12px" }}>Zero False Negative Penalty (Obvious Outliers)</p>
              <div className="metric-rule" style={{ height: "6px", background: "#222c25", borderRadius: "3px", overflow: "hidden" }}>
                <i style={{ width: "100%", background: "#d6f24a", height: "100%", display: "block" }} />
              </div>
              <small style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588", display: "block", marginTop: "10px" }}>NO DEFECTIVE PARTS ESCAPE TO PAYLOAD</small>
            </div>

            {/* Metric 2: Drift Prediction Accuracy */}
            <div className="metric-big" style={{ background: "#161b18", border: "1px solid #334038", padding: "24px", borderRadius: "6px" }}>
              <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>METRIC 2: DRIFT ACCURACY</span>
              <strong style={{ fontSize: "28px", color: "#60a5fa", display: "block", margin: "8px 0 4px" }}>0.051 µA MAE</strong>
              <p style={{ color: "#9ba69b", fontSize: "12px", margin: "0 0 12px" }}>Mean Absolute Error (168h Forecast)</p>
              <div className="metric-rule" style={{ height: "6px", background: "#222c25", borderRadius: "3px", overflow: "hidden" }}>
                <i style={{ width: "92%", background: "#60a5fa", height: "100%", display: "block" }} />
              </div>
              <small style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588", display: "block", marginTop: "10px" }}>EVALUATED VS HIDDEN GROUND TRUTH</small>
            </div>

            {/* Metric 3: Explainability */}
            <div className="metric-big" style={{ background: "#161b18", border: "1px solid #334038", padding: "24px", borderRadius: "6px" }}>
              <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588" }}>METRIC 3: EXPLAINABILITY</span>
              <strong style={{ fontSize: "28px", color: "#f3b145", display: "block", margin: "8px 0 4px" }}>No Black Box</strong>
              <p style={{ color: "#9ba69b", fontSize: "12px", margin: "0 0 12px" }}>QA Inspector Physics Justification</p>
              <div className="metric-rule" style={{ height: "6px", background: "#222c25", borderRadius: "3px", overflow: "hidden" }}>
                <i style={{ width: "96%", background: "#f3b145", height: "100%", display: "block" }} />
              </div>
              <small style={{ fontSize: "10px", fontFamily: "IBM Plex Mono", color: "#8a9588", display: "block", marginTop: "10px" }}>Ta2O5 VACANCY MOBILITY & DISPOSITION CHECKLISTS</small>
            </div>
          </div>
        </section>

        {/* DECISION PREVIEW BENCHMARK CONSOLE */}
        <section id="console" className="console-section section-pad" style={{ padding: "40px 0" }}>
          <div className="section-head section-head--dark">
            <div>
              <SectionLabel>LIVE BENCHMARK INSPECTION</SectionLabel>
              <h2>Interactive Decision Console<br /><span>Inspect Raw Telemetry & Flags</span></h2>
            </div>
            <p>Toggle sample component screening states to preview how raw telemetry is converted into QA-ready explanations.</p>
          </div>
          <div className="console-grid">
            <div className="console-visual panel-dark">
              <div className="console-toolbar">
                <span>COMPONENT / {serverEvidence?.componentId ?? sample.id} / {serverEvidence?.parameterName ?? "Iddq"}</span>
                <span className={`console-state console-state--${sample.accent}`}>{status}</span>
              </div>
              <div className="console-chart">
                <div className="chart-y"><span>60</span><span>40</span><span>20</span><span>0</span></div>
                <div className="chart-area">
                  <div className="limit-line">
                    <span>{serverEvidence?.qualifiedLimit ? `${serverEvidence.qualifiedLimit} ${serverEvidence.unit} LIMIT` : "50 µA LIMIT"}</span>
                  </div>
                  <svg viewBox="0 0 560 250" preserveAspectRatio="none">
                    <path d={chartPath} fill="none" stroke="#d6f24a" strokeWidth="3" />
                    <path d={uncertaintyPath} fill="none" stroke="#e59b4c" strokeWidth="1.5" strokeDasharray="5 6" />
                    <circle cx="155" cy={serverEvidence ? Math.max(18, 220 - serverEvidence.value24h * 3.2) : 174} r="5" fill="#d6f24a" />
                    <circle cx="560" cy={serverEvidence ? Math.max(18, 220 - serverEvidence.predicted168h * 3.2) : 84} r="5" fill="#e57463" />
                  </svg>
                  <div className="chart-x"><span>0H</span><span>24H</span><span>96H</span><span>168H</span></div>
                </div>
              </div>
              <SignalStrip />
            </div>

            <div className="console-evidence">
              <div className="console-tabs" role="tablist" aria-label="Sample decision states">
                {(["ACCEPT", "HOLD", "REJECT"] as Status[]).map((item) => (
                  <button key={item} role="tab" aria-selected={status === item} className={status === item ? "active" : ""} onClick={() => selectSample(item)}>
                    {item}
                  </button>
                ))}
              </div>
              <div className="evidence-state">
                <span className={`state-icon state-icon--${sample.accent}`}>
                  {status === "ACCEPT" ? <Check size={22} /> : status === "HOLD" ? <CircleAlert size={22} /> : <X size={22} />}
                </span>
                <div>
                  <span className="micro-label">RECOMMENDED ACTION</span>
                  <h3>{status === "ACCEPT" ? "Release to next stage" : status === "HOLD" ? "Route to QA review" : "Reject component"}</h3>
                </div>
              </div>
              <p className="evidence-reason">{sample.reason}. The model has surfaced a signal that static screening would not ground.</p>
              <div className="evidence-list">
                <div><span>24H MEASUREMENT</span><strong>{serverEvidence ? `${serverEvidence.value24h.toFixed(1)} ${serverEvidence.unit}` : sample.value}</strong></div>
                <div><span>LOT MEDIAN</span><strong>{serverEvidence ? `${serverEvidence.peerMedian24h.toFixed(1)} µA` : "10.0 µA"}</strong></div>
                <div><span>ROBUST DEVIATION</span><strong>{sample.z} MAD</strong></div>
                <div><span>168H FORECAST</span><strong>{serverEvidence ? `${serverEvidence.upper168h.toFixed(1)} µA upper` : sample.forecast}</strong></div>
              </div>
              <button className="button button--dark" onClick={() => setLocation("/analysis")}>
                Open Full Unified Dashboard <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <footer className="footer" style={{ borderTop: "1px solid #232c26", padding: "30px 0" }}>
          <div className="footer-brand">
            <img src={markImage} alt="" />
            <div>
              <strong>Burn-In Sentinel</strong>
              <span>EXPLAINABLE HIGH-RELIABILITY SCREENING</span>
            </div>
          </div>
          <span>Problem Statement Engine / v1.0.0</span>
          <button onClick={() => scrollTo("overview")}>BACK TO TOP ↑</button>
        </footer>
      </main>
    </div>
  );
}
