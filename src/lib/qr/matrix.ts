import QRCode from "qrcode";

/** Error-correction levels. Higher levels tolerate more occlusion (logos). */
export type Ecc = "L" | "M" | "Q" | "H";

export interface QrMatrix {
  /** Number of modules per side (excludes the quiet zone). */
  size: number;
  /** True when the module at (row, col) is dark. */
  get(row: number, col: number): boolean;
}

/**
 * Build the QR module matrix for `data`. Encoding (segmentation, ECC, masking)
 * is delegated to the well-tested `qrcode` library; we only consume the raw
 * bit matrix so all rendering/styling stays under our control.
 */
export function getQrMatrix(data: string, ecc: Ecc = "M"): QrMatrix {
  const qr = QRCode.create(data, { errorCorrectionLevel: ecc });
  const size = qr.modules.size;
  const bits = qr.modules.data;
  return {
    size,
    get: (row: number, col: number) => bits[row * size + col] === 1,
  };
}

export function countDarkModules(matrix: QrMatrix): number {
  let n = 0;
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) if (matrix.get(r, c)) n++;
  }
  return n;
}
