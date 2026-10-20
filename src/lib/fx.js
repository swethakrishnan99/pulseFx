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
export const RATE_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=CAD,EUR,GBP,AUD,MXN";

// Sample USD rates, used only if the service can't be reached.
export const FALLBACK_RATES = { USD: 1, CAD: 1.3841, EUR: 0.86, GBP: 0.75, AUD: 1.52, MXN: 18.4 };


/** Units of `to` you get for 1 unit of `from`. */
export function getRate(from, to, rates) {
  if (from === to) return 1;
  const f = rates?.[from];
  const t = rates?.[to];
  if (!f || !t) throw new Error(`Unsupported currency pair ${from}/${to}`);
  return t / f; // both rates are "per 1 USD"
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

/** Validates the API response and returns { rates, asOf }. Throws if it looks wrong. */
export function parseRateResponse(data) {
  const rates = { USD: 1 };
  for (const c of Object.keys(FALLBACK_RATES)) {
    if (c === "USD") continue;
    const r = data?.rates?.[c];
    if (typeof r !== "number" || !Number.isFinite(r) || r <= 0) throw new Error("Unexpected rate response");
    rates[c] = r;
  }
  return { rates, asOf: typeof data.date === "string" ? data.date : null };
}

/**
 * status:
 *   "loading"  fetching (shows the last known rate meanwhile)
 *   "live"     got a rate from the service
 *   "stale"    a refresh failed; still showing the last good rate
 *   "fallback" never got a rate; showing the built-in sample rate
 */
export function useExchangeRate({ refreshMs = 10 * 60 * 1000 } = {}) {
  const [state, setState] = useState({ status: "loading", rates: FALLBACK_RATES, asOf: null });
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
      const { rates, asOf } = parseRateResponse(await res.json());
      if (!mountedRef.current || controllerRef.current !== controller) return;
      setState({ status: "live", rates, asOf });
    } catch {
      if (!mountedRef.current || controllerRef.current !== controller) return;
      setState((prev) =>
        prev.asOf
          ? { ...prev, status: "stale" }
          : { status: "fallback", rates: FALLBACK_RATES, asOf: null }
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