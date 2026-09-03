export function normalizeClientPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("549")) digits = digits.slice(3);
  else if (digits.startsWith("54")) {
    digits = digits.slice(2);
    if (digits.startsWith("9")) digits = digits.slice(1);
  }
  return digits.replace(/^0+/, "");
}

export function isValidClientPhone(value: unknown) {
  const normalized = normalizeClientPhone(value);
  return normalized.length >= 8 && normalized.length <= 15;
}

export function normalizeClientEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return email || "";
}
