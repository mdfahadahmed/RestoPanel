"use server";

import { redirect } from "next/navigation";
import { destroyAdminSession } from "@/lib/admin/auth";

export async function adminSignOut(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}
