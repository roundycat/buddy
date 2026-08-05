import "server-only";
import sharp from "sharp";

type RGB = { r: number; g: number; b: number };

/**
 * Flood-fill uniform edge backdrop colors to transparent.
 * Skips when corners are already mostly clear (Bedrock remove-bg succeeded).
 */
export async function wipeSolidBackdrop(pngBytes: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(pngBytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels < 4 || width < 4 || height < 4) return pngBytes;

  const samplePoints = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
    [Math.floor(width / 2), 2],
    [2, Math.floor(height / 2)],
    [width - 3, Math.floor(height / 2)],
  ] as const;

  const opaqueSamples: RGB[] = [];
  let clearCorners = 0;
  for (const [x, y] of samplePoints) {
    const p = pixelAt(data, width, channels, x, y);
    if (p.a < 40) {
      clearCorners += 1;
      continue;
    }
    opaqueSamples.push({ r: p.r, g: p.g, b: p.b });
  }

  // Already cut out cleanly — don't touch.
  if (clearCorners >= 4 || opaqueSamples.length < 2) {
    return pngBytes;
  }

  const backdrop = averageColor(opaqueSamples);
  const cornerVariance = colorVariance(opaqueSamples);
  if (cornerVariance > 58) {
    return pngBytes;
  }

  // Light / flat studio plates (white, cream, cyan, gray) get a looser match.
  const bright = (backdrop.r + backdrop.g + backdrop.b) / 3;
  const threshold = bright > 180 ? 62 : 40;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  function enqueue(x: number, y: number) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const p = pixelAt(data, width, channels, x, y);
    if (p.a < 12) {
      visited[idx] = 1;
      return;
    }
    if (colorDistance(p, backdrop) > threshold) return;
    visited[idx] = 1;
    queue.push(idx);
  }

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  let cleared = 0;
  while (queue.length) {
    const idx = queue.pop()!;
    const x = idx % width;
    const y = Math.floor(idx / width);
    const offset = idx * channels;
    data[offset + 3] = 0;
    cleared += 1;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  // Soft fringe: near-backdrop pixels touching transparency
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const o = idx * channels;
      if ((data[o + 3] ?? 0) === 0) continue;
      const p = pixelAt(data, width, channels, x, y);
      if (colorDistance(p, backdrop) > threshold + 12) continue;
      let touchesClear = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const n = ((y + dy) * width + (x + dx)) * channels;
        if ((data[n + 3] ?? 0) === 0) {
          touchesClear = true;
          break;
        }
      }
      if (touchesClear) {
        data[o + 3] = 0;
        cleared += 1;
      }
    }
  }

  if (cleared < 80) return pngBytes;

  return sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
}

function pixelAt(
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y: number
) {
  const o = (y * width + x) * channels;
  return {
    r: data[o] ?? 0,
    g: data[o + 1] ?? 0,
    b: data[o + 2] ?? 0,
    a: data[o + 3] ?? 255,
  };
}

function averageColor(colors: RGB[]) {
  const n = colors.length || 1;
  return {
    r: Math.round(colors.reduce((s, c) => s + c.r, 0) / n),
    g: Math.round(colors.reduce((s, c) => s + c.g, 0) / n),
    b: Math.round(colors.reduce((s, c) => s + c.b, 0) / n),
  };
}

function colorDistance(a: RGB, b: RGB) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function colorVariance(colors: RGB[]) {
  const avg = averageColor(colors);
  const dists = colors.map((c) => colorDistance(c, avg));
  return dists.reduce((s, d) => s + d, 0) / (dists.length || 1);
}
