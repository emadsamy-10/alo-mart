import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import proxy from "@/proxy";
import { defaultLocale, intlLocale, isLocale, localeDirection, locales } from "@/lib/i18n/routing";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

describe("locale registry", () => {
  it("serves Arabic and English with Arabic as default", () => {
    expect(locales).toEqual(["ar", "en"]);
    expect(defaultLocale).toBe("ar");
  });
  it("maps direction", () => {
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("en")).toBe("ltr");
  });
  it("validates locale params", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
  it("formats Arabic numbers with Latin digits", () => {
    expect(intlLocale("ar")).toContain("nu-latn");
  });
});

describe("proxy locale negotiation", () => {
  const request = (path: string, headers: Record<string, string> = {}) =>
    new NextRequest(new URL(path, "http://localhost:3000"), { headers });

  it("redirects / to the browser's preferred supported locale", () => {
    const response = proxy(request("/", { "accept-language": "en-US,en;q=0.9" }));
    expect(response.headers.get("location")).toBe("http://localhost:3000/en");
  });

  it("falls back to the default locale", () => {
    const response = proxy(request("/", { "accept-language": "fr-FR" }));
    expect(response.headers.get("location")).toBe("http://localhost:3000/ar");
  });

  it("prefixes unprefixed paths, preserving them", () => {
    const response = proxy(request("/products/desk", { "accept-language": "en" }));
    expect(response.headers.get("location")).toBe("http://localhost:3000/en/products/desk");
  });

  it("passes through already-localized paths", () => {
    const response = proxy(request("/en/products/desk"));
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("message catalogs", () => {
  const keys = (obj: object, prefix = ""): string[] =>
    Object.entries(obj).flatMap(([k, v]) => (typeof v === "object" && v ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

  it("Arabic and English define exactly the same keys", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });
});
