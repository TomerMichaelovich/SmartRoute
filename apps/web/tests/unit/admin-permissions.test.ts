import { describe, expect, it } from "vitest";
import {
  canMapStore,
  hasAccess,
  hasSection,
  normalizePermissions,
  type AdminPrincipal,
} from "@smartroute/core/domain/entities/admin-user";
import { buildSessionToken, parseSessionToken } from "@/src/infrastructure/admin-session";

const mapper: AdminPrincipal = {
  kind: "user",
  id: "u1",
  username: "dani",
  displayName: "דני",
  permissions: { sections: [], storeIds: ["store-a"] },
};

describe("admin permissions", () => {
  it("gives the owner everything", () => {
    const owner: AdminPrincipal = { kind: "owner" };
    expect(hasSection(owner, "staff")).toBe(true);
    expect(canMapStore(owner, "any-store")).toBe(true);
  });

  it("limits a mapper to the stores it was given", () => {
    expect(canMapStore(mapper, "store-a")).toBe(true);
    expect(canMapStore(mapper, "store-b")).toBe(false);
    expect(hasAccess(mapper, { mapStore: "store-b" })).toBe(false);
    expect(hasAccess(mapper, "stores")).toBe(false);
    expect(hasAccess(mapper, "products")).toBe(false);
  });

  it("treats the stores section as mapping every store", () => {
    const manager: AdminPrincipal = { ...mapper, permissions: { sections: ["stores"], storeIds: [] } };
    expect(canMapStore(manager, "store-b")).toBe(true);
  });

  it("drops unknown sections and junk store ids", () => {
    expect(normalizePermissions({ sections: ["stores", "root", 7], storeIds: ["a", "", 3, "a"] })).toEqual({
      sections: ["stores"],
      storeIds: ["a"],
    });
    expect(normalizePermissions(null)).toEqual({ sections: [], storeIds: [] });
  });
});

describe("admin session token", () => {
  process.env.SESSION_SECRET ??= "test-secret";

  it("round-trips the owner and a user with its session version", () => {
    expect(parseSessionToken(buildSessionToken({ kind: "owner" }).value)).toEqual({ kind: "owner" });
    const subject = { kind: "user" as const, id: "3f1c2b9e-0000-4000-8000-000000000001", sessionVersion: 4 };
    expect(parseSessionToken(buildSessionToken(subject).value)).toEqual(subject);
  });

  it("rejects a token whose subject was swapped", () => {
    const [, expiresAt, signature] = buildSessionToken({ kind: "user", id: "u1", sessionVersion: 1 }).value.split(".");
    expect(parseSessionToken(`owner.${expiresAt}.${signature}`)).toBeNull();
  });

  it("rejects the old subject-less token format", () => {
    expect(parseSessionToken(`${Date.now() + 60_000}.abc`)).toBeNull();
  });
});
