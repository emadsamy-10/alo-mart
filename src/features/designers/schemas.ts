import { z } from "zod";
import { lenientArray } from "@/lib/api/schemas";

/**
 * Boundary schemas for the Designers & Subscriptions API (backend modules
 * Designers + UserSubscriptions). Unknown fields are stripped; lists drop a
 * malformed record instead of failing the page.
 */

const nullableString = z.string().nullable().optional().transform((v) => v ?? null);
const nullableNumber = z.number().nullable().optional().transform((v) => v ?? null);
const stringList = z.array(z.string()).nullable().optional().transform((v) => v ?? []);

export const metaSchema = z.object({
  current_page: z.number(),
  last_page: z.number(),
  per_page: z.number(),
  total: z.number(),
});

export const imageMediaSchema = z.object({
  id: z.number(),
  type: z.literal("image"),
  url: nullableString,
  /** Short-lived, viewer-bound link (draft or members-only photo): never pass it through the shared image optimiser. */
  protected: z.boolean().optional().default(false),
  width: nullableNumber,
  height: nullableNumber,
  alt_text: nullableString,
  sort_order: z.number().optional().default(0),
});

export const videoMediaSchema = z.object({
  id: z.number(),
  type: z.literal("video"),
  provider: z.enum(["youtube", "vimeo"]),
  embed_url: z.string(),
  watch_url: z.string(),
  alt_text: nullableString,
  sort_order: z.number().optional().default(0),
  design_slug: z.string().optional(),
  design_title: z.string().optional(),
});
export type ImageMedia = z.output<typeof imageMediaSchema>;
export type VideoMedia = z.output<typeof videoMediaSchema>;

export const designerCardSchema = z.object({
  slug: z.string(),
  display_name: z.string(),
  headline: nullableString,
  city: nullableString,
  specialties: stringList,
  avatar_url: nullableString,
  cover_url: nullableString,
  designs_count: z.number().optional().default(0),
});
export type DesignerCard = z.output<typeof designerCardSchema>;

export const designCardSchema = z.object({
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  members_only: z.boolean(),
  cover: imageMediaSchema.nullable(),
  images_count: z.number(),
  videos_count: z.number(),
  published_at: nullableString,
  designer: z.object({ slug: z.string(), display_name: z.string(), avatar_url: nullableString }).nullable(),
});
export type DesignCard = z.output<typeof designCardSchema>;

export const designPageSchema = z.object({ items: lenientArray(designCardSchema), meta: metaSchema });
export const designerPageSchema = z.object({ items: lenientArray(designerCardSchema), meta: metaSchema });

const viewerSchema = z
  .object({
    following: z.boolean().optional().default(false),
    saved: z.boolean().optional().default(false),
    signed_in: z.boolean().optional().default(false),
    is_owner: z.boolean().optional().default(false),
    customer_plus: z.boolean().optional().default(false),
  })
  .optional()
  .transform((v) => v ?? { following: false, saved: false, signed_in: false, is_owner: false, customer_plus: false });

export const designDetailSchema = designCardSchema.extend({
  locked: z.boolean(),
  description: nullableString,
  tags: stringList,
  images: lenientArray(imageMediaSchema),
  videos: lenientArray(videoMediaSchema),
  related: lenientArray(designCardSchema),
  viewer: viewerSchema,
});
export type DesignDetail = z.output<typeof designDetailSchema>;

export const designerDetailSchema = designerCardSchema.extend({
  bio: nullableString,
  links: lenientArray(z.object({ url: z.string(), label: z.string() })),
  member_since: nullableString,
  designs: lenientArray(designCardSchema),
  videos: lenientArray(videoMediaSchema),
  viewer: viewerSchema,
});
export type DesignerDetail = z.output<typeof designerDetailSchema>;

export const categoriesSchema = lenientArray(z.object({ code: z.string(), name: z.string() }));

/* ---------------------------------------------------------- subscriptions */

export const planSchema = z.object({
  id: z.number(),
  code: z.string(),
  audience: z.enum(["designer", "customer"]),
  name: z.string(),
  description: nullableString,
  prices: lenientArray(
    z.object({
      billing_period: z.enum(["monthly", "yearly"]),
      list_amount: z.string(),
      currency: z.object({ code: z.string(), decimal_places: z.number() }),
    }),
  ),
  entitlements: z.record(z.string(), z.union([z.number(), z.boolean()])),
});
export type Plan = z.output<typeof planSchema>;
export const plansSchema = lenientArray(planSchema);

