import { describe, expect, test } from "vitest";
import { returnPath } from "./return-path";

describe("returnPath", () => {
  test("keeps a path on this site, with its query", () => {
    expect(returnPath("/device?user_code=ABCD-EFGH")).toBe(
      "/device?user_code=ABCD-EFGH",
    );
  });

  test.each([
    "https://evil.example/device",
    "//evil.example/device",
    "/\\evil.example/device",
    "/\t/evil.example/device",
    "device",
    "",
    undefined,
    ["/device"],
  ])("rejects %j", (value) => {
    expect(returnPath(value)).toBeUndefined();
  });
});
