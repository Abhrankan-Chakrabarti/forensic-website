import { useEffect, useRef, useState, useCallback } from 'react';

export default function Histogram({ imageSrc }) {
  const canvasRef = useRef(null);
  const [activeChannel, setActiveChannel] = useState('all'); // 'all', 'lum', 'red', 'green', 'blue'
  const [stats, setStats] = useState(null);

  const renderHistogram = useCallback((rBins, gBins, bBins, lBins, channel) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Find max frequency for scaling
    let maxVal = 0;
    for (let i = 1; i < 255; i++) {
      if (channel === 'all' || channel === 'red') maxVal = Math.max(maxVal, rBins[i]);
      if (channel === 'all' || channel === 'green') maxVal = Math.max(maxVal, gBins[i]);
      if (channel === 'all' || channel === 'blue') maxVal = Math.max(maxVal, bBins[i]);
      if (channel === 'lum') maxVal = Math.max(maxVal, lBins[i]);
    }
    if (maxVal === 0) maxVal = 1;

    // Draw background grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 64; x < 256; x += 64) {
      const px = (x / 255) * width;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }

    const drawChannel = (bins, strokeColor, fillColor) => {
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * width;
        const y = height - (bins[i] / maxVal) * (height - 6);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();

      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    if (channel === 'all') {
      ctx.globalCompositeOperation = 'screen';
      drawChannel(rBins, 'rgba(239, 68, 68, 0.8)', 'rgba(239, 68, 68, 0.15)');
      drawChannel(gBins, 'rgba(16, 185, 129, 0.8)', 'rgba(16, 185, 129, 0.15)');
      drawChannel(bBins, 'rgba(59, 130, 246, 0.8)', 'rgba(59, 130, 246, 0.15)');
      ctx.globalCompositeOperation = 'source-over';
    } else if (channel === 'lum') {
      drawChannel(lBins, 'rgba(34, 211, 238, 0.9)', 'rgba(34, 211, 238, 0.2)');
    } else if (channel === 'red') {
      drawChannel(rBins, 'rgba(239, 68, 68, 0.9)', 'rgba(239, 68, 68, 0.2)');
    } else if (channel === 'green') {
      drawChannel(gBins, 'rgba(16, 185, 129, 0.9)', 'rgba(16, 185, 129, 0.2)');
    } else if (channel === 'blue') {
      drawChannel(bBins, 'rgba(59, 130, 246, 0.9)', 'rgba(59, 130, 246, 0.2)');
    }
  }, []);

  useEffect(() => {
    if (!imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const offCanvas = document.createElement('canvas');
      const w = Math.min(img.naturalWidth || img.width, 1024);
      const h = Math.min(img.naturalHeight || img.height, 1024);
      offCanvas.width = w;
      offCanvas.height = h;

      const ctx = offCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);

      const rBins = new Uint32Array(256);
      const gBins = new Uint32Array(256);
      const bBins = new Uint32Array(256);
      const lBins = new Uint32Array(256);

      const totalPixels = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

        rBins[r]++;
        gBins[g]++;
        bBins[b]++;
        lBins[lum]++;
      }

      // Detect clipping (unnatural spikes at 0 or 255)
      const shadowClip = ((lBins[0] / totalPixels) * 100).toFixed(1);
      const highlightClip = ((lBins[255] / totalPixels) * 100).toFixed(1);

      setStats({
        shadowClip: Number(shadowClip),
        highlightClip: Number(highlightClip),
      });

      renderHistogram(rBins, gBins, bBins, lBins, activeChannel);
    };
    img.src = imageSrc;
  }, [imageSrc, activeChannel, renderHistogram]);

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Color Channel & Luminance Histogram</span>
          {stats && (stats.shadowClip > 2 || stats.highlightClip > 2) && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 text-[10px]">
              {stats.shadowClip > 2 ? `Shadow clip: ${stats.shadowClip}%` : ''}
              {stats.shadowClip > 2 && stats.highlightClip > 2 ? ' • ' : ''}
              {stats.highlightClip > 2 ? `Highlight clip: ${stats.highlightClip}%` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
          {[
            { id: 'all', label: 'RGB' },
            { id: 'lum', label: 'Lum' },
            { id: 'red', label: 'R' },
            { id: 'green', label: 'G' },
            { id: 'blue', label: 'B' },
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={`px-2 py-1 rounded transition cursor-pointer text-[11px] ${
                activeChannel === ch.id
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-950 rounded-xl p-2 border border-slate-800/80 flex justify-center">
        <canvas
          ref={canvasRef}
          width={512}
          height={110}
          className="w-full h-28 object-contain rounded"
        />
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2 px-1">
        <span>0 (Darks / Shadows)</span>
        <span>128 (Midtones)</span>
        <span>255 (Highlights / Whites)</span>
      </div>
    </div>
  );
}
