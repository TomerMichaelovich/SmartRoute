export interface IOcrUsageRepository {
  /** How many photos this user had read since the given moment (ISO). */
  countSince(userId: string, sinceIso: string): Promise<number>;
  record(userId: string): Promise<void>;
}
