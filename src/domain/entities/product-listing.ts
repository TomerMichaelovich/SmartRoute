/** Which store carries a given master Product, and where it sits on that store's map. */
export interface ProductListing {
  id: string;
  productId: string;
  storeId: string;
  nodeId: string;
}
