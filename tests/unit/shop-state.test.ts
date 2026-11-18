import { describe, expect, it } from "vitest";
import { shopState } from "@/features/account/shop-state";

describe("account pending", () => {
  it("is pending only while signed in and the account lists have not arrived", () => {
    shopState.setSignedIn(true);
    shopState.setSynced(false);
    expect(shopState.accountPending()).toBe(true);
    shopState.setSynced(true);
    expect(shopState.accountPending()).toBe(false);
  });

  it("is never pending for a guest", () => {
    shopState.setSignedIn(false);
    shopState.setSynced(false);
    expect(shopState.accountPending()).toBe(false);
  });
});
