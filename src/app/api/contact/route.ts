import { NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  restaurant: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // No email provider wired yet — log the lead. In production this would push
  // to a CRM / send an email (e.g. Resend) / create a ticket.
  console.info("[contact] New lead:", {
    name: parsed.data.name,
    email: parsed.data.email,
    restaurant: parsed.data.restaurant || "—",
  });

  return NextResponse.json({ ok: true });
}
