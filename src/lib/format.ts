// Characters as the API counts them (code points), so an emoji is one, not two UTF-16 units.
export const characters = (text: string) => Array.from(text).length;

// The contract's int32: the most units a quantity or a stock can be.
export const int32Max = 2_147_483_647;

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// `docs/design.md`: dates as `5 Nov`, times as `14:12`.
export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso));
}

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// A day of the Shop as the API gives it (`2026-11-05`) read as written, in any zone: `5 Nov`.
export function formatDay(date: string) {
  return day.format(new Date(`${date}T00:00:00Z`));
}

const baht = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Every amount in the contract is whole satang (฿1 = 100); the screen shows `฿48,210.00`.
export function formatBaht(satang: number) {
  return `฿${baht.format(satang / 100)}`;
}

// The price field's text, such as "48210.50", with no thousands separators.
export function satangToBahtText(satang: number) {
  return (satang / 100).toFixed(2);
}

// "48.5" is 4850 satang. Only a whole number of satang is a price; anything else is undefined.
export function bahtTextToSatang(text: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return undefined;
  const satang = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(satang) ? satang : undefined;
}
