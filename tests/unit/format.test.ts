import { describe, expect, it } from "vitest";
import { currencyName, formatMoney, formatMoneyParts, parseAmount } from "@/lib/i18n/format";

const EGP = { code: "EGP", decimal_places: 2 };
const KWD = { code: "KWD", decimal_places: 3 };

/** Intl inserts non-breaking / directional marks; compare on visible characters. */
const visible = (s: string | null) => s?.replace(/[ ‏‎؜]/g, " ").replace(/\s+/g, " ").trim();

describe("parseAmount", () => {
  it("parses API decimal strings", () => {
    expect(parseAmount("4350.0000")).toBe(4350);
    expect(parseAmount(" 12.5 ")).toBe(12.5);
  });
  it("never fabricates a value", () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats English with the ISO code and no needless decimals", () => {
    expect(visible(formatMoney("4350.0000", EGP, "en"))).toBe("EGP 4,350");
  });
  it("keeps real fractions to the currency's precision", () => {
    expect(visible(formatMoney("19.5000", EGP, "en"))).toBe("EGP 19.50");
    expect(visible(formatMoney("1.2345", KWD, "en"))).toBe("KWD 1.235");
  });
  it("uses Latin digits and the Arabic currency symbol in Arabic", () => {
    const value = visible(formatMoney("4350.0000", EGP, "ar"));
    expect(value).toContain("4,350");
    expect(value).toContain("ج.م");
    expect(value).not.toMatch(/[٠-٩]/);
  });
  it("returns null for missing prices instead of 0", () => {
    expect(formatMoney(null, EGP, "en")).toBeNull();
  });
  it("survives an unknown currency code", () => {
    expect(visible(formatMoney("10", { code: "XXZ1", decimal_places: 2 }, "en"))).toBe("10 XXZ1");
  });
});

describe("currencyName", () => {
  it("is the ISO code in English and a localized name in Arabic", () => {
    expect(currencyName("EGP", "en")).toBe("EGP");
    expect(currencyName("EGP", "ar")).toMatch(/جنيه/);
  });
});

describe("formatMoneyParts", () => {
  it("splits amount and currency in locale order", () => {
    const en = formatMoneyParts("4350.0000", { code: "EGP", decimal_places: 2 }, "en");
    expect(en?.find((p) => p.type === "currency")?.value).toBe("EGP");
    expect(en?.find((p) => p.type === "amount")?.value).toBe("4,350");
    expect(en?.findIndex((p) => p.type === "currency")).toBeLessThan(en!.findIndex((p) => p.type === "amount"));

    const ar = formatMoneyParts("4350.0000", { code: "EGP", decimal_places: 2 }, "ar");
    expect(ar?.find((p) => p.type === "currency")?.value).toContain("ج.م");
    expect(ar?.map((p) => p.value).join("")).toContain("4,350");
  });

  it("returns null for missing prices", () => {
    expect(formatMoneyParts(null, { code: "EGP", decimal_places: 2 }, "en")).toBeNull();
  });
});
