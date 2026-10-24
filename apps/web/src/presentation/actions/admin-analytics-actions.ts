"use server";

import { revalidatePath } from "next/cache";
import { analyticsRepository } from "@/src/infrastructure/container";
import { requireAdmin } from "@/src/presentation/auth/admin";

export async function resetStoreAnalytics(storeId: string): Promise<void> {
  await requireAdmin("analytics");
  await analyticsRepository.deleteByStoreId(storeId);
  revalidatePath("/admin/analytics");
}
