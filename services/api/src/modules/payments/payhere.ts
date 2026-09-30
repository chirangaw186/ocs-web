/**
 * PayHere Checkout API helpers (pure functions, no I/O).
 * Docs: https://support.payhere.lk/api-&-mobile-sdk/checkout-api
 *   hash   = UPPER(md5(merchant_id + order_id + amount + currency + UPPER(md5(secret))))
 *   md5sig = UPPER(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(md5(secret))))
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { toDecimalString, type Minor } from "@pavielle/shared";

export interface PayHereConfig { merchantId: string; merchantSecret: string; sandbox: boolean }

const md5Upper = (s: string) => createHash("md5").update(s).digest("hex").toUpperCase();

export const checkoutUrl = (cfg: PayHereConfig) =>
  cfg.sandbox ? "https://sandbox.payhere.lk/pay/checkout" : "https://www.payhere.lk/pay/checkout";

export function checkoutHash(cfg: PayHereConfig, orderRef: string, amount: Minor, currency = "LKR") {
  return md5Upper(cfg.merchantId + orderRef + toDecimalString(amount) + currency + md5Upper(cfg.merchantSecret));
}

export interface PayHereNotification {
  merchant_id: string;
  order_id: string;
  payment_id: string;
  payhere_amount: string;
  payhere_currency: string;
  status_code: string;
  md5sig: string;
  method?: string;
  status_message?: string;
  [k: string]: string | undefined;
}

export function verifyNotification(cfg: PayHereConfig, n: PayHereNotification): boolean {
  if (n.merchant_id !== cfg.merchantId) return false;
  const expected = md5Upper(
    n.merchant_id + n.order_id + n.payhere_amount + n.payhere_currency + n.status_code + md5Upper(cfg.merchantSecret),
  );
  const a = Buffer.from(expected);
  const b = Buffer.from((n.md5sig ?? "").toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export const PAYHERE_STATUS = { "2": "SUCCEEDED", "0": "PENDING", "-1": "CANCELLED", "-2": "FAILED", "-3": "CHARGEDBACK" } as const;

/** "12300.00" -> 1230000 */
export const parseAmount = (s: string): Minor => Math.round(Number(s) * 100);

/** Fields the storefront posts to PayHere (as a hidden auto-submitted form). */
export function buildCheckoutForm(cfg: PayHereConfig, args: {
  orderRef: string; amount: Minor; items: string;
  firstName: string; lastName: string; email: string; phone: string; address: string; city: string;
  returnUrl: string; cancelUrl: string; notifyUrl: string;
}) {
  return {
    action: checkoutUrl(cfg),
    fields: {
      merchant_id: cfg.merchantId,
      return_url: args.returnUrl,
      cancel_url: args.cancelUrl,
      notify_url: args.notifyUrl,
      order_id: args.orderRef,
      items: args.items.slice(0, 250),
      currency: "LKR",
      amount: toDecimalString(args.amount),
      first_name: args.firstName,
      last_name: args.lastName,
      email: args.email,
      phone: args.phone,
      address: args.address,
      city: args.city,
      country: "Sri Lanka",
      hash: checkoutHash(cfg, args.orderRef, args.amount),
    },
  };
}
