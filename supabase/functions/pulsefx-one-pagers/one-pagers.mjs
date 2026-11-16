export async function loadOnePagers({ env, call }) {
  if (!env.AIRTABLE_ONE_PAGERS_TABLE_ID) throw new Error("One-pagers table is not configured");
  const assets = [];
  const seenOffsets = new Set();
  let pages = 0;
  let offset;
  do {
    if (++pages > 100 || (offset && seenOffsets.has(offset))) throw new Error("Invalid pagination");
    if (offset) seenOffsets.add(offset);
    const url = new URL(`https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(env.AIRTABLE_ONE_PAGERS_TABLE_ID)}`);
    url.searchParams.set("filterByFormula", "AND({Visible to partner}=1,NOT({Deleted}))");
    url.searchParams.set("sort[0][field]", "Sort order");
    url.searchParams.set("sort[0][direction]", "asc");
    if (offset) url.searchParams.set("offset", offset);
    const response = await call(url, { headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` } });
    if (!response.ok) throw new Error("One-pagers unavailable");
    const page = await response.json();
    if (!Array.isArray(page.records)) throw new Error("Invalid one-pagers");
    for (const record of page.records) {
      const fields = record.fields || {};
      const file = fields.File?.[0];
      const name = fields.Name;
      if (fields["Visible to partner"] !== true || fields.Deleted === true || typeof name !== "string" || !name.trim() || !file?.url || !file.filename) continue;
      if (!/^https:\/\//i.test(file.url)) continue;
      assets.push({ id: record.id, name, description: typeof fields.Description === "string" ? fields.Description : "", file: { name: file.filename, url: file.url } });
    }
    offset = page.offset;
    if (assets.length > 1000) throw new Error("Too many one-pagers");
  } while (offset);
  return assets;
}
