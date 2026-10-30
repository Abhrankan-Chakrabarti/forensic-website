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
  const fullImageDataRef = useRef(null);
  const naturalDimensionsRef = useRef({ w: 0, h: 0 });
  const lastPointerPosRef = useRef(null);

  const LOUPE_SIZE = 180; // Diameter of circular loupe in px

  // Prepare full resolution raw pixel data for zero-artifact sampling
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
      } catch (err) {
        console.warn('Unable to extract imageData for pixel loupe:', err);
      }
    };
    img.src = src;
  }, [src]);

  // Robust pixel-level rendering algorithm using integer grid sampling
  const updateLoupe = useCallback(
    (clientX, clientY) => {
      if (!enabled || !imgRef.current || !fullImageDataRef.current) {
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

      lastPointerPosRef.current = { clientX, clientY };

      // Calculate relative position within the rendered element
      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;

      // Compute exact natural image pixel coordinates
      const px = Math.min(w - 1, Math.max(0, Math.floor(relX * w)));
      const py = Math.min(h - 1, Math.max(0, Math.floor(relY * h)));

      // Read exact pixel values from raw image data
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

      // Save circular lens clipping mask
      ctx.save();
      ctx.beginPath();
      ctx.arc(LOUPE_SIZE / 2, LOUPE_SIZE / 2, LOUPE_SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.clip();

      // Integer grid sampling: determine discrete integer radius of pixels to capture
      const effectiveZoom = Math.max(2, Number(zoom) || 8);
      const pixelRadius = Math.ceil(LOUPE_SIZE / (2 * effectiveZoom));
      const sampleWidth = pixelRadius * 2 + 1;

      // Create a small offscreen buffer with exact discrete pixels
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = sampleWidth;
      tempCanvas.height = sampleWidth;
      const tempCtx = tempCanvas.getContext('2d');
      const tempImgData = tempCtx.createImageData(sampleWidth, sampleWidth);
      const d = tempImgData.data;

      for (let dy = -pixelRadius; dy <= pixelRadius; dy++) {
        for (let dx = -pixelRadius; dx <= pixelRadius; dx++) {
          const imgX = px + dx;
          const imgY = py + dy;
          const outIdx = ((dy + pixelRadius) * sampleWidth + (dx + pixelRadius)) * 4;

          if (imgX >= 0 && imgX < w && imgY >= 0 && imgY < h) {
            const srcIdx = (imgY * w + imgX) * 4;
            d[outIdx] = imgData[srcIdx];
            d[outIdx + 1] = imgData[srcIdx + 1];
            d[outIdx + 2] = imgData[srcIdx + 2];
            d[outIdx + 3] = imgData[srcIdx + 3];
          } else {
            // Out of bounds background: subtle checkered slate pattern
            const isEven = (Math.abs(imgX) + Math.abs(imgY)) % 2 === 0;
            const shade = isEven ? 24 : 12;
            d[outIdx] = shade;
            d[outIdx + 1] = shade;
            d[outIdx + 2] = shade + 4;
            d[outIdx + 3] = 255;
          }
        }
      }
      tempCtx.putImageData(tempImgData, 0, 0);

      // Scale discrete pixel grid up to loupe canvas with nearest-neighbor interpolation
      ctx.imageSmoothingEnabled = false;
      const renderSpan = sampleWidth * effectiveZoom;
      const renderOffset = Math.round((LOUPE_SIZE - renderSpan) / 2);

      ctx.drawImage(
        tempCanvas,
        0,
        0,
        sampleWidth,
        sampleWidth,
        renderOffset,
        renderOffset,
        renderSpan,
        renderSpan
      );

      // Faint sub-pixel boundary grid
      if (effectiveZoom >= 4) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= sampleWidth; i++) {
          const linePos = Math.round(renderOffset + i * effectiveZoom) + 0.5;
          ctx.beginPath();
          ctx.moveTo(linePos, renderOffset);
          ctx.lineTo(linePos, renderOffset + renderSpan);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(renderOffset, linePos);
          ctx.lineTo(renderOffset + renderSpan, linePos);
          ctx.stroke();
        }
      }

      // Reticle targeting the exact center pixel
      const centerPixelX = Math.round(renderOffset + pixelRadius * effectiveZoom);
      const centerPixelY = Math.round(renderOffset + pixelRadius * effectiveZoom);

      // Cyan target pixel bounding box
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.strokeRect(centerPixelX, centerPixelY, effectiveZoom, effectiveZoom);

      // Precision crosshair lines
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerPixelX + effectiveZoom / 2, 0);
      ctx.lineTo(centerPixelX + effectiveZoom / 2, centerPixelY - 2);
      ctx.moveTo(centerPixelX + effectiveZoom / 2, centerPixelY + effectiveZoom + 2);
      ctx.lineTo(centerPixelX + effectiveZoom / 2, LOUPE_SIZE);

      ctx.moveTo(0, centerPixelY + effectiveZoom / 2);
      ctx.lineTo(centerPixelX - 2, centerPixelY + effectiveZoom / 2);
      ctx.moveTo(centerPixelX + effectiveZoom + 2, centerPixelY + effectiveZoom / 2);
      ctx.lineTo(LOUPE_SIZE, centerPixelY + effectiveZoom / 2);
      ctx.stroke();

      ctx.restore();

      setIsHovering(true);
    },
    [enabled, zoom, LOUPE_SIZE]
  );

  // Immediately re-render loupe when zoom level changes
  useEffect(() => {
    if (enabled && lastPointerPosRef.current) {
      updateLoupe(lastPointerPosRef.current.clientX, lastPointerPosRef.current.clientY);
    }
  }, [zoom, enabled, updateLoupe]);

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
