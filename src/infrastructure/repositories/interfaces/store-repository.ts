import type { Store } from "@/src/domain/entities/store";

export interface IStoreRepository {
  findAll(): Promise<Store[]>;
  findActive(): Promise<Store[]>;
  findById(id: string): Promise<Store | null>;
  create(store: Store): Promise<Store>;
  update(id: string, patch: Partial<Store>): Promise<Store>;
  delete(id: string): Promise<void>;
}
