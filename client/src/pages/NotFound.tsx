/* Design philosophy: Orbital Instrument Panel — even error states use graphite/bone surfaces, Sentinel Chartreuse signal accents, mono telemetry labels, and test-bay language. */
import { ArrowLeft, Radio, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";

const markImage = "/manus-storage/burn-in-sentinel-mark_e481e603.png";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <main className="lost-signal-page">
      <div className="lost-signal-grid" />
      <header className="lost-signal-head"><div className="footer-brand"><img src={markImage} alt="" /><div><strong>Burn-In Sentinel</strong><span>EXPLAINABLE RELIABILITY SIGNALS</span></div></div><span className="lost-code">ROUTE MONITOR / OFF-NOMINAL</span></header>
      <section className="lost-signal-card">
        <div className="lost-signal-visual"><div className="lost-ring lost-ring--one" /><div className="lost-ring lost-ring--two" /><Radio size={33} /><span className="lost-cross lost-cross--h" /><span className="lost-cross lost-cross--v" /></div>
        <div className="lost-copy"><p className="section-label"><img src={markImage} alt="" className="section-label__mark" />SIGNAL OUTSIDE THE ENVELOPE</p><div className="lost-number">404</div><h1>Route not in<br /><em>the test bay.</em></h1><p>This path returned no trace. The page may have moved, or the signal was never commissioned.</p><div className="lost-actions"><button className="button button--signal" onClick={() => setLocation("/")}><ArrowLeft size={16} />Return to console</button><button className="lost-retry" onClick={() => window.location.reload()}><RotateCcw size={15} />Retry signal</button></div></div>
      </section>
      <footer className="lost-footer"><span><i className="status-dot" /> SYSTEM NOMINAL / DATA LINK OPEN</span><span>ERR_ROUTE_404 / v0.9.4</span></footer>
    </main>
  );
}
