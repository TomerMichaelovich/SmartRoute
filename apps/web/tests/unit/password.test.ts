import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/src/infrastructure/auth/password";

describe("password hashing", () => {
  it("verifies a correct password against its own hash", async () => {
    const hash = await hashPassword("s3cret-pass-phrase");
    expect(await verifyPassword("s3cret-pass-phrase", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("s3cret-pass-phrase");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("produces a distinct salt each call (hashes differ for the same input)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("returns false for null / empty / malformed stored values", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", undefined)).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "not-a-real-hash")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$deadbeef$cafe")).toBe(false);
  });
});
