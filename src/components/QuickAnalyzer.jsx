import { useState, useRef, useEffect, useCallback } from 'react';

export default function QuickAnalyzer() {
  const [imageSrc, setImageSrc] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileDetails, setFileDetails] = useState(null);
  const [elaScale, setElaScale] = useState(20);
  const [jpegQuality, setJpegQuality] = useState(0.9);
  const [viewMode, setViewMode] = useState('ela'); // 'original', 'ela', 'side-by-side'
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const elaCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Process ELA on image change or parameter change
  const computeELA = useCallback((img, scale, quality) => {
    setIsProcessing(true);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    // Canvas 1: Draw original image
    const origCanvas = document.createElement('canvas');
    origCanvas.width = width;
    origCanvas.height = height;
    const origCtx = origCanvas.getContext('2d');
    origCtx.drawImage(img, 0, 0);

    // Compute basic image metadata stats
    const origData = origCtx.getImageData(0, 0, width, height);
    const data = origData.data;
    let totalLuminance = 0;
    const sampleStep = Math.max(1, Math.floor(data.length / (4 * 5000))); // sample up to 5000 pixels
    let sampleCount = 0;
    for (let i = 0; i < data.length; i += 4 * sampleStep) {
      totalLuminance += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      sampleCount++;
    }
    const avgLuminance = sampleCount ? Math.round(totalLuminance / sampleCount) : 0;

    // Convert to recompressed JPEG
    const recompressedDataUrl = origCanvas.toDataURL('image/jpeg', quality);
    const recompressedImg = new Image();
    recompressedImg.onload = () => {
      // Canvas 2: Draw recompressed
      const recompCanvas = document.createElement('canvas');
      recompCanvas.width = width;
      recompCanvas.height = height;
      const recompCtx = recompCanvas.getContext('2d');
      recompCtx.drawImage(recompressedImg, 0, 0);
      const recompData = recompCtx.getImageData(0, 0, width, height);

      // Canvas 3: ELA output
      const elaCanvas = elaCanvasRef.current;
      if (elaCanvas) {
        elaCanvas.width = width;
        elaCanvas.height = height;
        const elaCtx = elaCanvas.getContext('2d');
        const elaImgData = elaCtx.createImageData(width, height);
        const elaData = elaImgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const diffR = Math.min(255, Math.abs(data[i] - recompData.data[i]) * scale);
          const diffG = Math.min(255, Math.abs(data[i + 1] - recompData.data[i + 1]) * scale);
          const diffB = Math.min(255, Math.abs(data[i + 2] - recompData.data[i + 2]) * scale);

          elaData[i] = diffR;
          elaData[i + 1] = diffG;
          elaData[i + 2] = diffB;
          elaData[i + 3] = 255;
        }

        elaCtx.putImageData(elaImgData, 0, 0);
      }

      setFileDetails((prev) => ({
        ...prev,
        width,
        height,
        aspectRatio: (width / height).toFixed(2),
        avgLuminance: `${avgLuminance} / 255`,
      }));

      setIsProcessing(false);
    };

    recompressedImg.src = recompressedDataUrl;
  }, []);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;

    setFileName(file.name);
    setFileDetails({
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: file.type,
      lastModified: new Date(file.lastModified).toLocaleDateString(),
    });

    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      computeELA(img, elaScale, jpegQuality);
    };
    img.src = imageSrc;
  }, [imageSrc, elaScale, jpegQuality, computeELA]);

  const loadSampleImage = () => {
    // Generate a synthetic test canvas with authentic & modified regions
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 640;
    sampleCanvas.height = 400;
    const ctx = sampleCanvas.getContext('2d');

    // Base background gradient
    const grad = ctx.createLinearGradient(0, 0, 640, 400);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 400);

    // Decorative grid pattern
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let x = 0; x < 640; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 400);
      ctx.stroke();
    }
    for (let y = 0; y < 400; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(640, y);
      ctx.stroke();
    }

    // High frequency simulated tamper element (strong contrast edge)
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(320, 200, 65, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FORENSIC SAMPLE', 320, 205);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px monospace';
    ctx.fillText('ELA Verification Test', 320, 230);

    const dataUrl = sampleCanvas.toDataURL('image/jpeg', 0.92);
    setFileName('sample_verification.jpg');
    setFileDetails({
      size: '42.8 KB',
      type: 'image/jpeg',
      lastModified: new Date().toLocaleDateString(),
    });
    setImageSrc(dataUrl);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div id="quick-analyzer" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 mb-16 scroll-mt-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold mb-2">
            <span>●</span> In-Browser Quick Inspector
          </div>
          <h2 className="text-2xl md:text-3xl font-bold">Interactive Error Level Analysis (ELA)</h2>
          <p className="text-slate-400 text-sm mt-1">
            Test any image instantly in your browser. Images are processed 100% locally in memory and never leave your machine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadSampleImage}
            className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium px-4 py-2.5 rounded-xl transition cursor-pointer"
          >
            Load Sample Image
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md shadow-cyan-500/10"
          >
            Upload Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      </div>

      {!imageSrc ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[260px] ${
            dragActive
              ? 'border-cyan-400 bg-cyan-950/20'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 mb-3 text-xl">
            🔍
          </div>
          <p className="text-slate-200 font-semibold mb-1">
            Drag & drop an image here or click to browse
          </p>
          <p className="text-slate-500 text-xs">
            Supports JPEG, PNG, WebP • 100% Client-side processing
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => setViewMode('ela')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'ela' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                ELA Map
              </button>
              <button
                onClick={() => setViewMode('original')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'original' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Original
              </button>
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'side-by-side' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Side-by-Side
              </button>
            </div>

            {/* Sliders */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
              <div className="flex items-center gap-3">
                <span>Amplification: <strong>{elaScale}x</strong></span>
                <input
                  type="range"
                  min="5"
                  max="40"
                  step="5"
                  value={elaScale}
                  onChange={(e) => setElaScale(Number(e.target.value))}
                  className="w-24 accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-3">
                <span>Resave Quality: <strong>{Math.round(jpegQuality * 100)}%</strong></span>
                <input
                  type="range"
                  min="0.70"
                  max="0.95"
                  step="0.05"
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(Number(e.target.value))}
                  className="w-24 accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>

            {isProcessing && (
              <span className="text-cyan-400 text-xs animate-pulse font-medium">
                Recalculating...
              </span>
            )}
          </div>

          {/* Canvas & Image Display */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 overflow-hidden flex justify-center items-center">
            {viewMode === 'side-by-side' ? (
              <div className="grid md:grid-cols-2 gap-4 w-full">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-400 mb-2 font-medium">Original Image</span>
                  <img
                    src={imageSrc}
                    alt="Original Upload"
                    className="max-h-[380px] w-auto object-contain rounded-xl border border-slate-800"
                  />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-cyan-400 mb-2 font-medium">ELA Difference Map</span>
                  <canvas
                    ref={elaCanvasRef}
                    className="max-h-[380px] w-auto object-contain rounded-xl border border-slate-800"
                  />
                </div>
              </div>
            ) : viewMode === 'original' ? (
              <div className="flex flex-col items-center">
                <img
                  src={imageSrc}
                  alt="Original"
                  className="max-h-[460px] w-auto object-contain rounded-xl border border-slate-800 shadow-xl"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <canvas
                  ref={elaCanvasRef}
                  className="max-h-[460px] w-auto object-contain rounded-xl border border-slate-800 shadow-xl"
                />
              </div>
            )}
          </div>

          {/* Metadata Card */}
          {fileDetails && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs">
                <span className="text-slate-500 block mb-0.5">File Name</span>
                <span className="font-semibold text-slate-200 truncate block" title={fileName}>
                  {fileName}
                </span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs">
                <span className="text-slate-500 block mb-0.5">Dimensions</span>
                <span className="font-semibold text-slate-200">
                  {fileDetails.width} × {fileDetails.height} px
                </span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs">
                <span className="text-slate-500 block mb-0.5">File Size</span>
                <span className="font-semibold text-slate-200">{fileDetails.size}</span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs">
                <span className="text-slate-500 block mb-0.5">Aspect Ratio</span>
                <span className="font-semibold text-slate-200">{fileDetails.aspectRatio} : 1</span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs col-span-2 md:col-span-1">
                <span className="text-slate-500 block mb-0.5">Avg Luminance</span>
                <span className="font-semibold text-cyan-400">{fileDetails.avgLuminance}</span>
              </div>
            </div>
          )}

          <div className="text-center text-xs text-slate-500">
            Need deeper pixel inspection, EXIF parsing, or full report export? Use our dedicated service at{' '}
            <a
              href="https://pixel.forensic.dpdns.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              pixel.forensic.dpdns.org ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
