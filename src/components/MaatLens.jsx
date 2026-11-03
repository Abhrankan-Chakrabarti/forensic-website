import { useState, useRef, useEffect, useCallback } from 'react';

// Egyptian Canon Standardized Grid Line Landmarks
const CANON_LANDMARKS = [
  { key: 'hairline', label: 'Hairline', line18: 18, line21: 21, color: '#eab308', required: true },
  { key: 'shoulder', label: 'Shoulders', line18: 16, line21: 19, color: '#38bdf8' },
  { key: 'elbow', label: 'Elbows', line18: 12, line21: 14, color: '#f59e0b' },
  { key: 'navel', label: 'Navel / Waist', line18: 11, line21: 13, color: '#06b6d4' },
  { key: 'buttock', label: 'Groin / Buttock', line18: 9, line21: 11, color: '#a855f7' },
  { key: 'knee', label: 'Knees', line18: 6, line21: 7, color: '#f43f5e' },
  { key: 'ankle', label: 'Ankles', line18: 1, line21: 1, color: '#10b981' },
  { key: 'soles', label: 'Soles / Baseline', line18: 0, line21: 0, color: '#eab308', required: true },
];

export default function MaatLens({
  imageSrc,
  fileName = 'artifact',
  onExportPlate,
}) {
  const [period, setPeriod] = useState('classical18'); // 'classical18' (18 squares) or 'late21' (21 squares)
  const [gridMode, setGridMode] = useState('full'); // 'full' (square grid) or 'horizontal'
  const [gridOpacity, setGridOpacity] = useState(0.5);
  const [activePoint, setActivePoint] = useState(null);
  const [imgDimensions, setImgDimensions] = useState({ w: 800, h: 600 });

  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);

  const canonTotalUnits = period === 'classical18' ? 18 : 21;

  // Normalized points (0 to 1 range for resolution independence)
  const [normPoints, setNormPoints] = useState({
    hairline: { x: 0.5, y: 0.12 },
    shoulder: { x: 0.5, y: 0.22 },
    elbow: { x: 0.52, y: 0.44 },
    navel: { x: 0.5, y: 0.49 },
    buttock: { x: 0.48, y: 0.58 },
    knee: { x: 0.5, y: 0.72 },
    ankle: { x: 0.5, y: 0.94 },
    soles: { x: 0.5, y: 0.98 },
  });

  // Load natural dimensions of artifact
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImgDimensions({
        w: img.naturalWidth || img.width,
        h: img.naturalHeight || img.height,
      });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Dragging handlers with window listeners
  const handlePointerDown = (key, e) => {
    e.preventDefault();
    e.stopPropagation();
    setActivePoint(key);
    isDraggingRef.current = true;
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDraggingRef.current || !activePoint || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      const normX = Math.max(0.02, Math.min(0.98, (clientX - rect.left) / rect.width));
      const normY = Math.max(0.02, Math.min(0.98, (clientY - rect.top) / rect.height));

      setNormPoints((prev) => ({
        ...prev,
        [activePoint]: { x: normX, y: normY },
      }));
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setActivePoint(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activePoint]);

  // Mathematical Calculations
  const solesYNorm = normPoints.soles.y;
  const hairlineYNorm = normPoints.hairline.y;
  const totalHeightNorm = Math.max(0.01, solesYNorm - hairlineYNorm);
  const gridUnitNorm = totalHeightNorm / canonTotalUnits;

  // Calculate dissonance for a landmark: δ = |actualY - expectedY| / gridUnit
  const getDissonance = useCallback((key) => {
    const landmark = CANON_LANDMARKS.find((l) => l.key === key);
    if (!landmark || !normPoints[key]) return { delta: 0, deltaStr: '0.000', isCompliant: true };

    const lineNum = period === 'classical18' ? landmark.line18 : landmark.line21;
    const expectedYNorm = solesYNorm - lineNum * gridUnitNorm;
    const actualYNorm = normPoints[key].y;

    const delta = (actualYNorm - expectedYNorm) / gridUnitNorm;
    const absDelta = Math.abs(delta);
    return {
      delta,
      absDelta,
      deltaStr: delta > 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3),
      isCompliant: absDelta <= 0.22, // Tolerance: ±0.22 canonical square units
    };
  }, [normPoints, period, solesYNorm, gridUnitNorm]);

  // Overall Ma'at Compliance Score
  const evaluatedLandmarks = CANON_LANDMARKS.filter((l) => !l.required);
  const avgDissonance = evaluatedLandmarks.reduce((acc, l) => acc + getDissonance(l.key).absDelta, 0) / evaluatedLandmarks.length;
  const maatScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, avgDissonance / 0.8)) * 100)));

  // Generate and export high-res artifact plate with canonical grid
  const handleExportPlate = () => {
    if (!imageSrc || !containerRef.current) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = imgDimensions.w || img.width;
      const h = imgDimensions.h || img.height;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');

      // Draw base image
      ctx.drawImage(img, 0, 0, w, h);

      // Dark translucent tint for high grid readability
      ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
      ctx.fillRect(0, 0, w, h);

      const expSolesY = normPoints.soles.y * h;
      const expTotalH = (normPoints.soles.y - normPoints.hairline.y) * h;
      const expUnit = expTotalH / canonTotalUnits;
      const centerX = normPoints.soles.x * w;

      // Draw 18/21 Horizontal Canonical Lines
      for (let i = 0; i <= canonTotalUnits; i++) {
        const y = expSolesY - i * expUnit;
        const isMajor = i % 6 === 0 || i === canonTotalUnits || i === 0;
        ctx.strokeStyle = isMajor ? 'rgba(234, 179, 8, 0.85)' : 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = isMajor ? Math.max(2, Math.round(w / 400)) : 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();

        // Line number label
        ctx.fillStyle = isMajor ? '#eab308' : 'rgba(255, 255, 255, 0.6)';
        const fSize = Math.max(10, Math.round(w / 65));
        ctx.font = `bold ${fSize}px monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(`L${i}`, 10, y - 4);
      }

      // Draw Vertical Grid Columns if Full Grid
      if (gridMode === 'full') {
        const halfCols = Math.ceil(w / expUnit / 2);
        for (let i = -halfCols; i <= halfCols; i++) {
          const x = centerX + i * expUnit;
          if (x >= 0 && x <= w) {
            ctx.strokeStyle = i === 0 ? 'rgba(234, 179, 8, 0.6)' : 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = i === 0 ? Math.max(2, Math.round(w / 450)) : 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
        }
      }

      // Draw Landmark Pins & Labels
      CANON_LANDMARKS.forEach((l) => {
        const pt = normPoints[l.key];
        const px = pt.x * w;
        const py = pt.y * h;
        const radius = Math.max(5, Math.round(w / 120));

        ctx.fillStyle = l.color;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        const diss = getDissonance(l.key);
        const tagText = l.required ? l.label.toUpperCase() : `${l.label} (δ:${diss.deltaStr})`;
        ctx.font = `bold ${Math.max(11, Math.round(w / 60))}px monospace`;
        ctx.fillStyle = '#020617e6';
        const metrics = ctx.measureText(tagText);
        ctx.fillRect(px + radius + 4, py - 10, metrics.width + 8, 20);
        ctx.strokeStyle = l.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + radius + 4, py - 10, metrics.width + 8, 20);
        ctx.fillStyle = l.color;
        ctx.fillText(tagText, px + radius + 8, py + 4);
      });

      // Bottom Forensic Banner
      const bH = Math.max(40, Math.round(h * 0.06));
      ctx.fillStyle = '#020617f0';
      ctx.fillRect(0, h - bH, w, bH);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h - bH);
      ctx.lineTo(w, h - bH);
      ctx.stroke();

      ctx.fillStyle = '#eab308';
      const bSize = Math.max(11, Math.round(bH * 0.38));
      ctx.font = `bold ${bSize}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(
        `THE MA'AT LENS: EGYPTIAN CANON OF PROPORTIONS • ${period.toUpperCase()} • COMPLIANCE: ${maatScore}% • ${new Date().toISOString()}`,
        14,
        h - Math.round(bH * 0.35)
      );

      const dataUrl = c.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${fileName.replace(/\.[^/.]+$/, '')}_maat_canon_grid.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (onExportPlate) onExportPlate(dataUrl);
    };
    img.src = imageSrc;
  };

  // Reset to default canonical positions
  const handleReset = () => {
    setNormPoints({
      hairline: { x: 0.5, y: 0.12 },
      shoulder: { x: 0.5, y: 0.22 },
      elbow: { x: 0.52, y: 0.44 },
      navel: { x: 0.5, y: 0.49 },
      buttock: { x: 0.48, y: 0.58 },
      knee: { x: 0.5, y: 0.72 },
      ankle: { x: 0.5, y: 0.94 },
      soles: { x: 0.5, y: 0.98 },
    });
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 text-slate-200">
      {/* Top Controls Bar */}
      <div className="w-full bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 font-mono text-[11px] font-bold">⚖️ Canon:</span>
            <div className="inline-flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setPeriod('classical18')}
                className={`px-2.5 py-1 rounded cursor-pointer transition ${
                  period === 'classical18' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Classical 18-Grid
              </button>
              <button
                type="button"
                onClick={() => setPeriod('late21')}
                className={`px-2.5 py-1 rounded cursor-pointer transition ${
                  period === 'late21' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Late Period 21-Grid
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-mono text-[11px]">Grid:</span>
            <div className="inline-flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setGridMode('full')}
                className={`px-2 py-1 rounded cursor-pointer transition ${
                  gridMode === 'full' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Square Grid
              </button>
              <button
                type="button"
                onClick={() => setGridMode('horizontal')}
                className={`px-2 py-1 rounded cursor-pointer transition ${
                  gridMode === 'horizontal' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Horizontal Lines
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-[11px] pl-2 border-l border-slate-800">
            <span>Opacity:</span>
            <input
              type="range"
              min="0.2"
              max="0.8"
              step="0.1"
              value={gridOpacity}
              onChange={(e) => setGridOpacity(Number(e.target.value))}
              className="w-16 accent-amber-400 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
          >
            Reset Pins
          </button>
          <button
            type="button"
            onClick={handleExportPlate}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-sm"
          >
            <span>Export Canon Plate ↓</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative w-full flex items-center justify-center min-h-72 sm:min-h-95 md:min-h-125 bg-slate-950/90 border border-slate-800 rounded-2xl p-3 sm:p-4 overflow-hidden select-none">
        <div
          ref={containerRef}
          className="relative inline-block max-h-72 sm:max-h-95 md:max-h-120 max-w-full overflow-hidden rounded-xl border border-slate-800 shadow-2xl touch-none"
        >
          {/* Base Artifact Evidence */}
          <img
            src={imageSrc}
            alt="Suspect Ancient Artifact"
            className="max-h-72 sm:max-h-95 md:max-h-120 max-w-full w-auto object-contain block opacity-75 pointer-events-none"
          />

          {/* SVG Overlay: 18/21 Square Egyptian Grid */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none">
            {/* Horizontal Canonical Lines */}
            {[...Array(canonTotalUnits + 1)].map((_, i) => {
              const yPercent = (solesYNorm - i * gridUnitNorm) * 100;
              const isMajor = i % 6 === 0 || i === canonTotalUnits || i === 0;
              return (
                <g key={`h-line-${i}`}>
                  <line
                    x1="0"
                    y1={`${yPercent}%`}
                    x2="100%"
                    y2={`${yPercent}%`}
                    stroke={isMajor ? `rgba(234, 179, 8, ${gridOpacity + 0.2})` : `rgba(255, 255, 255, ${gridOpacity * 0.4})`}
                    strokeWidth={isMajor ? '2' : '1'}
                  />
                  <text
                    x="8"
                    y={`${yPercent - 0.8}%`}
                    fill={isMajor ? '#eab308' : 'rgba(255, 255, 255, 0.4)'}
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    L{i}
                  </text>
                </g>
              );
            })}

            {/* Vertical Columns if Square Grid Mode is active */}
            {gridMode === 'full' && (
              <>
                {[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map((col) => {
                  const xPercent = (normPoints.soles.x + col * gridUnitNorm) * 100;
                  return (
                    <line
                      key={`v-col-${col}`}
                      x1={`${xPercent}%`}
                      y1="0"
                      x2={`${xPercent}%`}
                      y2="100%"
                      stroke={col === 0 ? `rgba(234, 179, 8, ${gridOpacity * 0.7})` : `rgba(255, 255, 255, ${gridOpacity * 0.25})`}
                      strokeWidth={col === 0 ? '1.5' : '1'}
                      strokeDasharray={col === 0 ? undefined : '2,2'}
                    />
                  );
                })}
              </>
            )}

            {/* Axial alignment plumb-line connecting hairline to soles */}
            <line
              x1={`${normPoints.hairline.x * 100}%`}
              y1={`${normPoints.hairline.y * 100}%`}
              x2={`${normPoints.soles.x * 100}%`}
              y2={`${normPoints.soles.y * 100}%`}
              stroke="#eab308"
              strokeDasharray="4 4"
              strokeWidth="1.5"
              opacity="0.6"
            />
          </svg>

          {/* Interactive Landmark Drag Handles */}
          {CANON_LANDMARKS.map((landmark) => {
            const pt = normPoints[landmark.key];
            const diss = getDissonance(landmark.key);
            const isSelected = activePoint === landmark.key;

            return (
              <div
                key={landmark.key}
                onPointerDown={(e) => handlePointerDown(landmark.key, e)}
                className={`absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full cursor-grab active:cursor-grabbing pointer-events-auto transition-transform flex items-center justify-center border-2 ${
                  isSelected ? 'scale-125 shadow-lg shadow-amber-400/50' : 'hover:scale-110'
                }`}
                style={{
                  left: `${pt.x * 100}%`,
                  top: `${pt.y * 100}%`,
                  backgroundColor: landmark.color,
                  borderColor: '#ffffff',
                }}
                title={`Drag to align ${landmark.label}`}
              >
                {/* Floating telemetry pill */}
                <div className="absolute left-6 -top-2 bg-slate-950/90 border border-slate-700/80 rounded px-1.5 py-0.5 text-[9px] font-mono whitespace-nowrap shadow pointer-events-none flex items-center gap-1">
                  <span className="font-bold" style={{ color: landmark.color }}>
                    {landmark.label}
                  </span>
                  {!landmark.required && (
                    <span className={diss.isCompliant ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {diss.deltaStr}u
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time Ma'at Telemetry Board */}
      <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
        {/* Metric 1: Canon Scale */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl space-y-1.5">
          <span className="text-amber-400 font-bold uppercase tracking-wider block text-[11px]">
            📐 Pharaonic Grid Scale
          </span>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Total Figure Span:</span>
            <span className="font-semibold text-amber-300">
              {Math.round(totalHeightNorm * imgDimensions.h)} px
            </span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">1 Grid Unit (Square):</span>
            <span className="font-semibold text-amber-300">
              {((totalHeightNorm * imgDimensions.h) / canonTotalUnits).toFixed(1)} px
            </span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Active Canon:</span>
            <span className="text-slate-200">{period === 'classical18' ? '18 Squares (Hairline)' : '21 Squares (Eyes/Hairline)'}</span>
          </div>
        </div>

        {/* Metric 2: Dissonance Breakdown */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl space-y-1">
          <span className="text-cyan-400 font-bold uppercase tracking-wider block text-[11px] mb-1">
            ⚖️ Landmark Dissonance (δ)
          </span>
          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
            {evaluatedLandmarks.map((l) => {
              const d = getDissonance(l.key);
              return (
                <div key={l.key} className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{l.label}:</span>
                  <span className={d.isCompliant ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {d.deltaStr} Units {d.isCompliant ? '✓' : '⚠️'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Metric 3: Ma'at Compliance Score & Verdict */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                𓌴 Ma'at Score (Truth & Order)
              </span>
              <span className={`text-base font-bold ${maatScore >= 80 ? 'text-emerald-400' : maatScore >= 55 ? 'text-amber-400' : 'text-rose-400'}`}>
                {maatScore}%
              </span>
            </div>
            {/* Score progress bar */}
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 mb-2">
              <div
                className={`h-full transition-all duration-300 ${
                  maatScore >= 80 ? 'bg-emerald-500' : maatScore >= 55 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${maatScore}%` }}
              />
            </div>
          </div>

          <div className="text-[10px] text-slate-400 leading-tight">
            <strong>Verdict: </strong>
            <span className={maatScore >= 80 ? 'text-emerald-300 font-bold' : maatScore >= 55 ? 'text-amber-300 font-bold' : 'text-rose-300 font-bold'}>
              {maatScore >= 80
                ? 'Authentic Canonical Proportions (High Egyptian Fidelity)'
                : maatScore >= 55
                ? 'Minor Stylistic Divergence (Provincial Workshop or Restored)'
                : 'Severe Geometric Dissonance (Suspect Modern Forgery or Non-Egyptian)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
