import { useState, useRef, useEffect, useCallback } from 'react';

export default function ForensicLoupe({
  src,
  alt = 'Forensic Evidence',
  className = '',
  zoom = 8,
  enabled = false,
  containerClassName = '',
}) {
  const [isHovering, setIsHovering] = useState(false);
  const [loupePos, setLoupePos] = useState({ x: 0, y: 0 });
  const [pixelInfo, setPixelInfo] = useState(null);

  const imgRef = useRef(null);
  const loupeCanvasRef = useRef(null);
  const sourceCanvasRef = useRef(null);
  const fullImageDataRef = useRef(null);
  const naturalDimensionsRef = useRef({ w: 0, h: 0 });

  const LOUPE_SIZE = 170; // Diameter of circular loupe in px

  // Prepare offscreen canvas with full resolution image data for sampling
  useEffect(() => {
    if (!src) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      naturalDimensionsRef.current = { w, h };

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);

      try {
        fullImageDataRef.current = ctx.getImageData(0, 0, w, h);
        sourceCanvasRef.current = canvas;
      } catch (err) {
        console.warn('Unable to extract imageData for pixel loupe:', err);
      }
    };
    img.src = src;
  }, [src]);

  // Update loupe canvas and pixel telemetry on pointer move
  const updateLoupe = useCallback(
    (clientX, clientY) => {
      if (!enabled || !imgRef.current || !sourceCanvasRef.current || !fullImageDataRef.current) {
        return;
      }

      const rect = imgRef.current.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        setIsHovering(false);
        return;
      }

      const { w, h } = naturalDimensionsRef.current;
      if (w === 0 || h === 0) return;

      // Calculate relative position within the rendered element
      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;

      // Compute exact natural image pixel coordinates
      const px = Math.min(w - 1, Math.max(0, Math.floor(relX * w)));
      const py = Math.min(h - 1, Math.max(0, Math.floor(relY * h)));

      // Read exact pixel values
      const imgData = fullImageDataRef.current.data;
      const idx = (py * w + px) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      const a = imgData[idx + 3];
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      setPixelInfo({ x: px, y: py, r, g, b, a, hex, lum });

      // Position the loupe near cursor without overflowing window bounds
      const offsetDistance = 24;
      let targetX = clientX + offsetDistance;
      let targetY = clientY - LOUPE_SIZE - offsetDistance;

      if (targetX + LOUPE_SIZE > window.innerWidth - 12) {
        targetX = clientX - LOUPE_SIZE - offsetDistance;
      }
      if (targetY < 12) {
        targetY = clientY + offsetDistance;
      }

      setLoupePos({ x: targetX, y: targetY });

      // Render magnified pixels to loupe canvas
      const canvas = loupeCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);

      // Save circle clip path
      ctx.save();
      ctx.beginPath();
      ctx.arc(LOUPE_SIZE / 2, LOUPE_SIZE / 2, LOUPE_SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.imageSmoothingEnabled = false;

      // Determine source window size in image pixels
      const sampleSpan = LOUPE_SIZE / zoom;
      const halfSpan = sampleSpan / 2;
      const sx = px - halfSpan + 0.5;
      const sy = py - halfSpan + 0.5;

      ctx.drawImage(
        sourceCanvasRef.current,
        sx,
        sy,
        sampleSpan,
        sampleSpan,
        0,
        0,
        LOUPE_SIZE,
        LOUPE_SIZE
      );

      // Draw faint pixel grid if zoom is high enough
      if (zoom >= 6) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        const pixelStep = zoom;
        const centerX = LOUPE_SIZE / 2;
        const centerY = LOUPE_SIZE / 2;

        for (let i = centerX % pixelStep; i < LOUPE_SIZE; i += pixelStep) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, LOUPE_SIZE);
          ctx.stroke();
        }
        for (let j = centerY % pixelStep; j < LOUPE_SIZE; j += pixelStep) {
          ctx.beginPath();
          ctx.moveTo(0, j);
          ctx.lineTo(LOUPE_SIZE, j);
          ctx.stroke();
        }
      }

      // Draw central crosshair reticle targeting the exact center pixel
      const cx = LOUPE_SIZE / 2;
      const cy = LOUPE_SIZE / 2;
      const reticleRadius = Math.max(3, zoom / 2);

      // Target pixel bounding box
      ctx.strokeStyle = '#22d3ee'; // Cyan
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        cx - reticleRadius,
        cy - reticleRadius,
        reticleRadius * 2,
        reticleRadius * 2
      );

      // Crosshair lines
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, cy - reticleRadius - 2);
      ctx.moveTo(cx, cy + reticleRadius + 2);
      ctx.lineTo(cx, LOUPE_SIZE);

      ctx.moveTo(0, cy);
      ctx.lineTo(cx - reticleRadius - 2, cy);
      ctx.moveTo(cx + reticleRadius + 2, cy);
      ctx.lineTo(LOUPE_SIZE, cy);
      ctx.stroke();

      ctx.restore();

      setIsHovering(true);
    },
    [enabled, zoom, LOUPE_SIZE]
  );

  const handleMouseMove = (e) => {
    updateLoupe(e.clientX, e.clientY);
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches[0]) {
      updateLoupe(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  return (
    <div
      className={`relative inline-block select-none ${containerClassName}`}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseLeave={handleMouseLeave}
      onTouchEnd={handleMouseLeave}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`${className} ${enabled ? 'cursor-crosshair' : ''}`}
      />

      {/* Floating Loupe Magnifier */}
      {enabled && isHovering && (
        <div
          className="fixed pointer-events-none z-50 flex flex-col items-center drop-shadow-2xl transition-transform duration-75"
          style={{
            left: `${loupePos.x}px`,
            top: `${loupePos.y}px`,
          }}
        >
          {/* Circular Glass & Lens Border */}
          <div className="relative rounded-full p-1 bg-gradient-to-br from-cyan-400 via-slate-900 to-cyan-600 shadow-2xl shadow-cyan-500/40 border-2 border-slate-950">
            <canvas
              ref={loupeCanvasRef}
              width={LOUPE_SIZE}
              height={LOUPE_SIZE}
              className="rounded-full bg-slate-950 block"
            />
            {/* Magnification Badge */}
            <span className="absolute top-1 right-1 bg-cyan-500 text-slate-950 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full shadow-md">
              {zoom}x
            </span>
          </div>

          {/* Micro Telemetry Pill */}
          {pixelInfo && (
            <div className="mt-2 bg-slate-950/95 border border-cyan-500/50 rounded-xl px-2.5 py-1 text-[11px] font-mono text-slate-200 flex items-center gap-2 shadow-xl backdrop-blur-md">
              <span
                className="w-3 h-3 rounded-full border border-white/40 shadow-sm shrink-0"
                style={{ backgroundColor: pixelInfo.hex }}
              />
              <span className="text-cyan-300 font-semibold">
                X:{pixelInfo.x} Y:{pixelInfo.y}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300">
                {pixelInfo.hex}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 text-[10px]">
                L:{pixelInfo.lum}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Persistent Corner Pixel HUD if enabled and hovering */}
      {enabled && isHovering && pixelInfo && (
        <div className="absolute bottom-2.5 left-2.5 bg-slate-950/90 border border-cyan-500/40 text-slate-300 text-[10px] sm:text-xs px-2.5 py-1 rounded-lg font-mono flex items-center gap-2 pointer-events-none z-10 shadow-lg">
          <span
            className="w-2.5 h-2.5 rounded border border-white/40"
            style={{ backgroundColor: pixelInfo.hex }}
          />
          <span>
            TARGET: <strong className="text-cyan-400">({pixelInfo.x}, {pixelInfo.y})</strong>
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden sm:inline">
            RGB: {pixelInfo.r}, {pixelInfo.g}, {pixelInfo.b}
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="text-slate-200">{pixelInfo.hex}</span>
        </div>
      )}
    </div>
  );
}
