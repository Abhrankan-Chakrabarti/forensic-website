import { useState, useRef, useEffect, useCallback, useId } from 'react';

// Direction helper for compass angles (0° = East, 90° = South, 180° = West, 270° = North)
function getCompassHeading(degrees) {
  const norm = ((degrees % 360) + 360) % 360;
  const headings = ['E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N', 'NNE', 'NE', 'ENE'];
  const idx = Math.round(norm / 22.5) % 16;
  return `${norm.toFixed(1)}° (${headings[idx]})`;
}

// Clamps (x, y) coordinates to image boundary rectangle [pad, w - pad] x [pad, h - pad]
function clampToBoundary(x, y, w, h, pad = 24) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;

  if (x >= pad && x <= w - pad && y >= pad && y <= h - pad) {
    return { isInside: true, bx: x, by: y, dist: 0 };
  }

  const halfW = (w / 2) - pad;
  const halfH = (h / 2) - pad;

  const scaleX = Math.abs(dx) > 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);

  const bx = cx + dx * scale;
  const by = cy + dy * scale;
  const dist = Math.hypot(x - bx, y - by);

  return { isInside: false, bx, by, dist: Math.round(dist) };
}

export default function ShadowConsistencyView({
  imageSrc,
  fileName = 'evidence',
  onExportPlate,
}) {
  const [mode, setMode] = useState('rays'); // 'rays' (Shadow Vanishing Rays) or 'probes' (Surface Luminance Probes)
  const [showInfiniteLines, setShowInfiniteLines] = useState(true);
  const [showCompass, setShowCompass] = useState(true);
  const [probeRadius, setProbeRadius] = useState(24); // pixels
  const [activeDrag, setActiveDrag] = useState(null); // { type, id, handle }
  const [imgDimensions, setImgDimensions] = useState({ w: 800, h: 600 });
  const [probeGradients, setProbeGradients] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [stageScale, setStageScale] = useState(1.0); // 1.0 (Fit), 0.65 (Wide), 0.45 (Horizon)

  const containerRef = useRef(null);
  const imageCanvasRef = useRef(null);
  const infiniteLinesId = useId();
  const compassToggleId = useId();

  // Shadow Rays State (Default aligned to converge visibly near top-center at (0.50, 0.10))
  const [rays, setRays] = useState([
    {
      id: 'ray1',
      label: 'Ray 1 (Suspect Subject)',
      color: '#38bdf8', // Neon Cyan
      caster: { x: 0.35, y: 0.40 },
      tip: { x: 0.20, y: 0.70 },
    },
    {
      id: 'ray2',
      label: 'Ray 2 (Reference Object)',
      color: '#f59e0b', // Neon Amber
      caster: { x: 0.65, y: 0.40 },
      tip: { x: 0.80, y: 0.70 },
    },
  ]);

  // Surface Luminance Probes State
  const [probes, setProbes] = useState({
    probeA: { label: 'Probe A (Suspect)', x: 0.38, y: 0.42, color: '#38bdf8' },
    probeB: { label: 'Probe B (Reference)', x: 0.66, y: 0.40, color: '#f59e0b' },
  });

  // Load natural image dimensions and render offscreen analysis buffer
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      setImgDimensions({ w, h });

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      imageCanvasRef.current = canvas;
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Dragging Handlers
  const handlePointerDown = useCallback((dragMeta, e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDrag(dragMeta);
  }, []);

  useEffect(() => {
    if (!activeDrag) return;

    const handlePointerMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const normX = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));

      if (activeDrag.type === 'ray') {
        setRays((prev) =>
          prev.map((r) => {
            if (r.id !== activeDrag.id) return r;
            return {
              ...r,
              [activeDrag.handle]: { x: normX, y: normY },
            };
          })
        );
      } else if (activeDrag.type === 'probe') {
        setProbes((prev) => ({
          ...prev,
          [activeDrag.id]: {
            ...prev[activeDrag.id],
            x: normX,
            y: normY,
          },
        }));
      }
    };

    const handlePointerUp = () => {
      setActiveDrag(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeDrag]);

  // Ray Geometry Calculations (Vanishing Point & Angular Discrepancy)
  const computeRayGeometry = useCallback(() => {
    const { w, h } = imgDimensions;
    const computedRays = rays.map((r) => {
      const p0 = { x: r.caster.x * w, y: r.caster.y * h };
      const p1 = { x: r.tip.x * w, y: r.tip.y * h };
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const length = Math.hypot(dx, dy);
      const angleDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;

      // Line equation: a*x + b*y + c = 0
      const a = p0.y - p1.y;
      const b = p1.x - p0.x;
      const c = p0.x * p1.y - p1.x * p0.y;

      return {
        ...r,
        p0,
        p1,
        dx,
        dy,
        length,
        angleDeg,
        a,
        b,
        c,
      };
    });

    // Pairwise angular differences & intersections
    let maxAngleDiff = 0;
    const intersections = [];

    for (let i = 0; i < computedRays.length; i++) {
      for (let j = i + 1; j < computedRays.length; j++) {
        const r1 = computedRays[i];
        const r2 = computedRays[j];

        let diff = Math.abs(r1.angleDeg - r2.angleDeg);
        if (diff > 180) diff = 360 - diff;
        if (diff > maxAngleDiff) maxAngleDiff = diff;

        // Line intersection: det = a1*b2 - a2*b1
        const det = r1.a * r2.b - r2.a * r1.b;
        if (Math.abs(det) > 1e-4) {
          const ix = (r1.b * r2.c - r2.b * r1.c) / det;
          const iy = (r2.a * r1.c - r1.a * r2.c) / det;
          intersections.push({ x: ix, y: iy, r1Label: r1.label, r2Label: r2.label });
        }
      }
    }

    // Centroid of intersections
    let vanishingPoint = null;
    if (intersections.length > 0) {
      const avgX = intersections.reduce((acc, p) => acc + p.x, 0) / intersections.length;
      const avgY = intersections.reduce((acc, p) => acc + p.y, 0) / intersections.length;
      vanishingPoint = { x: avgX, y: avgY };
    }

    let verdict = 'Consistent Light Source (Unified Geometry)';
    let verdictColor = 'text-emerald-400';
    let verdictBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

    if (maxAngleDiff > 12.0) {
      verdict = 'Conflicting Light Sources (Spliced Shadow Geometry)';
      verdictColor = 'text-rose-400';
      verdictBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    } else if (maxAngleDiff > 5.0) {
      verdict = 'Marginal Discrepancy (Possible Perspective / Sloped Ground)';
      verdictColor = 'text-amber-400';
      verdictBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }

    let vlClamped = null;
    if (vanishingPoint) {
      vlClamped = clampToBoundary(vanishingPoint.x, vanishingPoint.y, w, h, 28);
    }

    return {
      computedRays,
      maxAngleDiff: Number(maxAngleDiff.toFixed(1)),
      intersections,
      vanishingPoint,
      vlClamped,
      verdict,
      verdictColor,
      verdictBadge,
    };
  }, [rays, imgDimensions]);

  const rayGeometry = computeRayGeometry();

  // Compute Surface Luminance Gradients
  const computeLuminanceGradients = useCallback(() => {
    if (!imageCanvasRef.current) return;
    const ctx = imageCanvasRef.current.getContext('2d');
    const { w, h } = imgDimensions;

    const results = {};
    const probeKeys = ['probeA', 'probeB'];

    probeKeys.forEach((key) => {
      const p = probes[key];
      const cx = Math.round(p.x * w);
      const cy = Math.round(p.y * h);
      const rad = probeRadius;

      const x0 = Math.max(1, cx - rad);
      const y0 = Math.max(1, cy - rad);
      const x1 = Math.min(w - 2, cx + rad);
      const y1 = Math.min(h - 2, cy + rad);
      const gw = x1 - x0 + 1;
      const gh = y1 - y0 + 1;

      if (gw <= 2 || gh <= 2) return;

      const imgData = ctx.getImageData(x0, y0, gw, gh).data;
      let gx = 0;
      let gy = 0;
      let totalWeight = 0;

      for (let y = 1; y < gh - 1; y++) {
        for (let x = 1; x < gw - 1; x++) {
          const rx = x0 + x - cx;
          const ry = y0 + y - cy;
          const dist = Math.hypot(rx, ry);

          if (dist <= rad) {
            const weight = 1 - dist / rad;
            const idxLeft = (y * gw + (x - 1)) * 4;
            const idxRight = (y * gw + (x + 1)) * 4;
            const idxUp = ((y - 1) * gw + x) * 4;
            const idxDown = ((y + 1) * gw + x) * 4;

            const lumL = 0.299 * imgData[idxLeft] + 0.587 * imgData[idxLeft + 1] + 0.114 * imgData[idxLeft + 2];
            const lumR = 0.299 * imgData[idxRight] + 0.587 * imgData[idxRight + 1] + 0.114 * imgData[idxRight + 2];
            const lumU = 0.299 * imgData[idxUp] + 0.587 * imgData[idxUp + 1] + 0.114 * imgData[idxUp + 2];
            const lumD = 0.299 * imgData[idxDown] + 0.587 * imgData[idxDown + 1] + 0.114 * imgData[idxDown + 2];

            gx += (lumR - lumL) * weight;
            gy += (lumD - lumU) * weight;
            totalWeight += weight;
          }
        }
      }

      const gradMag = Math.hypot(gx, gy);
      // Light direction points in the direction of the gradient (towards the brightest highlight)
      const lightAngleDeg = ((Math.atan2(gy, gx) * 180) / Math.PI + 360) % 360;

      results[key] = {
        angle: Number(lightAngleDeg.toFixed(1)),
        heading: getCompassHeading(lightAngleDeg),
        magnitude: gradMag / Math.max(1, totalWeight),
        vector: gradMag > 0 ? { x: gx / gradMag, y: gy / gradMag } : { x: 0, y: 0 },
      };
    });

    if (results.probeA && results.probeB) {
      let diff = Math.abs(results.probeA.angle - results.probeB.angle);
      if (diff > 180) diff = 360 - diff;
      results.diff = Number(diff.toFixed(1));

      if (diff > 35.0) {
        results.verdict = 'Conflicting Surface Lighting (Opposing Key Lights)';
        results.verdictColor = 'text-rose-400';
        results.verdictBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      } else if (diff > 20.0) {
        results.verdict = 'Marginal Illumination Disparity';
        results.verdictColor = 'text-amber-400';
        results.verdictBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      } else {
        results.verdict = 'Consistent Surface Illumination (Matched Key Light)';
        results.verdictColor = 'text-emerald-400';
        results.verdictBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      }
    }

    setProbeGradients(results);
  }, [imgDimensions, probes, probeRadius]);

  useEffect(() => {
    if (mode === 'probes') {
      computeLuminanceGradients();
    }
  }, [mode, probes, probeRadius, computeLuminanceGradients]);

  // Ray Management Actions
  const handleAddRay = () => {
    if (rays.length >= 4) return;
    const palette = ['#38bdf8', '#f59e0b', '#f43f5e', '#10b981'];
    const newId = `ray${rays.length + 1}`;
    const nextColor = palette[rays.length % palette.length];
    setRays((prev) => [
      ...prev,
      {
        id: newId,
        label: `Ray ${prev.length + 1}`,
        color: nextColor,
        caster: { x: 0.5, y: 0.4 },
        tip: { x: 0.6, y: 0.7 },
      },
    ]);
  };

  const handleResetRays = () => {
    setRays([
      {
        id: 'ray1',
        label: 'Ray 1 (Suspect Subject)',
        color: '#38bdf8',
        caster: { x: 0.35, y: 0.40 },
        tip: { x: 0.20, y: 0.70 },
      },
      {
        id: 'ray2',
        label: 'Ray 2 (Reference Object)',
        color: '#f59e0b',
        caster: { x: 0.65, y: 0.40 },
        tip: { x: 0.80, y: 0.70 },
      },
    ]);
  };

  // High-Resolution Forensic Plate Export
  const exportLightingPlate = () => {
    if (!imageCanvasRef.current) return;
    setIsExporting(true);

    const { w, h } = imgDimensions;
    const canvas = document.createElement('canvas');
    const headerHeight = 72;
    const footerHeight = 84;
    canvas.width = w;
    canvas.height = h + headerHeight + footerHeight;
    const ctx = canvas.getContext('2d');

    // Header Background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, headerHeight);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('FORENSIC ILLUMINANT & SHADOW CONSISTENCY REPORT', 24, 32);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText(`Target: ${fileName} | Mode: ${mode === 'rays' ? 'Shadow Vanishing Rays' : 'Surface Luminance Gradient'}`, 24, 54);

    // Draw Original Image
    ctx.drawImage(imageCanvasRef.current, 0, headerHeight, w, h);

    // Draw Overlays
    ctx.save();
    ctx.translate(0, headerHeight);

    if (mode === 'rays') {
      const { computedRays, vanishingPoint } = rayGeometry;

      // Draw Infinite Extrapolations if enabled
      if (showInfiniteLines) {
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1.5;
        computedRays.forEach((r) => {
          ctx.strokeStyle = `${r.color}88`;
          const extLen = Math.max(w, h) * 1.5;
          ctx.beginPath();
          ctx.moveTo(r.p0.x - (r.dx / r.length) * extLen, r.p0.y - (r.dy / r.length) * extLen);
          ctx.lineTo(r.p1.x + (r.dx / r.length) * extLen, r.p1.y + (r.dy / r.length) * extLen);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }

      // Draw Main Rays
      computedRays.forEach((r) => {
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(r.p0.x, r.p0.y);
        ctx.lineTo(r.p1.x, r.p1.y);
        ctx.stroke();

        // Caster Point (Solid Circle with Crosshairs)
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.p0.x, r.p0.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Tip Arrowhead
        const headAngle = Math.atan2(r.dy, r.dx);
        const headLen = 14;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.moveTo(r.p1.x, r.p1.y);
        ctx.lineTo(r.p1.x - headLen * Math.cos(headAngle - Math.PI / 6), r.p1.y - headLen * Math.sin(headAngle - Math.PI / 6));
        ctx.lineTo(r.p1.x - headLen * Math.cos(headAngle + Math.PI / 6), r.p1.y - headLen * Math.sin(headAngle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        // Label
        ctx.fillStyle = '#020617ee';
        ctx.fillRect(r.p0.x + 10, r.p0.y - 18, 140, 22);
        ctx.strokeStyle = r.color;
        ctx.strokeRect(r.p0.x + 10, r.p0.y - 18, 140, 22);
        ctx.fillStyle = r.color;
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`${r.label} (${r.angleDeg.toFixed(1)}°)`, r.p0.x + 14, r.p0.y - 3);
      });

      // Draw Vanishing Point Marker
      if (vanishingPoint) {
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(vanishingPoint.x, vanishingPoint.y, 14, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(vanishingPoint.x, vanishingPoint.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#fef08a';
        ctx.fill();

        ctx.fillStyle = '#020617ee';
        ctx.fillRect(vanishingPoint.x + 16, vanishingPoint.y - 12, 160, 22);
        ctx.strokeStyle = '#eab308';
        ctx.strokeRect(vanishingPoint.x + 16, vanishingPoint.y - 12, 160, 22);
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`VL (${vanishingPoint.x.toFixed(0)}, ${vanishingPoint.y.toFixed(0)})`, vanishingPoint.x + 20, vanishingPoint.y + 3);
      }
    } else if (mode === 'probes' && probeGradients) {
      ['probeA', 'probeB'].forEach((key) => {
        const p = probes[key];
        const res = probeGradients[key];
        const cx = p.x * w;
        const cy = p.y * h;

        // Draw probe circle
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, probeRadius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = `${p.color}22`;
        ctx.fill();

        // Draw center crosshair
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Draw light vector arrow
        if (res && res.vector) {
          const arrowLen = probeRadius * 2.2;
          const ax = cx + res.vector.x * arrowLen;
          const ay = cy + res.vector.y * arrowLen;

          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(ax, ay);
          ctx.stroke();

          // Arrowhead
          const headAngle = Math.atan2(res.vector.y, res.vector.x);
          const headLen = 12;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax - headLen * Math.cos(headAngle - Math.PI / 6), ay - headLen * Math.sin(headAngle - Math.PI / 6));
          ctx.lineTo(ax - headLen * Math.cos(headAngle + Math.PI / 6), ay - headLen * Math.sin(headAngle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#020617ee';
          ctx.fillRect(cx + probeRadius + 6, cy - 14, 150, 24);
          ctx.strokeStyle = p.color;
          ctx.strokeRect(cx + probeRadius + 6, cy - 14, 150, 24);
          ctx.fillStyle = p.color;
          ctx.font = 'bold 11px monospace';
          ctx.fillText(`${p.label}: ${res.heading}`, cx + probeRadius + 10, cy + 2);
        }
      });
    }

    ctx.restore();

    // Footer Background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, h + headerHeight, w, footerHeight);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';

    if (mode === 'rays') {
      ctx.fillText(`VERDICT: ${rayGeometry.verdict}`, 24, h + headerHeight + 32);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px monospace';
      ctx.fillText(`Angular Disparity (Δθ): ${rayGeometry.maxAngleDiff}° | Analyzed Rays: ${rays.length} | Export Date: ${new Date().toISOString()}`, 24, h + headerHeight + 58);
    } else if (mode === 'probes' && probeGradients) {
      ctx.fillText(`VERDICT: ${probeGradients.verdict || 'Analysis Complete'}`, 24, h + headerHeight + 32);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px monospace';
      ctx.fillText(`Luminance Disparity: ${probeGradients.diff}° | Probe A: ${probeGradients.probeA?.heading} vs Probe B: ${probeGradients.probeB?.heading}`, 24, h + headerHeight + 58);
    }

    const dataUrl = canvas.toDataURL('image/png');
    if (onExportPlate) onExportPlate(dataUrl);

    // Direct Download
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${fileName.replace(/\.[^/.]+$/, '')}_lighting_consistency_plate.png`;
    a.click();
    setIsExporting(false);
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Primary Toolbar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-xl text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="inline-flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('rays')}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                mode === 'rays' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>☀️ Shadow Rays</span>
              <span className="text-[10px] bg-amber-400/30 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
                Vanishing
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode('probes')}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                mode === 'probes' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>💡 Surface Probes</span>
              <span className="text-[10px] bg-amber-400/30 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
                Gradients
              </span>
            </button>
          </div>

          {/* Mode Specific Controls */}
          {mode === 'rays' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRay}
                disabled={rays.length >= 4}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-lg transition cursor-pointer"
              >
                + Add Ray ({rays.length}/4)
              </button>
              <button
                type="button"
                onClick={handleResetRays}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-lg transition cursor-pointer"
                title="Reset Ray Positions"
              >
                ↻ Reset
              </button>
              <label htmlFor={infiniteLinesId} className="hidden sm:flex items-center gap-1.5 cursor-pointer select-none text-slate-300 text-[11px] ml-1">
                <input
                  id={infiniteLinesId}
                  type="checkbox"
                  checked={showInfiniteLines}
                  onChange={(e) => setShowInfiniteLines(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <span>Infinite Rays</span>
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono text-[11px]">Radius: <strong>{probeRadius}px</strong></span>
              <input
                type="range"
                min="15"
                max="45"
                step="2"
                value={probeRadius}
                onChange={(e) => setProbeRadius(Number(e.target.value))}
                className="w-20 accent-amber-500 cursor-pointer"
              />
            </div>
          )}

          <label htmlFor={compassToggleId} className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300 text-[11px]">
            <input
              id={compassToggleId}
              type="checkbox"
              checked={showCompass}
              onChange={(e) => setShowCompass(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>Compass HUD</span>
          </label>

          {mode === 'rays' && (
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-[11px]">
              <span className="text-slate-500 font-mono text-[10px] px-1.5 hidden md:inline">Perspective:</span>
              {[
                { id: 1.0, label: '1x Fit' },
                { id: 0.65, label: '0.65x Wide' },
                { id: 0.45, label: '0.45x Horizon' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStageScale(s.id)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition ${
                    stageScale === s.id ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export Button */}
        <button
          type="button"
          onClick={exportLightingPlate}
          disabled={isExporting}
          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>📸 Export Lighting Plate ↓</span>
        </button>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative w-full flex items-center justify-center bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-8 overflow-hidden select-none min-h-[55vh]">
        <div
          ref={containerRef}
          style={{
            transform: `scale(${stageScale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="relative inline-block max-w-full max-h-[72vh] touch-none cursor-crosshair shadow-2xl rounded-xl"
        >
          {/* Base Evidence Image */}
          <img
            src={imageSrc}
            alt="Evidence Subject"
            className="block max-w-full max-h-[72vh] w-auto h-auto object-contain select-none pointer-events-none"
            draggable={false}
          />

          {/* SVG Overlay for Vector Rays, Probes, and Reticles */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            {mode === 'rays' && (
              <>
                {/* Infinite Dashed Projections */}
                {showInfiniteLines &&
                  rayGeometry.computedRays.map((r) => {
                    const extLen = 2000;
                    const x1 = r.caster.x * 100 - (r.dx / r.length) * (extLen / (imgDimensions.w || 800)) * 100;
                    const y1 = r.caster.y * 100 - (r.dy / r.length) * (extLen / (imgDimensions.h || 600)) * 100;
                    const x2 = r.tip.x * 100 + (r.dx / r.length) * (extLen / (imgDimensions.w || 800)) * 100;
                    const y2 = r.tip.y * 100 + (r.dy / r.length) * (extLen / (imgDimensions.h || 600)) * 100;

                    return (
                      <line
                        key={`ext-${r.id}`}
                        x1={`${x1}%`}
                        y1={`${y1}%`}
                        x2={`${x2}%`}
                        y2={`${y2}%`}
                        stroke={r.color}
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        opacity="0.45"
                      />
                    );
                  })}

                {/* Primary Shadow Lines */}
                {rayGeometry.computedRays.map((r) => (
                  <g key={`line-${r.id}`}>
                    <line
                      x1={`${r.caster.x * 100}%`}
                      y1={`${r.caster.y * 100}%`}
                      x2={`${r.tip.x * 100}%`}
                      y2={`${r.tip.y * 100}%`}
                      stroke={r.color}
                      strokeWidth="3"
                    />
                  </g>
                ))}

                {/* Vanishing Point Target Reticle */}
                {rayGeometry.vanishingPoint && (
                  <g key="vl-target-beacon">
                    {/* Glowing outer halo */}
                    <circle
                      cx={`${(rayGeometry.vanishingPoint.x / (imgDimensions.w || 1)) * 100}%`}
                      cy={`${(rayGeometry.vanishingPoint.y / (imgDimensions.h || 1)) * 100}%`}
                      r="22"
                      fill="rgba(234, 179, 8, 0.2)"
                      stroke="#eab308"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                    {/* Crosshairs */}
                    <line
                      x1={`${((rayGeometry.vanishingPoint.x - 16) / (imgDimensions.w || 1)) * 100}%`}
                      y1={`${(rayGeometry.vanishingPoint.y / (imgDimensions.h || 1)) * 100}%`}
                      x2={`${((rayGeometry.vanishingPoint.x + 16) / (imgDimensions.w || 1)) * 100}%`}
                      y2={`${(rayGeometry.vanishingPoint.y / (imgDimensions.h || 1)) * 100}%`}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <line
                      x1={`${(rayGeometry.vanishingPoint.x / (imgDimensions.w || 1)) * 100}%`}
                      y1={`${((rayGeometry.vanishingPoint.y - 16) / (imgDimensions.h || 1)) * 100}%`}
                      x2={`${(rayGeometry.vanishingPoint.x / (imgDimensions.w || 1)) * 100}%`}
                      y2={`${((rayGeometry.vanishingPoint.y + 16) / (imgDimensions.h || 1)) * 100}%`}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    {/* Golden core */}
                    <circle
                      cx={`${(rayGeometry.vanishingPoint.x / (imgDimensions.w || 1)) * 100}%`}
                      cy={`${(rayGeometry.vanishingPoint.y / (imgDimensions.h || 1)) * 100}%`}
                      r="6"
                      fill="#fde047"
                      stroke="#020617"
                      strokeWidth="1.5"
                    />
                    {/* High-visibility badge */}
                    <rect
                      x={`${(rayGeometry.vanishingPoint.x / (imgDimensions.w || 1)) * 100}%`}
                      y={`${(rayGeometry.vanishingPoint.y / (imgDimensions.h || 1)) * 100}%`}
                      transform="translate(14, -14)"
                      width="156"
                      height="26"
                      rx="6"
                      fill="#020617f4"
                      stroke="#eab308"
                      strokeWidth="1.5"
                    />
                    <text
                      x={`${(rayGeometry.vanishingPoint.x / (imgDimensions.w || 1)) * 100}%`}
                      y={`${(rayGeometry.vanishingPoint.y / (imgDimensions.h || 1)) * 100}%`}
                      transform="translate(22, 3)"
                      fill="#fef08a"
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      ☀️ VL ({rayGeometry.vanishingPoint.x.toFixed(0)}, {rayGeometry.vanishingPoint.y.toFixed(0)})
                    </text>
                  </g>
                )}

                {/* Edge Radar Tracker when VL is outside the image bounds */}
                {rayGeometry.vanishingPoint && rayGeometry.vlClamped && !rayGeometry.vlClamped.isInside && (
                  <g key="vl-edge-beacon">
                    <line
                      x1={`${(rayGeometry.vlClamped.bx / (imgDimensions.w || 1)) * 100}%`}
                      y1={`${(rayGeometry.vlClamped.by / (imgDimensions.h || 1)) * 100}%`}
                      x2={`${(rayGeometry.vanishingPoint.x / (imgDimensions.w || 1)) * 100}%`}
                      y2={`${(rayGeometry.vanishingPoint.y / (imgDimensions.h || 1)) * 100}%`}
                      stroke="#eab308"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      opacity="0.85"
                    />
                    <circle
                      cx={`${(rayGeometry.vlClamped.bx / (imgDimensions.w || 1)) * 100}%`}
                      cy={`${(rayGeometry.vlClamped.by / (imgDimensions.h || 1)) * 100}%`}
                      r="14"
                      fill="#020617ee"
                      stroke="#eab308"
                      strokeWidth="2"
                    />
                    <circle
                      cx={`${(rayGeometry.vlClamped.bx / (imgDimensions.w || 1)) * 100}%`}
                      cy={`${(rayGeometry.vlClamped.by / (imgDimensions.h || 1)) * 100}%`}
                      r="5"
                      fill="#facc15"
                    />
                    <rect
                      x={`${(rayGeometry.vlClamped.bx / (imgDimensions.w || 1)) * 100}%`}
                      y={`${(rayGeometry.vlClamped.by / (imgDimensions.h || 1)) * 100}%`}
                      transform="translate(18, -14)"
                      width="196"
                      height="26"
                      rx="6"
                      fill="#020617fa"
                      stroke="#eab308"
                      strokeWidth="1.5"
                    />
                    <text
                      x={`${(rayGeometry.vlClamped.bx / (imgDimensions.w || 1)) * 100}%`}
                      y={`${(rayGeometry.vlClamped.by / (imgDimensions.h || 1)) * 100}%`}
                      transform="translate(26, 3)"
                      fill="#fef08a"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      📍 VL: {rayGeometry.vlClamped.dist}px off-screen
                    </text>
                  </g>
                )}
              </>
            )}

            {mode === 'probes' && probeGradients && (
              <>
                {['probeA', 'probeB'].map((key) => {
                  const p = probes[key];
                  const res = probeGradients[key];
                  if (!res || !res.vector) return null;

                  return (
                    <g key={`arrow-${key}`}>
                      <line
                        x1={`${p.x * 100}%`}
                        y1={`${p.y * 100}%`}
                        x2={`${p.x * 100 + res.vector.x * 6}%`}
                        y2={`${p.y * 100 + res.vector.y * 6}%`}
                        stroke={p.color}
                        strokeWidth="3"
                      />
                    </g>
                  );
                })}
              </>
            )}
          </svg>

          {/* Interactive Draggable Knobs for Rays */}
          {mode === 'rays' &&
            rays.map((r) => (
              <div key={r.id}>
                {/* Caster Handle (Circle) */}
                <div
                  onPointerDown={(e) => handlePointerDown({ type: 'ray', id: r.id, handle: 'caster' }, e)}
                  style={{ left: `${r.caster.x * 100}%`, top: `${r.caster.y * 100}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white cursor-grab active:cursor-grabbing shadow-lg flex items-center justify-center transition-transform hover:scale-125 z-20"
                  title={`${r.label}: Caster Object Point`}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                  <span
                    className="absolute left-6 top-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap bg-slate-950/90 border border-slate-700 pointer-events-none"
                    style={{ color: r.color }}
                  >
                    {r.label} (Caster)
                  </span>
                </div>

                {/* Shadow Tip Handle (Arrowhead / Diamond) */}
                <div
                  onPointerDown={(e) => handlePointerDown({ type: 'ray', id: r.id, handle: 'tip' }, e)}
                  style={{ left: `${r.tip.x * 100}%`, top: `${r.tip.y * 100}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rotate-45 border-2 border-white cursor-grab active:cursor-grabbing shadow-lg flex items-center justify-center transition-transform hover:scale-125 z-20"
                  title={`${r.label}: Shadow Tip Point`}
                >
                  <div className="w-2 h-2" style={{ backgroundColor: r.color }} />
                  <span
                    className="absolute left-6 top-0 -rotate-45 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap bg-slate-950/90 border border-slate-700 pointer-events-none"
                    style={{ color: r.color }}
                  >
                    Tip
                  </span>
                </div>
              </div>
            ))}

          {/* Interactive Draggable Knobs for Probes */}
          {mode === 'probes' &&
            ['probeA', 'probeB'].map((key) => {
              const p = probes[key];
              const res = probeGradients ? probeGradients[key] : null;

              return (
                <div
                  key={key}
                  onPointerDown={(e) => handlePointerDown({ type: 'probe', id: key }, e)}
                  style={{
                    left: `${p.x * 100}%`,
                    top: `${p.y * 100}%`,
                    width: `${probeRadius * 2}px`,
                    height: `${probeRadius * 2}px`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 cursor-grab active:cursor-grabbing shadow-xl flex items-center justify-center transition-transform hover:scale-105 z-20"
                >
                  <div
                    className="absolute inset-0 rounded-full opacity-20"
                    style={{ backgroundColor: p.color }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-white shadow-sm"
                  />
                  <span
                    className="absolute left-full ml-2 top-0 text-[10px] font-bold font-mono px-2 py-0.5 rounded shadow whitespace-nowrap bg-slate-950/90 border border-slate-700 pointer-events-none z-30"
                    style={{ color: p.color }}
                  >
                    {p.label} {res ? `(${res.heading})` : ''}
                  </span>
                </div>
              );
            })}

          {/* Live Compass HUD */}
          {showCompass && (
            <div className="absolute bottom-3 right-3 bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 shadow-xl flex items-center gap-3 z-30 pointer-events-none">
              <div className="relative w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center bg-slate-900">
                <span className="absolute top-0 text-[8px] font-bold text-slate-500">N</span>
                <span className="absolute bottom-0 text-[8px] font-bold text-slate-500">S</span>
                <span className="absolute left-0.5 text-[8px] font-bold text-slate-500">W</span>
                <span className="absolute right-0.5 text-[8px] font-bold text-slate-500">E</span>
                {mode === 'rays' && rayGeometry.computedRays.length > 0 && (
                  <div
                    className="w-0.5 h-6 bg-cyan-400 origin-center transition-transform"
                    style={{ transform: `rotate(${rayGeometry.computedRays[0].angleDeg}deg)` }}
                  />
                )}
                {mode === 'probes' && probeGradients?.probeA && (
                  <div
                    className="w-0.5 h-6 bg-cyan-400 origin-center transition-transform"
                    style={{ transform: `rotate(${probeGradients.probeA.angle}deg)` }}
                  />
                )}
              </div>
              <div className="text-[10px] font-mono">
                <div className="text-slate-400">Light Heading:</div>
                <div className="text-cyan-300 font-bold">
                  {mode === 'rays' && rayGeometry.computedRays.length > 0
                    ? getCompassHeading(rayGeometry.computedRays[0].angleDeg)
                    : mode === 'probes' && probeGradients?.probeA
                    ? probeGradients.probeA.heading
                    : 'Awaiting Lock'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Forensic Telemetry Deck */}
      <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs font-mono space-y-3">
        {mode === 'rays' ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 uppercase tracking-wider text-[11px]">Geometric Verdict:</span>
                <span className={`px-2.5 py-0.5 rounded-full border font-bold text-xs ${rayGeometry.verdictBadge}`}>
                  {rayGeometry.verdict}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400">Max Ray Disparity:</span>
                <span className={`font-bold text-sm ${rayGeometry.verdictColor}`}>
                  Δθ = {rayGeometry.maxAngleDiff}°
                </span>
              </div>
            </div>

            {/* Ray Angle Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {rayGeometry.computedRays.map((r) => (
                <div key={r.id} className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold" style={{ color: r.color }}>{r.label}</span>
                    <span className="text-slate-300 font-bold">{r.angleDeg.toFixed(1)}°</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Heading: <span className="text-slate-200">{getCompassHeading(r.angleDeg)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Caster: ({r.p0.x.toFixed(0)}, {r.p0.y.toFixed(0)}) → Tip: ({r.p1.x.toFixed(0)}, {r.p1.y.toFixed(0)})
                  </div>
                </div>
              ))}
            </div>

            {rayGeometry.vanishingPoint && (
              <div className="text-[11px] text-slate-400 pt-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>
                    Estimated Light Vanishing Point (V<sub>L</sub>):{' '}
                    <strong className="text-yellow-400">
                      ({rayGeometry.vanishingPoint.x.toFixed(1)}, {rayGeometry.vanishingPoint.y.toFixed(1)})
                    </strong>
                  </span>
                  {rayGeometry.vlClamped && !rayGeometry.vlClamped.isInside && (
                    <span className="text-amber-400 font-semibold text-[10px] bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                      Off-screen by {rayGeometry.vlClamped.dist}px
                    </span>
                  )}
                  {rayGeometry.vlClamped && !rayGeometry.vlClamped.isInside && stageScale === 1.0 && (
                    <button
                      type="button"
                      onClick={() => setStageScale(0.65)}
                      className="text-[10px] px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded transition cursor-pointer"
                    >
                      🔍 Fit V<sub>L</sub> on Stage
                    </button>
                  )}
                </div>
                <span className="text-slate-500 text-[10px]">
                  {rayGeometry.intersections.length} pairwise ray intersections computed
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 uppercase tracking-wider text-[11px]">Surface Lighting Verdict:</span>
                <span className={`px-2.5 py-0.5 rounded-full border font-bold text-xs ${probeGradients?.verdictBadge || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {probeGradients?.verdict || 'Positioning Probes...'}
                </span>
              </div>
              {probeGradients?.diff !== undefined && (
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">Illumination Disparity:</span>
                  <span className={`font-bold text-sm ${probeGradients.verdictColor}`}>
                    Δα = {probeGradients.diff}°
                  </span>
                </div>
              )}
            </div>

            {/* Probe Telemetry Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['probeA', 'probeB'].map((key) => {
                const p = probes[key];
                const res = probeGradients ? probeGradients[key] : null;

                return (
                  <div key={key} className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold" style={{ color: p.color }}>{p.label}</span>
                      <span className="text-slate-200 font-bold">{res ? `${res.angle}°` : '...'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Dominant Heading: <strong className="text-slate-200">{res ? res.heading : 'Computing...'}</strong>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Center: ({Math.round(p.x * imgDimensions.w)}, {Math.round(p.y * imgDimensions.h)}) | Sample Radius: {probeRadius}px
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
