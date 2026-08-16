/**
 * Reads pixel dimensions straight from image file bytes (no dependency, no decoding the actual
 * pixels) - just enough header parsing to size the map canvas to match an uploaded store photo,
 * so the canvas's aspect ratio matches the photo's and nothing gets cropped/stretched to fit.
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

function readPngSize(buf: Buffer): ImageDimensions | null {
  if (buf.length < 24) return null;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (!isPng) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readGifSize(buf: Buffer): ImageDimensions | null {
  if (buf.length < 10) return null;
  const header = buf.toString("ascii", 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function readJpegSize(buf: Buffer): ImageDimensions | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    // SOFn markers carry the frame's dimensions - skip DHT(C4)/JPG(C8)/DAC(CC), same family byte range.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  return null;
}

function readWebpSize(buf: Buffer): ImageDimensions | null {
  if (buf.length < 30) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const format = buf.toString("ascii", 12, 16);
  if (format === "VP8X") {
    // 24-bit little-endian width-1 / height-1 at fixed offsets in the VP8X chunk.
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height };
  }
  if (format === "VP8 " && buf.length >= 30) {
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  return null;
}

export function readImageDimensions(buf: Buffer, ext: string): ImageDimensions | null {
  const normalized = ext.toLowerCase();
  if (normalized === "png") return readPngSize(buf);
  if (normalized === "jpg" || normalized === "jpeg") return readJpegSize(buf);
  if (normalized === "gif") return readGifSize(buf);
  if (normalized === "webp") return readWebpSize(buf);
  return null;
}
