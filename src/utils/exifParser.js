/**
 * Lightweight, zero-dependency client-side JPEG EXIF parser.
 * Extracts key forensic tags including camera hardware, editing software signatures, and capture timestamps.
 */
export function parseExif(arrayBuffer) {
  const result = {
    hasExif: false,
    make: null,
    model: null,
    software: null,
    dateTime: null,
    dateTimeOriginal: null,
    iso: null,
    fNumber: null,
    exposureTime: null,
  };

  try {
    const view = new DataView(arrayBuffer);
    if (view.getUint16(0, false) !== 0xffd8) {
      return result; // Not a standard JPEG
    }

    let offset = 2;
    const length = view.byteLength;

    while (offset < length) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);

      // APP1 Marker for Exif (0xFFE1)
      if (marker === 0xe1) {
        const exifHeader = String.fromCharCode(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7)
        );

        if (exifHeader === 'Exif') {
          result.hasExif = true;
          const tiffStart = offset + 10;
          parseTiff(view, tiffStart, result);
        }
        break;
      } else {
        // Move to next marker
        offset += 2 + view.getUint16(offset + 2, false);
      }
    }
  } catch {
    // Graceful fallback on corrupt or truncated headers
  }

  return result;
}

function parseTiff(view, tiffStart, result) {
  const byteOrder = view.getUint16(tiffStart, false);
  const littleEndian = byteOrder === 0x4949; // 'II'

  if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) {
    return;
  }

  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
  if (ifd0Offset < 8) return;

  parseIfd(view, tiffStart, tiffStart + ifd0Offset, littleEndian, result);
}

function parseIfd(view, tiffStart, dirStart, littleEndian, result) {
  if (dirStart + 2 > view.byteLength) return;
  const numEntries = view.getUint16(dirStart, littleEndian);

  let exifSubIfdOffset = null;

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = dirStart + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);

    if (tag === 0x010f) {
      result.make = readString(view, tiffStart, entryOffset, count, littleEndian);
    } else if (tag === 0x0110) {
      result.model = readString(view, tiffStart, entryOffset, count, littleEndian);
    } else if (tag === 0x0131) {
      result.software = readString(view, tiffStart, entryOffset, count, littleEndian);
    } else if (tag === 0x0132) {
      result.dateTime = readString(view, tiffStart, entryOffset, count, littleEndian);
    } else if (tag === 0x8769) {
      // Exif sub-IFD pointer
      exifSubIfdOffset = view.getUint32(entryOffset + 8, littleEndian);
    }
  }

  if (exifSubIfdOffset) {
    parseSubIfd(view, tiffStart, tiffStart + exifSubIfdOffset, littleEndian, result);
  }
}

function parseSubIfd(view, tiffStart, dirStart, littleEndian, result) {
  if (dirStart + 2 > view.byteLength) return;
  const numEntries = view.getUint16(dirStart, littleEndian);

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = dirStart + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);

    if (tag === 0x9003) {
      result.dateTimeOriginal = readString(view, tiffStart, entryOffset, count, littleEndian);
    } else if (tag === 0x8827) {
      result.iso = view.getUint16(entryOffset + 8, littleEndian);
    } else if (tag === 0x829d) {
      // FNumber (rational: 2 longs)
      const offset = view.getUint32(entryOffset + 8, littleEndian);
      if (tiffStart + offset + 8 <= view.byteLength) {
        const num = view.getUint32(tiffStart + offset, littleEndian);
        const den = view.getUint32(tiffStart + offset + 4, littleEndian);
        result.fNumber = den ? `f/${(num / den).toFixed(1)}` : null;
      }
    } else if (tag === 0x829a) {
      // ExposureTime (rational)
      const offset = view.getUint32(entryOffset + 8, littleEndian);
      if (tiffStart + offset + 8 <= view.byteLength) {
        const num = view.getUint32(tiffStart + offset, littleEndian);
        const den = view.getUint32(tiffStart + offset + 4, littleEndian);
        if (num && den) {
          result.exposureTime = num < den ? `1/${Math.round(den / num)}s` : `${(num / den).toFixed(1)}s`;
        }
      }
    }
  }
}

function readString(view, tiffStart, entryOffset, count, littleEndian) {
  if (count <= 0) return null;
  const valueOffset = count <= 4 ? entryOffset + 8 : tiffStart + view.getUint32(entryOffset + 8, littleEndian);

  if (valueOffset + count > view.byteLength) return null;

  let str = '';
  for (let i = 0; i < count - 1; i++) {
    const charCode = view.getUint8(valueOffset + i);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  return str.trim() || null;
}
