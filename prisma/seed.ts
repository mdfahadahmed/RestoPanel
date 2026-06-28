import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Creates one demo restaurant + owner so you can sign in immediately.
// Run with: npm run db:seed   (login: demo@restopanel.com / demo12345)
async function main() {
  const email = "demo@restopanel.com";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already exists — skipping.");
    return;
  }

  const passwordHash = await bcrypt.hash("demo12345", 10);
  const restaurant = await prisma.restaurant.create({
    data: {
      slug: "bella-tavola",
      name: "Bella Tavola",
      ownerName: "Demo Owner",
      email,
      phone: "+44 7700 900000",
      users: {
        create: { name: "Demo Owner", email, passwordHash, role: "OWNER" },
      },
      categories: {
        create: [
          { name: "Starters", slug: "starters", position: 0 },
          { name: "Mains", slug: "mains", position: 1 },
          { name: "Desserts", slug: "desserts", position: 2 },
        ],
      },
    },
  });

  console.log(`Seeded restaurant ${restaurant.slug} (login: ${email} / demo12345)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
