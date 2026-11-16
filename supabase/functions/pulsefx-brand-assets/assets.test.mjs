import test from "node:test";
import assert from "node:assert/strict";
import { loadBrandAssets } from "./assets.mjs";
const env = { AIRTABLE_BASE_ID: "app123", AIRTABLE_TOKEN: "private", AIRTABLE_BRAND_ASSETS_TABLE_ID: "tblAssets" };
test("lists active assets with files across pages without exposing internal fields", async () => {
  let requests = 0;
  const assets = await loadBrandAssets({ env, call: async url => {
    requests++;
    assert.equal(url.searchParams.get("filterByFormula"), "AND({Visible to partner}=1,NOT({Deleted}))");
    assert.equal(url.searchParams.get("sort[0][field]"), "Display order");
    if (requests === 1) return Response.json({ records: [{ id: "recAsset", fields: { Name: "Logo", "Visible to partner": true, Internal: "secret", File: [{ filename: "logo.png", url: "https://files.test/logo" }] } }], offset: "next" });
    assert.equal(url.searchParams.get("offset"), "next");
    return Response.json({ records: [{ id: "recDeleted", fields: { "Visible to partner": true, Deleted: true, Name: "Deleted", File: [{ filename: "deleted.pdf", url: "https://files.test/deleted" }] } }, { id: "recInactive", fields: { "Visible to partner": false, Name: "Hidden", File: [{ filename: "hidden.png", url: "https://files.test/hidden" }] } }, { fields: { Name: "Missing file", "Visible to partner": true } }] });
  } });
  assert.deepEqual(assets, [{ id: "recAsset", name: "Logo", file: { name: "logo.png", url: "https://files.test/logo" } }]);
});
test("missing configuration and Airtable failures do not produce fake empty success", async () => {
  await assert.rejects(loadBrandAssets({ env: {}, call: () => { throw new Error("Must not call"); } }));
  await assert.rejects(loadBrandAssets({ env, call: async () => new Response(null, { status: 403 }) }));
});
