"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCtx } from "@/lib/ctx";

export async function setLiveOnly(on: boolean) {
  (await cookies()).set("liveOnly", on ? "1" : "0", { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setScope(branchId: string) {
  const ctx = await getCtx();
  if (!ctx || !ctx.branches.some((b) => b.id === branchId)) return; // only branches the user may see
  (await cookies()).set("scope", branchId, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  revalidatePath("/", "layout");
}
