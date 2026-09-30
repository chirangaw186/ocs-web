import { describe, expect, it } from "vitest";
import { orderTotals, rs, toDecimalString, formatLkr, sriLankaPhone } from "../src/index";

describe("pricing", () => {
  it("charges flat delivery below the free threshold", () => {
    expect(orderTotals([{ unitPrice: rs(11_900), quantity: 1 }])).toEqual({
      subtotal: rs(11_900), delivery: rs(400), total: rs(12_300),
    });
  });
  it("gives free delivery at or above Rs. 15,000", () => {
    expect(orderTotals([{ unitPrice: rs(7_500), quantity: 2 }]).delivery).toBe(0);
  });
  it("formats amounts for PayHere and for display", () => {
    expect(toDecimalString(rs(12_300))).toBe("12300.00");
    expect(formatLkr(rs(11_900))).toBe("Rs. 11,900");
  });
  it("normalises Sri Lankan phone numbers", () => {
    expect(sriLankaPhone.parse("077 123-4567")).toBe("0771234567");
    expect(sriLankaPhone.safeParse("12345").success).toBe(false);
  });
});
