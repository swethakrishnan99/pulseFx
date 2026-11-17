import { adminSessionValid } from "../_shared/admin-session.mjs";
import { dashboardData } from "./data.mjs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...cors, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export function createAdminDashboardHandler({ env, admin, fetchImpl = fetch }) {
  return async request => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "Dashboard is read-only." }, 405);
    const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!bearer) return json({ error: "Please sign in to view the administration dashboard." }, 401);
    if (!admin || !env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) {
      return json({ error: "The administration dashboard is not configured." }, 503);
    }
    try {
      const verification = await admin.auth.getUser(bearer);
      if (verification.error || !verification.data?.user) return json({ error: "Please sign in again." }, 401);
      const user = verification.data.user;
      if (user.app_metadata?.role !== "partner_admin") return json({ error: "Administrator access is required." }, 403);
      if (!await adminSessionValid(admin, user.id, bearer)) return json({ error: "Please sign in again." }, 401);

      const base = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}`;
      let nextRead = 0;
      async function list(tableUrl, fields) {
        const records = [], seen = new Set();
        let offset;
        do {
          const url = new URL(tableUrl);
          for (const field of fields) url.searchParams.append("fields[]", field);
          if (offset) url.searchParams.set("offset", offset);
          // All dashboard tables and pages share Airtable's five requests/second limit.
          const now = Date.now();
          const delay = Math.max(0, nextRead - now);
          nextRead = now + delay + 225;
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          const response = await fetchImpl(url, {
            headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` },
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) throw new Error("Dashboard data unavailable");
          const page = await response.json();
          if (!Array.isArray(page.records)) throw new Error("Invalid dashboard page");
          records.push(...page.records);
          offset = page.offset;
          if (offset && (typeof offset !== "string" || seen.has(offset))) throw new Error("Invalid dashboard pagination");
          if (offset) seen.add(offset);
        } while (offset);
        return records;
      }
      return json(await dashboardData({ env, admin, list, base }));
    } catch {
      return json({ error: "Unable to load dashboard data. Please try again." }, 502);
    }
  };
}
