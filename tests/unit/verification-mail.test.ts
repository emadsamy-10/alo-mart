import { describe, expect, it } from "vitest";
import { afterRegister } from "@/features/account/redirect";

describe("where registration lands", () => {
  it("says the link was sent only when the backend sent it", () => {
    expect(afterRegister("", true)).toBe("/account?welcome=1");
    expect(afterRegister("", false)).toBe("/account?welcome=unsent");
    // The backend omits the flag on older versions: don't claim either way, use the usual welcome.
    expect(afterRegister("", undefined)).toBe("/account?welcome=1");
  });

  it("keeps a safe destination the customer was heading to", () => {
    expect(afterRegister("/checkout", false)).toBe("/checkout");
    expect(afterRegister("/account", false)).toBe("/account?welcome=unsent");
  });
});
