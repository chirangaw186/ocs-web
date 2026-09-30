import { z } from "zod";

export const PAYMENT_METHODS = ["PAYHERE", "COD", "BANK_TRANSFER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",        // PayHere started, waiting for notify callback
  "AWAITING_CONFIRMATION",  // COD / bank transfer, staff must confirm with customer
  "CONFIRMED",
  "PACKED",
  "DISPATCHED",
  "DELIVERED",
  "FAILED_DELIVERY",
  "RETURNED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Sri Lankan mobile: 07XXXXXXXX or +947XXXXXXXX */
export const sriLankaPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(?:\+94|0)7\d{8}$/, "Enter a valid Sri Lankan mobile number"));

export const checkoutRequestSchema = z.object({
  items: z
    .array(z.object({ sku: z.string().min(1), quantity: z.number().int().min(1).max(10) }))
    .min(1)
    .max(20),
  customer: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.email(),
    phone: sriLankaPhone,
  }),
  address: z.object({
    line1: z.string().trim().min(3).max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(2).max(80),
    district: z.string().trim().min(2).max(80),
  }),
  paymentMethod: z.enum(PAYMENT_METHODS),
  note: z.string().max(500).optional(),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

/** Public product shape returned by the store API and used by the storefront. */
export interface StoreVariant {
  sku: string;
  colour: string;
  size: string;
  price: number;
  available: number;
}
export interface StoreProduct {
  slug: string;
  name: string;
  description: string;
  fabric: string | null;
  care: string | null;
  images: { url: string; alt: string }[];
  variants: StoreVariant[];
}
