export default function ForensicWebsite() {
  const features = [
    'Error Level Analysis (ELA)',
    'Metadata Inspection',
    'Compression Artefact Detection',
    'Clone & Tamper Analysis',
    'Pixel-Level Investigation',
    'Forensic Report Export'
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-4">
            forensic.dpdns.org
          </div>
          <h1 className="text-5xl font-bold mb-4">
            Digital Image Forensics Platform
          </h1>
          <p className="text-slate-400 max-w-3xl mx-auto text-lg">
            Professional image authenticity verification, manipulation detection,
            and forensic analysis for investigators, journalists, researchers,
            and security professionals.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <a
              href="https://pixel.forensic.dpdns.org"
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-6 py-3 rounded-2xl"
            >
              Launch Pixel Forensics
            </a>
            <button className="border border-slate-700 px-6 py-3 rounded-2xl">
              Documentation
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <h3 className="text-cyan-400 text-xl font-semibold mb-2">Image Analysis</h3>
            <p className="text-slate-400">
              Upload and analyse images for traces of editing, manipulation,
              recompression and tampering.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <h3 className="text-cyan-400 text-xl font-semibold mb-2">Metadata Inspection</h3>
            <p className="text-slate-400">
              Review EXIF metadata, timestamps, camera information and image properties.
            </p>
          </div>


          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <h3 className="text-cyan-400 text-xl font-semibold mb-2">Evidence Support</h3>
            <p className="text-slate-400">
              Generate structured forensic findings for investigative and research purposes.
            </p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 mb-16">
          <h2 className="text-3xl font-bold mb-6">Current Service</h2>
          <div className="bg-slate-800 rounded-2xl p-6">
            <h3 className="text-2xl text-cyan-400 font-semibold">
              pixel.forensic.dpdns.org
            </h3>
            <p className="text-slate-400 mt-3">
              Dedicated image forensics portal providing pixel-level examination,
              manipulation analysis, and authenticity verification.
            </p>
          </div>
        </div>


        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Capabilities</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <div
                key={feature}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5"
              >
                {feature}
              </div>
            ))}
          </div>
        </div>


        <footer className="text-center text-slate-500 border-t border-slate-800 pt-8">
          © Digital Forensics Services • forensic.dpdns.org
        </footer>
      </section>
    </div>
  );
}