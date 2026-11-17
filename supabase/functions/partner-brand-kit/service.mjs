import { isBrandImage } from "./images.mjs";
import { findPartnerMembership } from "../_shared/partner-membership.mjs";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const fields = { logo: "Brand logo", headshot: "Brand headshot" };
export function createBrandKitHandler({ env, fetchImpl = fetch }) {
  return async request => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const authorization = request.headers.get("Authorization");
    if (!/^Bearer\s+\S+$/i.test(authorization || "")) return json({ error: "Please sign in." }, 401);
    const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
    if (!env.SUPABASE_URL || !key || !env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) return json({ error: "Brand kit is not configured." }, 503);
    const call = (url, options = {}) => fetchImpl(url, { ...options, signal: AbortSignal.timeout(20000) });
    try {
      const auth = await call(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } });
      if (!auth.ok) return json({ error: "Please sign in again." }, 401);
      const user = await auth.json();
      if (!user.id) return json({ error: "Please sign in again." }, 401);
      const partner = await findPartnerMembership({ projectUrl: env.SUPABASE_URL, publishableKey: key, accessToken: authorization.replace(/^Bearer\s+/i, ""), userId: user.id, fetchImpl: call });
      if (!/^rec[A-Za-z0-9]{14}$/.test(partner || "")) return json({ error: "An active partner account is required." }, 403);
      if (Number(request.headers.get("Content-Length")) > 7100000) return json({ error: "File is too large." }, 413);
      // Bound streamed input as well as Content-Length before parsing base64.
      const reader = request.body?.getReader();
      let raw = "", size = 0;
      const decoder = new TextDecoder();
      if (reader) while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 7100000) { await reader.cancel(); return json({ error: "File is too large." }, 413); }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
      let input;
      try { input = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
      if (!input || typeof input !== "object") return json({ error: "Invalid request." }, 400);
      const headers = { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" };
      const tableUrl = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(env.AIRTABLE_BRAND_KIT_TABLE_ID || "Brand_kit_api")}`;
      const identity = { "Partner Airtable ID": partner, "Supabase user ID": user.id };
      let recordId;
      let resolved = false;
      const resolveRecord = async (create = false) => {
        if (!resolved) {
          const query = new URL(tableUrl);
          query.searchParams.set("filterByFormula", `{Partner Airtable ID}='${partner}'`);
          query.searchParams.set("maxRecords", "2");
          const response = await call(query, { headers });
          if (!response.ok) throw new Error("Lookup failed");
          const { records } = await response.json();
          if (!Array.isArray(records) || records.length > 1) throw new Error("Ambiguous brand kit");
          recordId = records[0]?.id;
          resolved = true;
        }
        if (!recordId && create) {
          // Upsert by the server-resolved partner identity, including simultaneous first saves.
          const response = await call(tableUrl, { method: "PATCH", headers, body: JSON.stringify({ performUpsert: { fieldsToMergeOn: ["Partner Airtable ID"] }, records: [{ fields: identity }] }) });
          if (!response.ok) throw new Error("Create failed");
          const result = await response.json();
          recordId = result.records?.[0]?.id;
        }
        if (recordId && !/^rec[A-Za-z0-9]{14}$/.test(recordId)) throw new Error("Invalid record");
        if (create && !recordId) throw new Error("Missing record");
        return recordId;
      };
      const read = async () => {
        const id = await resolveRecord();
        if (!id) return { fields: {} };
        const response = await call(`${tableUrl}/${id}`, { headers });
        if (!response.ok) throw new Error("Read failed");
        return response.json();
      };
      const patch = async values => {
        const id = await resolveRecord(true);
        const response = await call(`${tableUrl}/${id}`, { method: "PATCH", headers, body: JSON.stringify({ fields: { ...values, ...identity } }) });
        if (!response.ok) throw new Error("Save failed");
      };
      if (input.action === "description") {
        if (typeof input.description !== "string" || input.description.length > 500) return json({ error: "Use up to 500 characters." }, 400);
        await patch({ "Brand description": input.description.trim() });
      } else if (input.action === "upload") {
        const field = fields[input.kind];
        const types = input.kind === "logo" ? ["image/png", "image/jpeg", "image/svg+xml"] : ["image/png", "image/jpeg"];
        if (!field || !types.includes(input.contentType) || typeof input.filename !== "string" || !input.filename.trim() || input.filename.length > 255 || typeof input.file !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.file)) return json({ error: "Invalid image." }, 400);
        const binary = atob(input.file);
        const bytes = binary.length;
        if (!bytes || bytes > 5 * 1024 * 1024) return json({ error: "File is too large or empty." }, 400);
        let validImage = false;
        try { validImage = isBrandImage(binary, input.contentType); } catch { /* Invalid image encoding. */ }
        if (!validImage) return json({ error: "Upload a valid PNG or JPG image, or a static SVG logo without scripts or external resources." }, 400);
        // Stage separately: an unsuccessful upload must never replace the current asset.
        const staging = "Brand upload staging";
        const brandRecordId = await resolveRecord(true);
        const filename = `${crypto.randomUUID()}-${input.filename}`;
        const uploaded = await call(`https://content.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${brandRecordId}/${encodeURIComponent(staging)}/uploadAttachment`, { method: "POST", headers, body: JSON.stringify({ contentType: input.contentType, filename, file: input.file }) });
        if (!uploaded.ok) throw new Error("Upload failed");
        const result = await uploaded.json();
        const attachment = Object.values(result.fields || {}).flatMap(value => Array.isArray(value) ? value : []).find(value => value?.filename === filename);
        if (!attachment?.id || !attachment.url) throw new Error("Upload missing");
        // A singleton replaces the previous attachment; do not append to the current field.
        await patch({ [field]: [{ url: attachment.url, filename: input.filename }], [staging]: [] });
      } else if (input.action !== "load") return json({ error: "Invalid action." }, 400);
      const record = await read();
      const asset = (name, timestampField) => { const a = record.fields?.[name]?.[0]; return a ? { name: a.filename, size: a.size, url: a.url, uploadedAt: record.fields?.[timestampField] || null } : null; };
      return json({ kit: { logo: asset(fields.logo, "Logo uploaded at"), headshot: asset(fields.headshot, "Headshot uploaded at"), description: record.fields?.["Brand description"] || "", createdAt: record.fields?.["Created at"] || record.createdTime || null, updatedAt: record.fields?.["Updated at"] || null } });
    } catch {
      return json({ error: "Unable to confirm the change. Reload the Brand kit to check the current version before trying again." }, 502);
    }
  };
}
