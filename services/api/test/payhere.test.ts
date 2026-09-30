import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildCheckoutForm, checkoutHash, verifyNotification } from "../src/modules/payments/payhere.js";
import { signedNotification } from "./helpers.js";

const cfg = { merchantId: "1211149", merchantSecret: "test-secret", sandbox: true };
const md5 = (s: string) => createHash("md5").update(s).digest("hex").toUpperCase();

describe("PayHere", () => {
  it("builds the checkout hash from the documented formula", () => {
    expect(checkoutHash(cfg, "PV-1", 1_230_000)).toBe(md5("1211149PV-112300.00LKR" + md5("test-secret")));
  });
  it("builds a sandbox checkout form", () => {
    const form = buildCheckoutForm(cfg, { orderRef: "PV-1", amount: 1_230_000, items: "Dress", firstName: "A", lastName: "B",
      email: "a@b.lk", phone: "0771234567", address: "1 Road", city: "Colombo", returnUrl: "r", cancelUrl: "c", notifyUrl: "n" });
    expect(form.action).toBe("https://sandbox.payhere.lk/pay/checkout");
    expect(form.fields.amount).toBe("12300.00");
  });
  it("accepts a correctly signed notification", () => {
    expect(verifyNotification(cfg, signedNotification())).toBe(true);
  });
  it("rejects tampered amount, status, or merchant", () => {
    expect(verifyNotification(cfg, { ...signedNotification(), payhere_amount: "1.00" })).toBe(false);
    expect(verifyNotification(cfg, { ...signedNotification({ status_code: "-2" }), status_code: "2" })).toBe(false);
    expect(verifyNotification(cfg, { ...signedNotification(), merchant_id: "999" })).toBe(false);
  });
});
