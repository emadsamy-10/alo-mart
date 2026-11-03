import { describe, expect, it } from "vitest";
import { deviceName } from "@/features/account/device";
import { firstErrors, secret, text } from "@/features/account/form-state";
import { loginHref, safeNext } from "@/features/account/redirect";
import {
  accountCartSchema,
  accountWishlistSchema,
  addressSchema,
  addressesSchema,
  authResultSchema,
  customerSchema,
  orderPageSchema,
  orderSchema,
  placesSchema,
  sessionsSchema,
} from "@/features/account/schemas";
import { cartFromAccount, wishlistFromAccount } from "@/features/account/shop-mapping";
import register from "./fixtures/account/register.json";
import me from "./fixtures/account/me.json";
import sessions from "./fixtures/account/sessions.json";
import addresses from "./fixtures/account/addresses.json";
import addressCreated from "./fixtures/account/address-created.json";
import regions from "./fixtures/account/regions.json";
import cart from "./fixtures/account/cart.json";
import wishlist from "./fixtures/account/wishlist.json";
import order from "./fixtures/account/order.json";
import orders from "./fixtures/account/orders.json";
import loginInvalid from "./fixtures/account/login-invalid.json";
import registerInvalid from "./fixtures/account/register-invalid.json";
import resendTooSoon from "./fixtures/account/resend-too-soon.json";
import verifyInvalid from "./fixtures/account/verify-invalid.json";

describe("safeNext (open-redirect protection)", () => {
  it.each([
    ["/account/orders", "/account/orders"],
    ["/products/tee?variant=12", "/products/tee?variant=12"],
    ["/en/products/tee?variant=12", "/products/tee?variant=12"],
    ["/ar", "/"],
    ["%2Faccount%2Faddresses", "/account/addresses"],
  ])("keeps the same-site path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "%2F%2Fevil.example",
    "%252F%252Fevil.example",
    "/%0d%0aSet-Cookie:x",
    "account",
    "",
    "/login",
    "/register?next=/account",
    "/en/reset-password?token=abc",
    `/${"a".repeat(600)}`,
  ])("rejects %s", (input) => {
    expect(safeNext(input)).toBe("/account");
  });

  it("rejects non-strings and supports a custom fallback", () => {
    expect(safeNext(undefined)).toBe("/account");
    expect(safeNext(["/a"])).toBe("/account");
    expect(safeNext("//evil", "")).toBe("");
  });

  it("builds sign-in links that carry only a safe return path", () => {
    expect(loginHref("/account/orders")).toBe("/login?next=%2Faccount%2Forders");
    expect(loginHref("/products/tee?variant=3")).toBe("/login?next=%2Fproducts%2Ftee%3Fvariant%3D3");
    expect(loginHref("/account")).toBe("/login");
    expect(loginHref("https://evil.example")).toBe("/login");
    expect(loginHref(null)).toBe("/login");
  });
});

describe("deviceName", () => {
  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36", "Chrome on Windows"],
    ["Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0", "Edge on Windows"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", "Safari on iPhone"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36", "Chrome on Android"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0", "Firefox on macOS"],
    ["", "Web browser"],
    [null, "Web browser"],
  ])("%s → %s", (ua, expected) => {
    expect(deviceName(ua)).toBe(expected);
  });
});

describe("form helpers", () => {
  it("keeps the first API message per field and renames keys", () => {
    expect(firstErrors({ email: ["Taken.", "Other"], phone: ["Bad"] }, { phone: "mobile" })).toEqual({ email: "Taken.", mobile: "Bad" });
    expect(firstErrors({})).toBeUndefined();
    expect(firstErrors(undefined)).toBeUndefined();
  });

  it("trims and bounds text, keeps secrets raw", () => {
    const form = new FormData();
    form.set("name", "  Sara  ");
    form.set("password", "  spaced pass  ");
    expect(text(form, "name")).toBe("Sara");
    expect(text(form, "name", 2)).toBe("Sa");
    expect(text(form, "missing")).toBe("");
    expect(secret(form, "password")).toBe("  spaced pass  ");
  });
});

