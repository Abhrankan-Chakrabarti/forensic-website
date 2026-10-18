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
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 mb-16">
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
        <div id="capabilities" className="mb-16 scroll-mt-12">
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
        <div className="mb-16">
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