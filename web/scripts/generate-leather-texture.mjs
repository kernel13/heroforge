/**
 * Generates `public/leather.jpg`, the texture the page is laid on.
 *
 *     node scripts/generate-leather-texture.mjs public/leather.jpg
 *
 * Run by hand, and commit the JPEG it writes; nothing in the build calls this. It exists so the
 * texture is **reproducible and accounted for** rather than being an image of unknown origin
 * sitting in `public/`. Everything below is arithmetic over a seeded value-noise lattice — Chrome
 * is here only for its canvas and its JPEG encoder — so the output is this repository's own work
 * and carries no third-party licence. That is the point of it: the obvious stock parchments are
 * watermarked and not redistributable, and this application already carries three licences.
 *
 * The seed is fixed, so re-running this reproduces the committed file byte for byte. Change a
 * constant and you get a different hide; there is no "right" one, only the one that is committed.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const OUT = process.argv[2] ?? "public/leather.jpg";
/** Large enough to cover a desktop viewport without visible softening when scaled up. */
const W = 1600;
const H = 1000;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });

const dataUrl = await page.evaluate(
  ({ W, H }) => {
    // ── a deterministic value-noise field ────────────────────────────────────────────────────
    let seed = 20260727;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const LAT = 512;
    const lattice = new Float32Array(LAT * LAT);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rnd();

    const smooth = (t) => t * t * (3 - 2 * t);
    function noise(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = smooth(x - xi), yf = smooth(y - yi);
      const i0 = ((yi % LAT) + LAT) % LAT, i1 = (i0 + 1) % LAT;
      const j0 = ((xi % LAT) + LAT) % LAT, j1 = (j0 + 1) % LAT;
      const a = lattice[i0 * LAT + j0], b = lattice[i0 * LAT + j1];
      const c = lattice[i1 * LAT + j0], d = lattice[i1 * LAT + j1];
      return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * yf;
    }
    function fbm(x, y, octaves, lacunarity = 2.07, gain = 0.5) {
      let sum = 0, amp = 1, norm = 0, fx = x, fy = y;
      for (let o = 0; o < octaves; o++) {
        sum += amp * noise(fx, fy);
        norm += amp;
        amp *= gain;
        fx *= lacunarity;
        fy *= lacunarity;
      }
      return sum / norm;
    }
    /** Ridged noise: the creases and hairline cracks in a hide. */
    function ridge(x, y, octaves) {
      let sum = 0, amp = 1, norm = 0, fx = x, fy = y;
      for (let o = 0; o < octaves; o++) {
        sum += amp * (1 - Math.abs(noise(fx, fy) * 2 - 1));
        norm += amp;
        amp *= 0.55;
        fx *= 2.13;
        fy *= 2.13;
      }
      return sum / norm;
    }

    // ── the colour ramp, read off the reference: char → rust → tan → cream ───────────────────
    const RAMP = [
      [0.0, 46, 34, 28],
      [0.12, 92, 54, 33],
      [0.26, 148, 74, 28],
      [0.4, 178, 100, 44],
      [0.54, 198, 141, 88],
      [0.68, 213, 175, 130],
      [0.82, 227, 208, 180],
      [0.92, 236, 224, 203],
      [1.0, 247, 241, 229],
    ];
    function ramp(t) {
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      let i = 0;
      while (i < RAMP.length - 2 && t > RAMP[i + 1][0]) i++;
      const [t0, r0, g0, b0] = RAMP[i];
      const [t1, r1, g1, b1] = RAMP[i + 1];
      const f = (t - t0) / (t1 - t0);
      return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f];
    }

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(W, H);
    const px = img.data;

    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let x = 0; x < W; x++) {
        const u = x / W;

        // Where the light falls: a broad bloom up and left of centre, scorched to rust down the
        // right-hand edge and across the foot, with the lower-left corner and the outer edges
        // dropped into shadow.
        const bloom = Math.exp(-(((u - 0.34) / 0.46) ** 2 + ((v - 0.3) / 0.5) ** 2));
        const burn = Math.exp(-(((u - 1.04) / 0.46) ** 2 + ((v - 0.5) / 0.95) ** 2));
        const foot = Math.exp(-(((u - 0.68) / 0.6) ** 2 + ((v - 1.1) / 0.4) ** 2));
        const corner = Math.exp(-(((u - 0.0) / 0.26) ** 2 + ((v - 1.0) / 0.24) ** 2));
        const edge = Math.min(1, ((u - 0.42) / 0.82) ** 2 + ((v - 0.36) / 0.92) ** 2);

        // Domain warp, so the stains wander rather than sitting on the lattice.
        const wx = fbm(u * 2.1, v * 2.1, 3) - 0.5;
        const wy = fbm(u * 2.1 + 5.7, v * 2.1 + 3.1, 3) - 0.5;

        const stain = fbm(u * 3.4 + wx * 1.6, v * 3.4 + wy * 1.6, 6);
        const mottle = fbm(u * 14 + wx * 2.2, v * 14 + wy * 2.2, 5);
        const tooth = fbm(u * 190, v * 190, 3);
        const crack = ridge(u * 26 + wx, v * 26 + wy, 4);
        // Pitting: fine dots, but only where a slower field says there should be a patch of
        // them. Spread evenly they read as sensor noise; in clusters they read as damage.
        const speck = fbm(u * 96 + wx * 3, v * 96 + wy * 3, 2);
        const patch = fbm(u * 5.5 + 13.3, v * 5.5 + 9.1, 4);
        const pitting = Math.max(0, speck - 0.62) * Math.max(0, patch - 0.42) * 4.2;

        // Pushed away from its mean before it is used: raw fbm is a bell curve, and a bell curve
        // is an even wash. The stains have to be somewhere in particular to read as stains.
        const stained = 0.5 + (stain - 0.5) * 1.55;

        let L =
          0.42 +
          0.36 * bloom +
          0.4 * stained +
          0.13 * (mottle - 0.5) +
          0.05 * (tooth - 0.5) -
          0.16 * pitting;

        // The scorched right-hand edge is pulled *towards* rust, not subtracted towards black:
        // subtracting takes the ramp past rust into charcoal and loses the colour entirely.
        const scorch = Math.min(1, 0.85 * burn + 0.55 * foot);
        L += (0.33 - L) * scorch * 0.78;

        // Only the outer edge and the one dark corner actually go to shadow.
        L -= 0.34 * corner + 0.2 * edge;

        // Cracks bite hardest where the hide is already dark; a crease in the bloom is just glare.
        L -= 0.34 * Math.max(0, crack - 0.66) * (1.15 - L);

        let [r, g, b] = ramp(L);
        // A touch of per-pixel dirt so no area is perfectly flat under a screen's dithering.
        const dirt = (tooth - 0.5) * 14;
        const o = (y * W + x) * 4;
        px[o] = r + dirt;
        px[o + 1] = g + dirt * 0.92;
        px[o + 2] = b + dirt * 0.8;
        px[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.82);
  },
  { W, H },
);

writeFileSync(OUT, Buffer.from(dataUrl.split(",")[1], "base64"));
await browser.close();
console.log("wrote", OUT);
