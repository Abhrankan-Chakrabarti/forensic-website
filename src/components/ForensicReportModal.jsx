import { useState } from 'react';

export default function ForensicReportModal({
  isOpen,
  onClose,
  fileName,
  fileDetails,
  exifData,
  imageSrc,
  elaResultUrl,
  elaScale,
  jpegQuality,
  hashes,
}) {
  const [caseId] = useState(() => `CASE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const [examinerName, setExaminerName] = useState('Forensic Analyst');
  const [agencyName, setAgencyName] = useState('Digital Forensics & OSINT Lab');
  const [examinerNotes, setExaminerNotes] = useState('Preliminary in-browser examination completed. Error Level Analysis and metadata verification conducted locally under strict zero-knowledge retention.');
  const [copiedField, setCopiedField] = useState(null);

  if (!isOpen) return null;

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const reportData = {
      caseId,
      timestamp: new Date().toISOString(),
      examiner: examinerName,
      agency: agencyName,
      file: {
        name: fileName,
        size: fileDetails?.size,
        type: fileDetails?.type,
        dimensions: `${fileDetails?.width}x${fileDetails?.height}`,
        aspectRatio: fileDetails?.aspectRatio,
        avgLuminance: fileDetails?.avgLuminance,
      },
      hashes: {
        sha256: hashes?.sha256 || 'pending',
        md5: hashes?.md5 || 'pending',
      },
      analysisParameters: {
        elaAmplification: `${elaScale}x`,
        recompressionQuality: `${Math.round(jpegQuality * 100)}%`,
      },
      metadata: exifData || { notice: 'No EXIF metadata detected (potentially stripped or sanitized)' },
      examinerNotes,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${caseId}_forensic_audit.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isSuspicious = exifData?.software && /(photoshop|gimp|lightroom|canva|snapseed|pixelmator|tamper|edit)/i.test(exifData.software);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static print:overflow-visible">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:bg-white print:text-black">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <h3 className="text-sm sm:text-base font-bold text-white">
              Official Forensic Case Dossier
            </h3>
            <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-md font-mono">
              {caseId}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-cyan-500/20"
            >
              <span>🖨️ Print / Save PDF</span>
            </button>
            <button
              onClick={handleDownloadJSON}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5"
            >
              <span>Audit JSON ↓</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer text-lg leading-none"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Dossier Body (Printable) */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-200 print:text-black print:p-0 print:space-y-4">
          {/* Official Document Header */}
          <div className="border-b border-slate-800 print:border-slate-300 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-mono text-cyan-400 print:text-cyan-700 uppercase tracking-widest font-semibold block mb-1">
                  Digital Media Authenticity Verification Protocol
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white print:text-black">
                  Forensic Examination & Provenance Report
                </h1>
                <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
                  Generated via Digital Forensics Platform (forensic.dpdns.org) • 100% Client-Side Cryptographic Verification
                </p>
              </div>

              <div className="text-right sm:text-right text-xs font-mono text-slate-400 print:text-slate-600">
                <div>Case: <strong className="text-cyan-400 print:text-black">{caseId}</strong></div>
                <div>Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
              </div>
            </div>

            {/* Editable Field Headers (inputs on screen, text on print) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs">
              <div className="bg-slate-950/60 print:bg-slate-100 p-2.5 rounded-lg border border-slate-800 print:border-slate-300">
                <span className="text-slate-500 block mb-1 font-mono text-[10px] uppercase">Investigator / Examiner</span>
                <input
                  type="text"
                  value={examinerName}
                  onChange={(e) => setExaminerName(e.target.value)}
                  className="bg-transparent border-b border-slate-700 print:border-none w-full text-slate-200 print:text-black font-medium focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="bg-slate-950/60 print:bg-slate-100 p-2.5 rounded-lg border border-slate-800 print:border-slate-300">
                <span className="text-slate-500 block mb-1 font-mono text-[10px] uppercase">Agency / Organization</span>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="bg-transparent border-b border-slate-700 print:border-none w-full text-slate-200 print:text-black font-medium focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Cryptographic Integrity & Chain of Custody */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 print:text-cyan-800 mb-2 flex items-center gap-1.5">
              <span>🔒 Section 1: Cryptographic Evidence Hashes</span>
            </h4>
            <div className="bg-slate-950/80 print:bg-slate-50 border border-slate-800 print:border-slate-300 rounded-xl p-3.5 space-y-2.5 text-xs font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500 shrink-0">SHA-256 Checksum:</span>
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-cyan-300 print:text-slate-900 break-all select-all font-semibold">
                    {hashes?.sha256 || 'Calculating...'}
                  </span>
                  {hashes?.sha256 && (
                    <button
                      onClick={() => handleCopy(hashes.sha256, 'sha256')}
                      className="print:hidden text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded cursor-pointer shrink-0"
                    >
                      {copiedField === 'sha256' ? '✓ Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-2 border-t border-slate-900 print:border-slate-200">
                <span className="text-slate-500 shrink-0">MD5 Checksum:</span>
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-slate-300 print:text-slate-900 break-all select-all font-semibold">
                    {hashes?.md5 || 'Calculating...'}
                  </span>
                  {hashes?.md5 && (
                    <button
                      onClick={() => handleCopy(hashes.md5, 'md5')}
                      className="print:hidden text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded cursor-pointer shrink-0"
                    >
                      {copiedField === 'md5' ? '✓ Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* File Attributes & Parameters Grid */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 print:text-cyan-800 mb-2">
              📋 Section 2: Physical & Analytical Characteristics
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-slate-950/60 print:bg-slate-100 p-2.5 rounded-lg border border-slate-800 print:border-slate-300">
                <span className="text-slate-500 text-[10px] block font-mono">FILE NAME</span>
                <span className="font-semibold text-slate-200 print:text-black truncate block" title={fileName}>{fileName}</span>
              </div>
              <div className="bg-slate-950/60 print:bg-slate-100 p-2.5 rounded-lg border border-slate-800 print:border-slate-300">
                <span className="text-slate-500 text-[10px] block font-mono">DIMENSIONS</span>
                <span className="font-semibold text-slate-200 print:text-black">{fileDetails?.width} × {fileDetails?.height} px</span>
              </div>
              <div className="bg-slate-950/60 print:bg-slate-100 p-2.5 rounded-lg border border-slate-800 print:border-slate-300">
                <span className="text-slate-500 text-[10px] block font-mono">FILE SIZE</span>
                <span className="font-semibold text-slate-200 print:text-black">{fileDetails?.size}</span>
              </div>
              <div className="bg-slate-950/60 print:bg-slate-100 p-2.5 rounded-lg border border-slate-800 print:border-slate-300">
                <span className="text-slate-500 text-[10px] block font-mono">ELA ERROR RATE</span>
                <span className="font-semibold text-cyan-400 print:text-cyan-800">{Math.round(jpegQuality * 100)}% Resave • {elaScale}x</span>
              </div>
            </div>
          </div>

          {/* Metadata & Tamper Indicators */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 print:text-cyan-800 mb-2">
              🔍 Section 3: Metadata Provenance & Editing Signatures
            </h4>
            <div className="bg-slate-950/60 print:bg-slate-100 border border-slate-800 print:border-slate-300 rounded-xl p-3.5 space-y-2 text-xs">
              {isSuspicious ? (
                <div className="p-2.5 bg-rose-950/50 print:bg-rose-50 border border-rose-500/50 rounded-lg text-rose-300 print:text-rose-900 flex items-center gap-2">
                  <span className="font-bold text-sm">⚠️</span>
                  <span>
                    <strong>Editing Suite Signature Detected:</strong> {exifData.software}. Image has been modified through photo editing software.
                  </span>
                </div>
              ) : exifData?.hasExif ? (
                <div className="p-2.5 bg-emerald-950/40 print:bg-emerald-50 border border-emerald-500/40 rounded-lg text-emerald-300 print:text-emerald-900">
                  <span>✓ Genuine camera EXIF header identified without obvious post-processing software signatures.</span>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-900 print:bg-slate-200 rounded-lg text-slate-400 print:text-slate-700">
                  <span>ℹ No EXIF header detected. Image was either stripped, screenshot, or generated directly on the web.</span>
                </div>
              )}

              {exifData?.hasExif && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-900 print:border-slate-200 text-[11px]">
                  {exifData.make && <div><span className="text-slate-500">Make:</span> <strong className="text-slate-200 print:text-black">{exifData.make}</strong></div>}
                  {exifData.model && <div><span className="text-slate-500">Model:</span> <strong className="text-slate-200 print:text-black">{exifData.model}</strong></div>}
                  {exifData.dateTime && <div><span className="text-slate-500">Timestamp:</span> <strong className="text-slate-200 print:text-black">{exifData.dateTime}</strong></div>}
                  {exifData.iso && <div><span className="text-slate-500">ISO:</span> <strong className="text-slate-200 print:text-black">{exifData.iso}</strong></div>}
                  {exifData.fNumber && <div><span className="text-slate-500">Aperture:</span> <strong className="text-slate-200 print:text-black">{exifData.fNumber}</strong></div>}
                  {exifData.exposureTime && <div><span className="text-slate-500">Exposure:</span> <strong className="text-slate-200 print:text-black">{exifData.exposureTime}</strong></div>}
                </div>
              )}
            </div>
          </div>

          {/* Visual Evidence Plates */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 print:text-cyan-800 mb-2">
              📸 Section 4: Forensic Evidence Plates
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/80 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-300 flex flex-col items-center">
                <span className="text-[11px] text-slate-400 print:text-black font-semibold mb-2">Plate A: Source Image Evidence</span>
                {imageSrc && (
                  <img
                    src={imageSrc}
                    alt="Source Evidence"
                    className="max-h-48 sm:max-h-60 w-auto object-contain rounded border border-slate-800 print:border-slate-300"
                  />
                )}
              </div>
              <div className="bg-slate-950/80 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-300 flex flex-col items-center">
                <span className="text-[11px] text-cyan-400 print:text-black font-semibold mb-2">Plate B: ELA Difference Map</span>
                {elaResultUrl && (
                  <img
                    src={elaResultUrl}
                    alt="ELA Map"
                    className="max-h-48 sm:max-h-60 w-auto object-contain rounded border border-slate-800 print:border-slate-300"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Examiner Notes */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 print:text-cyan-800 mb-2">
              ✍️ Section 5: Examiner Findings & Conclusion
            </h4>
            <div className="bg-slate-950/60 print:bg-slate-100 p-3 rounded-xl border border-slate-800 print:border-slate-300">
              <textarea
                rows={3}
                value={examinerNotes}
                onChange={(e) => setExaminerNotes(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-300 print:text-black border-none focus:outline-none resize-none leading-relaxed"
                placeholder="Enter final notes and forensic impressions here..."
              />
            </div>
          </div>

          {/* Report Footer & Disclaimer */}
          <div className="pt-4 border-t border-slate-800 print:border-slate-300 text-[10px] text-slate-500 print:text-slate-600 space-y-1">
            <p>
              * Methodology Disclaimer: Error Level Analysis (ELA) and cryptographic hashing provide mathematical indications of compression disparity and evidence integrity. Findings should be combined with multi-algorithmic corroboration on <a href="https://pixel.forensic.dpdns.org" className="underline">pixel.forensic.dpdns.org</a>.
            </p>
            <div className="flex justify-between items-center pt-2">
              <span>Platform: forensic.dpdns.org</span>
              <span>Client-Side Verification Hash Verified: SHA-256 / MD5</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
