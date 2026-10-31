import { useState, useEffect, useCallback, useId } from 'react';
import ForensicLoupe from './ForensicLoupe.jsx';

const FILTER_DESCRIPTIONS = {
  red: 'Red Channel: Highlights red wavelength intensity. Useful for skin tone consistency, shadow warmth anomalies, and infrared illumination checks.',
  green: 'Green Channel: Captures the highest sensor resolution in standard Bayer color filters (RGGB). Best for inspecting base structural integrity.',
  blue: 'Blue Channel: Has the highest sensor noise and shortest wavelength. Inconsistent noise density in this channel strongly indicates composite splicing or localized smoothing.',
  lum: 'Luminance (Grayscale): Isolates perceived brightness (0.299R + 0.587G + 0.114B). Strips chromatic distraction to expose lighting direction and gradient mismatches.',
  invert: 'Inverted (Negative): Inverts all color values. Useful for spotting faint watermarks, hidden text artifacts, and subtle gradient shifts in deep shadows or bright highlights.',
  edges: 'High-Pass Edge Seams: Computes a 3x3 Laplacian spatial convolution. Highlights sharp boundary discontinuities, pasted borders, and copy-move splice seams.',
  bitplanes: 'Bit-Plane Slicer & Steganalysis: Decomposes pixels into individual binary bit-planes (Bit 0 to Bit 7). Unedited natural images show pure sensor noise at Bit 0; structured patterns or text indicate LSB steganographic payloads or digital tampering.',
  noise: 'Sensor Noise & PRNU Inconsistency: Extracts high-frequency physical sensor noise. Authentic camera captures show a uniform, continuous noise floor. AI-inpainted, airbrushed, or cloned patches exhibit flat zero-noise suppression, while foreign splices display sharp noise variance disparity.',
};

function getNoiseHeatmapColor(std) {
  // Normalize std from 0 to 16
  const t = Math.min(1, Math.max(0, std / 16));
  // 4-stop thermal palette:
  // 0.0 -> dark navy blue [15, 23, 42] (smoothed/AI inpaint/cloned)
  // 0.2 -> purple [126, 34, 206]
  // 0.45 -> emerald green [16, 185, 129] (natural ISO sensor floor)
  // 0.7 -> amber [245, 158, 11]
  // 1.0 -> neon crimson [244, 63, 94] (high noise splice)
  if (t < 0.2) {
    const s = t / 0.2;
    return [
      Math.round(15 + s * (126 - 15)),
      Math.round(23 + s * (34 - 23)),
      Math.round(42 + s * (206 - 42)),
    ];
  } else if (t < 0.45) {
    const s = (t - 0.2) / 0.25;
    return [
      Math.round(126 + s * (16 - 126)),
      Math.round(34 + s * (185 - 34)),
      Math.round(206 + s * (129 - 206)),
    ];
  } else if (t < 0.7) {
    const s = (t - 0.45) / 0.25;
    return [
      Math.round(16 + s * (245 - 16)),
      Math.round(185 + s * (158 - 185)),
      Math.round(129 + s * (11 - 129)),
    ];
  } else {
    const s = (t - 0.7) / 0.3;
    return [
      Math.round(245 + s * (244 - 245)),
      Math.round(158 + s * (63 - 158)),
      Math.round(11 + s * (94 - 11)),
    ];
  }
}

