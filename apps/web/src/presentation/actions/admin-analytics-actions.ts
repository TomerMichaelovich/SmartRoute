"use server";

import { revalidatePath } from "next/cache";
import { analyticsRepository } from "@/src/infrastructure/container";

export async function resetStoreAnalytics(storeId: string): Promise<void> {
  await analyticsRepository.deleteByStoreId(storeId);
  revalidatePath("/admin/analytics");
}
