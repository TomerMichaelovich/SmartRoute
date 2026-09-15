export interface Promotion {
  id: string;
  chainId: string;
  /** Omitted = chain-wide (applies to every branch of the chain). */
  storeId?: string;
  title: string;
  description: string;
  imageUrl?: string;
  attachedNodeId: string;
  isSponsored: boolean;
  isActive: boolean;
  frequencyCapPerSession: number;
  startDate?: string;
  endDate?: string;
}
