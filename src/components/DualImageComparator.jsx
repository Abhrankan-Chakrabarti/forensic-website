import { useState, useRef, useEffect, useCallback } from 'react';
import ForensicLoupe from './ForensicLoupe.jsx';

export default function DualImageComparator() {
  const [imageA, setImageA] = useState(null); // { src, name, size, width, height }
  const [imageB, setImageB] = useState(null);
  const [diffResultUrl, setDiffResultUrl] = useState(null);
  const [diffStats, setDiffStats] = useState(null);
  const [viewMode, setViewMode] = useState('split'); // 'split', 'side-by-side', 'heatmap', 'imageA', 'imageB'
  const [splitPos, setSplitPos] = useState(50);
  const [threshold, setThreshold] = useState(15); // sensitivity (0-100)
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoupeEnabled, setIsLoupeEnabled] = useState(false);
  const [loupeZoom, setLoupeZoom] = useState(8);

  const fileInputARef = useRef(null);
  const fileInputBRef = useRef(null);
  const splitContainerRef = useRef(null);
  const isDraggingSplit = useRef(false);

  // Compute visual difference between Image A and Image B
  const computeDiff = useCallback((srcA, srcB, sens) => {
    if (!srcA || !srcB) return;
    setIsProcessing(true);

    const imgA = new Image();
    const imgB = new Image();
    imgA.crossOrigin = 'anonymous';
    imgB.crossOrigin = 'anonymous';

    let loadedCount = 0;
    const onBothLoaded = () => {
      const w = Math.max(imgA.naturalWidth || imgA.width, imgB.naturalWidth || imgB.width);
      const h = Math.max(imgA.naturalHeight || imgA.height, imgB.naturalHeight || imgB.height);

      const canvasA = document.createElement('canvas');
      canvasA.width = w;
      canvasA.height = h;
      const ctxA = canvasA.getContext('2d');
      ctxA.drawImage(imgA, 0, 0, w, h);
      const dataA = ctxA.getImageData(0, 0, w, h).data;

      const canvasB = document.createElement('canvas');
      canvasB.width = w;
      canvasB.height = h;
      const ctxB = canvasB.getContext('2d');
      ctxB.drawImage(imgB, 0, 0, w, h);
      const dataB = ctxB.getImageData(0, 0, w, h).data;

      const diffCanvas = document.createElement('canvas');
      diffCanvas.width = w;
      diffCanvas.height = h;
      const diffCtx = diffCanvas.getContext('2d');
      const diffImageData = diffCtx.createImageData(w, h);
      const diffData = diffImageData.data;

      let changedPixels = 0;
      const totalPixels = w * h;

      for (let i = 0; i < dataA.length; i += 4) {
        const dr = Math.abs(dataA[i] - dataB[i]);
        const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
        const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
        const dist = (dr + dg + db) / 3;

        if (dist > sens) {
          changedPixels++;
          // High-contrast neon red/crimson overlay for altered regions
          diffData[i] = 255;
          diffData[i + 1] = Math.min(255, 30 + dist);
          diffData[i + 2] = 50;
          diffData[i + 3] = 255;
        } else {
          // Dimmed grayscale background for unchanged reference regions
          const gray = Math.round(0.299 * dataA[i] + 0.587 * dataA[i + 1] + 0.114 * dataA[i + 2]);
          const dimmed = Math.round(gray * 0.35);
          diffData[i] = dimmed;
          diffData[i + 1] = dimmed;
          diffData[i + 2] = Math.round(dimmed * 1.2);
          diffData[i + 3] = 255;
        }
      }

      diffCtx.putImageData(diffImageData, 0, 0);
      setDiffResultUrl(diffCanvas.toDataURL('image/png'));

      const alteredPct = ((changedPixels / totalPixels) * 100);
      setDiffStats({
        changedPixels,
        totalPixels,
        alteredPercentage: alteredPct.toFixed(2),
        matchPercentage: (100 - alteredPct).toFixed(2),
        width: w,
        height: h,
      });

      setIsProcessing(false);
    };

    imgA.onload = () => {
      loadedCount++;
      if (loadedCount === 2) onBothLoaded();
    };
    imgB.onload = () => {
      loadedCount++;
      if (loadedCount === 2) onBothLoaded();
    };

    imgA.src = srcA;
    imgB.src = srcB;
  }, []);

  const handleFile = (file, target) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target.result;
      const img = new Image();
      img.onload = () => {
        const payload = {
          src,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        };
        if (target === 'A') {
          setImageA(payload);
        } else {
          setImageB(payload);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // Re-run diff when images or threshold change
  useEffect(() => {
    if (!imageA?.src || !imageB?.src) return;
    const timer = setTimeout(() => {
      computeDiff(imageA.src, imageB.src, threshold);
    }, 0);
    return () => clearTimeout(timer);
  }, [imageA?.src, imageB?.src, threshold, computeDiff]);

  // Generate a sample pair (Original vs Tampered document)
  const loadSampleDiffPair = () => {
    const w = 640;
    const h = 420;

    // Canvas A: Original Document
    const canvasA = document.createElement('canvas');
    canvasA.width = w;
    canvasA.height = h;
    const ctxA = canvasA.getContext('2d');
    ctxA.fillStyle = '#0f172a';
    ctxA.fillRect(0, 0, w, h);

    // Subtle grid
    ctxA.strokeStyle = '#1e293b';
    ctxA.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctxA.beginPath(); ctxA.moveTo(x, 0); ctxA.lineTo(x, h); ctxA.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctxA.beginPath(); ctxA.moveTo(0, y); ctxA.lineTo(w, y); ctxA.stroke();
    }

    // Card background
    ctxA.fillStyle = '#1e293b';
    ctxA.beginPath();
    ctxA.roundRect(50, 40, 540, 340, 16);
    ctxA.fill();
    ctxA.strokeStyle = '#334155';
    ctxA.lineWidth = 2;
    ctxA.stroke();

    ctxA.fillStyle = '#38bdf8';
    ctxA.font = 'bold 22px sans-serif';
    ctxA.fillText('FINANCIAL AUDIT RECORD', 80, 95);

    ctxA.fillStyle = '#94a3b8';
    ctxA.font = '14px monospace';
    ctxA.fillText('Ref ID: #TX-89240-SEC', 80, 135);
    ctxA.fillText('Status: VERIFIED & CLEARED', 80, 165);
    ctxA.fillText('Officer: A. Chakrabarti', 80, 195);

    ctxA.fillStyle = '#22c55e';
    ctxA.font = 'bold 28px sans-serif';
    ctxA.fillText('Total Grant: $1,250.00', 80, 260);

    ctxA.fillStyle = '#64748b';
    ctxA.font = '12px sans-serif';
    ctxA.fillText('Original authentic document archive', 80, 330);

    const srcA = canvasA.toDataURL('image/png');

    // Canvas B: Tampered Copy (Modified Total and Status)
    const canvasB = document.createElement('canvas');
    canvasB.width = w;
    canvasB.height = h;
    const ctxB = canvasB.getContext('2d');
    ctxB.drawImage(canvasA, 0, 0);

    // Overwrite with altered text & tampered patch
    ctxB.fillStyle = '#1e293b';
    ctxB.fillRect(75, 148, 380, 24); // Cover status
    ctxB.fillRect(75, 230, 420, 42); // Cover total

    ctxB.fillStyle = '#f59e0b';
    ctxB.font = '14px monospace';
    ctxB.fillText('Status: MODIFIED / FORGED', 80, 165);

    ctxB.fillStyle = '#ef4444';
    ctxB.font = 'bold 28px sans-serif';
    ctxB.fillText('Total Grant: $9,850.00', 80, 260);

    // Subtle splice stamp
    ctxB.fillStyle = '#dc2626';
    ctxB.font = 'bold 13px sans-serif';
    ctxB.fillText('[TAMPER SPLICED]', 430, 95);

    const srcB = canvasB.toDataURL('image/png');

    setImageA({
      src: srcA,
      name: 'authentic_record_ref.png',
      size: '34.2 KB',
      width: w,
      height: h,
    });
    setImageB({
      src: srcB,
      name: 'suspected_tamper_copy.png',
      size: '35.8 KB',
      width: w,
      height: h,
    });

    computeDiff(srcA, srcB, threshold);
  };

  // Split comparison drag handling
  const updateSplitPos = useCallback((clientX) => {
    if (!splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSplitPos(percentage);
  }, []);

  const handleSplitMouseDown = (e) => {
    isDraggingSplit.current = true;
    updateSplitPos(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingSplit.current) updateSplitPos(e.clientX);
    };
    const handleMouseUp = () => {
      isDraggingSplit.current = false;
    };
    const handleTouchMove = (e) => {
      if (isDraggingSplit.current && e.touches[0]) {
        updateSplitPos(e.touches[0].clientX);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [updateSplitPos]);

  const hasBoth = Boolean(imageA && imageB);

  return (
    <div className="space-y-6">
      {/* Dual Upload Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Slot A: Reference Image */}
        <div className={`p-4 rounded-2xl border transition ${
          imageA ? 'bg-slate-950/70 border-cyan-500/30' : 'bg-slate-950/40 border-dashed border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center border border-cyan-500/40">
                A
              </span>
              <span className="text-xs font-semibold text-slate-200">Reference / Original Image</span>
            </div>
            {imageA && (
              <button
                onClick={() => setImageA(null)}
                className="text-[11px] text-slate-500 hover:text-rose-400 cursor-pointer"
              >
                Clear ✕
              </button>
            )}
          </div>

          {imageA ? (
            <div className="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
              <img src={imageA.src} alt="Reference" className="w-14 h-14 object-cover rounded-lg border border-slate-700 shrink-0" />
              <div className="min-w-0 text-xs">
                <p className="font-semibold text-slate-200 truncate">{imageA.name}</p>
                <p className="text-slate-400 text-[11px] mt-0.5">{imageA.width} × {imageA.height} px • {imageA.size}</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputARef.current?.click()}
              className="w-full py-6 text-center text-xs text-slate-400 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/30 rounded-xl bg-slate-900/40 transition cursor-pointer"
            >
              + Upload Image A (Original)
            </button>
          )}
          <input
            ref={fileInputARef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0], 'A');
              e.target.value = '';
            }}
          />
        </div>

        {/* Slot B: Suspect Image */}
        <div className={`p-4 rounded-2xl border transition ${
          imageB ? 'bg-slate-950/70 border-rose-500/30' : 'bg-slate-950/40 border-dashed border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center border border-rose-500/40">
                B
              </span>
              <span className="text-xs font-semibold text-slate-200">Suspect / Modified Image</span>
            </div>
            {imageB && (
              <button
                onClick={() => setImageB(null)}
                className="text-[11px] text-slate-500 hover:text-rose-400 cursor-pointer"
              >
                Clear ✕
              </button>
            )}
          </div>

          {imageB ? (
            <div className="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
              <img src={imageB.src} alt="Suspect" className="w-14 h-14 object-cover rounded-lg border border-slate-700 shrink-0" />
              <div className="min-w-0 text-xs">
                <p className="font-semibold text-slate-200 truncate">{imageB.name}</p>
                <p className="text-slate-400 text-[11px] mt-0.5">{imageB.width} × {imageB.height} px • {imageB.size}</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputBRef.current?.click()}
              className="w-full py-6 text-center text-xs text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 rounded-xl bg-slate-900/40 transition cursor-pointer"
            >
              + Upload Image B (Suspect)
            </button>
          )}
          <input
            ref={fileInputBRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0], 'B');
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Action / Pre-load Button */}
      {!hasBoth && (
        <div className="text-center py-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4">
          <p className="text-xs text-slate-400 mb-3">
            Upload two images to compute pixel-level delta and interactive comparison, or test with a sample pair:
          </p>
          <button
            onClick={loadSampleDiffPair}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>◈ Load Sample Diff Pair (Authentic vs Spliced)</span>
          </button>
        </div>
      )}

      {/* Main Diff Display when both images are loaded */}
      {hasBoth && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            {/* View Mode Pills */}
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
                  viewMode === 'split' ? 'bg-cyan-500 text-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Split Slider (A / B)
              </button>
              <button
                onClick={() => setViewMode('heatmap')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
                  viewMode === 'heatmap' ? 'bg-cyan-500 text-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Delta Heatmap
              </button>
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
                  viewMode === 'side-by-side' ? 'bg-cyan-500 text-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Side-by-Side
              </button>
            </div>

            {/* Threshold / Sensitivity Slider */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Diff Sensitivity:</span>
              <input
                type="range"
                min="3"
                max="60"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-24 accent-cyan-400 cursor-pointer"
              />
              <span className="font-mono text-cyan-300 w-6">{threshold}</span>
            </div>

            {/* Pixel Loupe Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setIsLoupeEnabled(!isLoupeEnabled)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  isLoupeEnabled
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Toggle Floating Pixel Loupe Magnifier"
              >
                <span>🔍 Loupe</span>
                <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${isLoupeEnabled ? 'bg-slate-950 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                  {loupeZoom}x
                </span>
              </button>

              {isLoupeEnabled && (
                <div className="flex items-center gap-0.5 pl-1 border-l border-slate-800">
                  {[2, 4, 8, 12, 16].map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setLoupeZoom(z)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                        loupeZoom === z
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {z}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export Action */}
            {diffResultUrl && (
              <a
                href={diffResultUrl}
                download="forensic_diff_heatmap.png"
                className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-medium px-3.5 py-1.5 rounded-xl transition cursor-pointer"
              >
                Export Heatmap ↓
              </a>
            )}
          </div>

          {/* Stats Summary Bar */}
          {diffStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs">
                <span className="text-slate-500 text-[11px] block">Overall Match</span>
                <span className={`text-base font-bold font-mono ${
                  Number(diffStats.matchPercentage) > 95 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {diffStats.matchPercentage}%
                </span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs">
                <span className="text-slate-500 text-[11px] block">Altered / Spliced</span>
                <span className={`text-base font-bold font-mono ${
                  Number(diffStats.alteredPercentage) > 0 ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {diffStats.alteredPercentage}%
                </span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs">
                <span className="text-slate-500 text-[11px] block">Changed Pixels</span>
                <span className="text-base font-semibold text-slate-200 font-mono">
                  {diffStats.changedPixels.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs">
                <span className="text-slate-500 text-[11px] block">Resolution Grid</span>
                <span className="text-base font-semibold text-slate-200 font-mono">
                  {diffStats.width} × {diffStats.height}
                </span>
              </div>
            </div>
          )}

          {/* Canvas Viewing Area */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-3 sm:p-4 flex items-center justify-center min-h-75 overflow-hidden">
            {isProcessing ? (
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                Computing pixel differences...
              </div>
            ) : viewMode === 'split' ? (
              <div className="w-full flex justify-center">
                <div
                  ref={splitContainerRef}
                  onMouseDown={handleSplitMouseDown}
                  onTouchStart={handleSplitMouseDown}
                  className="relative select-none overflow-hidden rounded-xl border border-slate-800 cursor-ew-resize max-h-120 max-w-full"
                >
                  {/* Layer B (Right / Background) */}
                  <img
                    src={imageB.src}
                    alt="Suspect Image"
                    className="block max-h-120 max-w-full w-auto object-contain pointer-events-none"
                  />

                  {/* Layer A (Left / Foreground Clip) */}
                  <div
                    style={{ clipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)` }}
                    className="absolute inset-0 pointer-events-none"
                  >
                    <img
                      src={imageA.src}
                      alt="Reference Image"
                      className="block max-h-120 max-w-full w-auto object-contain"
                    />
                  </div>

                  {/* Drag Handle */}
                  <div
                    style={{ left: `${splitPos}%` }}
                    className="absolute inset-y-0 w-0.5 bg-cyan-400 pointer-events-none -translate-x-1/2 z-20"
                  >
                    <div className="absolute top-3 -translate-x-1/2 bg-slate-950/90 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                      {Math.round(splitPos)}%
                    </div>
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/50 flex items-center justify-center text-xs font-bold border-2 border-slate-950 pointer-events-auto cursor-ew-resize">
                      ⇄
                    </div>
                  </div>

                  {/* Badges */}
                  <span className="absolute bottom-2.5 left-2.5 bg-slate-950/90 text-cyan-400 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-cyan-500/30 pointer-events-none z-10">
                    A: ORIGINAL • {Math.round(splitPos)}%
                  </span>
                  <span className="absolute bottom-2.5 right-2.5 bg-slate-950/90 text-rose-400 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-rose-500/30 pointer-events-none z-10">
                    B: SUSPECT • {Math.round(100 - splitPos)}%
                  </span>
                </div>
              </div>
            ) : viewMode === 'heatmap' ? (
              <div className="flex flex-col items-center">
                {diffResultUrl ? (
                  <div className="relative">
                    <ForensicLoupe
                      src={diffResultUrl}
                      alt="Delta Heatmap"
                      zoom={loupeZoom}
                      enabled={isLoupeEnabled}
                      className="max-h-120 max-w-full w-auto object-contain rounded-xl border border-slate-800 shadow-xl"
                    />
                    <div className="absolute bottom-3 left-3 bg-slate-950/90 border border-rose-500/50 text-rose-300 text-xs px-2.5 py-1 rounded-md font-mono flex items-center gap-2 pointer-events-none">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                      <span>Altered Pixels Highlighted in Crimson</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">No delta computed</div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-cyan-400 mb-2 font-medium">Image A (Reference)</span>
                  <ForensicLoupe
                    src={imageA.src}
                    alt="Reference A"
                    zoom={loupeZoom}
                    enabled={isLoupeEnabled}
                    className="max-h-75 max-w-full w-auto object-contain rounded-xl border border-slate-800"
                  />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-rose-400 mb-2 font-medium">Image B (Suspect Copy)</span>
                  <ForensicLoupe
                    src={imageB.src}
                    alt="Suspect B"
                    zoom={loupeZoom}
                    enabled={isLoupeEnabled}
                    className="max-h-75 max-w-full w-auto object-contain rounded-xl border border-slate-800"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
