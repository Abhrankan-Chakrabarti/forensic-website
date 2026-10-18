export default function ForensicWebsite() {
  const features = [
    'Error Level Analysis (ELA)',
    'Metadata Inspection',
    'Compression Artefact Detection',
    'Clone & Tamper Analysis',
    'Pixel-Level Investigation',
    'Forensic Report Export'
  ];

  const scrollToCapabilities = () => {
    const el = document.getElementById('capabilities');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-cyan-500 selection:text-black">
      <section className="max-w-7xl mx-auto px-6 py-16">
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
              Launch Pixel Forensics
            </a>
            <button
              onClick={scrollToCapabilities}
              className="border border-slate-700 hover:border-slate-500 hover:bg-slate-900 text-slate-200 px-6 py-3 rounded-2xl transition duration-200 cursor-pointer"
            >
              Explore Capabilities & Docs
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition">
            <h3 className="text-cyan-400 text-xl font-semibold mb-2">Image Analysis</h3>
            <p className="text-slate-400 leading-relaxed">
              Upload and analyse images for traces of editing, manipulation,
              recompression, and tampering.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition">
            <h3 className="text-cyan-400 text-xl font-semibold mb-2">Metadata Inspection</h3>
            <p className="text-slate-400 leading-relaxed">
              Review EXIF metadata, timestamps, camera information, and embedded properties.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition">
            <h3 className="text-cyan-400 text-xl font-semibold mb-2">Evidence Support</h3>
            <p className="text-slate-400 leading-relaxed">
              Generate structured forensic findings for investigative and research purposes.
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 mb-16">
          <h2 className="text-3xl font-bold mb-6">Current Service</h2>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl text-cyan-400 font-semibold">
                pixel.forensic.dpdns.org
              </h3>
              <p className="text-slate-400 mt-2 max-w-2xl leading-relaxed">
                Dedicated image forensics portal providing pixel-level examination,
                manipulation analysis, and authenticity verification.
              </p>
            </div>
            <a
              href="https://pixel.forensic.dpdns.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 px-5 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Open Service ↗
            </a>
          </div>
        </div>

        <div id="capabilities" className="mb-16 scroll-mt-12">
          <h2 className="text-3xl font-bold mb-4 text-center">Platform Capabilities</h2>
          <p className="text-slate-400 text-center max-w-2xl mx-auto mb-8">
            Advanced forensic tools and algorithmic analysis suites available on the platform.
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

        <footer className="text-center text-slate-500 border-t border-slate-800/80 pt-8 text-sm">
          © {new Date().getFullYear()} Digital Forensics Services • <a href="https://forensic.dpdns.org" className="hover:text-cyan-400 transition">forensic.dpdns.org</a>
        </footer>
      </section>
    </div>
  );
}