import { describe, expect, it } from "vitest";
import { shortBranchName } from "@/src/infrastructure/prices/branch-name";

describe("shortBranchName", () => {
  it("drops the city name and its abbreviations", () => {
    expect(shortBranchName("באר שבע", "באר שבע")).toBeNull();
    expect(shortBranchName("ביג באר שבע החדש", "באר שבע")).toBe("ביג החדש");
    expect(shortBranchName("רגר באר שבע", "באר שבע")).toBe("רגר");
    expect(shortBranchName('דיל ב"ש- נווה מנחם', "באר שבע")).toBe("דיל נווה מנחם");
    expect(shortBranchName("קרפור סיטי  צפון באר-שבע (2976)", "באר שבע")).toBe("קרפור סיטי צפון");
    expect(shortBranchName("סינמה סיטי", "באר שבע")).toBe("סינמה סיטי");
  });
});
