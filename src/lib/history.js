import { useState, useEffect } from "react";

/**
 * Historical exchange rates for the Dashboard charts.
 * Source: Frankfurter (ECB daily reference rates, business days only).
 * If the service can't be reached, a clearly labelled sample series is used instead.
 */
export const HISTORY_CURRENCIES = ["USD", "CAD", "EUR", "GBP"];
export const CURRENCY_NAMES = { USD: "United States", CAD: "Canada", EUR: "Euro Zone", GBP: "United Kingdom" };
export const CURRENCY_FLAGS = { USD: "\u{1F1FA}\u{1F1F8}", CAD: "\u{1F1E8}\u{1F1E6}", EUR: "\u{1F1EA}\u{1F1FA}", GBP: "\u{1F1EC}\u{1F1E7}" };

export const PERIODS = [
  { key: "D", label: "Last 7 days", days: 7 },
  { key: "W", label: "Last month", days: 30 },
  { key: "M", label: "Last 6 months", days: 182 },
  { key: "Y", label: "Last year", days: 365 },
];

const iso = (d) => d.toISOString().slice(0, 10);
const SAMPLE_IN_CAD = { CAD: 1, USD: 1.38, EUR: 1.62, GBP: 1.85 };

/** Deterministic made-up series (used only when the rate service is unreachable). */
function sampleSeries(want, have) {
  const base = SAMPLE_IN_CAD[want] / SAMPLE_IN_CAD[have];
  let seed = [...`${want}${have}`].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647 || 1;
  const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const points = [];
  let value = base;
  const end = new Date();
  for (let i = 365; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 864e5);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    value += (base - value) * 0.04 + (rand() - 0.5) * base * 0.006;
    points.push({ date: iso(d), value });
  }
  return points;
}

const cache = new Map();

export function useHistory(want, have) {
  const key = `${want}/${have}`;
  const [state, setState] = useState(() => cache.get(key) ?? { status: "loading", points: [] });

  useEffect(() => {
    if (cache.has(key)) {
      setState(cache.get(key));
      return;
    }
    setState({ status: "loading", points: [] });
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    (async () => {
      try {
        const end = new Date();
        const start = new Date(end.getTime() - 366 * 864e5);
        const url = `https://api.frankfurter.dev/v1/${iso(start)}..${iso(end)}?base=${want}&symbols=${have}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const points = Object.entries(data?.rates ?? {})
          .map(([date, r]) => ({ date, value: r?.[have] }))
          .filter((p) => typeof p.value === "number" && Number.isFinite(p.value) && p.value > 0)
          .sort((a, b) => a.date.localeCompare(b.date));
        if (points.length < 5) throw new Error("Unexpected history response");
        const next = { status: "live", points };
        cache.set(key, next);
        if (!cancelled) setState(next);
      } catch {
        if (!cancelled) setState({ status: "sample", points: sampleSeries(want, have) });
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [key, want, have]);

  return state;
}

/** Keep only the points inside the last `days` days (measured from the newest point). */
export function sliceDays(points, days) {
  if (points.length === 0) return points;
  const last = new Date(`${points[points.length - 1].date}T00:00:00Z`).getTime();
  const from = last - days * 864e5;
  return points.filter((p) => new Date(`${p.date}T00:00:00Z`).getTime() >= from);
}