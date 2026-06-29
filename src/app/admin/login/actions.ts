"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { adminLoginSchema } from "@/lib/validations/admin";
import { createAdminSession } from "@/lib/admin/auth";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";

/**
 * Verify admin credentials and, on success, write the standalone admin session
 * cookie. Returns a generic error on any failure to avoid user enumeration.
 */
export async function adminLogin(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  const parsed = adminLoginSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Enter a valid email and password.");
  }

  const { email, password } = parsed.data;
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  // Always run a compare to keep timing consistent whether or not the user
  // exists, then check the active flag.
  const hash =
    admin?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidi";
  const valid = await bcrypt.compare(password, hash);

  if (!admin || !admin.isActive || !valid) {
    return actionError("Incorrect email or password.");
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });
  await createAdminSession(admin);
  return actionOk();
}
