// Number formatting for display: thousands separators for S$ amounts and miles.
// Not for CSV exports or input values, which stay plain numbers.

// fmtNum(1234.5, 2) -> "1,234.50"; fmtNum(1000) -> "1,000"
export function fmtNum(n, decimals = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n ?? "");
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Whole numbers stay whole; fractional ones show two decimals (a cap of 822.86 stays "822.86", 600 stays "600").
export function fmtAuto(n) {
  const v = Number(n);
  return fmtNum(v, Number.isInteger(v) ? 0 : 2);
}
