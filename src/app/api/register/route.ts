import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { generateUniqueRestaurantSlug } from "@/lib/slug";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { restaurantName, ownerName, email, phone, password } = parsed.data;

  // Email is the login identity — must be unique platform-wide.
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const slug = await generateUniqueRestaurantSlug(restaurantName);
  const passwordHash = await bcrypt.hash(password, 10);

  // Create the tenant workspace and its owner atomically.
  const restaurant = await prisma.restaurant.create({
    data: {
      slug,
      name: restaurantName,
      ownerName,
      email,
      phone,
      users: {
        create: {
          name: ownerName,
          email,
          passwordHash,
          role: "OWNER",
        },
      },
    },
    select: { id: true, slug: true, name: true },
  });

  return NextResponse.json(
    {
      ok: true,
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
    },
    { status: 201 }
  );
}