export const subscriptionSchema = z.object({
  id: z.number(),
  audience: z.enum(["designer", "customer"]),
  status: z.enum(["active", "cancelled", "expired", "revoked"]),
  grants_access: z.boolean(),
  billing_period: z.enum(["monthly", "yearly"]),
  starts_at: z.string(),
  ends_at: z.string(),
  cancel_at_period_end: z.boolean(),
  activation_source: z.string(),
  plan: z.object({ id: z.number(), code: nullableString, name: nullableString }),
  terms: z.object({
    list_amount: nullableString,
    currency_code: nullableString,
    currency_decimal_places: nullableNumber,
    entitlements: z.record(z.string(), z.union([z.number(), z.boolean()])),
  }),
});
export type Subscription = z.output<typeof subscriptionSchema>;

export const requestSchema = z.object({
  id: z.number(),
  audience: z.enum(["designer", "customer"]),
  kind: z.enum(["new", "renewal"]),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]),
  billing_period: z.enum(["monthly", "yearly"]),
  decision_note: nullableString,
  created_at: nullableString,
  decided_at: nullableString,
  plan: z.object({
    id: z.number(),
    name: nullableString,
    list_amount: nullableString,
    currency_code: nullableString,
    currency_decimal_places: nullableNumber,
  }),
});
export type SubscriptionRequest = z.output<typeof requestSchema>;

const audienceStateSchema = z.object({
  entitled: z.boolean(),
  subscription: subscriptionSchema.nullable(),
  pending_request: requestSchema.nullable(),
});
export type AudienceState = z.output<typeof audienceStateSchema>;

export const overviewSchema = z.object({
  designer: audienceStateSchema,
  customer: audienceStateSchema,
  email_verified: z.boolean(),
});
export type SubscriptionOverview = z.output<typeof overviewSchema>;

export const historySchema = z.object({
  subscriptions: lenientArray(subscriptionSchema),
  requests: lenientArray(requestSchema),
});

/* ---------------------------------------------------------- studio */

export const limitsSchema = z.object({
  entitled: z.boolean(),
  max_published_designs: nullableNumber,
  max_images_per_design: z.number(),
  max_videos_per_design: z.number(),
  max_designs: z.number(),
  published: z.number(),
  pending_review: z.number(),
  total: z.number(),
});
export type StudioLimits = z.output<typeof limitsSchema>;

export const ownProfileSchema = designerCardSchema.extend({
  id: z.number(),
  bio: nullableString,
  links: lenientArray(z.object({ url: z.string(), label: z.string() })),
  status: z.enum(["pending", "approved", "rejected", "suspended"]),
  review_reason: nullableString,
  submitted_at: nullableString,
  reviewed_at: nullableString,
});
export type OwnProfile = z.output<typeof ownProfileSchema>;

export const studioSchema = z.object({
  email_verified: z.boolean(),
  profile: ownProfileSchema.nullable(),
  publicly_visible: z.boolean(),
  limits: limitsSchema.nullable(),
  categories: z.array(z.string()),
});
export type Studio = z.output<typeof studioSchema>;

export const ownDesignSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  description: nullableString,
  category: z.string(),
  tags: stringList,
  members_only: z.boolean(),
  status: z.enum(["draft", "pending_review", "published", "rejected", "archived"]),
  moderation_reason: nullableString,
  cover_media_id: nullableNumber,
  images: lenientArray(imageMediaSchema),
  videos: lenientArray(videoMediaSchema),
  submitted_at: nullableString,
  published_at: nullableString,
  updated_at: nullableString,
});
export type OwnDesign = z.output<typeof ownDesignSchema>;
export const ownDesignWithLimitsSchema = ownDesignSchema.extend({ limits: limitsSchema });
export const ownDesignsSchema = z.object({ items: lenientArray(ownDesignSchema), limits: limitsSchema });

export const inspirationSchema = z.object({
  entitled: z.boolean(),
  can_follow: z.boolean(),
  can_save: z.boolean(),
  designers: lenientArray(designerCardSchema),
  designs: lenientArray(designCardSchema),
  hidden: z.object({ designers: z.number(), designs: z.number() }),
});
export type Inspiration = z.output<typeof inspirationSchema>;
