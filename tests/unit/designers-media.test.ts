import { describe, expect, it } from "vitest";
import { designCardSchema, imageMediaSchema } from "@/features/designers/schemas";

/**
 * Design photos come from the API's signed delivery route. Viewer-bound
 * (protected) links must be recognisable so the UI renders them unoptimized
 * and keeps them out of the shared image-optimiser cache.
 */
describe("design image contract", () => {
  const base = { id: 7, type: "image", width: 800, height: 600, alt_text: null, sort_order: 1 };

  it("keeps the protected flag of viewer-bound links", () => {
    const parsed = imageMediaSchema.parse({ ...base, url: "https://api.example/api/v1/design-media/7?expires=1&v=u5&signature=x", protected: true });
    expect(parsed.protected).toBe(true);
  });

  it("treats a missing flag as a public link (older API responses)", () => {
    expect(imageMediaSchema.parse({ ...base, url: "https://api.example/api/v1/design-media/7?signature=x" }).protected).toBe(false);
  });

  it("accepts a locked members-only card whose cover is the public preview", () => {
    const card = designCardSchema.parse({
      slug: "hidden-courtyard",
      title: "Hidden courtyard",
      category: "architecture",
      members_only: true,
      cover: { ...base, url: "https://api.example/api/v1/design-media/7?signature=x", protected: false },
      images_count: 2,
      videos_count: 0,
      published_at: null,
      designer: null,
    });
    expect(card.cover?.protected).toBe(false);
  });
});
