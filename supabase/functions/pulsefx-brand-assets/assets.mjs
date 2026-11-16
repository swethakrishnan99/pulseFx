export async function loadBrandAssets({ env, call }) {
  if (!env.AIRTABLE_BRAND_ASSETS_TABLE_ID) throw new Error("Brand assets table is not configured");
  const assets = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(env.AIRTABLE_BRAND_ASSETS_TABLE_ID)}`);
    url.searchParams.set("filterByFormula", "AND({Visible to partner}=1,NOT({Deleted}))");
    url.searchParams.set("sort[0][field]", "Display order");
    url.searchParams.set("sort[0][direction]", "asc");
    if (offset) url.searchParams.set("offset", offset);
    const response = await call(url, { headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` } });
    if (!response.ok) throw new Error("Brand assets unavailable");
    const page = await response.json();
    if (!Array.isArray(page.records)) throw new Error("Invalid brand assets");
    for (const record of page.records) {
      const fields = record.fields || {};
      const file = fields.File?.[0];
      if (fields["Visible to partner"] !== true || fields.Deleted === true || typeof fields.Name !== "string" || !file?.url || !file.filename) continue;
      if (!/^https:\/\//i.test(file.url)) continue;
      assets.push({ id: record.id, name: fields.Name, file: { name: file.filename, url: file.url } });
    }
    offset = page.offset;
    if (assets.length > 1000) throw new Error("Too many brand assets");
  } while (offset);
  return assets;
}
