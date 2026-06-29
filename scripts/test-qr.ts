/**
 * End-to-end tests for the QR Menu system: URL/slug helpers, SVG rendering
 * (incl. custom-logo embedding), the QrCode data layer (CRUD + tenant scoping)
 * and the /q/<code> scan resolution + tracking.
 *
 * Run: npx tsx scripts/test-qr.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  generateQrSlug,
  resolveTargetPath,
  resolveTargetUrl,
  encodedUrl,
  normaliseBaseUrl,
} from "../src/lib/qr/urls";
import { renderQrSvg, logoClearRegion } from "../src/lib/qr/render";
import { getQrMatrix, countDarkModules } from "../src/lib/qr/matrix";
import { isSafeTargetPath } from "../src/lib/validations/qr";
import {
  createQrCode,
  listQrCodes,
  getQrCode,
  updateQrCode,
  deleteQrCode,
  resolveScan,
} from "../src/lib/qr/data";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

async function main() {
  const tag = `qr${Date.now().toString(36)}`;
  const base = "https://app.test";

  try {
    // ===================================================================== [1]
    console.log("\n[1] URL & slug helpers");
    const slug = generateQrSlug();
    check("slug is 8 chars, safe alphabet", /^[a-hjkmnp-z2-9]{8}$/.test(slug), slug);
    check("slugs are unique", generateQrSlug() !== generateQrSlug());
    check("normaliseBaseUrl strips trailing slash", normaliseBaseUrl("http://x/") === "http://x");

    const menu = { type: "MENU" as const, tableNumber: null, targetPath: null, code: "c1", isDynamic: false };
    const table = { type: "TABLE" as const, tableNumber: 5, targetPath: null, code: "c2", isDynamic: false };
    const dyn = { type: "DYNAMIC" as const, tableNumber: null, targetPath: "/r/demo/menu", code: "c3", isDynamic: true };

    check("MENU path → /r/<slug>", resolveTargetPath(menu, "demo") === "/r/demo");
    check("TABLE path → /r/<slug>?table=5", resolveTargetPath(table, "demo") === "/r/demo?table=5");
    check("TABLE without number falls back to home", resolveTargetPath({ ...table, tableNumber: null }, "demo") === "/r/demo");
    check("DYNAMIC path uses targetPath", resolveTargetPath(dyn, "demo") === "/r/demo/menu");
    check("DYNAMIC empty target → home", resolveTargetPath({ ...dyn, targetPath: "" }, "demo") === "/r/demo");
    check("DYNAMIC target without leading slash is normalised", resolveTargetPath({ ...dyn, targetPath: "promo" }, "demo") === "/promo");

    check("encodedUrl static MENU → /r/<slug>", encodedUrl(menu, "demo", base) === `${base}/r/demo`);
    check("encodedUrl static TABLE → ?table", encodedUrl(table, "demo", base) === `${base}/r/demo?table=5`);
    check("encodedUrl dynamic → /q/<code>", encodedUrl(dyn, "demo", base) === `${base}/q/c3`);
    check("resolveTargetUrl absolute", resolveTargetUrl(dyn, "demo", base) === `${base}/r/demo/menu`);

    check("isSafeTargetPath: relative ok", isSafeTargetPath("/r/x/menu"));
    check("isSafeTargetPath: empty ok", isSafeTargetPath(""));
    check("isSafeTargetPath: protocol-relative blocked", !isSafeTargetPath("//evil.com"));
    check("isSafeTargetPath: absolute URL blocked", !isSafeTargetPath("http://evil.com"));

    // ===================================================================== [2]
    console.log("\n[2] QR matrix + SVG rendering");
    const data = `${base}/r/demo`;
    const matrix = getQrMatrix(data, "M");
    check("matrix is square with dark modules", matrix.size >= 21 && countDarkModules(matrix) > 0, matrix.size);

    const svg = renderQrSvg(data, { size: 512 });
    check("renders an <svg> string", svg.startsWith("<svg") && svg.includes("</svg>"));
    check("honours pixel size", svg.includes('width="512"') && svg.includes('height="512"'));
    check("has a viewBox + module path", svg.includes("viewBox=") && svg.includes("<path"));
    check("no logo image without a logo", !svg.includes("<image"));

    const svgLogo = renderQrSvg(data, { size: 512, logoUrl: "https://cdn.test/logo.png?v=1&x=2" });
    check("embeds <image> when logo given", svgLogo.includes("<image"));
    check("logo URL is XML-escaped", svgLogo.includes("v=1&amp;x=2"));
    check("logo plate keeps a clear center", svgLogo.includes('rx="1.2"'));

    const region = logoClearRegion(33, 0.24);
    check("logoClearRegion is centered & in bounds", region.start > 0 && region.start + region.count <= 33 && region.count >= 1, region);

    const rounded = renderQrSvg(data, { rounded: true });
    check("rounded mode uses circles", rounded.includes("<circle"));

    // ===================================================================== [3]
    console.log("\n[3] Data layer — CRUD + tenant scoping");
    const a = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "A", ownerName: "A" } });
    const b = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "B", ownerName: "B" } });

    const qMenu = await createQrCode({ restaurantId: a.id, label: "Main", type: "MENU" });
    check("create MENU: code + defaults", qMenu.code.length === 8 && qMenu.type === "MENU" && qMenu.isDynamic === false && qMenu.logoEnabled === true);

    const qTable = await createQrCode({ restaurantId: a.id, label: "Table 5", type: "TABLE", tableNumber: 5 });
    check("create TABLE: stores tableNumber", qTable.type === "TABLE" && qTable.tableNumber === 5);

    const qDyn = await createQrCode({ restaurantId: a.id, label: "Flyer", type: "DYNAMIC", targetPath: "/r/x/menu", isDynamic: false });
    check("create DYNAMIC: forced isDynamic + targetPath", qDyn.isDynamic === true && qDyn.targetPath === "/r/x/menu");

    const list = await listQrCodes(a.id);
    check("listQrCodes returns all 3", list.length === 3);

    check("getQrCode is tenant-scoped (own)", (await getQrCode(a.id, qMenu.id))?.id === qMenu.id);
    check("getQrCode rejects cross-tenant", (await getQrCode(b.id, qMenu.id)) === null);

    const updated = await updateQrCode(a.id, qMenu.id, { label: "Renamed", isDynamic: true });
    check("update label + toggle dynamic", updated?.label === "Renamed" && updated?.isDynamic === true);
    const updTable = await updateQrCode(a.id, qTable.id, { tableNumber: 9 });
    check("update table number", updTable?.tableNumber === 9);
    const updDyn = await updateQrCode(a.id, qDyn.id, { targetPath: "/r/x/contact" });
    check("update dynamic target", updDyn?.targetPath === "/r/x/contact");
    check("update rejects cross-tenant", (await updateQrCode(b.id, qMenu.id, { label: "hack" })) === null);

    // ===================================================================== [4]
    console.log("\n[4] Scan resolution + tracking");
    const r1 = await resolveScan(qMenu.code);
    check("MENU scan → /r/<slug>", r1?.targetPath === `/r/${tag}-a` && r1?.slug === `${tag}-a`);
    const after1 = await getQrCode(a.id, qMenu.id);
    check("scan increments count + sets lastScannedAt", after1?.scanCount === 1 && !!after1?.lastScannedAt);
    await resolveScan(qMenu.code);
    const after2 = await getQrCode(a.id, qMenu.id);
    check("second scan increments again", after2?.scanCount === 2);

    const rTable = await resolveScan(qTable.code);
    check("TABLE scan → ?table=9", rTable?.targetPath === `/r/${tag}-a?table=9`);
    const rDyn = await resolveScan(qDyn.code);
    check("DYNAMIC scan → editable target", rDyn?.targetPath === "/r/x/contact");

    check("unknown code resolves to null", (await resolveScan(`${tag}-missing`)) === null);

    await updateQrCode(a.id, qMenu.id, { isActive: false });
    check("inactive code does not resolve", (await resolveScan(qMenu.code)) === null);

    // ===================================================================== [5]
    console.log("\n[5] Tenant isolation + delete");
    await createQrCode({ restaurantId: b.id, label: "B menu", type: "MENU" });
    const aList = await listQrCodes(a.id);
    const bList = await listQrCodes(b.id);
    check("A sees only its codes", aList.every((q) => q.restaurantId === a.id) && aList.length === 3);
    check("B sees only its codes", bList.length === 1 && bList[0].restaurantId === b.id);

    check("delete removes the code", (await deleteQrCode(a.id, qTable.id)) === true);
    check("deleted code is gone", (await getQrCode(a.id, qTable.id)) === null);
    check("delete is idempotent / scoped", (await deleteQrCode(a.id, qTable.id)) === false);
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { startsWith: tag } } }); // cascades qrCodes
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
