import test from "node:test";
import assert from "node:assert/strict";
import { createSupportHandler } from "./service.mjs";
const partnerId = "rec12345678901234";
const env = { SUPABASE_URL: "https://project.test", SUPABASE_ANON_KEY: "public", AIRTABLE_TOKEN: "private", AIRTABLE_BASE_ID: "app12345678901234", AIRTABLE_SUPPORT_TABLE_ID: "tblDf8Yt2cSMHPoSl" };
const reply = (body, status = 200) => Response.json(body, { status });
function setup({ authStatus = 200, membership = true, partnerStatus = 200, writeStatus = 200, writeThrows = false, missingReference = false } = {}) {
  const writes = [];
  const handler = createSupportHandler({ env, fetchImpl: async (url, options = {}) => {
    const path = String(url);
    if (path.includes('/auth/v1/user')) return reply({ id: 'user-id', email: 'current@example.test' }, authStatus);
    if (path.includes('/rest/v1/partner_memberships')) return reply(membership ? [{ partner_id: partnerId }] : []);
    if (path.endsWith('/' + partnerId)) return reply({ id: partnerId, fields: { Contact: 'Partner Contact', Name: 'Company' } }, partnerStatus);
    assert.ok(path.endsWith('/tblDf8Yt2cSMHPoSl'));
    writes.push(JSON.parse(options.body));
    if (writeThrows) throw new Error('secret upstream details');
    return reply({ id: 'recABCDEFGHIJKLMN', fields: missingReference ? {} : { 'Support ID': 'SUP-000001' } }, writeStatus);
  } });
  const request = (body = { subject: ' Question ', message: ' Need help ' }, headers = { Authorization: 'Bearer live-token' }) => handler(new Request('https://edge.test', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }));
  return { handler, request, writes };
}
test('creates support with trusted identity and returns only the reference', async () => {
  const { request, writes } = setup(); const response = await request();
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { request: { supportId: 'SUP-000001', status: 'Received' } });
  assert.deepEqual(writes, [{ fields: { 'Partner Airtable ID': partnerId, 'Supabase user ID': 'user-id', 'Client name': 'Partner Contact', Email: 'current@example.test', Source: 'Partner', Subject: 'Question', Message: 'Need help', Status: 'Received' } }]);
});
test('preflight works; unsupported methods and anonymous calls cannot write', async () => {
  const {handler, request, writes} = setup();
  assert.equal((await handler(new Request('https://edge.test',{method:'OPTIONS'}))).status,204);
  assert.equal((await handler(new Request('https://edge.test'))).status,405);
  assert.equal((await request(undefined, {})).status,401); assert.equal(writes.length,0);
});
test('invalid session and disabled/unlinked partner cannot write', async () => {
  for (const options of [{authStatus:401},{authStatus:403},{membership:false}]) {
    const {request,writes}=setup(options); const r=await request(); assert.ok([401,403].includes(r.status));assert.equal(writes.length,0);
  }
});
test('rejects forged identity, source, status, response and malformed or excessive content', async () => {
  const { request, writes } = setup();
  for (const extra of ['Email','partnerId','Source','Status','Response','Responded by user ID']) assert.equal((await request({subject:'Hi',message:'Help',[extra]:'forged'})).status,400);
  for (const body of ['{',null,[],{subject:' ',message:'Hi'},{subject:'a'.repeat(201),message:'Hi'},{subject:'Hi',message:'a'.repeat(10001)}]) assert.equal((await request(body)).status,400);
  assert.equal((await request('a'.repeat(24001))).status,413);assert.equal(writes.length,0);
});
test('missing configuration fails before upstream requests', async () => {
  const handler=createSupportHandler({env:{},fetchImpl:()=>assert.fail('unexpected fetch')});
  assert.equal((await handler(new Request('https://edge.test',{method:'POST',headers:{Authorization:'Bearer token'}}))).status,503);
});
test('partner lookup failure is safe to retry and never writes', async () => {
 const {request,writes}=setup({partnerStatus:404});const response=await request();assert.equal(response.status,502);assert.equal((await response.json()).uncertain,false);assert.equal(writes.length,0);
});
test('failed or ambiguous writes never auto-retry or expose upstream errors', async () => {
 for(const options of [{writeThrows:true},{writeStatus:422},{missingReference:true}]) {const {request,writes}=setup(options);const response=await request();const body=await response.json();assert.equal(response.status,502);assert.equal(body.uncertain,true);assert.ok(!body.error.includes('secret'));assert.equal(writes.length,1);}
});
