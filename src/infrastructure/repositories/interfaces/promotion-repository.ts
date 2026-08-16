import type { Promotion } from "@/src/domain/entities/promotion";

export interface IPromotionRepository {
  findAll(): Promise<Promotion[]>;
  findById(id: string): Promise<Promotion | null>;
  create(promotion: Promotion): Promise<Promotion>;
  update(id: string, patch: Partial<Promotion>): Promise<Promotion>;
  delete(id: string): Promise<void>;
}
