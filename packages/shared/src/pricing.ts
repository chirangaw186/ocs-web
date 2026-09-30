import { rs, type Minor } from "./money";

/** Delivery policy from the business plan (section 11.2). Change here, not in callers. */
export const DELIVERY_POLICY = {
  flatFee: rs(400),
  freeAbove: rs(15_000),
} as const;

export const deliveryFee = (subtotal: Minor): Minor =>
  subtotal >= DELIVERY_POLICY.freeAbove ? 0 : DELIVERY_POLICY.flatFee;

export interface PricedLine {
  unitPrice: Minor;
  quantity: number;
}

export function orderTotals(lines: PricedLine[]) {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const delivery = deliveryFee(subtotal);
  return { subtotal, delivery, total: subtotal + delivery };
}
