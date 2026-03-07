/**
 * Icon generator for the Copilot Dash Edge extension.
 * Run: node extension/generate-icons.js
 *
 * Creates simple colored circle PNG icons:
 * - Active (blue): indicates a matching run was found
 * - Inactive (gray): no matching run
 *
 * Uses pure Node.js to create minimal valid PNG files.
 */

const fs = require("fs");
const path = require("path");

// Minimal PNG encoder for simple solid-color circles
function createPng(size, r, g, b, bgR, bgG, bgB) {
  // Create raw pixel data (RGBA)
  const pixels = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const radius = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);

      if (dist <= radius) {
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = 255;
      } else if (dist <= radius + 1) {
        // Anti-alias edge
        const alpha = Math.max(0, Math.min(255, Math.round((radius + 1 - dist) * 255)));
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = alpha;
      } else {
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }

  return encodePng(size, size, pixels);
}

function encodePng(width, height, pixels) {
  const zlib = require("zlib");

  // Add filter byte (0 = None) to each row
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: None
    pixels.copy(
      raw,
      y * (1 + width * 4) + 1,
      y * width * 4,
      (y + 1) * width * 4
    );
  }

  const compressed = zlib.deflateSync(raw);

  // Build PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", compressed);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate icons
const iconsDir = path.join(__dirname, "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [16, 48, 128];

for (const size of sizes) {
  // Active icon (blue: #2563EB)
  const active = createPng(size, 37, 99, 235, 0, 0, 0);
  fs.writeFileSync(path.join(iconsDir, `icon-active-${size}.png`), active);

  // Inactive icon (gray: #9CA3AF)
  const inactive = createPng(size, 156, 163, 175, 0, 0, 0);
  fs.writeFileSync(path.join(iconsDir, `icon-inactive-${size}.png`), inactive);
}

console.log("✓ Extension icons generated in extension/icons/");
