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
  createdAt: string;
  updatedAt: string;
}
