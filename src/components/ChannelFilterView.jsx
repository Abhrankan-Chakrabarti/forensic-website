import { useState, useEffect, useCallback, useId } from 'react';

const FILTER_DESCRIPTIONS = {
  red: 'Red Channel: Highlights red wavelength intensity. Useful for skin tone consistency, shadow warmth anomalies, and infrared illumination checks.',
  green: 'Green Channel: Captures the highest sensor resolution in standard Bayer color filters (RGGB). Best for inspecting base structural integrity.',
  blue: 'Blue Channel: Has the highest sensor noise and shortest wavelength. Inconsistent noise density in this channel strongly indicates composite splicing or localized smoothing.',
  lum: 'Luminance (Grayscale): Isolates perceived brightness (0.299R + 0.587G + 0.114B). Strips chromatic distraction to expose lighting direction and gradient mismatches.',
  invert: 'Inverted (Negative): Inverts all color values. Useful for spotting faint watermarks, hidden text artifacts, and subtle gradient shifts in deep shadows or bright highlights.',
  edges: 'High-Pass Edge Seams: Computes a 3x3 Laplacian spatial convolution. Highlights sharp boundary discontinuities, pasted borders, and copy-move splice seams.',
  bitplanes: 'Bit-Plane Slicer & Steganalysis: Decomposes pixels into individual binary bit-planes (Bit 0 to Bit 7). Unedited natural images show pure sensor noise at Bit 0; structured patterns or text indicate LSB steganographic payloads or digital tampering.',
};

