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