export default function ChannelFilterView({
  imageSrc,
  fileName = 'image',
  isLoupeEnabled = false,
  loupeZoom = 8,
}) {
  const [activeFilter, setActiveFilter] = useState('blue');
  const [monochromeChannels, setMonochromeChannels] = useState(true);
  const [edgeBoost, setEdgeBoost] = useState(2);
  const [selectedBitPlane, setSelectedBitPlane] = useState(0); // 0 (LSB) to 7 (MSB) or 'combined'
  const [bitTargetChannel, setBitTargetChannel] = useState('lum'); // 'lum', 'red', 'green', 'blue'
  const [noiseMode, setNoiseMode] = useState('residual'); // 'residual' (amplified) or 'variance' (heatmap)
  const [noiseGain, setNoiseGain] = useState(12); // 2x to 40x
  const [noiseWindow, setNoiseWindow] = useState(7); // 5, 7, 11
  const [resultUrl, setResultUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const monoToggleId = useId();

  const applyFilter = useCallback((src, filter, mono, boost, bitPlane, bitChan, nMode, nGain, nWin) => {
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
      } else if (filter === 'noise') {
        // High-frequency sensor noise extraction & variance mapping
        const gray = new Float32Array(w * h);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          // Use green/blue or luminance for sensor grain
          gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        // Fast 3x3 local mean filter
        const blurred = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
          const y0 = Math.max(0, y - 1);
          const y1 = Math.min(h - 1, y + 1);
          for (let x = 0; x < w; x++) {
            const x0 = Math.max(0, x - 1);
            const x1 = Math.min(w - 1, x + 1);
            let sum = 0;
            let count = 0;
            for (let sy = y0; sy <= y1; sy++) {
              for (let sx = x0; sx <= x1; sx++) {
                sum += gray[sy * w + sx];
                count++;
              }
            }
            blurred[y * w + x] = sum / count;
          }
        }

        const residual = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          residual[i] = gray[i] - blurred[i];
        }

        if (nMode === 'residual') {
          // Amplified residual centered at neutral mid-gray (128)
          for (let i = 0; i < w * h; i++) {
            const val = Math.round(128 + residual[i] * nGain);
            const clamped = Math.min(255, Math.max(0, val));
            const outIdx = i * 4;
            outData[outIdx] = clamped;
            outData[outIdx + 1] = clamped;
            outData[outIdx + 2] = clamped;
            outData[outIdx + 3] = 255;
          }
        } else {
          // Variance heatmap via integral images (Summed-Area Tables)
          const tw = w + 1;
          const sumTable = new Float64Array(tw * (h + 1));
          const sqTable = new Float64Array(tw * (h + 1));

          for (let y = 0; y < h; y++) {
            let rowSum = 0;
            let rowSq = 0;
            for (let x = 0; x < w; x++) {
              const v = residual[y * w + x];
              rowSum += v;
              rowSq += v * v;
              const idx = (y + 1) * tw + (x + 1);
              const aboveIdx = y * tw + (x + 1);
              sumTable[idx] = sumTable[aboveIdx] + rowSum;
              sqTable[idx] = sqTable[aboveIdx] + rowSq;
            }
          }

          const rad = Math.floor(nWin / 2);
          for (let y = 0; y < h; y++) {
            const y1 = Math.max(0, y - rad);
            const y2 = Math.min(h, y + rad + 1);
            for (let x = 0; x < w; x++) {
              const x1 = Math.max(0, x - rad);
              const x2 = Math.min(w, x + rad + 1);
              const count = (x2 - x1) * (y2 - y1);

              const sum = sumTable[y2 * tw + x2] - sumTable[y1 * tw + x2] - sumTable[y2 * tw + x1] + sumTable[y1 * tw + x1];
              const sq = sqTable[y2 * tw + x2] - sqTable[y1 * tw + x2] - sqTable[y2 * tw + x1] + sqTable[y1 * tw + x1];

              const mean = sum / count;
              const variance = Math.max(0, (sq / count) - (mean * mean));
              const std = Math.sqrt(variance);

              const [r, g, b] = getNoiseHeatmapColor(std);
              const outIdx = (y * w + x) * 4;
              outData[outIdx] = r;
              outData[outIdx + 1] = g;
              outData[outIdx + 2] = b;
              outData[outIdx + 3] = 255;
            }
          }
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
      applyFilter(imageSrc, activeFilter, monochromeChannels, edgeBoost, selectedBitPlane, bitTargetChannel, noiseMode, noiseGain, noiseWindow);
    }, 0);
    return () => clearTimeout(timer);
  }, [imageSrc, activeFilter, monochromeChannels, edgeBoost, selectedBitPlane, bitTargetChannel, noiseMode, noiseGain, noiseWindow, applyFilter]);

  const exportFilename = activeFilter === 'bitplanes'
    ? `${fileName.replace(/\.[^/.]+$/, '')}_bitplane_${selectedBitPlane}_${bitTargetChannel}.png`
    : activeFilter === 'noise'
    ? `${fileName.replace(/\.[^/.]+$/, '')}_noise_${noiseMode}.png`
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
          <button
            type="button"
            onClick={() => setActiveFilter('noise')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'noise'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm shadow-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Sensor Noise</span>
            <span className="text-[10px] bg-amber-400/30 text-amber-200 px-1.5 py-0.2 rounded-full font-bold">
              PRNU
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

      {/* Sensor Noise Specialized Secondary Control Bar */}
      {activeFilter === 'noise' && (
        <div className="w-full bg-slate-950/70 border border-amber-500/30 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Noise Mode Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono text-[11px]">Mode:</span>
            <div className="inline-flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setNoiseMode('residual')}
                className={`px-3 py-1 rounded cursor-pointer transition ${
                  noiseMode === 'residual'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Amplified Grain (Residual)
              </button>
              <button
                type="button"
                onClick={() => setNoiseMode('variance')}
                className={`px-3 py-1 rounded cursor-pointer transition ${
                  noiseMode === 'variance'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Variance Heatmap
              </button>
            </div>
          </div>

          {/* Sliders / Options */}
          <div className="flex items-center gap-4 text-slate-300">
            {noiseMode === 'residual' ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Amplification: <strong>{noiseGain}x</strong></span>
                <input
                  type="range"
                  min="4"
                  max="35"
                  step="1"
                  value={noiseGain}
                  onChange={(e) => setNoiseGain(Number(e.target.value))}
                  className="w-24 accent-amber-400 cursor-pointer"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Window:</span>
                {[5, 7, 11].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setNoiseWindow(w)}
                    className={`px-2 py-0.5 rounded font-mono text-[10px] cursor-pointer transition ${
                      noiseWindow === w
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {w}×{w}
                  </button>
                ))}
              </div>
            )}

            {/* Heatmap Legend */}
            {noiseMode === 'variance' && (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-slate-400 pl-3 border-l border-slate-800">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-900" title="Low noise / AI inpaint / smoothing" />
                <span>Zero Noise</span>
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 ml-1" title="Natural sensor noise" />
                <span>ISO Grain</span>
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-500 ml-1" title="High noise / splice" />
                <span>Splice Disparity</span>
              </div>
            )}
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
            : activeFilter === 'noise'
            ? noiseMode === 'residual'
              ? 'Amplified Residual: Displays the extracted high-frequency sensor grain centered around mid-gray. AI-inpainted, blurred, or airbrushed regions appear unnaturally smooth and flat, while pasted foreign elements exhibit distinct grain disparity.'
              : 'Variance Heatmap: Computes sliding-window standard deviation of sensor noise. Deep indigo/purple highlights smoothed, cloned, or AI-inpainted areas with zero noise; emerald green represents natural camera ISO sensor grain; crimson red highlights high-variance spliced patches.'
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
          <ForensicLoupe
            src={resultUrl}
            alt={`Filter: ${activeFilter}`}
            zoom={loupeZoom}
            enabled={isLoupeEnabled}
            className="max-h-72 sm:max-h-95 md:max-h-115 max-w-full w-auto object-contain rounded-xl border border-slate-800 shadow-xl"
          />
        ) : (
          <div className="text-xs text-slate-500">Processing channel filter...</div>
        )}
      </div>
    </div>
  );
}
