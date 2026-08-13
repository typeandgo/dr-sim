// Bağımlılıksız PNG ikon üreteci: normal ve "aktif" (kırmızı) varyantlar
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');
const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 4;

const PANEL = [31, 41, 55, 255]; // #1f2937
const BORDER = [75, 85, 99, 255]; // #4b5563
const IDLE = [156, 163, 175, 255]; // #9ca3af
const ACTIVE = [239, 68, 68, 255]; // #ef4444

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

// RGBA piksel dizisini PNG buffer'ına çevirir
const toPng = (width, height, rgba) => {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const over = (dst, src) => {
  const a = src[3] / 255;
  if (a === 0) return dst;
  const ia = 1 - a;
  return [
    src[0] * a + dst[0] * ia,
    src[1] * a + dst[1] * ia,
    src[2] * a + dst[2] * ia,
    Math.min(255, src[3] + dst[3] * ia),
  ];
};

const insideRoundedRect = (x, y, size, radius, inset) => {
  const min = inset;
  const max = size - inset;
  if (x < min || y < min || x > max || y > max) return false;
  const cx = Math.min(Math.max(x, min + radius), max - radius);
  const cy = Math.min(Math.max(y, min + radius), max - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
};

// Yuvarlak köşeli panel + "engellendi" halkası (halka içinden çapraz çizgi)
const renderIcon = (size, accent) => {
  const s = size * SUPERSAMPLE;
  const out = Buffer.alloc(size * size * 4);
  const radius = s * 0.22;
  const center = s / 2;
  const ringOuter = s * 0.32;
  const ringInner = s * 0.22;
  const slashHalf = s * 0.045;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const x = px * SUPERSAMPLE + sx + 0.5;
          const y = py * SUPERSAMPLE + sy + 0.5;
          let color = [0, 0, 0, 0];

          if (insideRoundedRect(x, y, s, radius, 0)) color = over(color, BORDER);
          if (insideRoundedRect(x, y, s, radius * 0.9, s * 0.05)) color = over(color, PANEL);

          const d = Math.hypot(x - center, y - center);
          const onRing = d <= ringOuter && d >= ringInner;
          // 45°'lik çapraz: |(x-cx) + (y-cy)| küçükse çizgi üzerindedir
          const onSlash = Math.abs((x - center) + (y - center)) / Math.SQRT2 <= slashHalf
            && d <= ringOuter;
          if (onRing || onSlash) color = over(color, accent);

          acc = [acc[0] + color[0], acc[1] + color[1], acc[2] + color[2], acc[3] + color[3]];
        }
      }
      const n = SUPERSAMPLE * SUPERSAMPLE;
      const i = (py * size + px) * 4;
      out[i] = Math.round(acc[0] / n);
      out[i + 1] = Math.round(acc[1] / n);
      out[i + 2] = Math.round(acc[2] / n);
      out[i + 3] = Math.round(acc[3] / n);
    }
  }

  return toPng(size, size, out);
};

mkdirSync(OUT_DIR, { recursive: true });
SIZES.forEach((size) => {
  writeFileSync(resolve(OUT_DIR, `icon-${size}.png`), renderIcon(size, IDLE));
  writeFileSync(resolve(OUT_DIR, `icon-active-${size}.png`), renderIcon(size, ACTIVE));
});

console.log(`ikonlar üretildi: ${OUT_DIR}`);