export default function ChannelFilterView({ imageSrc, fileName = 'image' }) {
  const [activeFilter, setActiveFilter] = useState('blue');
  const [monochromeChannels, setMonochromeChannels] = useState(true);
  const [edgeBoost, setEdgeBoost] = useState(2);
  const [selectedBitPlane, setSelectedBitPlane] = useState(0); // 0 (LSB) to 7 (MSB) or 'combined'
  const [bitTargetChannel, setBitTargetChannel] = useState('lum'); // 'lum', 'red', 'green', 'blue'
  const [resultUrl, setResultUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const monoToggleId = useId();

  const applyFilter = useCallback((src, filter, mono, boost, bitPlane, bitChan) => {
    if (!src) return;
    setIsProcessing(true);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = w;
      outCanvas.height = h;
      const outCtx = outCanvas.getContext('2d');
      const outImgData = outCtx.createImageData(w, h);
      const outData = outImgData.data;

      if (filter === 'edges') {
        // High-pass Laplacian edge filter
        const gray = new Uint8Array(w * h);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          gray[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }

        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            const val = 4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - w] - gray[idx + w];
            const outIdx = idx * 4;
            const clamped = Math.min(255, Math.max(0, Math.abs(val) * boost));
            outData[outIdx] = clamped;
            outData[outIdx + 1] = clamped;
            outData[outIdx + 2] = clamped;
            outData[outIdx + 3] = 255;
          }
        }
      } else if (filter === 'bitplanes') {
        // Binary Bit-Plane Slicer & LSB Steganalysis
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          let val;
          if (bitChan === 'red') val = r;
          else if (bitChan === 'green') val = g;
          else if (bitChan === 'blue') val = b;
          else val = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

          let bitOut;
          if (bitPlane === 'combined') {
            // Amplify lowest 3 bits (0b000 - 0b111) to fill 0-255 dynamic range
            bitOut = (val & 0b111) * 36;
          } else {
            // Single bit extraction (0 to 7)
            const bit = (val >> Number(bitPlane)) & 1;
            bitOut = bit ? 255 : 0;
          }

          outData[i] = bitOut;
          outData[i + 1] = bitOut;
          outData[i + 2] = bitOut;
          outData[i + 3] = 255;
        }
      } else {
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          switch (filter) {
            case 'red':
              if (mono) {
                outData[i] = r;
                outData[i + 1] = r;
                outData[i + 2] = r;
              } else {
                outData[i] = r;
                outData[i + 1] = 0;
                outData[i + 2] = 0;
              }
              break;
            case 'green':
              if (mono) {
                outData[i] = g;
                outData[i + 1] = g;
                outData[i + 2] = g;
              } else {
                outData[i] = 0;
                outData[i + 1] = g;
                outData[i + 2] = 0;
              }
              break;
            case 'blue':
              if (mono) {
                outData[i] = b;
                outData[i + 1] = b;
                outData[i + 2] = b;
              } else {
                outData[i] = 0;
                outData[i + 1] = 0;
                outData[i + 2] = b;
              }
              break;
            case 'lum': {
              const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
              outData[i] = lum;
              outData[i + 1] = lum;
              outData[i + 2] = lum;
              break;
            }
            case 'invert':
              outData[i] = 255 - r;
              outData[i + 1] = 255 - g;
              outData[i + 2] = 255 - b;
              break;
            default:
              outData[i] = r;
              outData[i + 1] = g;
              outData[i + 2] = b;
          }
          outData[i + 3] = 255;
        }
      }

      outCtx.putImageData(outImgData, 0, 0);
      setResultUrl(outCanvas.toDataURL('image/png'));
      setIsProcessing(false);
    };
    img.src = src;
  }, []);

  useEffect(() => {
    if (!imageSrc) return;
    const timer = setTimeout(() => {
      applyFilter(imageSrc, activeFilter, monochromeChannels, edgeBoost, selectedBitPlane, bitTargetChannel);
    }, 0);
    return () => clearTimeout(timer);
  }, [imageSrc, activeFilter, monochromeChannels, edgeBoost, selectedBitPlane, bitTargetChannel, applyFilter]);

  const exportFilename = activeFilter === 'bitplanes'
    ? `${fileName.replace(/\.[^/.]+$/, '')}_bitplane_${selectedBitPlane}_${bitTargetChannel}.png`
    : `${fileName.replace(/\.[^/.]+$/, '')}_${activeFilter}.png`;

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Primary Filter Selector Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-2.5 sm:p-3 rounded-xl">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter('red')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeFilter === 'red'
                ? 'bg-rose-500 text-white font-semibold shadow-sm shadow-rose-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Red (R)
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('green')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeFilter === 'green'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm shadow-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Green (G)
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('blue')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeFilter === 'blue'
                ? 'bg-blue-500 text-white font-semibold shadow-sm shadow-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Blue (B)
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('lum')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeFilter === 'lum'
                ? 'bg-slate-200 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Luminance
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('invert')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeFilter === 'invert'
                ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm shadow-amber-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Inverted
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('edges')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              activeFilter === 'edges'
                ? 'bg-cyan-400 text-slate-950 font-semibold shadow-sm shadow-cyan-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Edge Seams
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('bitplanes')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'bitplanes'
                ? 'bg-purple-500 text-white font-semibold shadow-sm shadow-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Bit Planes (LSB)</span>
            <span className="text-[10px] bg-purple-400/20 text-purple-200 px-1.5 py-0.2 rounded-full font-bold">
              8-Bit
            </span>
          </button>
        </div>

        {/* Dynamic Controls based on filter */}
        <div className="flex items-center gap-3 text-xs text-slate-300">
          {['red', 'green', 'blue'].includes(activeFilter) && (
            <label htmlFor={monoToggleId} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                id={monoToggleId}
                type="checkbox"
                checked={monochromeChannels}
                onChange={(e) => setMonochromeChannels(e.target.checked)}
                className="accent-cyan-400 rounded"
              />
              <span className="text-slate-400 text-[11px]">Monochrome Intensity</span>
            </label>
          )}

          {activeFilter === 'edges' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Boost: <strong>{edgeBoost}x</strong></span>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={edgeBoost}
                onChange={(e) => setEdgeBoost(Number(e.target.value))}
                className="w-20 accent-cyan-400 cursor-pointer"
              />
            </div>
          )}

          {resultUrl && (
            <a
              href={resultUrl}
              download={exportFilename}
              className="text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 px-3 py-1 rounded-lg transition"
            >
              Export Filter ↓
            </a>
          )}
        </div>
      </div>

      {/* Bit-Plane Specialized Secondary Control Bar */}
      {activeFilter === 'bitplanes' && (
        <div className="w-full bg-slate-950/70 border border-purple-500/30 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Bit-Plane Selector */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-slate-400 font-mono text-[11px] mr-1">Plane:</span>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setSelectedBitPlane(b)}
                className={`px-2.5 py-1 rounded-md font-mono text-xs transition cursor-pointer ${
                  selectedBitPlane === b
                    ? 'bg-purple-500 text-white font-bold shadow-sm shadow-purple-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
                title={b === 0 ? 'Bit 0: Least Significant Bit (LSB) - Steganography Layer' : b === 7 ? 'Bit 7: Most Significant Bit (MSB)' : `Bit ${b}`}
              >
                {b === 0 ? 'Bit 0 (LSB)' : b === 7 ? 'Bit 7 (MSB)' : `Bit ${b}`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedBitPlane('combined')}
              className={`px-2.5 py-1 rounded-md font-mono text-xs transition cursor-pointer ${
                selectedBitPlane === 'combined'
                  ? 'bg-purple-500 text-white font-bold shadow-sm shadow-purple-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
              title="Combined Bits 0-2 amplified"
            >
              Combined LSBs (0-2)
            </button>
          </div>

          {/* Target Channel for Bit Slicing */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-400 font-mono text-[11px] mr-1">Target:</span>
            <div className="inline-flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setBitTargetChannel('lum')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${
                  bitTargetChannel === 'lum' ? 'bg-purple-500/30 text-purple-200 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Grayscale
              </button>
              <button
                type="button"
                onClick={() => setBitTargetChannel('red')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${
                  bitTargetChannel === 'red' ? 'bg-rose-500/30 text-rose-200 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Red
              </button>
              <button
                type="button"
                onClick={() => setBitTargetChannel('green')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${
                  bitTargetChannel === 'green' ? 'bg-emerald-500/30 text-emerald-200 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Green
              </button>
              <button
                type="button"
                onClick={() => setBitTargetChannel('blue')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${
                  bitTargetChannel === 'blue' ? 'bg-blue-500/30 text-blue-200 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Blue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Description Context Pill */}
      <div className="w-full text-xs text-slate-400 bg-slate-950/60 border border-slate-800/80 px-3.5 py-2 rounded-xl flex items-center gap-2">
        <span className="text-cyan-400 text-sm">💡</span>
        <span>
          {activeFilter === 'bitplanes'
            ? selectedBitPlane === 0
              ? 'Bit 0 (Least Significant Bit): In an unedited camera capture, Bit 0 resembles pure sensor noise (50% random entropy). Structured shapes, text, or solid patches here indicate LSB steganographic payloads or digital tampering.'
              : selectedBitPlane === 7
              ? 'Bit 7 (Most Significant Bit): Contains ~50% of the image\'s gross visual contours and luminance data.'
              : selectedBitPlane === 'combined'
              ? 'Combined LSBs 0–2 (Amplified Noise Profile): Stretches the lowest 3 bits across the 8-bit dynamic range, highlighting concealed watermarks or payload boundaries.'
              : `Bit ${selectedBitPlane}: Mid-level bit-plane decomposing textural and gradual gradient transitions.`
            : FILTER_DESCRIPTIONS[activeFilter]}
        </span>
      </div>

      {/* Image Display */}
      <div className="relative w-full flex items-center justify-center min-h-60 sm:min-h-80 bg-slate-950/80 border border-slate-800 rounded-xl p-3 sm:p-4">
        {isProcessing && (
          <div className="absolute top-3 right-3 bg-slate-950/90 border border-cyan-500/40 text-cyan-300 text-[10px] px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Filtering...</span>
          </div>
        )}

        {resultUrl ? (
          <img
            src={resultUrl}
            alt={`Filter: ${activeFilter}`}
            className="max-h-72 sm:max-h-95 md:max-h-115 max-w-full w-auto object-contain rounded-xl border border-slate-800 shadow-xl"
          />
        ) : (
          <div className="text-xs text-slate-500">Processing channel filter...</div>
        )}
      </div>
    </div>
  );
}
