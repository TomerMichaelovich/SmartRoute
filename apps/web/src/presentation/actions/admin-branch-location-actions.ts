"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { branchLocationRepository } from "@/src/infrastructure/container";
import { parseCoordinates } from "@/src/infrastructure/prices/geocode";
import { requireAdmin } from "@/src/presentation/auth/admin";

const PAGE = "/admin/price-branches";

/** Coordinates pasted from Google Maps ("31.2341, 34.7996"); kept over the nightly geocoder. */
export async function setBranchLocation(branchId: number, formData: FormData): Promise<void> {
  await requireAdmin("stores");
  const point = parseCoordinates(String(formData.get("coordinates") ?? ""));
  if (!point) redirect(`${PAGE}?invalid=${branchId}#branch-${branchId}`);
  await branchLocationRepository.setManualLocation(branchId, point);
  revalidatePath(PAGE);
}

/** Drops hand-set coordinates: the geocoder looks the branch up again on its next run. */
export async function resetBranchLocation(branchId: number): Promise<void> {
  await requireAdmin("stores");
  await branchLocationRepository.setManualLocation(branchId, null);
  revalidatePath(PAGE);
}
