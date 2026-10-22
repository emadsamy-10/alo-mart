import { describe, expect, it } from "vitest";
import { isUsableUrl, productCardImage, resolveImage } from "@/lib/images";

const original = "https://api.example.com/storage/products/1/original.webp";

describe("resolveImage", () => {
  it("falls back to today's single URL when no renditions exist (current staging contract)", () => {
    expect(productCardImage({ primary_image_url: original })).toEqual({ src: original, width: null, height: null });
  });

  it("prefers the matching rendition once the backend serves them", () => {
    const product = {
      primary_image_url: original,
      primary_image: {
        width_px: 2400,
        height_px: 3000,
        renditions: {
          thumbnail: { url: "https://api.example.com/t.webp", width_px: 400, height_px: 500 },
          card: { url: "https://api.example.com/c.webp", width_px: 800, height_px: 1000 },
          detail: { url: "https://api.example.com/d.webp", width_px: 1200, height_px: 1500 },
        },
      },
    };
    expect(productCardImage(product, "card")?.src).toBe("https://api.example.com/c.webp");
    expect(productCardImage(product, "thumbnail")?.src).toBe("https://api.example.com/t.webp");
    expect(productCardImage(product, "detail")).toEqual({ src: "https://api.example.com/d.webp", width: 1200, height: 1500 });
  });

  it("walks down the preference list when a rendition is missing", () => {
    const resolved = resolveImage(
      { url: original, renditions: { detail: { url: "https://api.example.com/d.webp" }, card: { url: null } } },
      "card",
    );
    expect(resolved?.src).toBe("https://api.example.com/d.webp");
  });

  it("uses renditions.original before the legacy url", () => {
    expect(resolveImage({ url: null, renditions: { original: { url: original, width_px: 10, height_px: 20 } } }, "large")).toEqual({
      src: original,
      width: 10,
      height: 20,
    });
  });

  it("returns null when there is no usable image", () => {
    expect(resolveImage({ url: null }, "card")).toBeNull();
    expect(resolveImage({ url: "javascript:alert(1)" }, "card")).toBeNull();
    expect(resolveImage(null, "card")).toBeNull();
  });
});

describe("isUsableUrl", () => {
  it("accepts http(s) and root-relative paths only", () => {
    expect(isUsableUrl("https://a.b/c.png")).toBe(true);
    expect(isUsableUrl("/brand/logo.jpeg")).toBe(true);
    expect(isUsableUrl("data:image/png;base64,xx")).toBe(false);
    expect(isUsableUrl("")).toBe(false);
  });
});
