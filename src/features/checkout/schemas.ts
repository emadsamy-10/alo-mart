import { z } from "zod";
import { decimalSchema, lenientArray } from "@/lib/api/schemas";

/**
 * Boundary schemas for checkout, orders and payments (`/v1/user/checkout/quote`,
 * `/v1/user/orders`, `/v1/user/payment-methods`, `/v1/user/orders/{id}/payment`),
 * written against real local-API responses (tests/unit/fixtures/checkout).
 *
 * Every amount here is the SERVER's calculation. The storefront displays
 * them; it never adds, taxes or discounts anything itself.
 */

const nullableString = z.string().nullable().optional().transform((v) => v ?? null);
const money = decimalSchema.nullable().optional().transform((v) => v ?? null);
const name = z.string().nullable().transform((v) => v ?? "");

export const blockerSchema = z.object({ code: z.string(), message: z.string() });
export type Blocker = z.output<typeof blockerSchema>;
const blockers = lenientArray(blockerSchema).optional().transform((v) => v ?? []);

const currencySchema = z.object({ code: z.string(), symbol: nullableString, decimal_places: z.number() });

export const shippingOptionSchema = z.object({
  shipping_method_id: z.number(),
  name: z.string(),
  description: nullableString,
  fee: money,
  is_free_shipping: z.boolean().optional().transform((v) => v ?? false),
  delivery_estimate: z
    .object({ min_days: z.number().nullable(), max_days: z.number().nullable() })
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});
export type ShippingOption = z.output<typeof shippingOptionSchema>;

const quoteItemSchema = z.object({
  id: z.number(),
  quantity: z.number(),
  product: z.object({ id: z.number(), name, slug: z.string(), primary_image_url: nullableString }).nullable(),
  variant: z
    .object({
      id: z.number(),
      options: lenientArray(z.object({ value: z.object({ name }).nullable() })),
    })
    .nullable(),
  unit_price: money,
  line_subtotal: money,
  is_available: z.boolean(),
  blockers,
});

const quoteStoreSchema = z.object({
  store: z.object({ id: z.number(), name, slug: z.string() }),
  items: lenientArray(quoteItemSchema),
  delivery: z.object({ status: z.string() }).nullable().optional(),
  shipping_options: lenientArray(shippingOptionSchema),
  selected_shipping: shippingOptionSchema.nullable().optional().transform((v) => v ?? null),
  shipping_fee: money,
  total: money,
  checkout_ready: z.boolean(),
  blockers,
});
export type QuoteStore = z.output<typeof quoteStoreSchema>;

export const quoteSchema = z.object({
  market: z.object({ code: z.string() }),
  currency: currencySchema,
  address: z.object({ id: z.number() }).nullable().optional(),
  stores: lenientArray(quoteStoreSchema),
  item_count: z.number(),
  quantity_count: z.number(),
  merchandise_total: money,
  shipping_total: money,
  tax_total: money,
  grand_total: money,
  tax_calculated: z.boolean().optional().transform((v) => v ?? false),
  tax: z
    .object({ name: nullableString, rate_percent: nullableString, price_includes_tax: z.boolean().optional() })
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  checkout_ready: z.boolean(),
  blockers,
});
export type Quote = z.output<typeof quoteSchema>;

export const paymentMethodSchema = z.object({ code: z.string(), name: z.string() });
export type PaymentMethod = z.output<typeof paymentMethodSchema>;
export const paymentMethodsSchema = lenientArray(paymentMethodSchema);

export const placedOrderSchema = z.object({ id: z.string(), order_number: z.string() });

export const paymentSchema = z.object({
  id: z.string(),
  order: z.object({ id: z.string(), order_number: z.string(), payment_status: z.string() }),
  status: z.string(),
  amount: money,
  currency: z.object({ code: z.string(), decimal_places: z.number() }),
  payment_method: paymentMethodSchema.nullable().optional().transform((v) => v ?? null),
  current_attempt: z
    .object({
      id: z.string(),
      status: z.string(),
      action: z.object({ type: z.string(), url: z.string() }).nullable().optional().transform((v) => v ?? null),
    })
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});
export type Payment = z.output<typeof paymentSchema>;
