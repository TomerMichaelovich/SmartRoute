import type { Promotion } from "@smartroute/core/domain/entities/promotion";

export interface IPromotionRepository {
  findAll(): Promise<Promotion[]>;
  findById(id: string): Promise<Promotion | null>;
  create(promotion: Promotion): Promise<Promotion>;
  update(id: string, patch: Partial<Promotion>): Promise<Promotion>;
  delete(id: string): Promise<void>;
}
