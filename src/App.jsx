import { useState, useEffect } from 'react';
import QuickAnalyzer from './components/QuickAnalyzer.jsx';

export default function ForensicWebsite() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [serviceStatus, setServiceStatus] = useState({
    state: 'checking', // 'checking' | 'online' | 'offline'
    modules: 44,
    version: null,
    latencyMs: null,
    lastChecked: null,
  });

  const [refreshIndex, setRefreshIndex] = useState(0);

  const handleManualRefresh = () => {
    setServiceStatus((prev) => ({ ...prev, state: 'checking' }));
    setRefreshIndex((i) => i + 1);
  };

  useEffect(() => {
    let ignore = false;

    async function verifyHealth() {
      const startTime = performance.now();
      const endpoints = [
        'https://pixel.forensic.dpdns.org/api/health',
        '/api/health',
      ];

      for (const url of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (data.status === 'ok' && !ignore) {
              const latencyMs = Math.round(performance.now() - startTime);
              setServiceStatus({
                state: 'online',
                modules: data.modules || 44,
                version: data.version || '1.0.0',
                latencyMs,
                lastChecked: new Date(),
              });
              return;
            }
          }
        } catch {
          // Fallback to next endpoint
        }
      }

      if (!ignore) {
        setServiceStatus({
          state: 'offline',
          modules: null,
          version: null,
          latencyMs: null,
          lastChecked: new Date(),
        });
      }
    }

    verifyHealth();
    const interval = setInterval(verifyHealth, 60000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [refreshIndex]);

  const features = [
    'Error Level Analysis (ELA)',
    'Metadata Inspection',
    'Compression Artefact Detection',
    'Clone & Tamper Analysis',
    'Pixel-Level Investigation',
    'Forensic Report Export'
  ];

  const methodology = [
    {
      title: 'Error Level Analysis (ELA)',
      desc: 'ELA works by intentionally saving the image at a known error rate (such as 90% JPEG quality) and computing the difference against the original. Areas that have been digitally altered will display significantly different compression potentials compared to untouched regions.',
    },
    {
      title: 'Metadata & Provenance Integrity',
      desc: 'Digital photos store exchangeable image file format (EXIF) headers including device serials, camera settings, software signatures, and GPS coordinates. Tampering or editing frequently leaves inconsistent timestamp chains or editing suite signatures.',
    },
    {
      title: 'Zero-Knowledge Privacy',
      desc: 'All preliminary evaluations conducted in our quick inspector run entirely within your local browser sandbox via the HTML5 Canvas API. No images, telemetry, or file payloads are transferred over the wire during quick analysis.',
    },
  ];

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-cyan-500 selection:text-black">
      {/* Sticky Header Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/85 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400 shrink-0" />
            <a href="#" className="font-bold tracking-tight text-base sm:text-lg hover:text-cyan-400 transition truncate">
              forensic<span className="text-cyan-400">.dpdns.org</span>
            </a>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <button
              onClick={() => scrollToSection('quick-analyzer')}
              className="hover:text-cyan-400 transition cursor-pointer"
            >
              Quick Inspector
            </button>
            <button
              onClick={() => scrollToSection('current-service')}
              className="hover:text-cyan-400 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>Services</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  serviceStatus.state === 'online'
                    ? 'bg-emerald-400'
                    : serviceStatus.state === 'checking'
                    ? 'bg-cyan-400 animate-ping'
                    : 'bg-rose-500'
                }`}
              />
            </button>
            <button
              onClick={() => scrollToSection('capabilities')}
              className="hover:text-cyan-400 transition cursor-pointer"
            >
              Capabilities
            </button>
            <button
              onClick={() => scrollToSection('methodology')}
              className="hover:text-cyan-400 transition cursor-pointer"
            >
              Methodology
            </button>
          </nav>

          {/* Desktop & Mobile Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://github.com/Abhrankan-Chakrabarti/forensic-website"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on GitHub"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition text-xs flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <a
              href="https://pixel.forensic.dpdns.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs px-3.5 py-2 rounded-xl transition duration-200 shadow-sm shadow-cyan-500/20 shrink-0"
            >
              Workbench ↗
            </a>

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white bg-slate-900 border border-slate-800 transition"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-xl px-4 py-4 space-y-2">
            <button
              onClick={() => scrollToSection('quick-analyzer')}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-cyan-400 hover:bg-slate-900 transition flex items-center justify-between"
            >
              <span>Quick Inspector</span>
              <span className="text-xs text-slate-500">In-Browser ELA</span>
            </button>
            <button
              onClick={() => scrollToSection('current-service')}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-cyan-400 hover:bg-slate-900 transition flex items-center justify-between"
            >
              <span>Platform Services</span>
              <span
                className={`text-xs font-semibold ${
                  serviceStatus.state === 'online'
                    ? 'text-emerald-400'
                    : serviceStatus.state === 'checking'
                    ? 'text-cyan-400'
                    : 'text-rose-400'
                }`}
              >
                {serviceStatus.state === 'online'
                  ? `Online (${serviceStatus.modules} mods)`
                  : serviceStatus.state === 'checking'
                  ? 'Checking...'
                  : 'Offline'}
              </span>
            </button>
            <button
              onClick={() => scrollToSection('capabilities')}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-cyan-400 hover:bg-slate-900 transition"
            >
              Capabilities & Specs
            </button>
            <button
              onClick={() => scrollToSection('methodology')}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-cyan-400 hover:bg-slate-900 transition"
            >
              Methodology & Privacy
            </button>
            <div className="pt-2">
              <a
                href="https://pixel.forensic.dpdns.org"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-sm px-4 py-3 rounded-xl transition shadow-md shadow-cyan-500/20"
              >
                Launch Pixel Forensics Workbench ↗
              </a>
            </div>
          </div>
        )}
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Hero Section */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-block px-3.5 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-4 text-xs sm:text-sm font-medium">
            forensic.dpdns.org
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4 leading-tight">
            Digital Image Forensics Platform
          </h1>
          <p className="text-slate-400 max-w-3xl mx-auto text-sm sm:text-base md:text-lg leading-relaxed px-2">
            Professional image authenticity verification, manipulation detection,
            and forensic analysis for investigators, journalists, researchers,
            and security professionals.
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap justify-center items-stretch sm:items-center gap-3 sm:gap-4 mt-8 w-full max-w-xl mx-auto">
            <a
              href="https://pixel.forensic.dpdns.org"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-6 py-3 rounded-2xl transition duration-200 shadow-lg shadow-cyan-500/20 text-center text-sm sm:text-base"
            >
              Launch Pixel Forensics ↗
            </a>
            <button
              onClick={() => scrollToSection('quick-analyzer')}
              className="bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 font-medium px-6 py-3 rounded-2xl transition duration-200 cursor-pointer text-center text-sm sm:text-base"
            >
              Try In-Browser Analyzer ↓
            </button>
            <button
              onClick={() => scrollToSection('capabilities')}
              className="border border-slate-700 hover:border-slate-500 hover:bg-slate-900 text-slate-200 px-6 py-3 rounded-2xl transition duration-200 cursor-pointer text-center text-sm sm:text-base"
            >
              Capabilities & Specs
            </button>
          </div>
        </div>

        {/* Feature Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-16">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 font-bold text-sm">
              01
            </div>
            <h3 className="text-cyan-400 text-lg sm:text-xl font-semibold mb-2">Image Analysis</h3>
            <p className="text-slate-400 leading-relaxed text-xs sm:text-sm">
              Upload and analyse images for traces of editing, manipulation,
              recompression anomalies, and localized tampering.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 font-bold text-sm">
              02
            </div>
            <h3 className="text-cyan-400 text-lg sm:text-xl font-semibold mb-2">Metadata Inspection</h3>
            <p className="text-slate-400 leading-relaxed text-xs sm:text-sm">
              Review EXIF metadata, timestamps, camera profiles, color space parameters,
              and embedded hardware properties.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 font-bold text-sm">
              03
            </div>
            <h3 className="text-cyan-400 text-lg sm:text-xl font-semibold mb-2">Evidence Support</h3>
            <p className="text-slate-400 leading-relaxed text-xs sm:text-sm">
              Generate structured forensic findings, audit logs, and analytical reports
              for investigative, journalistic, and legal workflows.
            </p>
          </div>
        </div>

        {/* Interactive In-Browser Tool */}
        <QuickAnalyzer />

        {/* Current Service Banner */}
        <div id="current-service" className="bg-slate-900/80 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 mb-12 sm:mb-16 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold">Current Service</h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-mono">
                {serviceStatus.lastChecked
                  ? `Health verified: ${serviceStatus.lastChecked.toLocaleTimeString()}`
                  : 'Verifying /api/health...'}
              </span>
              <button
                onClick={handleManualRefresh}
                title="Re-check health endpoint"
                className="text-xs text-slate-400 hover:text-cyan-400 transition cursor-pointer bg-slate-950/60 border border-slate-800 rounded px-2 py-0.5"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl sm:rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                {serviceStatus.state === 'online' ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                      Online & Operational
                    </span>
                    {serviceStatus.latencyMs !== null && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({serviceStatus.latencyMs}ms)
                      </span>
                    )}
                  </>
                ) : serviceStatus.state === 'checking' ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                      Checking /api/health...
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
                      Service Unreachable / Offline
                    </span>
                  </>
                )}
              </div>

              <h3 className="text-xl sm:text-2xl text-cyan-400 font-semibold break-all sm:break-normal">
                pixel.forensic.dpdns.org
              </h3>
              <p className="text-slate-400 mt-2 max-w-2xl leading-relaxed text-xs sm:text-sm">
                Dedicated image forensics portal providing high-resolution pixel-level examination,
                manipulation analysis, clone detection, and authenticity verification.
              </p>

              {/* Dynamic Health Telemetry Badges */}
              {serviceStatus.state === 'online' && (
                <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px]">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium">
                    ✓ {serviceStatus.modules} Analysis Modules Verified
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 font-mono">
                    Workbench v{serviceStatus.version}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-400">
                    Live EC2 Graviton2 (ARM64)
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
              <a
                href="https://pixel.forensic.dpdns.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 w-full text-center shadow-md shadow-cyan-500/10"
              >
                Open Service Portal ↗
              </a>
              <a
                href="https://pixel.forensic.dpdns.org/api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center text-slate-400 hover:text-cyan-400 text-[11px] py-1 transition text-center font-mono"
              >
                Inspect Health Endpoint ↗
              </a>
            </div>
          </div>
        </div>

        {/* Platform Capabilities */}
        <div id="capabilities" className="mb-12 sm:mb-16 scroll-mt-20">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-center">Platform Capabilities</h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-6 sm:mb-8 text-xs sm:text-sm px-2">
            Advanced forensic tools and algorithmic analysis suites available across our platform network.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {features.map((feature) => (
              <div
                key={feature}
                className="bg-slate-900/80 border border-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 hover:border-cyan-500/30 transition flex items-center gap-3"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                <span className="font-medium text-slate-200 text-xs sm:text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Methodology & Privacy */}
        <div id="methodology" className="mb-12 sm:mb-16 scroll-mt-20">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">Methodology & Principles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {methodology.map((item) => (
              <div
                key={item.title}
                className="bg-slate-900/60 border border-slate-800 rounded-xl sm:rounded-2xl p-5 sm:p-6"
              >
                <h4 className="text-sm sm:text-base font-semibold text-slate-200 mb-2">{item.title}</h4>
                <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-slate-500 border-t border-slate-800/80 pt-6 sm:pt-8 text-xs sm:text-sm space-y-2">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span>Built & Developed by</span>
            <a
              href="https://www.linkedin.com/in/abhrankan-chakrabarti-159460214/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1 transition"
            >
              Abhrankan Chakrabarti
              <svg className="w-3.5 h-3.5 inline-block" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.67 1.67 0 1 0 0-3.34 1.67 1.67 0 0 0 0 3.34m1.39 9.74v-8.37H5.07v8.37h2.78z" />
              </svg>
            </a>
          </div>
          <div>
            © {new Date().getFullYear()} Digital Forensics Services • <a href="https://forensic.dpdns.org" className="hover:text-cyan-400 transition">forensic.dpdns.org</a>
          </div>
        </footer>
      </section>
    </div>
  );
}