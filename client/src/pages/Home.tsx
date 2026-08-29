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

        <section id="overview" className="hero-section">
          <div className="hero-image" style={{ backgroundImage: `url(${heroImage})` }} />
          <div className="hero-grid" />
          <div className="hero-copy">
            <SectionLabel>EXPLAINABLE SCREENING / 001</SectionLabel>
            <h1>Catch the drift<br /><em>before the payload does.</em></h1>
            <p className="hero-lede">A dynamic screening layer for high-reliability electronics. Find latent defects hiding inside static limits—then show QA exactly why.</p>
            <div className="hero-actions">
              <button className="button button--signal" onClick={() => setLocation("/analysis")} style={{ padding: "14px 28px", fontSize: "15px" }}>
                Open Unified Screening Workbench <ShieldCheck size={18} />
              </button>
              <button className="button button--dark" onClick={() => setLocation("/upload")} style={{ width: "auto" }}>
                Upload Dataset <Upload size={16} />
              </button>
            </div>
          </div>
          <div className="hero-telemetry panel-glass">
            <div className="telemetry-head"><span>LIVE TELEMETRY</span><span className="telemetry-id">RUN_041 / Iddq</span></div>
            <div className="telemetry-main"><strong>45.0</strong><span>µA @ 24H</span><span className="warning-chip"><CircleAlert size={13} /> REVIEW</span></div>
            <div className="mini-chart"><svg viewBox="0 0 360 90" preserveAspectRatio="none"><path d="M0 72 C40 69 54 62 88 65 S130 54 164 55 S210 48 240 42 S290 35 360 20" fill="none" stroke="#d6f24a" strokeWidth="2" /><path d="M0 72 C40 69 54 62 88 65 S130 54 164 55 S210 48 240 42 S290 35 360 20 L360 90 L0 90Z" fill="url(#fill)" opacity=".18" /><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#d6f24a"/><stop offset="1" stopColor="#d6f24a" stopOpacity="0"/></linearGradient></defs></svg></div>
            <SignalStrip compact />
          </div>
          <div className="hero-index">01 <span>/</span> 06</div>
        </section>

        <section className="intro-section section-pad">
          <SignalLedger labels={["STATIC LIMIT", "PEER MEDIAN", "DRIFT"]} />
          <div className="intro-aside"><SectionLabel>THE FAILURE MODE</SectionLabel><div className="giant-number">01<span>/06</span></div></div>
          <div className="intro-body"><h2>Static limits are the floor.<br /><span>Behavior is the signal.</span></h2><p>Traditional ESS asks whether a component is inside the line. Burn-In Sentinel asks whether it is behaving like its peers—and whether its trajectory is quietly changing.</p><div className="callout"><span className="callout-icon"><Crosshair size={18} /></span><div><strong>45 µA can be a failure signal.</strong><p>When a lot’s median is 10 µA, a part at 45 µA is an outlier even when the datasheet ceiling says 50 µA.</p></div></div></div>
        </section>

        <section id="detection" className="dark-section section-pad detection-section">
          <div className="section-head"><div><SectionLabel>THE DETECTION ENGINE</SectionLabel><h2>Two lenses.<br /><em>One safer decision.</em></h2></div><p>Peer-relative anomaly scoring catches what absolute limits miss. Forecasted drift flags risk before the 168-hour checkpoint arrives.</p></div>
          <div className="engine-grid">
            <article className="engine-card engine-card--lime"><div className="card-number">A / 01</div><Radar size={27} /><h3>Dynamic<br />outlier detection</h3><p>Robust lot baselines built from medians and MAD—not averages distorted by the failures we are trying to find.</p><div className="metric-line"><span>PEER SCORE</span><strong>8.4 <small>MAD</small></strong></div><SignalStrip compact /></article>
            <article className="engine-card engine-card--amber"><div className="card-number">B / 02</div><Activity size={27} /><h3>168h drift<br />prediction</h3><p>Use 0h and 24h behavior to forecast the long-term value, including an uncertainty bound for conservative decisions.</p><div className="metric-line"><span>UPPER BOUND</span><strong>51.0 <small>µA</small></strong></div><div className="forecast-bar"><i /><span>50.0 µA QUALIFIED LIMIT</span></div></article>
          </div>
        </section>

        <section id="console" className="console-section section-pad">
          <div className="section-head section-head--dark"><div><SectionLabel>PROTOTYPE / DECISION CONSOLE</SectionLabel><h2>See the evidence<br /><span>behind the flag.</span></h2></div><p>Toggle a sample component state to preview how the system turns raw telemetry into a QA-ready explanation.</p></div>
          <div className="console-grid">
            <div className="console-visual panel-dark"><div className="console-toolbar"><span>COMPONENT / {serverEvidence?.componentId ?? sample.id} / {serverEvidence?.parameterName ?? "Iddq"}</span><span className={`console-state console-state--${sample.accent}`}>{status}</span></div><div className="console-chart"><div className="chart-y"><span>60</span><span>40</span><span>20</span><span>0</span></div><div className="chart-area"><div className="limit-line"><span>{serverEvidence?.qualifiedLimit ? `${serverEvidence.qualifiedLimit} ${serverEvidence.unit} LIMIT` : "50 µA LIMIT"}</span></div><svg viewBox="0 0 560 250" preserveAspectRatio="none"><path d={chartPath} fill="none" stroke="#d6f24a" strokeWidth="3" /><path d={uncertaintyPath} fill="none" stroke="#e59b4c" strokeWidth="1.5" strokeDasharray="5 6" /><circle cx="155" cy={serverEvidence ? Math.max(18, 220 - serverEvidence.value24h * 3.2) : 174} r="5" fill="#d6f24a" /><circle cx="560" cy={serverEvidence ? Math.max(18, 220 - serverEvidence.predicted168h * 3.2) : 84} r="5" fill="#e57463" /></svg><div className="chart-x"><span>0H</span><span>24H</span><span>96H</span><span>168H</span></div></div></div><SignalStrip /></div>
            <div className="console-evidence"><div className="console-tabs" role="tablist" aria-label="Sample decision states">{(["ACCEPT", "HOLD", "REJECT"] as Status[]).map((item) => <button key={item} role="tab" aria-selected={status === item} className={status === item ? "active" : ""} onClick={() => selectSample(item)}>{item}</button>)}</div><div className="evidence-state"><span className={`state-icon state-icon--${sample.accent}`}>{status === "ACCEPT" ? <Check size={22} /> : status === "HOLD" ? <CircleAlert size={22} /> : <X size={22} />}</span><div><span className="micro-label">RECOMMENDED ACTION</span><h3>{status === "ACCEPT" ? "Release to next stage" : status === "HOLD" ? "Route to QA review" : "Reject component"}</h3></div></div><p className="evidence-reason">{sample.reason}. The model has surfaced a signal that static screening would not reliably explain.</p><div className="evidence-list"><div><span>24H MEASUREMENT</span><strong>{serverEvidence ? `${serverEvidence.value24h.toFixed(1)} ${serverEvidence.unit}` : sample.value}</strong></div><div><span>LOT MEDIAN</span><strong>{serverEvidence ? `${serverEvidence.peerMedian24h.toFixed(1)} µA` : "10.2 µA"}</strong></div><div><span>ROBUST DEVIATION</span><strong>{sample.z} MAD</strong></div><div><span>168H FORECAST</span><strong>{serverEvidence ? `${serverEvidence.upper168h.toFixed(1)} µA upper` : sample.forecast}</strong></div></div><button className="button button--dark" onClick={() => toast("Evidence report queued", { description: "A QA-ready report would be generated from the connected dataset." })}>Generate evidence report <ArrowRight size={16} /></button></div>
          </div>
        </section>

        <section id="explainability" className="explain-section section-pad"><SignalLedger labels={["MEASURE", "PEER", "FORECAST", "AUDIT"]} /><div className="explain-copy"><SectionLabel>WHY QA CAN TRUST IT</SectionLabel><h2>No black box.<br /><em>No silent overrides.</em></h2><p>Every flag ships with the measurement, peer comparison, forecast interval, and model version behind it. Uncertainty is displayed—not hidden.</p><div className="explain-points"><div><span>01</span><p><strong>Reason codes</strong> turn model output into an inspection path.</p></div><div><span>02</span><p><strong>Three-way decisions</strong> let uncertainty become a Hold, not a guess.</p></div><div><span>03</span><p><strong>Immutable audit trails</strong> keep every release decision traceable.</p></div></div></div><div className="explain-art"><div className="orbit-radar"><span className="radar-ring radar-ring--one" /><span className="radar-ring radar-ring--two" /><span className="radar-ring radar-ring--three" /><span className="radar-cross radar-cross--h" /><span className="radar-cross radar-cross--v" /><i className="radar-node radar-node--one" /><i className="radar-node radar-node--two" /><i className="radar-node radar-node--three" /><div className="radar-sweep" /></div><div className="orbit-caption"><span className="status-dot" />PREDICTION INTERVAL ACTIVE<div className="orbit-value">51.0 <small>µA UPPER BOUND</small></div></div></div></section>

        <section id="validation" className="metrics-section dark-section section-pad"><div className="section-head"><div><SectionLabel>VALIDATION / SAFETY-WEIGHTED</SectionLabel><h2>Optimize for what<br /><em>must not escape.</em></h2></div><p>Grouped, time-aware validation keeps parts from the same lot out of both train and test. False negatives carry the greater cost.</p></div><div className="metrics-grid"><div className="metric-big"><span>PRIMARY METRIC</span><strong>Recall</strong><p>Defect capture rate</p><div className="metric-rule"><i style={{ width: "94%" }} /></div><small>MAXIMIZE / LOW FALSE NEGATIVE RATE</small></div><div className="metric-big"><span>PREDICTION</span><strong>MAE</strong><p>168h forecast accuracy</p><div className="metric-rule"><i style={{ width: "76%" }} /></div><small>REPORT BY PARAMETER + LOT</small></div><div className="metric-big"><span>TRUST</span><strong>Coverage</strong><p>Upper-bound calibration</p><div className="metric-rule"><i style={{ width: "88%" }} /></div><small>UNCERTAINTY MUST BE HONEST</small></div></div></section>

        <section id="roadmap" className="roadmap-section section-pad"><SignalLedger labels={["01", "02", "03", "04"]} /><div className="section-head section-head--dark"><div><SectionLabel>IMPLEMENTATION ROADMAP</SectionLabel><h2>From shadow mode<br /><span>to safer release.</span></h2></div><p>Start with one parameter. Prove the behavior. Expand only when the evidence is ready.</p></div><div className="roadmap-list">{[["01", "Data + baseline", "Normalize units, define peer groups, and establish robust static-plus-dynamic baseline scoring.", Gauge], ["02", "Drift model", "Train a transparent 168-hour predictor with calibrated upper bounds and safety-slope thresholds.", GitBranch], ["03", "QA console", "Fuse signals into Accept, Hold, Reject and give every outcome a reason code.", ShieldCheck], ["04", "Blind pilot", "Run in shadow mode against held-out lots before changing any release decision.", Sparkles]].map(([num, title, copy, Icon]) => <div className="roadmap-row" key={num as string}><span className="roadmap-num">{num as string}</span><Icon size={20} /><div><h3>{title as string}</h3><p>{copy as string}</p></div><ChevronRight size={18} /></div>)}</div></section>

        <footer className="footer"><div className="footer-brand"><img src={markImage} alt="" /><div><strong>Burn-In Sentinel</strong><span>EXPLAINABLE RELIABILITY SIGNALS</span></div></div><span>Prototype concept / v0.9.4</span><button onClick={() => scrollTo("overview")}>BACK TO TOP ↑</button></footer>
      </main>
    </div>
  );
}
