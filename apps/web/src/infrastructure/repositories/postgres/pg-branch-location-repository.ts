import { rawSql } from "../../db/client";
import type { GeoPoint } from "@/src/infrastructure/prices/geocode";
import type { BranchLocationView, IBranchLocationRepository } from "../interfaces/branch-location-repository";

export class PgBranchLocationRepository implements IBranchLocationRepository {
  async findQuotedBranches(): Promise<BranchLocationView[]> {
    const rows = (await rawSql.query(
      `SELECT b.id, c.name AS chain_name, b.name, b.address, b.city_code, b.lat, b.lng, b.geocode_status
       FROM retail_branches b JOIN retail_chains c ON c.id = b.chain_id
       WHERE b.prices_enabled AND b.is_active AND b.is_retail
       ORDER BY (b.lat IS NOT NULL), c.name, b.name`,
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: Number(r.id),
      chainName: String(r.chain_name),
      name: String(r.name),
      address: (r.address as string | null) ?? null,
      cityCode: r.city_code === null ? null : Number(r.city_code),
      lat: r.lat === null ? null : Number(r.lat),
      lng: r.lng === null ? null : Number(r.lng),
      geocodeStatus: String(r.geocode_status),
    }));
  }

  async setManualLocation(branchId: number, point: GeoPoint | null): Promise<void> {
    if (point) {
      await rawSql.query(`UPDATE retail_branches SET lat = $2, lng = $3, geocode_status = 'manual' WHERE id = $1`, [
        branchId,
        point.lat,
        point.lng,
      ]);
    } else {
      // Back to the geocoder: it looks the branch up again on its next run.
      await rawSql.query(
        `UPDATE retail_branches SET lat = NULL, lng = NULL, geocode_status = 'pending', geocoded_address = NULL WHERE id = $1`,
        [branchId],
      );
    }
  }
}
