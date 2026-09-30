/**
 * All money is stored as integer minor units (cents) of LKR to avoid floating-point errors.
 * Rs. 11,900.00 => 1_190_000
 */
export type Minor = number;

export const rs = (rupees: number): Minor => Math.round(rupees * 100);

/** "11900.00" — the format PayHere expects (no thousands separators). */
export const toDecimalString = (minor: Minor): string => (minor / 100).toFixed(2);

/** "Rs. 11,900" for display. */
export const formatLkr = (minor: Minor): string =>
  `Rs. ${(minor / 100).toLocaleString("en-LK", {
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
