export interface WhatsAppLink {
  phone: string;
  userId: string;
  listId: string;
  lastInboundAt: string;
  lastAddedItemIds: string[];
}

export interface WhatsAppListReset {
  listId: string;
  tripItemIds: string[];
  leftoverItemIds: string[];
  finishedAt: string;
  askedAt: string | null;
  pendingText: string | null;
}

export interface IWhatsAppRepository {
  /** Mints a one-time link code for this user + list, valid for `ttlMinutes`. */
  createLinkCode(userId: string, listId: string, ttlMinutes: number): Promise<string>;
  /** Marks the code used and returns who/what it links, or null if unknown, used or expired. */
  consumeLinkCode(code: string): Promise<{ userId: string; listId: string } | null>;
  /** Links (or re-links) a number to a user's list; also counts as an inbound message. */
  upsertLink(phone: string, userId: string, listId: string): Promise<void>;
  findLinkByPhone(phone: string): Promise<WhatsAppLink | null>;
  findLinksByList(listId: string): Promise<WhatsAppLink[]>;
  findLinkByUserAndList(userId: string, listId: string): Promise<WhatsAppLink | null>;
  deleteLink(phone: string): Promise<void>;
  touchInbound(phone: string): Promise<void>;
  setLastAdded(phone: string, itemIds: string[]): Promise<void>;
  /** True the first time a message id is seen, false for a redelivery. */
  markMessageProcessed(messageId: string): Promise<boolean>;

  /** A trip on this list just finished; replaces any earlier one not yet handled. */
  recordFinishedTrip(listId: string, tripItemIds: string[], leftoverItemIds: string[]): Promise<void>;
  findListReset(listId: string): Promise<WhatsAppListReset | null>;
  /** The bot asked about leftovers; `pendingText` = items sent meanwhile, to add after the answer. */
  markListResetAsked(listId: string, pendingText: string | null): Promise<void>;
  /** Removes the row; true only for the caller that removed it (so two answers don't both apply). */
  deleteListReset(listId: string): Promise<boolean>;
}
