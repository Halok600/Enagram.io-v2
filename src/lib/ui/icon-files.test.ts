import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Older Safari ignores the SVG icon: icon.png and favicon.ico (both rendered from icon.svg) are the fallbacks.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const read = (name: string) => readFileSync(new URL(`../../app/${name}`, import.meta.url));
const hasPngSignature = (b: Buffer, at = 0) => PNG_SIGNATURE.every((byte, i) => b[at + i] === byte);

test("icon.png is a 32x32 PNG", () => {
  const png = read("icon.png");
  assert.ok(hasPngSignature(png), "missing the PNG signature");
  assert.equal(png.toString("ascii", 12, 16), "IHDR");
  assert.equal(png.readUInt32BE(16), 32, "width");
  assert.equal(png.readUInt32BE(20), 32, "height");
});

test("favicon.ico is a valid ICO with one 32x32 PNG image", () => {
  const ico = read("favicon.ico");
  assert.equal(ico.readUInt16LE(0), 0, "reserved");
  assert.equal(ico.readUInt16LE(2), 1, "type 1 = icon");
  assert.equal(ico.readUInt16LE(4), 1, "image count");
  assert.equal(ico[6], 32, "directory width");
  assert.equal(ico[7], 32, "directory height");
  const size = ico.readUInt32LE(14);
  const offset = ico.readUInt32LE(18);
  assert.equal(offset, 22);
  assert.equal(offset + size, ico.length, "the image data runs to the end of the file");
  assert.ok(hasPngSignature(ico, offset), "the embedded image is a PNG");
  assert.equal(ico.readUInt32BE(offset + 16), 32);
  assert.equal(ico.readUInt32BE(offset + 20), 32);
});