describe("account API schemas (real local-API responses)", () => {
  it("parses register/login results without exposing more than needed", () => {
    const parsed = authResultSchema.parse(register.data);
    expect(parsed.token).toMatch(/^\d+\|/);
    expect(parsed.expires_at).toBeTruthy();
    expect(parsed.account.email_verified_at).toBeNull();
    expect(parsed.verification_email_sent).toBe(true);
    expect(customerSchema.parse(me.data).email).toBe(parsed.account.email);
  });

  it("parses sessions with exactly one current session", () => {
    const parsed = sessionsSchema.parse(sessions.data);
    expect(parsed.filter((s) => s.is_current)).toHaveLength(1);
    expect(parsed[0].name).toBe("Chrome on Windows");
  });

  it("parses addresses and bilingual geography", () => {
    expect(addressSchema.parse(addressCreated.data).is_default).toBe(true);
    const list = addressesSchema.parse(addresses.data);
    expect(list[0].city?.name).toBeTruthy();
    expect(placesSchema.parse(regions.data)[0].name).toBe("القاهرة");
  });

  it("parses an order and the order list", () => {
    const parsed = orderSchema.parse(order.data);
    expect(parsed.order_number).toMatch(/^AM-/);
    expect(parsed.stores[0].items.length).toBeGreaterThan(0);
    expect(parsed.totals.grand_total).toBeTruthy();
    expect(parsed.delivery_address?.city?.name).toBeTruthy();
    expect(orderPageSchema.parse(orders.data).meta.total).toBe(1);
  });

  it("drops one malformed list record instead of failing the page", () => {
    const parsed = addressesSchema.parse([...addresses.data, { id: "broken" }]);
    expect(parsed).toHaveLength(addresses.data.length);
  });

  it("keeps machine-readable error codes in the fixtures the website relies on", () => {
    expect(loginInvalid.http).toBe(401);
    expect(registerInvalid.http).toBe(422);
    expect(Object.keys(registerInvalid.errors)).toEqual(expect.arrayContaining(["name", "email", "password"]));
    expect(resendTooSoon).toMatchObject({ http: 429, code: "resend_too_soon" });
    expect(verifyInvalid).toMatchObject({ http: 422, code: "verification_invalid" });
  });
});

describe("account cart/wishlist → shared store shapes", () => {
  const image = (url: string | null) => (url ? `img:${url}` : null);

  it("maps the account cart to cart lines keyed by variant, with item ids", () => {
    const view = cartFromAccount(accountCartSchema.parse(cart.data), image);
    const item = cart.data.items[0];
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]).toMatchObject({ variantId: item.variant.id, productId: item.product.id, slug: item.product.slug, quantity: 2, issue: null });
    expect(view.lines[0].currency.code).toBe("EGP");
    expect(view.lines[0].imageUrl).toMatch(/^img:/);
    expect(view.itemIds).toEqual({ [item.variant.id]: item.id });
  });

  it("flags unavailable and out-of-stock lines, shows a real reduction only", () => {
    const base = accountCartSchema.parse(cart.data);
    const item = base.items[0];
    const view = cartFromAccount(
      {
        ...base,
        items: [
          { ...item, is_available: false, unavailable_reason: "insufficient_stock" },
          { ...item, id: 99, variant: { ...item.variant!, id: 999 }, is_available: false, unavailable_reason: "product_unavailable" },
          { ...item, id: 98, variant: { ...item.variant!, id: 998 }, price: "500.0000", sale_price: "400.0000", unit_price: "400.0000" },
          { ...item, id: 97, product: null },
        ],
      },
      image,
    );
    expect(view.lines.map((l) => l.issue)).toEqual(["out_of_stock", "unavailable", null]);
    expect(view.lines[2]).toMatchObject({ unitPrice: "400.0000", regularPrice: "500.0000" });
    expect(view.lines[0].regularPrice).toBeNull();
  });

  it("maps the account wishlist to entries keyed by product", () => {
    const entries = wishlistFromAccount(accountWishlistSchema.parse(wishlist.data), image);
    expect(entries).toHaveLength(1);
    expect(entries[0].productId).toBe(wishlist.data.items[0].product.id);
  });
});
