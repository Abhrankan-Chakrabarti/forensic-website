import { useState, useRef, useEffect, useCallback } from 'react';

const PRESET_TAGS = [
  'ELA Discontinuity',
  'Noise Disparity',
  'Splice Seam',
  'Clone Artifact',
  'Altered Text',
  'Metadata Anomaly',
];

const COLOR_PALETTE = [
  { name: 'Neon Cyan', hex: '#06b6d4' },
  { name: 'Rose Red', hex: '#f43f5e' },
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Emerald Green', hex: '#10b981' },
];

// Pure function to draw an individual annotation item onto any target 2D context
function drawAnnotationItem(ctx, item, index, canvasWidth) {
  const { type, x1, y1, x2, y2, color, label } = item;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, Math.round(canvasWidth / 450));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.round(Math.sqrt(dx * dx + dy * dy));

  if (type === 'box') {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const w = Math.abs(dx);
    const h = Math.abs(dy);

    // Box body
    ctx.strokeRect(minX, minY, w, h);

    // Semi-transparent highlight fill
    ctx.fillStyle = `${color}20`;
    ctx.fillRect(minX, minY, w, h);

    // Label banner
    const displayLabel = `#${index + 1} ${label || 'Zone'}`;
    const fontSize = Math.max(12, Math.round(canvasWidth / 50));
    ctx.font = `bold ${fontSize}px monospace`;
    const textMetrics = ctx.measureText(displayLabel);
    const tagPadding = 6;
    const tagW = textMetrics.width + tagPadding * 2;
    const tagH = fontSize + 8;

    ctx.fillStyle = '#020617ee';
    ctx.fillRect(minX, Math.max(0, minY - tagH), tagW, tagH);
    ctx.strokeStyle = color;
    ctx.strokeRect(minX, Math.max(0, minY - tagH), tagW, tagH);

    ctx.fillStyle = color;
    ctx.fillText(displayLabel, minX + tagPadding, Math.max(0, minY - tagH) + fontSize);
  } else if (type === 'caliper') {
    // Main caliper dimension line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Perpendicular tick marks at endpoints
    const angle = Math.atan2(dy, dx);
    const tickLen = Math.max(8, Math.round(canvasWidth / 70));
    const perpAngle = angle + Math.PI / 2;

    ctx.beginPath();
    ctx.moveTo(x1 - Math.cos(perpAngle) * tickLen, y1 - Math.sin(perpAngle) * tickLen);
    ctx.lineTo(x1 + Math.cos(perpAngle) * tickLen, y1 + Math.sin(perpAngle) * tickLen);
    ctx.moveTo(x2 - Math.cos(perpAngle) * tickLen, y2 - Math.sin(perpAngle) * tickLen);
    ctx.lineTo(x2 + Math.cos(perpAngle) * tickLen, y2 + Math.sin(perpAngle) * tickLen);
    ctx.stroke();

    // Distance tag in center
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const caliperText = `↔ ${dist} px (ΔX:${Math.abs(dx)} ΔY:${Math.abs(dy)})`;
    const fontSize = Math.max(11, Math.round(canvasWidth / 55));
    ctx.font = `bold ${fontSize}px monospace`;
    const metrics = ctx.measureText(caliperText);
    const pad = 5;

    ctx.fillStyle = '#020617ee';
    ctx.fillRect(midX - metrics.width / 2 - pad, midY - fontSize - pad, metrics.width + pad * 2, fontSize + pad * 2);
    ctx.strokeStyle = color;
    ctx.strokeRect(midX - metrics.width / 2 - pad, midY - fontSize - pad, metrics.width + pad * 2, fontSize + pad * 2);

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(caliperText, midX, midY - pad);
  } else if (type === 'arrow') {
    // Arrow stem
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrow head at (x2, y2)
    const headLen = Math.max(12, Math.round(canvasWidth / 50));
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Label at tail (x1, y1)
    if (label) {
      const fontSize = Math.max(12, Math.round(canvasWidth / 50));
      ctx.font = `bold ${fontSize}px monospace`;
      const metrics = ctx.measureText(label);
      const pad = 5;
      ctx.fillStyle = '#020617ee';
      ctx.fillRect(x1 - pad, y1 - fontSize - pad, metrics.width + pad * 2, fontSize + pad * 2);
      ctx.strokeStyle = color;
      ctx.strokeRect(x1 - pad, y1 - fontSize - pad, metrics.width + pad * 2, fontSize + pad * 2);
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.fillText(label, x1, y1 - pad);
    }
  } else if (type === 'circle') {
    const radius = dist;
    ctx.beginPath();
    ctx.arc(x1, y1, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Center crosshair
    const chLen = Math.max(6, Math.round(canvasWidth / 90));
    ctx.beginPath();
    ctx.moveTo(x1 - chLen, y1);
    ctx.lineTo(x1 + chLen, y1);
    ctx.moveTo(x1, y1 - chLen);
    ctx.lineTo(x1, y1 + chLen);
    ctx.stroke();

    if (label) {
      const fontSize = Math.max(12, Math.round(canvasWidth / 50));
      ctx.font = `bold ${fontSize}px monospace`;
      const metrics = ctx.measureText(label);
      const pad = 5;
      ctx.fillStyle = '#020617ee';
      ctx.fillRect(x1 - metrics.width / 2 - pad, y1 - radius - fontSize - pad * 2, metrics.width + pad * 2, fontSize + pad * 2);
      ctx.strokeStyle = color;
      ctx.strokeRect(x1 - metrics.width / 2 - pad, y1 - radius - fontSize - pad * 2, metrics.width + pad * 2, fontSize + pad * 2);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(label, x1, y1 - radius - pad);
    }
  }

  ctx.restore();
}

