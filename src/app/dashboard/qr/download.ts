/**
 * Browser-only helpers to download/print a QR SVG. The SVG is generated on the
 * server (with the embedded logo); these turn it into a downloaded file, a
 * rasterised PNG (via canvas), or a print-ready window — no native deps.
 */

export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(URL.createObjectURL(blob), filename);
}

export async function downloadPng(svg: string, filename: string, size = 1024): Promise<void> {
  const url = await svgToPngUrl(svg, size);
  triggerDownload(url, filename.replace(/\.svg$/i, "") + ".png");
}

export function printSvg(svg: string, title: string): void {
  const win = window.open("", "_blank", "width=600,height=700");
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><title>${escapeHtml(title)}</title>` +
      `<style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:#fff}` +
      `svg{width:80vmin;height:80vmin}@media print{svg{width:120mm;height:120mm}}</style></head>` +
      `<body>${svg}<script>window.onload=function(){window.focus();window.print();}</script></body></html>`
  );
  win.document.close();
}

async function svgToPngUrl(svg: string, size: number): Promise<string> {
  const svgUrl =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const img = new Image();
  // Allow rasterising cross-origin logos without tainting the canvas.
  img.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not render QR image"));
    img.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);
  return canvas.toDataURL("image/png");
}

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
