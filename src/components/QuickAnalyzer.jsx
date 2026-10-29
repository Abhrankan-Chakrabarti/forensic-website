import { useState, useRef, useEffect, useCallback } from 'react';
import { parseExif } from '../utils/exifParser.js';
import Histogram from './Histogram.jsx';
import DualImageComparator from './DualImageComparator.jsx';
import ChannelFilterView from './ChannelFilterView.jsx';

export default function QuickAnalyzer() {
  const [activeTab, setActiveTab] = useState('single'); // 'single' (ELA/EXIF) or 'dual' (Diff Comparator)
  const [imageSrc, setImageSrc] = useState(null);
  const [elaResultUrl, setElaResultUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileDetails, setFileDetails] = useState(null);
  const [exifData, setExifData] = useState(null);
  const [elaScale, setElaScale] = useState(20);
  const [jpegQuality, setJpegQuality] = useState(0.9);
  const [viewMode, setViewMode] = useState('split'); // 'split', 'side-by-side', 'ela', 'original'
  const [splitPos, setSplitPos] = useState(50); // percentage 0 - 100
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [sanitizedNotice, setSanitizedNotice] = useState(null);

  const fileInputRef = useRef(null);
  const splitContainerRef = useRef(null);
  const isDraggingSplit = useRef(false);

  // Process ELA on image change or parameter change
  const computeELA = useCallback((img, scale, quality) => {
    setIsProcessing(true);
    setElaResultUrl(null);
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
    const sampleStep = Math.max(1, Math.floor(data.length / (4 * 5000)));
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

      // Canvas 3: Offscreen ELA computation
      const elaCanvas = document.createElement('canvas');
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

      const computedResultUrl = elaCanvas.toDataURL('image/png');
      setElaResultUrl(computedResultUrl);

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

    // Parse EXIF
    const arrayReader = new FileReader();
    arrayReader.onload = (e) => {
      if (e.target.result) {
        const parsed = parseExif(e.target.result);
        setExifData(parsed.hasExif ? parsed : null);
      }
    };
    arrayReader.readAsArrayBuffer(file);

    // Read Data URL for display
    const dataReader = new FileReader();
    dataReader.onload = (e) => {
      setImageSrc(e.target.result);
      setLoadVersion((v) => v + 1);
    };
    dataReader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      computeELA(img, elaScale, jpegQuality);
    };
    img.src = imageSrc;
  }, [imageSrc, elaScale, jpegQuality, loadVersion, computeELA]);

  const loadSampleImage = () => {
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

    // Grid pattern
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

    // High frequency simulated tamper element
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
    setExifData({
      hasExif: true,
      make: 'Forensic Lab Virtual Camera',
      model: 'Synthetic Test Rig',
      software: 'Simulated Editing Suite v2.0',
      dateTimeOriginal: new Date().toLocaleDateString(),
      iso: 100,
      fNumber: 'f/2.8',
      exposureTime: '1/250s',
    });
    setImageSrc(dataUrl);
    setLoadVersion((v) => v + 1);
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

  // Strip all metadata & export a clean copy
  const sanitizeAndExport = (format = 'image/jpeg') => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const ext = format === 'image/png' ? 'png' : 'jpg';
      const mime = format === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = format === 'image/png' ? undefined : 0.95;

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const base = fileName.replace(/\.[^/.]+$/, '') || 'image';
        a.href = url;
        a.download = `${base}_sanitized.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        setSanitizedNotice({
          format: ext.toUpperCase(),
          size: `${(blob.size / 1024).toFixed(1)} KB`,
        });
        setTimeout(() => setSanitizedNotice(null), 6000);
      }, mime, quality);
    };
    img.src = imageSrc;
  };

  // Split comparison drag calculation
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
      if (isDraggingSplit.current) {
        updateSplitPos(e.clientX);
      }
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

  const isSuspiciousSoftware = exifData?.software && /(photoshop|gimp|lightroom|canva|snapseed|pixelmator|tamper|edit)/i.test(exifData.software);

  return (
    <div id="quick-analyzer" className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 mb-12 sm:mb-16 scroll-mt-20">
      {/* Tool Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 pb-5 border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => setActiveTab('single')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'single'
              ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
              : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <span>🔬</span>
          <span>Single-Image ELA & Metadata</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dual')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'dual'
              ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
              : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <span>⚖️</span>
          <span>Dual-Image Diff Comparator</span>
          <span className="text-[10px] bg-cyan-400/20 text-cyan-300 px-1.5 py-0.5 rounded-full font-mono font-bold">
            NEW
          </span>
        </button>
      </div>

      {activeTab === 'dual' ? (
        <DualImageComparator />
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold mb-2">
            <span>●</span> In-Browser Quick Inspector
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Interactive Error Level Analysis & EXIF</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Test any image instantly in your browser. Images are processed 100% locally in memory and never leave your machine.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          <button
            onClick={loadSampleImage}
            className="flex-1 sm:flex-initial text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium px-3.5 sm:px-4 py-2.5 rounded-xl transition cursor-pointer text-center"
          >
            Sample Image
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-initial text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-3.5 sm:px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md shadow-cyan-500/10 text-center"
          >
            Upload Image
          </button>
          {elaResultUrl && (
            <a
              href={elaResultUrl}
              download={`ela_${fileName.replace(/\.[^/.]+$/, '') || 'analysis'}.png`}
              className="flex-1 sm:flex-initial text-xs bg-slate-800 hover:bg-slate-700 border border-cyan-500/30 text-cyan-300 font-medium px-3.5 sm:px-4 py-2.5 rounded-xl transition cursor-pointer text-center"
            >
              Export ELA ↓
            </a>
          )}
          {imageSrc && (
            <button
              onClick={() => sanitizeAndExport('image/jpeg')}
              className="flex-1 sm:flex-initial text-xs bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-600/50 text-emerald-300 font-medium px-3.5 sm:px-4 py-2.5 rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-sm"
              title="Strip all EXIF, GPS, camera metadata and download a clean copy"
            >
              <span>🛡️ Strip EXIF</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFile(e.target.files[0]);
              }
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {sanitizedNotice && (
        <div className="mb-6 p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-base">✓</span>
            <span>
              <strong>Metadata stripped!</strong> Clean sanitized copy exported ({sanitizedNotice.format} • {sanitizedNotice.size}) with zero EXIF, GPS, camera serials, or software tags.
            </span>
          </div>
          <button
            onClick={() => setSanitizedNotice(null)}
            className="text-emerald-400 hover:text-white px-2 py-0.5 rounded cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {!imageSrc ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-65 ${
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
            Supports JPEG, PNG, WebP • Auto EXIF Extraction • 100% Client-side processing
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-medium overflow-x-auto w-full lg:w-auto">
              <button
                onClick={() => setViewMode('split')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 text-center flex-1 sm:flex-initial ${
                  viewMode === 'split' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Split Slider
              </button>
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 text-center flex-1 sm:flex-initial ${
                  viewMode === 'side-by-side' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Side-by-Side
              </button>
              <button
                onClick={() => setViewMode('ela')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 text-center flex-1 sm:flex-initial ${
                  viewMode === 'ela' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                ELA Only
              </button>
              <button
                onClick={() => setViewMode('channels')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 text-center flex-1 sm:flex-initial ${
                  viewMode === 'channels' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Channels & Filters
              </button>
              <button
                onClick={() => setViewMode('original')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 text-center flex-1 sm:flex-initial ${
                  viewMode === 'original' ? 'bg-cyan-500 text-black font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Original
              </button>
            </div>

            {/* Sliders (shown for ELA modes) */}
            {viewMode !== 'channels' && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6 text-xs text-slate-300 w-full lg:w-auto">
                <div className="flex items-center justify-between sm:justify-start gap-3 bg-slate-900/40 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                  <span className="shrink-0">Amplification: <strong>{elaScale}x</strong></span>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    step="5"
                    value={elaScale}
                    onChange={(e) => setElaScale(Number(e.target.value))}
                    className="w-32 sm:w-24 accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-3 bg-slate-900/40 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                  <span className="shrink-0">Resave Quality: <strong>{Math.round(jpegQuality * 100)}%</strong></span>
                  <input
                    type="range"
                    min="0.70"
                    max="0.95"
                    step="0.05"
                    value={jpegQuality}
                    onChange={(e) => setJpegQuality(Number(e.target.value))}
                    className="w-32 sm:w-24 accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {isProcessing && (
              <span className="text-cyan-400 text-xs animate-pulse font-medium text-center">
                Recalculating...
              </span>
            )}
          </div>

          {/* Image Display Area */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 overflow-hidden flex justify-center items-center min-h-60 sm:min-h-80 select-none">
            {viewMode === 'split' ? (
              <div className="w-full flex flex-col items-center">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-3 text-xs w-full">
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 sm:px-3 py-1 rounded-lg text-center">
                    <span className="text-slate-400">Ratio:</span>
                    <span className="text-cyan-400 font-semibold font-mono">{Math.round(splitPos)}%</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-slate-300 font-semibold font-mono">{Math.round(100 - splitPos)}%</span>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
                    <button
                      onClick={() => setSplitPos(25)}
                      className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                        Math.round(splitPos) === 25
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      25%
                    </button>
                    <button
                      onClick={() => setSplitPos(50)}
                      className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                        Math.round(splitPos) === 50
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      50%
                    </button>
                    <button
                      onClick={() => setSplitPos(75)}
                      className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                        Math.round(splitPos) === 75
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      75%
                    </button>
                  </div>
                </div>

                <div
                  ref={splitContainerRef}
                  onMouseDown={handleSplitMouseDown}
                  onTouchStart={(e) => {
                    isDraggingSplit.current = true;
                    if (e.touches[0]) updateSplitPos(e.touches[0].clientX);
                  }}
                  className="relative max-h-72 sm:max-h-95 md:max-h-115 max-w-full overflow-hidden rounded-xl border border-slate-800 cursor-ew-resize inline-block touch-none select-none"
                >
                  {/* Base Layer: Original Image (defines natural container bounds & aspect ratio) */}
                  <img
                    src={imageSrc}
                    alt="Original"
                    className="max-h-72 sm:max-h-95 md:max-h-115 max-w-full w-auto object-contain block pointer-events-none"
                  />

                  {/* Top Layer: ELA Difference Map (clipped via clip-path to match splitPos exactly) */}
                  {elaResultUrl && (
                    <img
                      src={elaResultUrl}
                      alt="ELA Analysis"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      style={{
                        clipPath: `inset(0 0 0 ${splitPos}%)`,
                        WebkitClipPath: `inset(0 0 0 ${splitPos}%)`,
                      }}
                    />
                  )}

                  {/* Computing feedback overlay badge if recalculating */}
                  {isProcessing && (
                    <div className="absolute top-3 right-3 bg-slate-950/90 border border-cyan-500/40 text-cyan-300 text-[10px] sm:text-xs px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 z-20 pointer-events-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      <span>Computing ELA...</span>
                    </div>
                  )}

                  {/* Draggable Divider Line & Knob */}
                  <div
                    style={{ left: `${splitPos}%` }}
                    className="absolute inset-y-0 w-0.5 bg-cyan-400 pointer-events-none -translate-x-1/2 z-20"
                  >
                    {/* Floating percentage badge above divider */}
                    <div className="absolute top-3 -translate-x-1/2 bg-slate-950/90 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                      {Math.round(splitPos)}%
                    </div>

                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/50 flex items-center justify-center text-xs font-bold border-2 border-slate-950 pointer-events-auto cursor-ew-resize">
                      ⇄
                    </div>
                  </div>

                  {/* Corner Badges */}
                  <span className="absolute bottom-2.5 left-2.5 bg-slate-950/90 text-cyan-400 text-[9px] sm:text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-cyan-500/30 pointer-events-none z-10">
                    ORIGINAL • {Math.round(splitPos)}%
                  </span>
                  <span className="absolute bottom-2.5 right-2.5 bg-slate-950/90 text-slate-300 text-[9px] sm:text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-slate-700 pointer-events-none z-10">
                    ELA MAP • {Math.round(100 - splitPos)}%
                  </span>
                </div>
              </div>
            ) : viewMode === 'side-by-side' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-400 mb-2 font-medium">Original Image</span>
                  <img
                    src={imageSrc}
                    alt="Original Upload"
                    className="max-h-60 sm:max-h-80 md:max-h-95 max-w-full w-auto object-contain rounded-xl border border-slate-800"
                  />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-cyan-400 mb-2 font-medium">ELA Difference Map</span>
                  {elaResultUrl ? (
                    <img
                      src={elaResultUrl}
                      alt="ELA Difference Map"
                      className="max-h-60 sm:max-h-80 md:max-h-95 max-w-full w-auto object-contain rounded-xl border border-slate-800"
                    />
                  ) : (
                    <div className="h-48 sm:h-65 flex items-center justify-center text-xs text-slate-500">
                      Computing ELA map...
                    </div>
                  )}
                </div>
              </div>
            ) : viewMode === 'channels' ? (
              <ChannelFilterView imageSrc={imageSrc} fileName={fileName} />
            ) : viewMode === 'original' ? (
              <div className="flex flex-col items-center">
                <img
                  src={imageSrc}
                  alt="Original"
                  className="max-h-72 sm:max-h-95 md:max-h-115 max-w-full w-auto object-contain rounded-xl border border-slate-800 shadow-xl"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center">
                {elaResultUrl ? (
                  <img
                    src={elaResultUrl}
                    alt="ELA Difference Map"
                    className="max-h-72 sm:max-h-95 md:max-h-115 max-w-full w-auto object-contain rounded-xl border border-slate-800 shadow-xl"
                  />
                ) : (
                  <div className="h-48 sm:h-65 flex items-center justify-center text-xs text-slate-500">
                    Computing ELA map...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Metadata Card */}
          {fileDetails && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 sm:p-3 text-xs">
                <span className="text-slate-500 block mb-0.5 text-[11px]">File Name</span>
                <span className="font-semibold text-slate-200 truncate block" title={fileName}>
                  {fileName}
                </span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 sm:p-3 text-xs">
                <span className="text-slate-500 block mb-0.5 text-[11px]">Dimensions</span>
                <span className="font-semibold text-slate-200 truncate block">
                  {fileDetails.width} × {fileDetails.height} px
                </span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 sm:p-3 text-xs">
                <span className="text-slate-500 block mb-0.5 text-[11px]">File Size</span>
                <span className="font-semibold text-slate-200 block">{fileDetails.size}</span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 sm:p-3 text-xs">
                <span className="text-slate-500 block mb-0.5 text-[11px]">Aspect Ratio</span>
                <span className="font-semibold text-slate-200 block">{fileDetails.aspectRatio} : 1</span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 sm:p-3 text-xs col-span-2 sm:col-span-1">
                <span className="text-slate-500 block mb-0.5 text-[11px]">Avg Luminance</span>
                <span className="font-semibold text-cyan-400 block">{fileDetails.avgLuminance}</span>
              </div>
            </div>
          )}

          {/* EXIF Metadata & Tamper Signatures */}
          {exifData && (
            <div className={`rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border text-xs ${
              isSuspiciousSoftware
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 font-semibold">
                  <span>📸</span>
                  <span>Extracted EXIF Camera & Forensic Tags</span>
                </div>
                {isSuspiciousSoftware && (
                  <span className="self-start sm:self-auto px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                    ⚠️ Modification Signature Detected
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="bg-slate-900/40 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Device</span>
                  <span className="font-medium text-slate-200">{[exifData.make, exifData.model].filter(Boolean).join(' ') || 'Not recorded'}</span>
                </div>
                <div className="bg-slate-900/40 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Software / Editor</span>
                  <span className={`font-medium ${isSuspiciousSoftware ? 'text-amber-300 font-bold' : 'text-slate-200'}`}>
                    {exifData.software || 'None reported'}
                  </span>
                </div>
                <div className="bg-slate-900/40 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Capture Timestamp</span>
                  <span className="font-medium text-slate-200">{exifData.dateTimeOriginal || exifData.dateTime || 'Not recorded'}</span>
                </div>
                <div className="bg-slate-900/40 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">Optics & Exposure</span>
                  <span className="font-medium text-slate-200">
                    {[exifData.fNumber, exifData.exposureTime, exifData.iso ? `ISO ${exifData.iso}` : null].filter(Boolean).join(' • ') || 'Not recorded'}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-slate-400 text-[11px] leading-relaxed">
                  🔒 <strong>Privacy Advice:</strong> This image contains hardware/timestamp fingerprints. Strip metadata to sanitize before sharing.
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => sanitizeAndExport('image/jpeg')}
                    className="text-[11px] bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 px-3 py-1.5 rounded-lg transition font-medium cursor-pointer"
                  >
                    Clean JPG ↓
                  </button>
                  <button
                    onClick={() => sanitizeAndExport('image/png')}
                    className="text-[11px] bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition font-medium cursor-pointer"
                  >
                    Clean PNG ↓
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Color & Luminance Histogram */}
          <Histogram imageSrc={imageSrc} />

          <div className="text-center text-xs text-slate-500">
            Need deeper pixel inspection, clone mask detection, or full report export? Use our dedicated service at{' '}
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
        </>
      )}
    </div>
  );
}
