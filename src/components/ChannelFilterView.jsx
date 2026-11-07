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
  clones: 'Copy-Move Clone Detection: Identifies duplicated image regions created via clone-stamp, healing brush, or copy-paste operations to hide or replicate objects. Uses spatial block feature matching and shift-vector clustering to isolate identical patches and draw connecting displacement vectors.',
  fft: '2D Fast Fourier Transform (FFT) & Frequency Spectrum: Decomposes spatial image data into 2D frequency coefficients centered at DC (0,0). Natural photographs exhibit smooth radial 1/f^2 decay. Periodic resampling (bilinear/bicubic resizing), sensor CFA lattices, GAN upsampling grids, and AI generative models produce sharp harmonic spikes, concentric rings, or abnormal high-frequency attenuation.',
};

function getNoiseHeatmapColor(std) {
  const t = Math.min(1, Math.max(0, std / 16));
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

// Inferno Colormap for Fourier Magnitude Spectrum
function getInfernoColor(t) {
  const c = Math.max(0, Math.min(1, t));
  if (c < 0.25) {
    const s = c / 0.25;
    return [Math.round(4 + s * 60), Math.round(4 + s * 12), Math.round(20 + s * 90)];
  } else if (c < 0.5) {
    const s = (c - 0.25) / 0.25;
    return [Math.round(64 + s * 118), Math.round(16 + s * 38), Math.round(110 - s * 10)];
  } else if (c < 0.75) {
    const s = (c - 0.5) / 0.25;
    return [Math.round(182 + s * 69), Math.round(54 + s * 82), Math.round(100 - s * 80)];
  } else {
    const s = (c - 0.75) / 0.25;
    return [Math.round(251 + s * 4), Math.round(136 + s * 119), Math.round(20 + s * 235)];
  }
}

// Electric Radar Cyan Colormap
function getRadarCyanColor(t) {
  const c = Math.max(0, Math.min(1, t));
  if (c < 0.35) {
    const s = c / 0.35;
    return [Math.round(2 + s * 6), Math.round(6 + s * 45), Math.round(23 + s * 65)];
  } else if (c < 0.7) {
    const s = (c - 0.35) / 0.35;
    return [Math.round(8 - s * 2), Math.round(51 + s * 131), Math.round(88 + s * 124)];
  } else {
    const s = (c - 0.7) / 0.3;
    return [Math.round(6 + s * 249), Math.round(182 + s * 73), Math.round(212 + s * 43)];
  }
}

// 2D Fast Fourier Transform (FFT) Architecture & Analysis Engine
const FFT_SIZE = 512;
const FFT_HALF = 256;
const FFT_BIT_REV = new Uint16Array(FFT_SIZE);
let _fftJ = 0;
for (let i = 0; i < FFT_SIZE - 1; i++) {
  FFT_BIT_REV[i] = _fftJ;
  let k = FFT_SIZE >> 1;
  while (k <= _fftJ) {
    _fftJ -= k;
    k >>= 1;
  }
  _fftJ += k;
}
FFT_BIT_REV[FFT_SIZE - 1] = FFT_SIZE - 1;

function fft1D(real, imag, n) {
  for (let i = 0; i < n; i++) {
    const r = FFT_BIT_REV[i];
    if (i < r) {
      const tr = real[i]; real[i] = real[r]; real[r] = tr;
      const ti = imag[i]; imag[i] = imag[r]; imag[r] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = -2 * Math.PI / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wR = 1.0;
      let wI = 0.0;
      for (let k = 0; k < half; k++) {
        const uR = real[i + k];
        const uI = imag[i + k];
        const pos = i + k + half;
        const vR = real[pos] * wR - imag[pos] * wI;
        const vI = real[pos] * wI + imag[pos] * wR;

        real[i + k] = uR + vR;
        imag[i + k] = uI + vI;
        real[pos] = uR - vR;
        imag[pos] = uI - vI;

        const nextWR = wR * wStepR - wI * wStepI;
        wI = wR * wStepI + wI * wStepR;
        wR = nextWR;
      }
    }
  }
}

function compute2DFFTSpectrum(img, channel = 'lum', hannWindow = true, boost = 2.5, colormap = 'inferno', detectHarmonics = true) {
  const N = FFT_SIZE;
  const halfN = FFT_HALF;

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = N;
  sampleCanvas.height = N;
  const sCtx = sampleCanvas.getContext('2d');

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const minDim = Math.min(w, h);
  const sx = (w - minDim) / 2;
  const sy = (h - minDim) / 2;
  sCtx.drawImage(img, sx, sy, minDim, minDim, 0, 0, N, N);

  const imgData = sCtx.getImageData(0, 0, N, N);
  const d = imgData.data;

  const real = new Float32Array(N * N);
  const imag = new Float32Array(N * N);

  // Compute channel intensity and mean
  let sum = 0;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    let val;
    if (channel === 'red') val = d[i];
    else if (channel === 'green') val = d[i + 1];
    else if (channel === 'blue') val = d[i + 2];
    else val = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    real[p] = val;
    sum += val;
  }
  const meanVal = sum / (N * N);

  // Apply Hann window and mean centering
  for (let y = 0; y < N; y++) {
    const wy = hannWindow ? 0.5 * (1 - Math.cos((2 * Math.PI * y) / N)) : 1.0;
    const yOff = y * N;
    for (let x = 0; x < N; x++) {
      const wx = hannWindow ? 0.5 * (1 - Math.cos((2 * Math.PI * x) / N)) : 1.0;
      real[yOff + x] = (real[yOff + x] - meanVal) * wx * wy;
      imag[yOff + x] = 0;
    }
  }

  // Row-wise FFT
  const rowR = new Float32Array(N);
  const rowI = new Float32Array(N);
  for (let y = 0; y < N; y++) {
    const offset = y * N;
    for (let x = 0; x < N; x++) {
      rowR[x] = real[offset + x];
      rowI[x] = imag[offset + x];
    }
    fft1D(rowR, rowI, N);
    for (let x = 0; x < N; x++) {
      real[offset + x] = rowR[x];
      imag[offset + x] = rowI[x];
    }
  }

  // Column-wise FFT
  const colR = new Float32Array(N);
  const colI = new Float32Array(N);
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      colR[y] = real[y * N + x];
      colI[y] = imag[y * N + x];
    }
    fft1D(colR, colI, N);
    for (let y = 0; y < N; y++) {
      real[y * N + x] = colR[y];
      imag[y * N + x] = colI[y];
    }
  }

  // Shift quadrants (FFT-shift) & Compute log magnitude
  const shifted = new Float32Array(N * N);
  let minLog = Infinity;
  let maxLog = -Infinity;

  for (let y = 0; y < N; y++) {
    const origY = (y + halfN) % N;
    const yOff = y * N;
    for (let x = 0; x < N; x++) {
      const origX = (x + halfN) % N;
      const idx = origY * N + origX;
      const mag = Math.sqrt(real[idx] * real[idx] + imag[idx] * imag[idx]);
      const logMag = Math.log(1 + boost * 0.05 * mag);
      shifted[yOff + x] = logMag;

      const distFromDC = Math.hypot(x - halfN, y - halfN);
      if (distFromDC >= 3) {
        if (logMag > maxLog) maxLog = logMag;
      }
      if (logMag < minLog) minLog = logMag;
    }
  }
  if (maxLog <= minLog) maxLog = minLog + 1;

  // Azimuthal radial profile & peak anomaly detection
  const radialSum = new Float64Array(halfN);
  const radialSqSum = new Float64Array(halfN);
  const radialCount = new Uint32Array(halfN);

  for (let y = 0; y < N; y++) {
    const dy = y - halfN;
    const yOff = y * N;
    for (let x = 0; x < N; x++) {
      const dx = x - halfN;
      const r = Math.round(Math.sqrt(dx * dx + dy * dy));
      if (r < halfN) {
        const val = shifted[yOff + x];
        radialSum[r] += val;
        radialSqSum[r] += val * val;
        radialCount[r]++;
      }
    }
  }

  const radialMean = new Float32Array(halfN);
  const radialStd = new Float32Array(halfN);
  for (let r = 0; r < halfN; r++) {
    if (radialCount[r] > 0) {
      const m = radialSum[r] / radialCount[r];
      radialMean[r] = m;
      const v = Math.max(0, (radialSqSum[r] / radialCount[r]) - (m * m));
      radialStd[r] = Math.sqrt(v);
    }
  }

  // Linear regression on power law spectral decay slope: ln P(r) ~ -beta * ln(r) + C
  let sumLnR = 0, sumLnP = 0, sumLnR_LnP = 0, sumLnR2 = 0, nPts = 0;
  for (let r = 8; r < Math.min(120, halfN); r++) {
    if (radialMean[r] > 0) {
      const lnR = Math.log(r);
      const lnP = Math.log(radialMean[r]);
      sumLnR += lnR;
      sumLnP += lnP;
      sumLnR_LnP += lnR * lnP;
      sumLnR2 += lnR * lnR;
      nPts++;
    }
  }
  const slope = nPts > 1 ? (nPts * sumLnR_LnP - sumLnR * sumLnP) / (nPts * sumLnR2 - sumLnR * sumLnR) : -2;
  const slopeBeta = Math.max(0, -slope);

  // Detect Harmonic Resampling / Periodic lattice peaks
  const detectedPeaks = [];
  if (detectHarmonics) {
    for (let y = 4; y < N - 4; y++) {
      const dy = y - halfN;
      const yOff = y * N;
      for (let x = 4; x < N - 4; x++) {
        const dx = x - halfN;
        const r = Math.round(Math.sqrt(dx * dx + dy * dy));
        if (r < 16 || r >= halfN - 10) continue;
        if (!(dx > 0 || (dx === 0 && dy > 0))) continue;

        const val = shifted[yOff + x];
        let isMax = true;
        for (let ky = -2; ky <= 2 && isMax; ky++) {
          const kyOff = (y + ky) * N;
          for (let kx = -2; kx <= 2; kx++) {
            if (kx === 0 && ky === 0) continue;
            if (shifted[kyOff + (x + kx)] >= val) {
              isMax = false;
              break;
            }
          }
        }

        if (isMax) {
          const m = radialMean[r];
          const s = radialStd[r];
          if (val > m + 3.2 * s) {
            const snr = ((val - m) / Math.max(0.01, s));
            detectedPeaks.push({
              x,
              y,
              dx,
              dy,
              r,
              wavelength: (N / r).toFixed(1),
              freq: ((r / halfN) * 0.5).toFixed(3),
              snr: snr.toFixed(1),
            });
          }
        }
      }
    }
    detectedPeaks.sort((a, b) => Number(b.snr) - Number(a.snr));
  }

  // Render to output canvas
  const outCanvas = document.createElement('canvas');
  outCanvas.width = N;
  outCanvas.height = N;
  const outCtx = outCanvas.getContext('2d');
  const outImgData = outCtx.createImageData(N, N);
  const outD = outImgData.data;

  const range = maxLog - minLog;
  for (let i = 0; i < N * N; i++) {
    const val = shifted[i];
    const norm = Math.max(0, Math.min(1, (val - minLog) / range));
    let rgb;
    if (colormap === 'radar') {
      rgb = getRadarCyanColor(norm);
    } else if (colormap === 'matrix') {
      const v = Math.round(norm * 255);
      rgb = [v, v, v];
    } else {
      rgb = getInfernoColor(norm);
    }
    const idx = i * 4;
    outD[idx] = rgb[0];
    outD[idx + 1] = rgb[1];
    outD[idx + 2] = rgb[2];
    outD[idx + 3] = 255;
  }
  outCtx.putImageData(outImgData, 0, 0);

  // Overlay concentric frequency grid rings (0.1, 0.2, 0.3, 0.4 cy/px)
  outCtx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  outCtx.lineWidth = 1;
  [0.1, 0.2, 0.3, 0.4].forEach((f) => {
    const rad = Math.round((f / 0.5) * halfN);
    outCtx.beginPath();
    outCtx.arc(halfN, halfN, rad, 0, 2 * Math.PI);
    outCtx.stroke();
  });

  // DC Center crosshairs
  outCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  outCtx.beginPath();
  outCtx.moveTo(halfN - 8, halfN);
  outCtx.lineTo(halfN + 8, halfN);
  outCtx.moveTo(halfN, halfN - 8);
  outCtx.lineTo(halfN, halfN + 8);
  outCtx.stroke();

  // Overlay detected harmonic peak reticles
  if (detectHarmonics && detectedPeaks.length > 0) {
    const topPeaks = detectedPeaks.slice(0, 8);
    topPeaks.forEach((p, idx) => {
      [
        { px: p.x, py: p.y },
        { px: N - p.x, py: N - p.y }
      ].forEach((coord) => {
        outCtx.strokeStyle = idx === 0 ? '#38bdf8' : '#f43f5e';
        outCtx.lineWidth = 1.5;
        outCtx.beginPath();
        outCtx.arc(coord.px, coord.py, 8, 0, 2 * Math.PI);
        outCtx.stroke();

        outCtx.beginPath();
        outCtx.arc(coord.px, coord.py, 2, 0, 2 * Math.PI);
        outCtx.fillStyle = '#ffffff';
        outCtx.fill();
      });

      if (idx < 3) {
        outCtx.fillStyle = '#38bdf8';
        outCtx.font = 'bold 10px monospace';
        outCtx.textAlign = 'left';
        outCtx.fillText(`λ=${p.wavelength}px`, p.x + 10, p.y + 3);
      }
    });
  }

  // Downsample radial curve for SVG sparkline (32 points)
  const sparklinePts = [];
  const step = Math.floor(halfN / 32);
  let maxRadial = 0;
  for (let i = 0; i < 32; i++) {
    const r = i * step + 1;
    const v = radialMean[r] || 0;
    if (v > maxRadial) maxRadial = v;
    sparklinePts.push(v);
  }

  let verdict = 'Authentic Sensor Decay';
  let verdictColor = 'text-emerald-400';
  if (slopeBeta > 2.35) {
    verdict = 'High-Frequency Suppressed / Synthetic (AI/Blur)';
    verdictColor = 'text-amber-400';
  } else if (slopeBeta < 1.65) {
    verdict = 'Excessive High-Frequency / Foreign Lattice';
    verdictColor = 'text-rose-400';
  }

  return {
    dataUrl: outCanvas.toDataURL('image/png'),
    slopeBeta: Number(slopeBeta.toFixed(2)),
    verdict,
    verdictColor,
    peaks: detectedPeaks.slice(0, 8),
    sparklinePts,
    maxRadial,
  };
}

