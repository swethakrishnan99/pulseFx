import { useState, useEffect, useCallback, useRef } from "react";

/**
 * USD <-> CAD exchange rate.
 *
 * Source: Frankfurter (free, no API key) which serves European Central Bank
 * reference rates. These update ONCE A DAY (around 16:00 CET), so this is the
 * latest official market rate, not a live tick-by-tick price.
 *
 * To use Monex's or Ebury's real quote API later, only useExchangeRate() below
 * needs to change. Everything else just reads { usdCad, status, asOf }.
 */
export const RATE_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=CAD";

// Used only if the rate service can't be reached and we have no earlier rate.
export const FALLBACK_USD_CAD = 1.3841;

/** Units of `to` you get for 1 unit of `from`. */
export function getRate(from, to, usdCad) {
  if (from === to) return 1;
  if (from === "USD" && to === "CAD") return usdCad;
  if (from === "CAD" && to === "USD") return 1 / usdCad;
  throw new Error(`Unsupported currency pair ${from}/${to}`);
}

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** "" and "." count as 0 so half-typed input never produces NaN. */
export function parseAmount(s) {
  if (s === "" || s === ".") return 0;
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

export const fmt2 = (n) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtRate = (r) => r.toFixed(4);

/** "2026-10-09" -> "Oct 9, 2026" (UTC-safe so the day never shifts by timezone). */
export function niceDate(iso) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Validates the API response and returns { usdCad, asOf }. Throws if it looks wrong. */
export function parseRateResponse(data) {
  const rate = data?.rates?.CAD;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Unexpected rate response");
  }
  return { usdCad: rate, asOf: typeof data.date === "string" ? data.date : null };
}

/**
 * status:
 *   "loading"  fetching (shows the last known rate meanwhile)
 *   "live"     got a rate from the service
 *   "stale"    a refresh failed; still showing the last good rate
 *   "fallback" never got a rate; showing the built-in sample rate
 */
export function useExchangeRate({ refreshMs = 10 * 60 * 1000 } = {}) {
  const [state, setState] = useState({ status: "loading", usdCad: FALLBACK_USD_CAD, asOf: null });
  const controllerRef = useRef(null);
  const mountedRef = useRef(false);

  const load = useCallback(async () => {
    controllerRef.current?.abort(); // a newer request replaces any older one
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);

    setState((prev) => ({ ...prev, status: "loading" }));
    try {
      const res = await fetch(RATE_URL, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { usdCad, asOf } = parseRateResponse(await res.json());
      if (!mountedRef.current || controllerRef.current !== controller) return;
      setState({ status: "live", usdCad, asOf });
    } catch {
      if (!mountedRef.current || controllerRef.current !== controller) return;
      setState((prev) =>
        prev.asOf
          ? { ...prev, status: "stale" }
          : { status: "fallback", usdCad: FALLBACK_USD_CAD, asOf: null }
      );
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const id = setInterval(load, refreshMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
      controllerRef.current?.abort();
    };
  }, [load, refreshMs]);

  return { ...state, refresh: load };
}
