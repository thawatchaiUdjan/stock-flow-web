import { useEffect, useState } from "react";

import { bangkokDay } from "@/lib/bangkok-day";

// date-controls R7, R9: default guidance follows Shop midnight and resumed tabs.
export function useBangkokToday() {
  const [today, setToday] = useState(() => bangkokDay(Date.now()));
  useEffect(() => {
    const refresh = () => setToday(bangkokDay(Date.now()));
    const nextMidnight = Date.parse(`${today}T00:00:00+07:00`) + 24 * 60 * 60 * 1000;
    const timer = window.setTimeout(refresh, Math.max(1, nextMidnight - Date.now()));
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [today]);
  return today;
}
