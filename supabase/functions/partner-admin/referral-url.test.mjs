import test from 'node:test';
import assert from 'node:assert/strict';
import { createPartnerAdminHandler } from './service.mjs';
const id = '11111111-1111-4111-8111-111111111111';
const partnerId = 'recAAAAAAAAAAAAAA';
function setup(options = {}) {
  const calls = [];
  const handler = createPartnerAdminHandler({
    env: { AIRTABLE_TOKEN: 'private', AIRTABLE_BASE_ID: 'base', AIRTABLE_PARTNERS_TABLE_ID: 'partners_api' },
    auth: { getUser: async () => ({ data: { user: { id: 'admin', app_metadata: { role: options.role || 'partner_admin' } } } }) },
    store: { verifyAdminSession: async () => !options.invalidSession, list: async () => options.missing ? [] : [{ id, partner_id: options.unlinked ? null : partnerId }] },
    fetchImpl: async (url, init) => {
      calls.push(url); assert.equal(init.headers.Authorization, 'Bearer private');
      return Response.json({ id: options.mismatch ? 'recBBBBBBBBBBBBBB' : partnerId, fields: { 'Referral URL': options.url ?? 'https://portal.example/?ref=signed' } });
    },
  });
  return { calls, run: () => handler(new Request(`https://edge.example?referralUrlFor=${id}`, { headers: { Authorization: 'Bearer session' } })) };
}
test('admin reads the saved partner referral URL without changing Airtable', async () => {
  const s = setup(); const response = await s.run(); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { referralUrl: 'https://portal.example/?ref=signed' });
  assert.ok(s.calls[0].endsWith(`/partners_api/${partnerId}`));
});
test('non-admin and expired admin sessions cannot read URLs', async () => {
  for (const options of [{ role: 'partner' }, { invalidSession: true }]) {
    const s = setup(options); assert.ok((await s.run()).status >= 400); assert.equal(s.calls.length, 0);
  }
});
test('missing partners and mismatched or unsafe Airtable values fail safely', async () => {
  for (const options of [{ missing: true }, { mismatch: true }, { url: 'javascript:alert(1)' }]) assert.ok((await setup(options).run()).status >= 400);
});
test('unlinked partners and partners with no saved URL return an empty value', async () => {
  for (const options of [{ unlinked: true }, { url: '' }]) assert.deepEqual(await (await setup(options).run()).json(), { referralUrl: '' });
});
