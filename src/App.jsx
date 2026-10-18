import QuickAnalyzer from './components/QuickAnalyzer.jsx';

export default function ForensicWebsite() {
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
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-cyan-500 selection:text-black">
      {/* Sticky Header Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
            <a href="#" className="font-bold tracking-tight text-lg hover:text-cyan-400 transition">
              forensic<span className="text-cyan-400">.dpdns.org</span>
            </a>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <button
              onClick={() => scrollToSection('quick-analyzer')}
              className="hover:text-cyan-400 transition cursor-pointer"
            >
              Quick Inspector
            </button>
            <button
              onClick={() => scrollToSection('current-service')}
              className="hover:text-cyan-400 transition cursor-pointer"
            >
              Services
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

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Abhrankan-Chakrabarti/forensic-website"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on GitHub"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800 transition text-xs flex items-center gap-1.5"
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
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs px-4 py-2 rounded-xl transition duration-200 shadow-sm shadow-cyan-500/20"
            >
              Launch Portal ↗
            </a>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-4 text-sm font-medium">
            forensic.dpdns.org
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">
            Digital Image Forensics Platform
          </h1>
          <p className="text-slate-400 max-w-3xl mx-auto text-lg leading-relaxed">
            Professional image authenticity verification, manipulation detection,
            and forensic analysis for investigators, journalists, researchers,
            and security professionals.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <a
              href="https://pixel.forensic.dpdns.org"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-6 py-3 rounded-2xl transition duration-200 shadow-lg shadow-cyan-500/20"
            >
              Launch Pixel Forensics ↗
            </a>
            <button
              onClick={() => scrollToSection('quick-analyzer')}
              className="bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 font-medium px-6 py-3 rounded-2xl transition duration-200 cursor-pointer"
            >
              Try In-Browser Analyzer ↓
            </button>
            <button
              onClick={() => scrollToSection('capabilities')}
              className="border border-slate-700 hover:border-slate-500 hover:bg-slate-900 text-slate-200 px-6 py-3 rounded-2xl transition duration-200 cursor-pointer"
            >
              Capabilities & Specs
            </button>
          </div>
        </div>

        {/* Feature Overview Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 font-bold">
              01
            </div>
            <h3 className="text-cyan-400 text-xl font-semibold mb-2">Image Analysis</h3>
            <p className="text-slate-400 leading-relaxed text-sm">
              Upload and analyse images for traces of editing, manipulation,
              recompression anomalies, and localized tampering.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 font-bold">
              02
            </div>
            <h3 className="text-cyan-400 text-xl font-semibold mb-2">Metadata Inspection</h3>
            <p className="text-slate-400 leading-relaxed text-sm">
              Review EXIF metadata, timestamps, camera profiles, color space parameters,
              and embedded hardware properties.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 font-bold">
              03
            </div>
            <h3 className="text-cyan-400 text-xl font-semibold mb-2">Evidence Support</h3>
            <p className="text-slate-400 leading-relaxed text-sm">
              Generate structured forensic findings, audit logs, and analytical reports
              for investigative, journalistic, and legal workflows.
            </p>
          </div>
        </div>

        {/* Interactive In-Browser Tool */}
        <QuickAnalyzer />

        {/* Current Service Banner */}
        <div id="current-service" className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 mb-16 scroll-mt-20">
          <h2 className="text-3xl font-bold mb-6">Current Service</h2>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Online & Operational</span>
              </div>
              <h3 className="text-2xl text-cyan-400 font-semibold">
                pixel.forensic.dpdns.org
              </h3>
              <p className="text-slate-400 mt-2 max-w-2xl leading-relaxed text-sm">
                Dedicated image forensics portal providing high-resolution pixel-level examination,
                manipulation analysis, clone detection, and authenticity verification.
              </p>
            </div>
            <a
              href="https://pixel.forensic.dpdns.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 px-6 py-3 rounded-xl text-sm font-semibold transition shrink-0"
            >
              Open Service Portal ↗
            </a>
          </div>
        </div>

        {/* Platform Capabilities */}
        <div id="capabilities" className="mb-16 scroll-mt-20">
          <h2 className="text-3xl font-bold mb-4 text-center">Platform Capabilities</h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-8 text-sm">
            Advanced forensic tools and algorithmic analysis suites available across our platform network.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <div
                key={feature}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-cyan-500/30 transition flex items-center gap-3"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="font-medium text-slate-200">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Methodology & Privacy */}
        <div id="methodology" className="mb-16 scroll-mt-20">
          <h2 className="text-3xl font-bold mb-8 text-center">Methodology & Principles</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {methodology.map((item) => (
              <div
                key={item.title}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6"
              >
                <h4 className="text-base font-semibold text-slate-200 mb-2">{item.title}</h4>
                <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-slate-500 border-t border-slate-800/80 pt-8 text-sm">
          © {new Date().getFullYear()} Digital Forensics Services • <a href="https://forensic.dpdns.org" className="hover:text-cyan-400 transition">forensic.dpdns.org</a>
        </footer>
      </section>
    </div>
  );
}