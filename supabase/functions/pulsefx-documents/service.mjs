import { adminSessionValid } from "../_shared/admin-session.mjs";
import { isBrandImage } from "../partner-brand-kit/images.mjs";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body, status = 200) => Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const limit = 5 * 1024 * 1024;
const bucket = "document-upload-staging";
class Failure extends Error { constructor(message, status = 502) { super(message); this.status = status; } }
const checked = result => { if (result.error) throw new Error("Storage unavailable"); return result.data; };
export function documentView(record) {
  const f = record.fields || {}, a = f.File?.[0];
  const audit = prefix => ({ at: f[`${prefix} at`] || null, userId: f[`${prefix} by user ID`] || null, email: f[`${prefix} by email`] || null });
  return { id: record.id, name: f.Name || "", visible: f["Visible to partner"] === true, deleted: f.Deleted === true,
    file: a?.url && /^https:\/\//i.test(a.url) ? { id: a.id, name: a.filename, url: a.url, type: a.type || "", size: a.size || null } : null,
    updatedAt: f["Last updated at"] || null,
    created: { ...audit("Created"), at: f["Created at"] || record.createdTime || null }, replaced: audit("Replaced"), deletedAudit: audit("Deleted") };
}
export async function boundedBody(request) {
  const reader = request.body?.getReader(), chunks = []; let size = 0;
  if (Number(request.headers.get("content-length")) > 7100000) throw new Failure("Maximum file size is 5 MB.", 413);
  if (reader) while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 7100000) { await reader.cancel(); throw new Failure("Maximum file size is 5 MB.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Failure("Invalid request.", 400); }
}
function uploadFile(input) {
  if (typeof input.filename !== "string" || !input.filename.trim() || input.filename.length > 255 || /[\\/\x00-\x1f]/.test(input.filename)
    || typeof input.file !== "string" || !input.file.length || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.file)) throw new Failure("Choose a valid file.", 400);
  const binary = atob(input.file);
  if (!binary.length || binary.length > limit) throw new Failure("Maximum file size is 5 MB.", 400);
  const types = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp", gif: "image/gif", txt: "text/plain", csv: "text/csv", zip: "application/zip", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
  const extension = input.filename.split(".").pop().toLowerCase(), type = types[extension];
  if (!type) throw new Failure("Use PDF, PNG, JPG, SVG, WebP, GIF, TXT, CSV, ZIP, DOCX, XLSX or PPTX.", 400);
  if ((["png", "jpg", "jpeg", "svg"].includes(extension) && !isBrandImage(binary, type)) || (extension === "pdf" && !binary.startsWith("%PDF-"))) throw new Failure("The file content does not match its format.", 400);
  return { bytes: Uint8Array.from(binary, char => char.charCodeAt(0)), type };
}
export function createDocumentsHandler({ env, admin, fetchImpl = fetch, verifySession = adminSessionValid, now = () => new Date() }) {
  return async request => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    let attemptedWrite = false;
    try {
      const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
      if (!bearer) throw new Failure("Please sign in.", 401);
      if (!admin || !env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) throw new Failure("Documents are not configured.", 503);
      const verification = await admin.auth.getUser(bearer), actor = verification.data?.user;
      if (verification.error || !actor) throw new Failure("Please sign in again.", 401);
      if (actor.app_metadata?.role !== "partner_admin") throw new Failure("Administrator access is required.", 403);
      if (!await verifySession(admin, actor.id, bearer)) throw new Failure("Please sign in again.", 401);
      const input = await boundedBody(request);
      if (!input || !["load", "create", "replace", "edit", "visibility", "delete"].includes(input.action)) throw new Failure("Invalid document action.", 400);
      const table = { brand: env.AIRTABLE_BRAND_ASSETS_TABLE_ID, guide: env.AIRTABLE_ONE_PAGERS_TABLE_ID }[input.section];
      if (typeof table !== "string" || !table) throw new Failure("Document section is not configured.", 400);
      const base = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(table)}`;
      const headers = { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" };
      const call = async (url, options = {}) => {
        const response = await fetchImpl(url, { ...options, headers, signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error("Airtable unavailable");
        return response.json();
      };
      if (input.action === "load") {
        const documents = [], seen = new Set(); let offset, pages = 0;
        do {
          if (++pages > 100 || (offset && seen.has(offset))) throw new Error("Invalid pagination");
          if (offset) seen.add(offset);
          const url = new URL(base); if (offset) url.searchParams.set("offset", offset);
          const page = await call(url);
          if (!Array.isArray(page.records)) throw new Error("Invalid records");
          documents.push(...page.records.map(documentView)); offset = page.offset;
        } while (offset);
        return json({ documents });
      }
      if (!actor.email) throw new Failure("Your account needs an email address.", 400);
      let record;
      if (input.action !== "create") {
        if (!/^rec[A-Za-z0-9]{14}$/.test(input.id || "")) throw new Failure("Invalid document.", 400);
        record = await call(`${base}/${input.id}`);
        if (record.fields?.Deleted === true) throw new Failure("This document was deleted. Refresh Documents.", 409);
        const current = documentView(record);
        if (!input.expected || input.expected.fileId !== (current.file?.id || null) || input.expected.visible !== current.visible || input.expected.replacedAt !== current.replaced.at) throw new Failure("This document changed. Refresh Documents before continuing.", 409);
      }
      if (record && input.expected) {
        const current = documentView(record);
        if ((input.action === "edit" || "name" in input.expected) && (input.expected.name !== current.name || input.expected.filename !== (current.file?.name || ""))) throw new Failure("This document changed. Refresh Documents before continuing.", 409);
      }
      const timestamp = now().toISOString();
      const audit = prefix => ({ [`${prefix} at`]: timestamp, [`${prefix} by user ID`]: actor.id, [`${prefix} by email`]: actor.email });
      let fields;
      if (input.action === "edit") {
        if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 200) throw new Failure("Enter a name up to 200 characters.", 400);
        const current = documentView(record);
        if (typeof input.filename !== "string" || (current.file && (!input.filename.trim() || input.filename.length > 255 || /[\\/\x00-\x1f]/.test(input.filename))) || (!current.file && input.filename !== "")) throw new Failure("Enter a valid file name up to 255 characters.", 400);
        const filename = input.filename.trim();
        const extension = value => value.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() || "";
        if (current.file && extension(filename) !== extension(current.file.name)) throw new Failure("Keep the existing file extension.", 400);
        if (input.name.trim() === current.name && filename === (current.file?.name || "")) throw new Failure("No changes to save.", 400);
        fields = { Name: input.name.trim() };
        // Re-ingest the existing attachment under its new name; never trust a URL from the browser.
        if (current.file && filename !== current.file.name) fields.File = record.fields.File.map((attachment, index) => index === 0 ? { url: current.file.url, filename } : { id: attachment.id });
      }
      if (input.action === "delete") fields = { Deleted: true, ...audit("Deleted") };
      if (input.action === "visibility") {
        if (typeof input.visible !== "boolean") throw new Failure("Invalid visibility.", 400);
        fields = { "Visible to partner": input.visible };
      }
      if (["create", "replace"].includes(input.action)) {
        if (input.action === "create" && (typeof input.name !== "string" || !input.name.trim() || input.name.length > 200 || typeof input.visible !== "boolean")) throw new Failure("Enter a name up to 200 characters and choose visibility.", 400);
        const upload = uploadFile(input);
        // Private temporary storage keeps the current Airtable file intact until one final write.
        const existing = await admin.storage.getBucket(bucket);
        if (existing.error) {
          const created = await admin.storage.createBucket(bucket, { public: false, fileSizeLimit: limit });
          if (created.error && !(await admin.storage.getBucket(bucket)).data) throw new Error("Storage unavailable");
        } else if (existing.data.public) throw new Error("Staging bucket must be private");
        const path = `${actor.id}/${crypto.randomUUID()}/${input.filename}`;
        const storage = admin.storage.from(bucket);
        checked(await storage.upload(path, upload.bytes, { contentType: upload.type, upsert: false }));
        const signed = checked(await storage.createSignedUrl(path, 3600));
        fields = { File: [{ url: signed.signedUrl, filename: input.filename }] };
        if (input.action === "create") Object.assign(fields, { Name: input.name.trim(), "Visible to partner": input.visible, Deleted: false, "Created by user ID": actor.id, "Created by email": actor.email });
        else Object.assign(fields, audit("Replaced"));
        attemptedWrite = true;
        record = await call(input.action === "create" ? base : `${base}/${input.id}`, { method: input.action === "create" ? "POST" : "PATCH", body: JSON.stringify({ fields }) });
        // Keep staging if Airtable has not confirmed ingestion. URLs expire after an hour.
        if (!record.fields?.File?.[0]?.id || record.fields.File[0].filename !== input.filename || record.fields.File[0].error) throw new Error("Attachment ingestion not confirmed");
        if (!record.fields.File[0].url?.includes("/storage/v1/")) await storage.remove([path]).catch(() => {});
      } else {
        attemptedWrite = true;
        record = await call(`${base}/${input.id}`, { method: "PATCH", body: JSON.stringify({ fields }) });
      }
      if (!record?.id) throw new Error("Missing record");
      if (input.action === "edit" && (record.fields?.Name !== input.name.trim() || (fields.File && (!record.fields.File?.[0]?.id || record.fields.File[0].filename !== input.filename.trim() || record.fields.File[0].error)))) throw new Error("Rename not confirmed");
      return json({ document: documentView(record) });
    } catch (error) {
      return json({ error: error instanceof Failure ? error.message : attemptedWrite ? "Unable to confirm the change. Refresh Documents to check the result before trying again." : "Documents are currently unavailable. Please try again later.", uncertain: attemptedWrite }, error instanceof Failure ? error.status : 502);
    }
  };
}
