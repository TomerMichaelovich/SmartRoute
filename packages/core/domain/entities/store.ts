export interface Store {
  id: string;
  chainId: string;
  name: string;
  address: string;
  city: string;
  mapImageUrl: string;
  mapWidth: number;
  mapHeight: number;
  isActive: boolean;
  promotionsEnabled: boolean;
  /** Multiplier on the route map's footprint trail size (1 = the original size). Set by the admin. */
  footstepScale: number;
  createdAt: string;
  updatedAt: string;
}
