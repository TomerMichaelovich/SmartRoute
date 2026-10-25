import type { GeoPoint } from "@/src/infrastructure/prices/geocode";

export interface BranchLocationView {
  id: number;
  chainName: string;
  name: string;
  address: string | null;
  cityCode: number | null;
  lat: number | null;
  lng: number | null;
  /** "pending" | "ok" | "not_found" | "manual" */
  geocodeStatus: string;
}

/** Where the price branches are, for the distance shown in cheapest-basket results. */
export interface IBranchLocationRepository {
  /** Branches that take part in quotes (pilot cities), unplaced ones first. */
  findQuotedBranches(): Promise<BranchLocationView[]>;
  /** Coordinates set by hand (kept by the nightly geocoder); null hands the branch back to it. */
  setManualLocation(branchId: number, point: GeoPoint | null): Promise<void>;
}
