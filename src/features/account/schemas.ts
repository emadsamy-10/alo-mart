import { z } from "zod";
import { decimalSchema, lenientArray } from "@/lib/api/schemas";

/**
 * Boundary schemas for the CUSTOMER account API (/v1/user/*), written against
 * the real responses of the backend (see docs/api-contract.md, "Customer
 * account"). Like the catalog schemas: unknown fields are stripped, nullable
 * fields stay nullable, lists drop a malformed record instead of failing.
 */

const nullableString = z.string().nullable().optional().transform((v) => v ?? null);
const name = z.string().nullable().transform((v) => v ?? "");

export const customerSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  phone: nullableString,
  gender: z.enum(["male", "female"]).nullable().optional().transform((v) => v ?? null),
  date_of_birth: nullableString,
  avatar_url: nullableString,
  email_verified_at: nullableString,
  created_at: nullableString,
});
export type Customer = z.output<typeof customerSchema>;

/** login / register */
export const authResultSchema = z.object({
  token: z.string().min(1),
  expires_at: nullableString,
  account: customerSchema,
  verification_email_sent: z.boolean().optional(),
});

export const verifyResultSchema = z.object({
  already_verified: z.boolean(),
  account: customerSchema.optional(),
});

export const emailChangeResultSchema = z.object({
  account: customerSchema,
  verification_email_sent: z.boolean(),
});

export const sessionSchema = z.object({
  id: z.number(),
  name: z.string(),
  created_at: nullableString,
  last_used_at: nullableString,
  expires_at: nullableString,
  is_current: z.boolean(),
});
export type AccountSession = z.output<typeof sessionSchema>;
export const sessionsSchema = lenientArray(sessionSchema);

export const revokedSchema = z.object({ revoked: z.number() });

/* ---------- geography & addresses ---------- */

export const placeSchema = z.object({ id: z.number(), name, code: nullableString });
export type Place = z.output<typeof placeSchema>;
export const placesSchema = lenientArray(placeSchema);

export const addressSchema = z.object({
  id: z.number(),
  label: nullableString,
  recipient_name: z.string(),
  recipient_phone: z.string(),
  country: placeSchema.extend({ phone_code: nullableString }).nullable().optional().transform((v) => v ?? null),
  region: placeSchema.nullable().optional().transform((v) => v ?? null),
  city: placeSchema.nullable().optional().transform((v) => v ?? null),
  address_line_1: z.string(),
  address_line_2: nullableString,
  building: nullableString,
  floor: nullableString,
  unit: nullableString,
  postal_code: nullableString,
  delivery_instructions: nullableString,
  is_default: z.boolean(),
});
export type Address = z.output<typeof addressSchema>;
export const addressesSchema = lenientArray(addressSchema);

/* ---------- orders ---------- */

const moneyValue = decimalSchema.nullable().optional().transform((v) => v ?? null);

/** OrderPresenter::TOTALS — gross = incl. tax. */
const orderTotalsSchema = z.object({
  merchandise_gross: moneyValue,
  shipping_gross: moneyValue,
  tax_total: moneyValue,
  grand_total: moneyValue,
});

const orderCurrencySchema = z.object({ code: z.string(), decimal_places: z.number() });

const optionSchema = z.object({
  attribute: z.object({ name }).nullable(),
  value: z.object({ name, display_value: nullableString }).nullable(),
});

const orderItemSchema = z.object({
  id: z.number(),
  product: z.object({ id: z.number().nullable(), name, slug: nullableString }),
  variant: z.object({ id: z.number().nullable(), sku: nullableString, options: lenientArray(optionSchema) }),
  quantity: z.number(),
  unit_price: moneyValue,
  line_gross: moneyValue,
});

const storeOrderSchema = z.object({
  id: z.string(),
  status: z.string(),
  store: z.object({ name, slug: nullableString }),
  shipping: z
    .object({
      name: nullableString,
      fee: moneyValue,
      is_free_shipping: z.boolean().optional(),
      delivery_estimate: z.object({ min_days: z.number().nullable(), max_days: z.number().nullable() }).optional(),
    })
    .optional(),
  totals: orderTotalsSchema.optional(),
  items: lenientArray(orderItemSchema).nullable().optional().transform((v) => v ?? []),
  // Order lifecycle (absent on an API without it: treated as unknown/none).
  cancellation_reason: nullableString,
  refund: z.object({ status: z.string(), amount: moneyValue }).nullable().optional().transform((v) => v ?? null),
  status_timestamps: z.record(z.string(), z.string().nullable()).optional(),
});

const orderAddressSchema = z
  .object({
    recipient_name: nullableString,
    recipient_phone: nullableString,
    address_line_1: nullableString,
    address_line_2: nullableString,
    building: nullableString,
    floor: nullableString,
    unit: nullableString,
    country: z.object({ name }).nullable().optional(),
    region: z.object({ name }).nullable().optional(),
    city: z.object({ name }).nullable().optional(),
  })
  .partial();

export const orderSchema = z.object({
  id: z.string(),
  order_number: z.string(),
  status: z.string(),
  payment_status: z.string(),
  placed_at: nullableString,
  market: z.object({ code: z.string() }),
  currency: orderCurrencySchema,
  store_count: z.number().optional(),
  item_count: z.number(),
  quantity_count: z.number().optional(),
  totals: orderTotalsSchema,
  delivery_address: orderAddressSchema.nullable().optional().transform((v) => v ?? null),
  stores: lenientArray(storeOrderSchema).optional().transform((v) => v ?? []),
  // Order lifecycle (absent on an API without it: no deadline, no cancel action).
  payment_due_at: nullableString,
  payment_expired: z.boolean().optional().transform((v) => v ?? false),
  cancelled_at: nullableString,
  cancellation_reason: nullableString,
  refund_status: nullableString,
  can_cancel: z.boolean().optional().transform((v) => v ?? false),
});
export type Order = z.output<typeof orderSchema>;

export const orderPageSchema = z.object({
  items: lenientArray(orderSchema),
  meta: z.object({ current_page: z.number(), last_page: z.number(), per_page: z.number(), total: z.number() }),
});

/* ---------- account cart & wishlist ---------- */

const shopCurrencySchema = z.object({ code: z.string(), symbol: nullableString, decimal_places: z.number() });

export const accountCartSchema = z.object({
  market: z.object({ code: z.string() }),
  currency: shopCurrencySchema.nullable(),
  items: lenientArray(
    z.object({
      id: z.number(),
      quantity: z.number(),
      product: z.object({ id: z.number(), name, slug: z.string(), primary_image_url: nullableString }).nullable(),
      variant: z.object({ id: z.number(), options: lenientArray(optionSchema) }).nullable(),
      price: moneyValue,
      sale_price: moneyValue,
      unit_price: moneyValue,
      is_available: z.boolean(),
      unavailable_reason: nullableString,
      is_in_stock: z.boolean(),
    }),
  ),
});
export type AccountCart = z.output<typeof accountCartSchema>;

export const accountWishlistSchema = z.object({
  items: lenientArray(
    z.object({
      id: z.number(),
      product: z.object({ id: z.number(), name, slug: z.string(), primary_image_url: nullableString }).nullable(),
    }),
  ),
});
export type AccountWishlist = z.output<typeof accountWishlistSchema>;

/** Responses whose body we do not need. */
export const anySchema = z.unknown();