export default function ForensicAnnotationOverlay({
  imageSrc,
  annotations,
  onAnnotationsChange,
  onExportFlattened,
  fileName = 'evidence',
}) {
  const [activeTool, setActiveTool] = useState('box'); // 'box', 'caliper', 'arrow', 'circle'
  const [selectedTag, setSelectedTag] = useState(PRESET_TAGS[0]);
  const [customTag, setCustomTag] = useState('');
  const [activeColor, setActiveColor] = useState(COLOR_PALETTE[0].hex);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  // Load natural dimensions of source image
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setDims({
        w: img.naturalWidth || img.width,
        h: img.naturalHeight || img.height,
      });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Redraw annotations on canvas whenever dimensions, annotations, or active draft changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dims.w === 0 || dims.h === 0) return;

    if (canvas.width !== dims.w || canvas.height !== dims.h) {
      canvas.width = dims.w;
      canvas.height = dims.h;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    annotations.forEach((item, idx) => {
      drawAnnotationItem(ctx, item, idx, canvas.width);
    });

    if (currentDraft) {
      drawAnnotationItem(ctx, currentDraft, annotations.length, canvas.width);
    }
  }, [dims, annotations, currentDraft]);

  // Convert client viewport coordinates to natural image pixel coordinates
  const getNaturalCoords = useCallback((e) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: Math.round(Math.max(0, Math.min(canvasRef.current.width, (clientX - rect.left) * scaleX))),
      y: Math.round(Math.max(0, Math.min(canvasRef.current.height, (clientY - rect.top) * scaleY))),
    };
  }, []);

  // Export combined high-res evidence image
  const generateFlattenedDataUrl = useCallback(() => {
    if (!imageSrc || dims.w === 0 || dims.h === 0) return Promise.resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    return new Promise((resolve) => {
      img.onload = () => {
        const w = dims.w || img.width;
        const h = dims.h || img.height;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = w;
        exportCanvas.height = h;
        const expCtx = exportCanvas.getContext('2d');

        // Draw original evidence plate
        expCtx.drawImage(img, 0, 0, w, h);

        // Draw overlay annotations
        annotations.forEach((item, idx) => {
          drawAnnotationItem(expCtx, item, idx, w);
        });

        // Stamp forensic banner at bottom
        const bannerH = Math.max(24, Math.round(h * 0.04));
        expCtx.fillStyle = '#020617e6';
        expCtx.fillRect(0, h - bannerH, w, bannerH);
        expCtx.fillStyle = '#06b6d4';
        const fontSize = Math.max(10, Math.round(bannerH * 0.5));
        expCtx.font = `bold ${fontSize}px monospace`;
        expCtx.textAlign = 'left';
        expCtx.fillText(
          `FORENSIC LAB ANNOTATED EVIDENCE PLATE • ${fileName} • ${new Date().toISOString()}`,
          12,
          h - Math.round(bannerH * 0.3)
        );

        const dataUrl = exportCanvas.toDataURL('image/png');
        resolve(dataUrl);
      };
      img.src = imageSrc;
    });
  }, [imageSrc, dims, annotations, fileName]);

  // Update flattened export for parent component
  useEffect(() => {
    if (annotations.length > 0) {
      generateFlattenedDataUrl()?.then((dataUrl) => {
        if (dataUrl && onExportFlattened) {
          onExportFlattened(dataUrl);
        }
      });
    } else if (onExportFlattened) {
      onExportFlattened(null);
    }
  }, [annotations, generateFlattenedDataUrl, onExportFlattened]);

  const handlePointerDown = (e) => {
    e.preventDefault();
    const coords = getNaturalCoords(e);
    isDrawingRef.current = true;

    const label = customTag.trim() || selectedTag;
    setCurrentDraft({
      id: Date.now(),
      type: activeTool,
      x1: coords.x,
      y1: coords.y,
      x2: coords.x,
      y2: coords.y,
      color: activeColor,
      label,
    });
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current || !currentDraft) return;
    const coords = getNaturalCoords(e);

    setCurrentDraft((prev) => ({
      ...prev,
      x2: coords.x,
      y2: coords.y,
    }));
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current || !currentDraft) return;
    isDrawingRef.current = false;

    const dx = Math.abs(currentDraft.x2 - currentDraft.x1);
    const dy = Math.abs(currentDraft.y2 - currentDraft.y1);

    // Only commit if user dragged more than 5px to avoid accidental tiny dots
    if (dx > 5 || dy > 5) {
      onAnnotationsChange([...annotations, currentDraft]);
    }

    setCurrentDraft(null);
  };

  const handleUndo = () => {
    if (annotations.length === 0) return;
    onAnnotationsChange(annotations.slice(0, -1));
  };

  const handleClear = () => {
    onAnnotationsChange([]);
  };

  const handleDownloadPlate = async () => {
    const dataUrl = await generateFlattenedDataUrl();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${fileName.replace(/\.[^/.]+$/, '')}_annotated_plate.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Annotation Controls Toolbar */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Tool Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-mono text-[11px] mr-1">Tool:</span>
          <button
            type="button"
            onClick={() => setActiveTool('box')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTool === 'box'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
            title="Bounding Box: Draw rectangular suspect region"
          >
            <span>🔲 Box</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('caliper')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTool === 'caliper'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
            title="Caliper: Measure exact pixel distance & offsets"
          >
            <span>📏 Caliper</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('arrow')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTool === 'arrow'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
            title="Arrow: Point at specific anomaly"
          >
            <span>↗️ Arrow</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('circle')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTool === 'circle'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
            title="Target Circle: Mark circular artifact"
          >
            <span>⭕ Circle</span>
          </button>
        </div>

        {/* Color Palette */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-mono text-[11px] mr-1">Color:</span>
          {COLOR_PALETTE.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setActiveColor(c.hex)}
              className={`w-6 h-6 rounded-full cursor-pointer transition flex items-center justify-center border ${
                activeColor === c.hex ? 'border-white scale-110 shadow-md' : 'border-slate-800 hover:scale-105'
              }`}
              style={{ backgroundColor: c.hex }}
              title={c.name}
            >
              {activeColor === c.hex && <span className="text-black text-[10px] font-bold">✓</span>}
            </button>
          ))}
        </div>

        {/* Action Buttons: Undo, Clear, Export */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={annotations.length === 0}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-xs transition cursor-pointer"
          >
            ↩ Undo
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={annotations.length === 0}
            className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 disabled:opacity-40 disabled:cursor-not-allowed border border-rose-500/40 text-rose-300 text-xs transition cursor-pointer"
          >
            🗑 Clear
          </button>
          {annotations.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadPlate}
              className="px-3 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-xs font-medium transition cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <span>Export Plate ↓</span>
            </button>
          )}
        </div>
      </div>

      {/* Preset Tags Bar */}
      <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 font-mono text-[11px] mr-1">Tag:</span>
          {PRESET_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setSelectedTag(tag);
                setCustomTag('');
              }}
              className={`px-2 py-0.5 rounded-md font-mono text-[11px] cursor-pointer transition ${
                selectedTag === tag && !customTag
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          placeholder="Custom label..."
          className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 placeholder-slate-500 text-[11px] w-36 focus:outline-none focus:border-cyan-400"
        />
      </div>

      {/* Interactive Overlay Canvas Area */}
      <div className="relative w-full flex items-center justify-center min-h-60 sm:min-h-80 bg-slate-950/90 border border-slate-800 rounded-xl p-3 sm:p-4 overflow-hidden select-none">
        {/* Base Evidence Image */}
        <img
          src={imageSrc}
          alt="Evidence Subject"
          className="max-h-72 sm:max-h-95 md:max-h-115 max-w-full w-auto object-contain block rounded-xl pointer-events-none"
        />

        {/* Vector Drawing Overlay Canvas */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute inset-0 m-auto max-h-72 sm:max-h-95 md:max-h-115 max-w-full w-auto h-auto object-contain cursor-crosshair touch-none"
          style={{ width: 'auto', height: 'auto' }}
        />

        {/* Badge Overlay */}
        <div className="absolute top-3 left-3 bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 px-2.5 py-1 rounded-md font-mono pointer-events-none">
          Click & drag to mark with {activeTool.toUpperCase()} • {annotations.length} marked
        </div>
      </div>
    </div>
  );
}
