import { QrCode } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { listQrCodes } from "@/lib/qr/data";
import { encodedUrl, resolveTargetUrl } from "@/lib/qr/urls";
import { renderQrSvg } from "@/lib/qr/render";
import { CreateQrDialog } from "./CreateQrDialog";
import { QrCard, type QrCardData } from "./QrCard";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const { restaurantId, restaurantSlug } = await requireTenant();

  const [codes, restaurant] = await Promise.all([
    listQrCodes(restaurantId),
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { logoUrl: true } }),
  ]);

  const logoAvailable = Boolean(restaurant?.logoUrl);

  const cards: QrCardData[] = codes.map((qr) => {
    const data = encodedUrl(qr, restaurantSlug);
    const previewSvg = renderQrSvg(data, {
      size: 220,
      logoUrl: qr.logoEnabled && logoAvailable ? restaurant?.logoUrl ?? null : null,
    });
    return {
      id: qr.id,
      label: qr.label,
      type: qr.type,
      code: qr.code,
      tableNumber: qr.tableNumber,
      targetPath: qr.targetPath,
      isDynamic: qr.isDynamic,
      isActive: qr.isActive,
      scanCount: qr.scanCount,
      encodedUrl: data,
      targetUrl: resolveTargetUrl(qr, restaurantSlug),
      previewSvg,
    };
  });

  return (
    <>
      <PageHeader
        title="QR Menu"
        description="Generate, download and print QR codes that open your storefront."
        action={<CreateQrDialog logoAvailable={logoAvailable} />}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title="No QR codes yet"
          description="Create a menu, table or dynamic QR. Download it as SVG/PNG or print it for your tables, windows and flyers."
          action={<CreateQrDialog logoAvailable={logoAvailable} />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((qr) => (
            <QrCard key={qr.id} qr={qr} />
          ))}
        </div>
      )}
    </>
  );
}
