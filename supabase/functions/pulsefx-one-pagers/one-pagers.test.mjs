import test from "node:test";
import assert from "node:assert/strict";
import { loadOnePagers } from "./one-pagers.mjs";

test("uses Airtable Name verbatim and excludes records without Name", async () => {
  const file = [{ filename: "guide.pdf", url: "https://files.test/guide.pdf" }];
  const records = [
    { id: "name", fields: { "Visible to partner": true, Name: "Guide (PDF)", Title: "Old title", File: file } },
    { id: "title", fields: { "Visible to partner": true, Title: "Original guide", File: file } },
    { id: "empty-name", fields: { "Visible to partner": true, Name: "", Title: "Another guide", File: file } },
    { id: "deleted", fields: { "Visible to partner": true, Deleted: true, Name: "Deleted guide", File: file } },
    { id: "draft", fields: { Name: "Draft", File: file } },
    { id: "missing-file", fields: { "Visible to partner": true, Name: "Missing file" } },
  ];
  const result = await loadOnePagers({
    env: { AIRTABLE_BASE_ID: "appTest", AIRTABLE_ONE_PAGERS_TABLE_ID: "tblTest", AIRTABLE_TOKEN: "secret" },
    call: async url => {
      assert.equal(url.searchParams.get("filterByFormula"), "AND({Visible to partner}=1,NOT({Deleted}))");
      return Response.json({ records });
    },
  });
  assert.deepEqual(result.map(item => [item.id, item.name]), [
    ["name", "Guide (PDF)"],
  ]);
});
