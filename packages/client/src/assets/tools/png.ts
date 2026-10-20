// Minimal PNG codec (8-bit RGBA / RGB / palette, non-interlaced) for asset generation scripts.
import { deflateSync, inflateSync } from 'node:zlib';

export interface Img { w: number; h: number; data: Uint8Array } // RGBA

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export function decodePng(bytes: Uint8Array): Img {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8, w = 0, h = 0, depth = 0, ctype = 0;
  const idat: Uint8Array[] = [];
  let palette: Uint8Array | null = null, trns: Uint8Array | null = null;
  while (p < bytes.length) {
    const len = dv.getUint32(p); const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    const body = bytes.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); depth = body[8]; ctype = body[9]; if (body[12]) throw new Error('interlaced'); }
    else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error('depth ' + depth);
  const bpp = ctype === 6 ? 4 : ctype === 2 ? 3 : ctype === 3 ? 1 : ctype === 4 ? 2 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = new Uint8Array(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[i] = v & 255;
    }
  }
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (ctype === 6) data.set(out.subarray(i * 4, i * 4 + 4), i * 4);
    else if (ctype === 2) { data.set(out.subarray(i * 3, i * 3 + 3), i * 4); data[i * 4 + 3] = 255; }
    else if (ctype === 3) { const k = out[i]; data.set(palette!.subarray(k * 3, k * 3 + 3), i * 4); data[i * 4 + 3] = trns && k < trns.length ? trns[k] : 255; }
    else if (ctype === 4) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = out[i * 2]; data[i * 4 + 3] = out[i * 2 + 1]; }
    else { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = out[i]; data[i * 4 + 3] = 255; }
  }
  return { w, h, data };
}

export function encodePng(img: Img): Uint8Array {
  const { w, h, data } = img;
  const raw = new Uint8Array((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) raw.set(data.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  const chunk = (type: string, body: Uint8Array) => {
    const b = new Uint8Array(12 + body.length); const dv = new DataView(b.buffer);
    dv.setUint32(0, body.length); for (let i = 0; i < 4; i++) b[4 + i] = type.charCodeAt(i);
    b.set(body, 8); dv.setUint32(8 + body.length, crc32(b.subarray(4, 8 + body.length))); return b;
  };
  const ihdr = new Uint8Array(13); const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 6;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array())];
  return Buffer.concat(parts);
}