// Spatial Block Matching & Shift-Vector Clustering Algorithm
function detectCopyMoveClones(sourceCanvas, origWidth, origHeight, sensitivity = 'medium', minDistance = 35) {
  const maxDim = 520;
  const scale = Math.max(1, Math.max(origWidth, origHeight) / maxDim);
  const aw = Math.round(origWidth / scale);
  const ah = Math.round(origHeight / scale);

  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = aw;
  smallCanvas.height = ah;
  const smallCtx = smallCanvas.getContext('2d');
  smallCtx.drawImage(sourceCanvas, 0, 0, aw, ah);
  const smallImgData = smallCtx.getImageData(0, 0, aw, ah);
  const d = smallImgData.data;

  const gray = new Float32Array(aw * ah);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }

  const B = 16;
  const S = 6;
  const scaledMinDist = minDistance / scale;

  const diffThreshold = sensitivity === 'high' ? 26 : sensitivity === 'low' ? 12 : 18;
  const minVotes = sensitivity === 'high' ? 3 : sensitivity === 'low' ? 5 : 4;

  const blocks = [];
  const halfB = Math.floor(B / 2);

  for (let y = 0; y <= ah - B; y += S) {
    for (let x = 0; x <= aw - B; x += S) {
      let q1 = 0, q2 = 0, q3 = 0, q4 = 0;
      let sum = 0, sqSum = 0;

      for (let by = 0; by < B; by++) {
        const rowOffset = (y + by) * aw + x;
        const isTop = by < halfB;
        for (let bx = 0; bx < B; bx++) {
          const val = gray[rowOffset + bx];
          sum += val;
          sqSum += val * val;
          if (isTop) {
            if (bx < halfB) q1 += val;
            else q2 += val;
          } else {
            if (bx < halfB) q3 += val;
            else q4 += val;
          }
        }
      }

      const totalPixels = B * B;
      const quadPixels = totalPixels / 4;
      const mean = sum / totalPixels;
      const variance = (sqSum / totalPixels) - (mean * mean);

      if (variance < 6) continue;

      const f1 = q1 / quadPixels;
      const f2 = q2 / quadPixels;
      const f3 = q3 / quadPixels;
      const f4 = q4 / quadPixels;

      const hashKey = (Math.round(mean / 6) << 6) ^ Math.round(Math.sqrt(variance) / 2);

      blocks.push({
        x: x + halfB,
        y: y + halfB,
        f1, f2, f3, f4,
        hashKey,
      });
    }
  }

  const buckets = new Map();
  for (let i = 0; i < blocks.length; i++) {
    const k = blocks[i].hashKey;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(blocks[i]);
  }

  const matches = [];
  const shiftBins = new Map();

  for (const [, bucket] of buckets) {
    if (bucket.length < 2) continue;
    const len = Math.min(bucket.length, 35);
    for (let i = 0; i < len; i++) {
      const b1 = bucket[i];
      for (let j = i + 1; j < len; j++) {
        const b2 = bucket[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);

        if (dist < scaledMinDist) continue;

        const diff = Math.abs(b1.f1 - b2.f1) + Math.abs(b1.f2 - b2.f2) + Math.abs(b1.f3 - b2.f3) + Math.abs(b1.f4 - b2.f4);
        if (diff > diffThreshold) continue;

        let sx = Math.round(dx / 6) * 6;
        let sy = Math.round(dy / 6) * 6;
        let p1 = b1;
        let p2 = b2;
        if (sx < 0 || (sx === 0 && sy < 0)) {
          sx = -sx;
          sy = -sy;
          p1 = b2;
          p2 = b1;
        }

        const shiftKey = `${sx},${sy}`;
        const currentCount = (shiftBins.get(shiftKey) || 0) + 1;
        shiftBins.set(shiftKey, currentCount);

        matches.push({
          p1,
          p2,
          shiftKey,
        });
      }
    }
  }

  const validShifts = new Set();
  let maxVotes = 0;
  let dominantShift = null;

  for (const [key, count] of shiftBins) {
    if (count >= minVotes) {
      validShifts.add(key);
      if (count > maxVotes) {
        maxVotes = count;
        dominantShift = key;
      }
    }
  }

  const confirmedClones = matches.filter((m) => validShifts.has(m.shiftKey));

  const scaledClones = confirmedClones.map((c) => ({
    x1: Math.round(c.p1.x * scale),
    y1: Math.round(c.p1.y * scale),
    x2: Math.round(c.p2.x * scale),
    y2: Math.round(c.p2.y * scale),
    blockSize: Math.round(B * scale),
  }));

  return {
    clones: scaledClones,
    dominantShift,
    totalMatches: scaledClones.length,
    clustersCount: validShifts.size,
  };
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
  const [selectedBitPlane, setSelectedBitPlane] = useState(0); // 0 to 7 or 'combined'
  const [bitTargetChannel, setBitTargetChannel] = useState('lum');
  const [noiseMode, setNoiseMode] = useState('residual');
  const [noiseGain, setNoiseGain] = useState(12);
  const [noiseWindow, setNoiseWindow] = useState(7);
  const [cloneSensitivity, setCloneSensitivity] = useState('medium'); // 'low', 'medium', 'high'
  const [cloneMinDist, setCloneMinDist] = useState(35); // 25, 35, 60
  const [showCloneVectors, setShowCloneVectors] = useState(true);
  const [cloneStats, setCloneStats] = useState(null);
  const [fftColorMap, setFftColorMap] = useState('inferno'); // 'inferno', 'radar', 'matrix'
  const [fftBoost, setFftBoost] = useState(2.5);
  const [fftChannel, setFftChannel] = useState('lum'); // 'lum', 'red', 'green', 'blue'
  const [fftHannWindow, setFftHannWindow] = useState(true);
  const [fftDetectHarmonics, setFftDetectHarmonics] = useState(true);
  const [fftStats, setFftStats] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const monoToggleId = useId();
  const fftHannToggleId = useId();
  const fftHarmonicsToggleId = useId();

  const applyFilter = useCallback((src, filter, mono, boost, bitPlane, bitChan, nMode, nGain, nWin, cSens, cDist, cVec, fCmap, fBoost, fChan, fHann, fHarm) => {
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

      const outCanvas = document.createElement('canvas');
      outCanvas.width = w;
      outCanvas.height = h;
      const outCtx = outCanvas.getContext('2d');

      if (filter === 'fft') {
        const stats = compute2DFFTSpectrum(img, fChan, fHann, fBoost, fCmap, fHarm);
        setFftStats(stats);
        setResultUrl(stats.dataUrl);
        setIsProcessing(false);
        return;
      }

      if (filter === 'clones') {
        const detection = detectCopyMoveClones(canvas, w, h, cSens, cDist);
        setCloneStats({
          totalMatches: detection.totalMatches,
          clustersCount: detection.clustersCount,
          dominantShift: detection.dominantShift,
        });

        // Draw background evidence image with dimmed tone
        outCtx.drawImage(img, 0, 0, w, h);
        outCtx.fillStyle = 'rgba(2, 6, 23, 0.45)';
        outCtx.fillRect(0, 0, w, h);

        if (detection.clones.length > 0) {
          detection.clones.forEach((c) => {
            const half = Math.floor(c.blockSize / 2);

            // Source block (Neon Cyan)
            outCtx.fillStyle = 'rgba(6, 182, 212, 0.22)';
            outCtx.fillRect(c.x1 - half, c.y1 - half, c.blockSize, c.blockSize);
            outCtx.strokeStyle = '#06b6d4';
            outCtx.lineWidth = 1.5;
            outCtx.strokeRect(c.x1 - half, c.y1 - half, c.blockSize, c.blockSize);

            // Target block (Neon Rose)
            outCtx.fillStyle = 'rgba(244, 63, 94, 0.22)';
            outCtx.fillRect(c.x2 - half, c.y2 - half, c.blockSize, c.blockSize);
            outCtx.strokeStyle = '#f43f5e';
            outCtx.strokeRect(c.x2 - half, c.y2 - half, c.blockSize, c.blockSize);

            // Connecting displacement vector
            if (cVec) {
              outCtx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
              outCtx.lineWidth = 1.5;
              outCtx.beginPath();
              outCtx.moveTo(c.x1, c.y1);
              outCtx.lineTo(c.x2, c.y2);
              outCtx.stroke();

              // Arrowhead at target (x2, y2)
              const angle = Math.atan2(c.y2 - c.y1, c.x2 - c.x1);
              const headLen = Math.max(6, Math.round(c.blockSize / 3.5));
              outCtx.fillStyle = '#f59e0b';
              outCtx.beginPath();
              outCtx.moveTo(c.x2, c.y2);
              outCtx.lineTo(c.x2 - headLen * Math.cos(angle - Math.PI / 6), c.y2 - headLen * Math.sin(angle - Math.PI / 6));
              outCtx.lineTo(c.x2 - headLen * Math.cos(angle + Math.PI / 6), c.y2 - headLen * Math.sin(angle + Math.PI / 6));
              outCtx.closePath();
              outCtx.fill();
            }
          });
        } else {
          // No clones detected badge
          const bw = Math.min(340, w - 20);
          const bh = 54;
          outCtx.fillStyle = '#020617ea';
          outCtx.fillRect((w - bw) / 2, (h - bh) / 2, bw, bh);
          outCtx.strokeStyle = '#334155';
          outCtx.lineWidth = 1.5;
          outCtx.strokeRect((w - bw) / 2, (h - bh) / 2, bw, bh);

          outCtx.fillStyle = '#10b981';
          outCtx.font = 'bold 13px monospace';
          outCtx.textAlign = 'center';
          outCtx.fillText('✓ NO CLONED REGIONS DETECTED', w / 2, (h / 2) - 2);
          outCtx.fillStyle = '#94a3b8';
          outCtx.font = '11px monospace';
          outCtx.fillText('Shift-vector clustering threshold: Clean', w / 2, (h / 2) + 16);
        }

        setResultUrl(outCanvas.toDataURL('image/png'));
        setIsProcessing(false);
        return;
      }

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const outImgData = outCtx.createImageData(w, h);
      const outData = outImgData.data;

      if (filter === 'edges') {
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
            bitOut = (val & 0b111) * 36;
          } else {
            const bit = (val >> Number(bitPlane)) & 1;
            bitOut = bit ? 255 : 0;
          }

          outData[i] = bitOut;
          outData[i + 1] = bitOut;
          outData[i + 2] = bitOut;
          outData[i + 3] = 255;
        }
      } else if (filter === 'noise') {
        const gray = new Float32Array(w * h);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

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
      applyFilter(
        imageSrc,
        activeFilter,
        monochromeChannels,
        edgeBoost,
        selectedBitPlane,
        bitTargetChannel,
        noiseMode,
        noiseGain,
        noiseWindow,
        cloneSensitivity,
        cloneMinDist,
        showCloneVectors,
        fftColorMap,
        fftBoost,
        fftChannel,
        fftHannWindow,
        fftDetectHarmonics
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [
    imageSrc,
    activeFilter,
    monochromeChannels,
    edgeBoost,
    selectedBitPlane,
    bitTargetChannel,
    noiseMode,
    noiseGain,
    noiseWindow,
    cloneSensitivity,
    cloneMinDist,
    showCloneVectors,
    fftColorMap,
    fftBoost,
    fftChannel,
    fftHannWindow,
    fftDetectHarmonics,
    applyFilter
  ]);

  const exportFilename = activeFilter === 'bitplanes'
    ? `${fileName.replace(/\.[^/.]+$/, '')}_bitplane_${selectedBitPlane}_${bitTargetChannel}.png`
    : activeFilter === 'noise'
    ? `${fileName.replace(/\.[^/.]+$/, '')}_noise_${noiseMode}.png`
    : activeFilter === 'clones'
    ? `${fileName.replace(/\.[^/.]+$/, '')}_copy_move_clones.png`
    : activeFilter === 'fft'
    ? `${fileName.replace(/\.[^/.]+$/, '')}_fft_spectrum_${fftColorMap}.png`
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
            <span>Bit Planes</span>
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
          <button
            type="button"
            onClick={() => setActiveFilter('clones')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'clones'
                ? 'bg-rose-500 text-white font-semibold shadow-sm shadow-rose-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Clone Stamp</span>
            <span className="text-[10px] bg-rose-400/20 text-rose-200 px-1.5 py-0.2 rounded-full font-bold">
              Copy-Move
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('fft')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'fft'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>2D FFT Spectrum</span>
            <span className="text-[10px] bg-indigo-400/20 text-indigo-200 px-1.5 py-0.2 rounded-full font-bold">
              Fourier
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
            >
              Combined LSBs (0-2)
            </button>
          </div>

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

            {noiseMode === 'variance' && (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-slate-400 pl-3 border-l border-slate-800">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-indigo-900" title="Low noise / AI inpaint / smoothing" />
                <span>Zero Noise</span>
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 ml-1" title="Natural sensor noise" />
                <span>ISO Grain</span>
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-500 ml-1" title="High noise / splice" />
                <span>Disparity</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Copy-Move Clone Stamp Secondary Control Bar */}
      {activeFilter === 'clones' && (
        <div className="w-full bg-slate-950/70 border border-rose-500/30 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono text-[11px]">Sensitivity:</span>
              <div className="inline-flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-[11px]">
                {['low', 'medium', 'high'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCloneSensitivity(s)}
                    className={`px-2.5 py-0.5 rounded capitalize cursor-pointer transition ${
                      cloneSensitivity === s ? 'bg-rose-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-mono text-[11px]">Min Dist:</span>
              <div className="inline-flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-[11px]">
                {[25, 35, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCloneMinDist(d)}
                    className={`px-2 py-0.5 rounded font-mono text-[10px] cursor-pointer transition ${
                      cloneMinDist === d ? 'bg-rose-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {d}px
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300 text-[11px]">
              <input
                type="checkbox"
                checked={showCloneVectors}
                onChange={(e) => setShowCloneVectors(e.target.checked)}
                className="accent-rose-500 rounded"
              />
              <span>Displacement Vectors</span>
            </label>
          </div>

          {cloneStats && (
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                Matches: <strong>{cloneStats.totalMatches}</strong>
              </span>
              {cloneStats.dominantShift && (
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
                  Shift: <strong>Δ({cloneStats.dominantShift})</strong>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2D FFT Specialized Secondary Control Bar */}
      {activeFilter === 'fft' && (
        <div className="w-full bg-slate-950/70 border border-indigo-500/30 rounded-xl p-3 flex flex-col gap-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Colormap */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-mono text-[11px]">Palette:</span>
                <div className="inline-flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-[11px]">
                  {[
                    { id: 'inferno', label: 'Inferno' },
                    { id: 'radar', label: 'Cyan Radar' },
                    { id: 'matrix', label: 'Matrix B&W' },
                  ].map((cm) => (
                    <button
                      key={cm.id}
                      type="button"
                      onClick={() => setFftColorMap(cm.id)}
                      className={`px-2.5 py-0.5 rounded cursor-pointer transition ${
                        fftColorMap === cm.id
                          ? 'bg-indigo-600 text-white font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {cm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Channel */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-mono text-[11px]">Channel:</span>
                <div className="inline-flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-[11px]">
                  {[
                    { id: 'lum', label: 'Luminance' },
                    { id: 'red', label: 'Red' },
                    { id: 'green', label: 'Green' },
                    { id: 'blue', label: 'Blue' },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setFftChannel(ch.id)}
                      className={`px-2 py-0.5 rounded cursor-pointer transition ${
                        fftChannel === ch.id
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hann Window Toggle */}
              <label htmlFor={fftHannToggleId} className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300 text-[11px]">
                <input
                  id={fftHannToggleId}
                  type="checkbox"
                  checked={fftHannWindow}
                  onChange={(e) => setFftHannWindow(e.target.checked)}
                  className="accent-indigo-500 rounded"
                />
                <span>Hann Window (Suppress Edge Cross)</span>
              </label>

              {/* Detect Harmonics Toggle */}
              <label htmlFor={fftHarmonicsToggleId} className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300 text-[11px]">
                <input
                  id={fftHarmonicsToggleId}
                  type="checkbox"
                  checked={fftDetectHarmonics}
                  onChange={(e) => setFftDetectHarmonics(e.target.checked)}
                  className="accent-indigo-500 rounded"
                />
                <span>Detect Harmonic Peaks</span>
              </label>
            </div>

            {/* Dynamic Range / Log Boost */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">Dynamic Boost: <strong>{fftBoost.toFixed(1)}x</strong></span>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.5"
                value={fftBoost}
                onChange={(e) => setFftBoost(Number(e.target.value))}
                className="w-24 accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Telemetry and Frequency Analytics Bar */}
          {fftStats && (
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px]">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-mono">Decay Exponent:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono font-bold text-indigo-300">
                    β = {fftStats.slopeBeta}
                  </span>
                  <span className={`font-semibold ${fftStats.verdictColor}`}>
                    ({fftStats.verdict})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-slate-400">Harmonics:</span>
                  <span className={`px-2 py-0.5 rounded border ${
                    fftStats.peaks.length > 0
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-bold'
                      : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  }`}>
                    {fftStats.peaks.length > 0 ? `${fftStats.peaks.length} Spikes Detected` : '0 Lattice Spikes (Clean)'}
                  </span>
                </div>
              </div>

              {/* Sparkline Radial Power Spectrum Chart */}
              {fftStats.sparklinePts && fftStats.sparklinePts.length > 0 && (
                <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                  <span>P(r) DC→Nyquist:</span>
                  <svg className="w-28 h-5 overflow-visible" viewBox="0 0 100 20">
                    <polyline
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth="1.5"
                      points={fftStats.sparklinePts.map((val, idx) => {
                        const x = (idx / (fftStats.sparklinePts.length - 1)) * 100;
                        const y = 20 - (val / Math.max(0.1, fftStats.maxRadial)) * 18;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      }).join(' ')}
                    />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Peak list pills if detected */}
          {fftStats && fftStats.peaks && fftStats.peaks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono">
              <span className="text-slate-400">Prominent Lattices:</span>
              {fftStats.peaks.slice(0, 5).map((p, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300"
                  title={`Offset: (${p.dx}, ${p.dy}), Freq: ${p.freq} cy/px, SNR: ${p.snr}x`}
                >
                  λ = {p.wavelength}px ({p.freq} cy/px, SNR {p.snr}x)
                </span>
              ))}
            </div>
          )}
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
            : activeFilter === 'clones'
            ? 'Copy-Move Forgery Detection: Computes spatial block features and clusters displacement vectors (ΔX, ΔY). Cyan boxes mark cloned source regions, rose boxes mark pasted targets, and amber vectors connect matched duplicate patches.'
            : activeFilter === 'fft'
            ? '2D Fast Fourier Transform (FFT) Magnitude Spectrum: DC component is centered at (256, 256) with concentric circles indicating spatial frequencies up to 0.5 cycles/pixel. Natural sensor decay follows β ≈ 1.8–2.2. Sharp starburst spikes or off-center reticles expose periodic resizing (resampling grid), CFA demosaicing lattices, or generative AI upsampling.'
            : FILTER_DESCRIPTIONS[activeFilter]}
        </span>
      </div>

      {/* Image Display */}
      <div className="relative w-full flex items-center justify-center min-h-60 sm:min-h-80 bg-slate-950/80 border border-slate-800 rounded-xl p-3 sm:p-4">
        {isProcessing && (
          <div className="absolute top-3 right-3 bg-slate-950/90 border border-cyan-500/40 text-cyan-300 text-[10px] px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Processing...</span>
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
          <div className="text-xs text-slate-500">Processing forensic filter...</div>
        )}
      </div>
    </div>
  );
}
