import { getQrMatrix, type Ecc } from "./matrix";

export interface QrRenderOptions {
  /** Output width/height in px. Default 512. */
  size?: number;
  /** Quiet-zone width in modules. Default 4 (spec minimum). */
  margin?: number;
  dark?: string;
  light?: string;
  /** Transparent background instead of `light`. */
  transparent?: boolean;
  ecc?: Ecc;
  /** Center logo URL. Forces ECC "H" unless `ecc` is given. */
  logoUrl?: string | null;
  /** Logo size as a fraction of the QR width. Default 0.24. */
  logoRatio?: number;
  /** Draw circular modules instead of squares. */
  rounded?: boolean;
}

export interface LogoRegion {
  /** Inclusive start module index. */
  start: number;
  /** Exclusive end module index. */
  end: number;
  /** Side length in modules. */
  count: number;
}

/**
 * The square block of modules cleared for a center logo, kept centered and
 * (where possible) parity-aligned with the matrix so it looks balanced.
 */
export function logoClearRegion(size: number, ratio: number): LogoRegion {
  let count = Math.max(1, Math.floor(size * ratio));
  // Match parity with the matrix so the cleared block is centered.
  if (count % 2 !== size % 2) count += 1;
  const start = Math.floor((size - count) / 2);
  return { start, end: start + count, count };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Render a QR code as a standalone SVG string (vector → perfect for print &
 * download). When `logoUrl` is set, the central modules are cleared and the
 * logo is overlaid on a rounded plate; error correction "H" keeps the code
 * scannable despite the occlusion.
 */
export function renderQrSvg(data: string, opts: QrRenderOptions = {}): string {
  const logoUrl = opts.logoUrl?.trim() || null;
  const ecc: Ecc = opts.ecc ?? (logoUrl ? "H" : "M");
  const margin = opts.margin ?? 4;
  const pixel = opts.size ?? 512;
  const dark = opts.dark ?? "#0a0a0c";
  const light = opts.light ?? "#ffffff";
  const rounded = opts.rounded ?? false;

  const matrix = getQrMatrix(data, ecc);
  const size = matrix.size;
  const count = size + margin * 2;
  const region = logoUrl ? logoClearRegion(size, opts.logoRatio ?? 0.24) : null;

  const inLogo = (r: number, c: number) =>
    region != null &&
    r >= region.start &&
    r < region.end &&
    c >= region.start &&
    c < region.end;

  // One <path> for all dark modules keeps the SVG compact.
  let path = "";
  const circles: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!matrix.get(r, c) || inLogo(r, c)) continue;
      const x = c + margin;
      const y = r + margin;
      if (rounded) {
        circles.push(`<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.5"/>`);
      } else {
        path += `M${x} ${y}h1v1h-1z`;
      }
    }
  }

  const bg = opts.transparent
    ? ""
    : `<rect width="${count}" height="${count}" fill="${light}"/>`;

  const modules = rounded
    ? `<g fill="${dark}">${circles.join("")}</g>`
    : `<path fill="${dark}" d="${path}"/>`;

  let logo = "";
  if (region && logoUrl) {
    // Pad the cleared block slightly so the logo doesn't touch live modules.
    const pad = 0.6;
    const lx = region.start + margin - pad;
    const ly = region.start + margin - pad;
    const lsize = region.count + pad * 2;
    const inset = 0.9; // image inset within the white plate
    logo =
      `<rect x="${lx}" y="${ly}" width="${lsize}" height="${lsize}" rx="1.2" fill="${light}"/>` +
      `<image href="${escapeXml(logoUrl)}" x="${lx + inset}" y="${ly + inset}" ` +
      `width="${lsize - inset * 2}" height="${lsize - inset * 2}" ` +
      `preserveAspectRatio="xMidYMid meet"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixel}" height="${pixel}" ` +
    `viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    bg +
    modules +
    logo +
    `</svg>`
  );
}
