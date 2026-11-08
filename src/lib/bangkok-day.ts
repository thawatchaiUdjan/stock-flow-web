// dashboard-and-reports R1: the Shop's days are Bangkok's, which is UTC+7 all year.
const bangkokOffset = 7 * 60 * 60 * 1000;

// The Bangkok day (YYYY-MM-DD) of a moment.
export function bangkokDay(at: number | string) {
  return new Date(new Date(at).getTime() + bangkokOffset).toISOString().slice(0, 10);
}
